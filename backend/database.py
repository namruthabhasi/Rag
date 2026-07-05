"""
Database Layer — Cloud-safe version
Manages:
  - Qdrant client (cloud via QDRANT_URL, or local disk for dev)
  - BM25 index (rebuilt from Qdrant payloads on startup — no local file needed)
  - Metadata store (rebuilt from Qdrant payloads on startup — no local file needed)

This design means Railway's ephemeral filesystem is not a problem:
every restart rebuilds state from Qdrant Cloud automatically.
"""
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient, models as qdrant_models
from rank_bm25 import BM25Okapi

from config import get_settings

logger = logging.getLogger(__name__)
_settings = get_settings()


# ---------------------------------------------------------------------------
# Qdrant
# ---------------------------------------------------------------------------

def get_qdrant_client() -> QdrantClient:
    """Return a Qdrant client — cloud if QDRANT_URL is set, otherwise local disk."""
    if _settings.qdrant_url:
        logger.info("Connecting to Qdrant Cloud: %s", _settings.qdrant_url)
        return QdrantClient(
            url=_settings.qdrant_url,
            api_key=_settings.qdrant_api_key or None,
        )
    else:
        # Use a temp directory so it always works even on read-only filesystems
        data_dir = Path(tempfile.gettempdir()) / "qdrant_data"
        data_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Using local Qdrant storage at: %s", data_dir)
        return QdrantClient(path=str(data_dir))


def ensure_collection(client: QdrantClient) -> None:
    """
    Ensure the Qdrant collection exists with the correct vector dimensions.
    If a collection exists but has mismatched dimensions (e.g. after a model change),
    it is automatically deleted and recreated so uploads never fail silently.
    """
    import google.genai as _genai_module
    logger.info(
        "Startup info — google-genai SDK: %s | embedding model: %s | "
        "embedding dimensions: %d | Qdrant collection: %s",
        getattr(_genai_module, "__version__", "unknown"),
        _settings.embedding_model,
        _settings.embedding_dimensions,
        _settings.collection_name,
    )

    existing = {c.name: c for c in client.get_collections().collections}

    if _settings.collection_name in existing:
        # Verify dimensions match — recreate if they don't
        try:
            info = client.get_collection(_settings.collection_name)
            existing_size = info.config.params.vectors.size
            if existing_size != _settings.embedding_dimensions:
                logger.warning(
                    "Qdrant collection '%s' has %d dimensions but config requires %d. "
                    "Recreating collection (all existing vectors will be lost).",
                    _settings.collection_name, existing_size, _settings.embedding_dimensions,
                )
                client.delete_collection(_settings.collection_name)
                # Fall through to create below
            else:
                logger.info(
                    "Qdrant collection '%s' OK — %d dimensions.",
                    _settings.collection_name, existing_size,
                )
                return
        except Exception as e:
            logger.warning("Could not verify collection dimensions: %s. Recreating.", e)
            client.delete_collection(_settings.collection_name)

    client.create_collection(
        collection_name=_settings.collection_name,
        vectors_config=qdrant_models.VectorParams(
            size=_settings.embedding_dimensions,
            distance=qdrant_models.Distance.COSINE,
        ),
    )
    logger.info(
        "Created Qdrant collection '%s' with %d dimensions.",
        _settings.collection_name, _settings.embedding_dimensions,
    )


# ---------------------------------------------------------------------------
# BM25 — rebuilt from Qdrant payloads (no local file)
# ---------------------------------------------------------------------------

class BM25Store:
    """
    Wraps rank-bm25. State is held in memory and rebuilt from Qdrant on startup.
    No pickle file is written, making this safe for ephemeral filesystems.
    """

    def __init__(self):
        self._corpus: List[List[str]] = []
        self._texts: List[str] = []
        self._point_ids: List[str] = []
        self._bm25: Optional[BM25Okapi] = None

    def bootstrap_from_qdrant(self, client: QdrantClient) -> None:
        """Scroll all points from Qdrant and rebuild the in-memory BM25 index."""
        logger.info("Bootstrapping BM25 index from Qdrant...")
        offset = None
        total = 0
        while True:
            results, next_offset = client.scroll(
                collection_name=_settings.collection_name,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for point in results:
                text = (point.payload or {}).get("text", "")
                pid = str(point.id)
                if text:
                    self._corpus.append(text.lower().split())
                    self._texts.append(text)
                    self._point_ids.append(pid)
                    total += 1
            if next_offset is None:
                break
            offset = next_offset
        self._rebuild()
        logger.info("BM25 bootstrap complete: %d chunks loaded.", total)

    def _rebuild(self) -> None:
        self._bm25 = BM25Okapi(self._corpus) if self._corpus else None

    def add(self, texts: List[str], point_ids: List[str]) -> None:
        for text, pid in zip(texts, point_ids):
            self._corpus.append(text.lower().split())
            self._texts.append(text)
            self._point_ids.append(pid)
        self._rebuild()

    def remove_by_doc_id(self, doc_id: str, metadata_store: "MetadataStore") -> None:
        """Remove all chunks belonging to a document."""
        doc_point_ids = {
            pid
            for pid, meta in metadata_store.get_all_chunks().items()
            if meta.get("doc_id") == doc_id
        }
        keep = [i for i, pid in enumerate(self._point_ids) if pid not in doc_point_ids]
        self._corpus = [self._corpus[i] for i in keep]
        self._texts = [self._texts[i] for i in keep]
        self._point_ids = [self._point_ids[i] for i in keep]
        self._rebuild()

    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        if not self._bm25 or not self._corpus:
            return []
        tokens = query.lower().split()
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:top_k]
        return [
            {"point_id": self._point_ids[idx], "score": float(score), "text": self._texts[idx]}
            for idx, score in ranked
            if score > 0
        ]

    @property
    def size(self) -> int:
        return len(self._corpus)


