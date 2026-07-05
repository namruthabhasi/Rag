"""
PrecisionRAG — FastAPI Backend
Serves all retrieval, ingestion, and analytics endpoints.
"""
import logging
import tempfile
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import get_settings
from database import get_db
from services.ingestion import ingest_document, delete_document as _delete_document
from services.retrieval import run_rag_pipeline

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_settings = get_settings()

# Use system temp directory for uploads — safe on Railway's ephemeral filesystem
UPLOAD_DIR = Path(tempfile.gettempdir()) / "rag_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# In-process job tracker
# Stores per-document ingestion progress so the frontend gets real stage data.
# Structure: { doc_id: { stage, percent, error, stages: [...] } }
# ---------------------------------------------------------------------------
_jobs: Dict[str, Dict[str, Any]] = {}

INGESTION_STAGES = [
    "Reading Document",
    "Extracting Text",
    "Chunking",
    "Extracting Metadata",
    "Generating Embeddings",
    "Updating BM25",
    "Uploading to Qdrant",
    "Completed",
]


def _init_job(doc_id: str) -> None:
    _jobs[doc_id] = {
        "status": "processing",
        "stage": "Reading Document",
        "percent": 0,
        "error": None,
        "stages": [
            {"name": s, "status": "pending"} for s in INGESTION_STAGES
        ],
    }
    _jobs[doc_id]["stages"][0]["status"] = "running"


def _advance_job(doc_id: str, stage_index: int) -> None:
    job = _jobs.get(doc_id)
    if not job:
        return
    stages = job["stages"]
    # Mark previous stages completed
    for i in range(stage_index):
        stages[i]["status"] = "completed"
    # Mark current stage running
    if stage_index < len(stages):
        stages[stage_index]["status"] = "running"
        job["stage"] = stages[stage_index]["name"]
    job["percent"] = round((stage_index / len(INGESTION_STAGES)) * 100)


def _complete_job(doc_id: str) -> None:
    job = _jobs.get(doc_id)
    if not job:
        return
    for s in job["stages"]:
        s["status"] = "completed"
    job["status"] = "completed"
    job["stage"] = "Completed"
    job["percent"] = 100


