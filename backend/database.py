"""
Phase 2 — Database Layer
Manages:
  - Qdrant client (local disk or cloud)
  - BM25 index persistence
  - Metadata store (JSON file on disk)
"""
import json
import logging
import pickle
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
        data_dir = Path(_settings.qdrant_data_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Using local Qdrant storage at: %s", data_dir)
        return QdrantClient(path=str(data_dir))


def ensure_collection(client: QdrantClient) -> None:
    """Create the Qdrant collection if it does not already exist."""
    existing = [c.name for c in client.get_collections().collections]
    if _settings.collection_name not in existing:
        client.create_collection(
            collection_name=_settings.collection_name,
            vectors_config=qdrant_models.VectorParams(
                size=_settings.embedding_dimensions,
                distance=qdrant_models.Distance.COSINE,
            ),
        )
        logger.info("Created Qdrant collection '%s'.", _settings.collection_name)
    else:
        logger.debug("Qdrant collection '%s' already exists.", _settings.collection_name)


# ---------------------------------------------------------------------------
# BM25 Persistence
# ---------------------------------------------------------------------------

class BM25Store:
    """
    Wraps rank-bm25 with disk persistence.
    Stores: tokenized corpus + point_ids aligned to corpus order.
    """

    def __init__(self):
        self._corpus: List[List[str]] = []   # tokenized chunks
        self._texts: List[str] = []          # raw chunk texts
        self._point_ids: List[str] = []      # Qdrant point IDs (aligned)
        self._bm25: Optional[BM25Okapi] = None
        self._index_path = Path(_settings.bm25_index_path)
        self._load()

    def _load(self) -> None:
        if self._index_path.exists():
            try:
                with open(self._index_path, "rb") as f:
                    data = pickle.load(f)
                self._corpus = data["corpus"]
                self._texts = data["texts"]
                self._point_ids = data["point_ids"]
                if self._corpus:
                    self._bm25 = BM25Okapi(self._corpus)
                logger.info("BM25 index loaded (%d documents).", len(self._corpus))
            except Exception as e:
                logger.warning("Failed to load BM25 index: %s. Starting fresh.", e)
        else:
            logger.info("No BM25 index found. Starting fresh.")

    def _save(self) -> None:
        self._index_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._index_path, "wb") as f:
            pickle.dump(
                {"corpus": self._corpus, "texts": self._texts, "point_ids": self._point_ids},
                f,
            )

    def _rebuild(self) -> None:
        if self._corpus:
            self._bm25 = BM25Okapi(self._corpus)
        else:
            self._bm25 = None

    def add(self, texts: List[str], point_ids: List[str]) -> None:
        for text, pid in zip(texts, point_ids):
            tokens = text.lower().split()
            self._corpus.append(tokens)
            self._texts.append(text)
            self._point_ids.append(pid)
        self._rebuild()
        self._save()

    def remove_by_doc_id(self, doc_id: str, metadata_store: "MetadataStore") -> None:
        """Remove all chunks belonging to a document."""
        # Find point_ids for this doc_id
        doc_point_ids = {
            pid
            for pid, meta in metadata_store.get_all_chunks().items()
            if meta.get("doc_id") == doc_id
        }
        keep_indices = [
            i for i, pid in enumerate(self._point_ids) if pid not in doc_point_ids
        ]
        self._corpus = [self._corpus[i] for i in keep_indices]
        self._texts = [self._texts[i] for i in keep_indices]
        self._point_ids = [self._point_ids[i] for i in keep_indices]
        self._rebuild()
        self._save()

    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        if not self._bm25 or not self._corpus:
            return []
        tokens = query.lower().split()
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True
        )[:top_k]
        results = []
        for idx, score in ranked:
            if score > 0:
                results.append(
                    {"point_id": self._point_ids[idx], "score": float(score), "text": self._texts[idx]}
                )
        return results

    @property
    def size(self) -> int:
        return len(self._corpus)


# ---------------------------------------------------------------------------
# Metadata Store
# ---------------------------------------------------------------------------

class MetadataStore:
    """
    A simple JSON file–backed store mapping Qdrant point_id → chunk metadata.
    Also stores document-level records keyed by doc_id.
    """

    def __init__(self):
        self._path = Path(_settings.metadata_store_path)
        self._data: Dict[str, Any] = {"documents": {}, "chunks": {}}
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                with open(self._path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
                logger.info(
                    "Metadata store loaded: %d docs, %d chunks.",
                    len(self._data.get("documents", {})),
                    len(self._data.get("chunks", {})),
                )
            except Exception as e:
                logger.warning("Failed to load metadata store: %s. Starting fresh.", e)

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    # Documents
    def upsert_document(self, doc_id: str, doc_record: Dict[str, Any]) -> None:
        self._data.setdefault("documents", {})[doc_id] = doc_record
        self._save()

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self._data.get("documents", {}).get(doc_id)

    def get_all_documents(self) -> Dict[str, Any]:
        return self._data.get("documents", {})

    def delete_document(self, doc_id: str) -> None:
        self._data.get("documents", {}).pop(doc_id, None)
        # Remove associated chunks
        self._data["chunks"] = {
            pid: meta
            for pid, meta in self._data.get("chunks", {}).items()
            if meta.get("doc_id") != doc_id
        }
        self._save()

    # Chunks
    def upsert_chunk(self, point_id: str, chunk_meta: Dict[str, str]) -> None:
        self._data.setdefault("chunks", {})[point_id] = chunk_meta
        self._save()

    def get_chunk(self, point_id: str) -> Optional[Dict[str, str]]:
        return self._data.get("chunks", {}).get(point_id)

    def get_all_chunks(self) -> Dict[str, Any]:
        return self._data.get("chunks", {})

    def get_chunks_for_doc(self, doc_id: str) -> List[str]:
        """Return all point_ids belonging to a document."""
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

    if _metadata_store is None:
        _metadata_store = MetadataStore()

    return _qdrant_client, _bm25_store, _metadata_store
