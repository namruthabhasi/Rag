"""
Phase 2 — Ingestion Service
Orchestrates the full document ingestion pipeline:
  1. Parse document text
  2. Chunk into token-sized windows
  3. Extract metadata + identifiers per chunk
  4. Generate embeddings via gemini-embedding-001 (output_dimensionality=768)
  5. Upsert vectors into Qdrant
  6. Update BM25 index and MetadataStore
"""
import logging
import time
import uuid
from pathlib import Path
from typing import Dict, List, Any

from google import genai
from google.genai.types import EmbedContentConfig

from config import get_settings
from database import get_db
from services.parser import parse_document
from services.chunker import chunk_text
from services.metadata_extractor import (
    extract_identifiers,
    extract_metadata_from_filename,
    build_chunk_metadata,
)

logger = logging.getLogger(__name__)
_settings = get_settings()

# Singleton Gemini client — reused for all embedding calls
_gemini_client: genai.Client | None = None


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=_settings.gemini_api_key)
    return _gemini_client


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of texts using gemini-embedding-001.
    Uses output_dimensionality=768 (MRL) so vectors match the Qdrant collection.
    Batches requests to stay within API limits (max 100 per batch).
    """
    client = _get_gemini_client()
    embeddings: List[List[float]] = []
    batch_size = 50  # conservative batch size

    for i in range(0, len(texts), batch_size):
        batch = texts[i: i + batch_size]
        response = client.models.embed_content(
            model=_settings.embedding_model,
            contents=batch,
            config=EmbedContentConfig(
                output_dimensionality=_settings.embedding_dimensions,
            ),
        )
        for emb in response.embeddings:
            embeddings.append(list(emb.values))

    return embeddings


def ingest_document(
    file_path: Path,
    file_name: str,
    doc_id: str,
    extra_metadata: Dict[str, str] | None = None,
) -> Dict[str, Any]:
    """
    Run the full ingestion pipeline for a document file.
    Returns a summary record describing the indexed document.
    """
    qdrant, bm25, meta_store = get_db()
    start = time.perf_counter()

    # 1. Parse
    logger.info("[%s] Parsing document...", doc_id)
    raw_text = parse_document(file_path, file_name)

    # 2. Chunk
    logger.info("[%s] Chunking text...", doc_id)
    chunks = chunk_text(raw_text, _settings.chunk_size, _settings.chunk_overlap)
    if not chunks:
        raise ValueError(f"No text chunks produced for '{file_name}'.")

    # 3. Base metadata
    doc_metadata = extract_metadata_from_filename(file_name)
    if extra_metadata:
        doc_metadata.update(extra_metadata)

    # 4. Build per-chunk data
    chunk_texts = [c.text for c in chunks]
    point_ids = [str(uuid.uuid4()) for _ in chunks]
    all_identifiers: List[str] = []

    chunk_meta_list = []
    for i, (chunk, pid) in enumerate(zip(chunks, point_ids)):
        meta = build_chunk_metadata(
            doc_id=doc_id,
            doc_name=file_name,
            chunk_index=i,
            chunk_text=chunk.text,
            doc_metadata=doc_metadata,
        )
        chunk_meta_list.append(meta)
        for ident in extract_identifiers(chunk.text):
            if ident not in all_identifiers:
                all_identifiers.append(ident)

    # 5. Generate embeddings
    logger.info("[%s] Generating embeddings for %d chunks...", doc_id, len(chunk_texts))
    vectors = embed_texts(chunk_texts)

    # 6. Upsert into Qdrant
    logger.info("[%s] Upserting %d vectors into Qdrant...", doc_id, len(vectors))
    upload_date = _now_iso()
    size_bytes = file_path.stat().st_size
    from qdrant_client.models import PointStruct
    points = [
        PointStruct(
            id=pid,
            vector=vec,
            payload={
                **meta,
                "text": text,
                "upload_date": upload_date,
                "size_bytes": size_bytes,
            },
        )
        for pid, vec, meta, text in zip(point_ids, vectors, chunk_meta_list, chunk_texts)
    ]
    qdrant.upsert(collection_name=_settings.collection_name, points=points)

    # 7. Update BM25
    logger.info("[%s] Adding chunks to BM25 index...", doc_id)
    bm25.add(texts=chunk_texts, point_ids=point_ids)

    # 8. Save chunk metadata
    for pid, meta in zip(point_ids, chunk_meta_list):
        meta_store.upsert_chunk(pid, meta)

    elapsed = round((time.perf_counter() - start) * 1000)

    # 9. Build and save document record
    doc_record = {
        "id": doc_id,
        "name": file_name,
        "type": doc_metadata.get("file_type", "TXT"),
        "chunksCount": len(chunks),
        "identifiers": all_identifiers,
        "uploadDate": _now_iso(),
        "status": "indexed",
        "sizeBytes": file_path.stat().st_size,
        "metadata": doc_metadata,
        "processingTimeMs": elapsed,
    }
    meta_store.upsert_document(doc_id, doc_record)

    logger.info("[%s] Ingestion complete in %dms.", doc_id, elapsed)
    return doc_record


def delete_document(doc_id: str) -> None:
    """
    Remove a document and all its chunks from Qdrant, BM25, and MetadataStore.
    """
    qdrant, bm25, meta_store = get_db()

    # Get all point IDs for this doc
    point_ids = meta_store.get_chunks_for_doc(doc_id)

    if point_ids:
        # Delete from Qdrant
        from qdrant_client.models import PointIdsList
        qdrant.delete(
            collection_name=_settings.collection_name,
            points_selector=PointIdsList(points=point_ids),
        )

    # Remove from BM25
    bm25.remove_by_doc_id(doc_id, meta_store)

    # Remove from metadata store
    meta_store.delete_document(doc_id)

    logger.info("Deleted document '%s' (%d chunks removed).", doc_id, len(point_ids))


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