def _fail_job(doc_id: str, error: str) -> None:
    job = _jobs.get(doc_id)
    if not job:
        return
    job["status"] = "failed"
    job["error"] = error
    # Mark the currently running stage as failed
    for s in job["stages"]:
        if s["status"] == "running":
            s["status"] = "failed"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PrecisionRAG API",
    description="Production Retrieval-Augmented Generation backend.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("PrecisionRAG startup — initialising DB connections...")
    try:
        get_db()
        logger.info("DB ready.")
    except Exception as exc:
        logger.error("DB startup failed: %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    query: str
    mode: str = "hybrid-rerank"
    top_k: Optional[int] = None


class DeleteResponse(BaseModel):
    success: bool
    message: str


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def basic_health():
    return {"status": "healthy"}


@app.get("/api/health")
async def health():
    try:
        qdrant, bm25, meta_store = get_db()
        return {
            "status": "ok",
            "qdrant": "connected",
            "bm25_chunks": bm25.size,
            "indexed_documents": len(meta_store.get_all_documents()),
            "embedding_model": _settings.embedding_model,
            "llm_model": _settings.llm_model,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Backend not ready: {exc}")


# ---------------------------------------------------------------------------
# Job Status — real-time ingestion progress
# ---------------------------------------------------------------------------
@app.get("/api/job/{doc_id}")
async def job_status(doc_id: str):
    """Return real-time ingestion progress for a document."""
    job = _jobs.get(doc_id)
    if not job:
        # Might be a doc from a previous process restart; check metadata store
        _, _, meta_store = get_db()
        doc = meta_store.get_document(doc_id)
        if doc:
            status = doc.get("status", "indexed")
            return {
                "status": status,
                "stage": "Completed" if status == "indexed" else status,
                "percent": 100 if status == "indexed" else 0,
                "error": doc.get("error"),
                "stages": [
                    {"name": s, "status": "completed" if status == "indexed" else "pending"}
                    for s in INGESTION_STAGES
                ],
            }
        raise HTTPException(status_code=404, detail=f"Job '{doc_id}' not found.")
    return job


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Save the uploaded file to a temp location, register a 'processing'
    document record, and schedule ingestion as a BackgroundTask.
    Returns immediately so Railway's 30-second request timeout is never hit.
    """
    allowed_extensions = {".pdf", ".docx", ".txt", ".csv", ".json"}
    suffix = Path(file.filename or "file").suffix.lower()

    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(allowed_extensions))}",
        )

    doc_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}{suffix}"

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        save_path.write_bytes(content)
        logger.info("Saved upload %s — %d bytes (%s)", doc_id, len(content), file.filename)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    _, _, meta_store = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    processing_record: Dict[str, Any] = {
        "id": doc_id,
        "name": file.filename or save_path.name,
        "type": suffix.lstrip(".").upper(),
        "chunksCount": 0,
        "identifiers": [],
        "uploadDate": now_iso,
        "status": "processing",
        "sizeBytes": len(content),
        "metadata": {},
        "processingTimeMs": 0,
    }
    meta_store.upsert_document(doc_id, processing_record)
    _init_job(doc_id)

    background_tasks.add_task(
        _run_ingestion_background,
        save_path=save_path,
        file_name=file.filename or save_path.name,
        doc_id=doc_id,
    )

    return {"success": True, "document": processing_record}


def _run_ingestion_background(save_path: Path, file_name: str, doc_id: str) -> None:
    """
    Full ingestion pipeline — runs after the HTTP response is sent.
    Updates _jobs[doc_id] at every stage so the frontend gets real progress.
    All exceptions are logged with full tracebacks to Railway logs.
    """
    _, _, meta_store = get_db()
    start_time = datetime.now(timezone.utc)

    try:
        # Stage 0: Reading Document (file already saved)
        _advance_job(doc_id, 0)
        logger.info("[%s] Stage 0/7 — Reading document '%s'", doc_id, file_name)

        # Stage 1: Extracting Text
        _advance_job(doc_id, 1)
        logger.info("[%s] Stage 1/7 — Extracting text", doc_id)
        from services.parser import parse_document
        raw_text = parse_document(save_path, file_name)
        logger.info("[%s] Extracted %d characters", doc_id, len(raw_text))

        # Stage 2: Chunking
        _advance_job(doc_id, 2)
        logger.info("[%s] Stage 2/7 — Chunking text", doc_id)
        from services.chunker import chunk_text
        chunks = chunk_text(raw_text, _settings.chunk_size, _settings.chunk_overlap)
        if not chunks:
            raise ValueError(f"No text chunks produced for '{file_name}'. File may be empty or image-only.")
        logger.info("[%s] Created %d chunks", doc_id, len(chunks))

        # Stage 3: Extracting Metadata
        _advance_job(doc_id, 3)
        logger.info("[%s] Stage 3/7 — Extracting metadata", doc_id)
        from services.metadata_extractor import (
            extract_identifiers,
            extract_metadata_from_filename,
            build_chunk_metadata,
        )
        doc_metadata = extract_metadata_from_filename(file_name)
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

        # Stage 4: Generating Embeddings
        _advance_job(doc_id, 4)
        logger.info("[%s] Stage 4/7 — Generating embeddings for %d chunks", doc_id, len(chunk_texts))
        from services.ingestion import embed_texts
        vectors = embed_texts(chunk_texts)
        logger.info("[%s] Generated %d embedding vectors", doc_id, len(vectors))

        # Stage 5: Updating BM25
        _advance_job(doc_id, 5)
        logger.info("[%s] Stage 5/7 — Updating BM25 index", doc_id)
        qdrant, bm25, meta_store = get_db()
        bm25.add(texts=chunk_texts, point_ids=point_ids)
        for pid, meta in zip(point_ids, chunk_meta_list):
            meta_store.upsert_chunk(pid, meta)

        # Stage 6: Uploading to Qdrant
        _advance_job(doc_id, 6)
        logger.info("[%s] Stage 6/7 — Upserting %d vectors to Qdrant", doc_id, len(vectors))
        upload_ts = datetime.now(timezone.utc).isoformat()
        size_bytes = save_path.stat().st_size if save_path.exists() else 0
        from qdrant_client.models import PointStruct
        points = [
            PointStruct(
                id=pid,
                vector=vec,
                payload={
                    **meta,
                    "text": text,
                    "upload_date": upload_ts,
                    "size_bytes": size_bytes,
                },
            )
            for pid, vec, meta, text in zip(point_ids, vectors, chunk_meta_list, chunk_texts)
        ]
        qdrant.upsert(collection_name=_settings.collection_name, points=points)

        # Stage 7: Completed
        elapsed_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        doc_record: Dict[str, Any] = {
            "id": doc_id,
            "name": file_name,
            "type": doc_metadata.get("file_type", "TXT"),
            "chunksCount": len(chunks),
            "identifiers": all_identifiers,
            "uploadDate": start_time.isoformat(),
            "status": "indexed",
            "sizeBytes": size_bytes,
            "metadata": doc_metadata,
            "processingTimeMs": elapsed_ms,
        }
        meta_store.upsert_document(doc_id, doc_record)
        _complete_job(doc_id)
        logger.info("[%s] Ingestion COMPLETE — %d chunks, %d identifiers, %dms", doc_id, len(chunks), len(all_identifiers), elapsed_ms)

    except Exception as exc:
        full_tb = traceback.format_exc()
        logger.error("[%s] Ingestion FAILED:\n%s", doc_id, full_tb)
        _fail_job(doc_id, str(exc))
        existing = meta_store.get_document(doc_id) or {}
        existing["status"] = "failed"
        existing["error"] = str(exc)
        meta_store.upsert_document(doc_id, existing)
    finally:
        save_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------
@app.get("/api/documents")
async def list_documents():
    _, _, meta_store = get_db()
    docs = list(meta_store.get_all_documents().values())
    docs.sort(key=lambda d: d.get("uploadDate", ""), reverse=True)
    return {"documents": docs, "total": len(docs)}


@app.delete("/api/documents/{doc_id}")
async def delete_document_endpoint(doc_id: str):
    _, _, meta_store = get_db()
    if not meta_store.get_document(doc_id):
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
    try:
        _delete_document(doc_id)
        _jobs.pop(doc_id, None)
        return DeleteResponse(success=True, message=f"Document '{doc_id}' deleted.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Deletion failed: {exc}")


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------
@app.post("/api/query")
async def query_endpoint(request: QueryRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    valid_modes = {"vector", "bm25", "hybrid", "hybrid-rerank"}
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Must be one of: {valid_modes}")
    try:
        result = run_rag_pipeline(
            query=request.query,
            mode=request.mode,
            top_k=request.top_k,
        )
        return result
    except Exception as exc:
        logger.error("Query pipeline error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {exc}")


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@app.get("/api/analytics")
async def analytics():
    qdrant, bm25, meta_store = get_db()
    docs = meta_store.get_all_documents()
    total_chunks = bm25.size
    total_docs = len(docs)
    total_identifiers = sum(len(d.get("identifiers", [])) for d in docs.values())
    times = [d.get("processingTimeMs", 0) for d in docs.values() if d.get("processingTimeMs")]
    avg_ingest_ms = round(sum(times) / len(times)) if times else 0
    return {
        "totalDocuments": total_docs,
        "totalChunks": total_chunks,
        "totalIdentifiers": total_identifiers,
        "avgIngestionTimeMs": avg_ingest_ms,
        "embeddingModel": _settings.embedding_model,
        "llmModel": _settings.llm_model,
        "qdrantCollection": _settings.collection_name,
        "bm25IndexSize": total_chunks,
    }