# ---------------------------------------------------------------------------
# Metadata Store — rebuilt from Qdrant payloads (no local JSON file)
# ---------------------------------------------------------------------------

class MetadataStore:
    """
    In-memory store rebuilt from Qdrant on startup.
    Documents are re-synthesised from chunk payloads so no separate JSON file
    is needed — safe for ephemeral filesystems like Railway.
    """

    def __init__(self):
        self._data: Dict[str, Any] = {"documents": {}, "chunks": {}}

    def bootstrap_from_qdrant(self, client: QdrantClient) -> None:
        """Scroll all Qdrant points and rebuild documents + chunks in memory."""
        logger.info("Bootstrapping MetadataStore from Qdrant...")
        offset = None
        while True:
            results, next_offset = client.scroll(
                collection_name=_settings.collection_name,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for point in results:
                payload = point.payload or {}
                pid = str(point.id)

                # Rebuild chunk record
                chunk_meta = {k: v for k, v in payload.items() if k != "text"}
                self._data["chunks"][pid] = chunk_meta

                # Rebuild document record (last write wins — all chunks share same doc meta)
                doc_id = payload.get("doc_id")
                if doc_id and doc_id not in self._data["documents"]:
                    self._data["documents"][doc_id] = {
                        "id": doc_id,
                        "name": payload.get("doc_name", "Unknown"),
                        "type": payload.get("file_type", "TXT"),
                        "status": "indexed",
                        "uploadDate": payload.get("upload_date", ""),
                        "sizeBytes": payload.get("size_bytes", 0),
                        "metadata": {
                            k: v for k, v in payload.items()
                            if k not in ("doc_id", "doc_name", "text", "chunk_index", "upload_date", "size_bytes")
                        },
                        "identifiers": [],
                        "chunksCount": 0,
                        "processingTimeMs": 0,
                    }

            if next_offset is None:
                break
            offset = next_offset

        # Count chunks per document
        for pid, meta in self._data["chunks"].items():
            doc_id = meta.get("doc_id")
            if doc_id and doc_id in self._data["documents"]:
                self._data["documents"][doc_id]["chunksCount"] += 1

        logger.info(
            "MetadataStore bootstrap complete: %d docs, %d chunks.",
            len(self._data["documents"]),
            len(self._data["chunks"]),
        )

    # --- Documents ---
    def upsert_document(self, doc_id: str, doc_record: Dict[str, Any]) -> None:
        self._data.setdefault("documents", {})[doc_id] = doc_record

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self._data.get("documents", {}).get(doc_id)

    def get_all_documents(self) -> Dict[str, Any]:
        return self._data.get("documents", {})

    def delete_document(self, doc_id: str) -> None:
        self._data.get("documents", {}).pop(doc_id, None)
        self._data["chunks"] = {
            pid: meta
            for pid, meta in self._data.get("chunks", {}).items()
            if meta.get("doc_id") != doc_id
        }

    # --- Chunks ---
    def upsert_chunk(self, point_id: str, chunk_meta: Dict[str, str]) -> None:
        self._data.setdefault("chunks", {})[point_id] = chunk_meta

    def get_chunk(self, point_id: str) -> Optional[Dict[str, str]]:
        return self._data.get("chunks", {}).get(point_id)

    def get_all_chunks(self) -> Dict[str, Any]:
        return self._data.get("chunks", {})

    def get_chunks_for_doc(self, doc_id: str) -> List[str]:
        return [
            pid
            for pid, meta in self._data.get("chunks", {}).items()
            if meta.get("doc_id") == doc_id
        ]


# ---------------------------------------------------------------------------
# Singletons (lazily initialized)
# ---------------------------------------------------------------------------

_qdrant_client: Optional[QdrantClient] = None
_bm25_store: Optional[BM25Store] = None
_metadata_store: Optional[MetadataStore] = None


def get_db():
    """Return initialized (qdrant_client, bm25_store, metadata_store) tuple."""
    global _qdrant_client, _bm25_store, _metadata_store

    if _qdrant_client is None:
        _qdrant_client = get_qdrant_client()
        ensure_collection(_qdrant_client)

    if _bm25_store is None:
        _bm25_store = BM25Store()
        _bm25_store.bootstrap_from_qdrant(_qdrant_client)

    if _metadata_store is None:
        _metadata_store = MetadataStore()
        _metadata_store.bootstrap_from_qdrant(_qdrant_client)

    return _qdrant_client, _bm25_store, _metadata_store
