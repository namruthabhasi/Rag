"""
PrecisionRAG — FastAPI Backend
Serves all retrieval, ingestion, and analytics endpoints.
"""
import logging
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
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

# Use system temp directory for uploads — safe on ephemeral filesystems (Railway)
UPLOAD_DIR = Path(tempfile.gettempdir()) / "rag_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="PrecisionRAG API",
    description="Production Retrieval-Augmented Generation backend.",
    version="1.0.0",
)

# CORS — allow Vite dev server and any deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB singletons on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing database connections...")
    get_db()
    logger.info("PrecisionRAG backend ready.")


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
        doc_count = len(meta_store.get_all_documents())
        chunk_count = bm25.size
        return {
            "status": "ok",
            "qdrant": "connected",
            "bm25_chunks": chunk_count,
            "indexed_documents": doc_count,
            "embedding_model": _settings.embedding_model,
            "llm_model": _settings.llm_model,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Backend not ready: {str(e)}")


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Accept a file upload, save it to a temp location, and immediately return a
    'processing' document record. Ingestion runs as a background task so the
    request is not held open (Railway has a 30-second timeout).
    """
    allowed_extensions = {".pdf", ".docx", ".txt", ".csv", ".json"}
    suffix = Path(file.filename or "file").suffix.lower()

    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(allowed_extensions)}",
        )

    doc_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}{suffix}"

    # Save uploaded file to temp disk immediately
    try:
        content = await file.read()
        save_path.write_bytes(content)
        logger.info("Saved upload: %s (%d bytes)", save_path, len(content))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Build a placeholder 'processing' record and register it in the metadata store
    # so the frontend can see it while ingestion runs in the background.
    _, _, meta_store = get_db()
    processing_record = {
        "id": doc_id,
        "name": file.filename or save_path.name,
        "type": suffix.lstrip(".").upper(),
        "chunksCount": 0,
        "identifiers": [],
        "uploadDate": datetime.now(timezone.utc).isoformat(),
        "status": "processing",
        "sizeBytes": len(content),
        "metadata": {},
        "processingTimeMs": 0,
    }
    meta_store.upsert_document(doc_id, processing_record)

    # Schedule real ingestion to run after the response is sent
    background_tasks.add_task(
        _run_ingestion_background,
        save_path=save_path,
        file_name=file.filename or save_path.name,
        doc_id=doc_id,
    )

    return {"success": True, "document": processing_record}


def _run_ingestion_background(save_path: Path, file_name: str, doc_id: str):
    """Run the full ingestion pipeline in the background and update the document status."""
    _, _, meta_store = get_db()
    try:
        doc_record = ingest_document(
            file_path=save_path,
            file_name=file_name,
            doc_id=doc_id,
        )
        # Update the existing record with the fully indexed one
        meta_store.upsert_document(doc_id, doc_record)
        logger.info("Background ingestion complete for doc_id=%s", doc_id)
    except Exception as e:
        logger.error("Background ingestion failed for %s: %s", file_name, e)
        # Mark the document as failed so the frontend can reflect that
        existing = meta_store.get_document(doc_id) or {}
        existing["status"] = "failed"
        existing["error"] = str(e)
        meta_store.upsert_document(doc_id, existing)
    finally:
        save_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------
@app.get("/api/documents")
async def list_documents():
    """Return all indexed documents."""
    _, _, meta_store = get_db()
    docs = list(meta_store.get_all_documents().values())
    # Sort newest first
    docs.sort(key=lambda d: d.get("uploadDate", ""), reverse=True)
    return {"documents": docs, "total": len(docs)}


@app.delete("/api/documents/{doc_id}")
async def delete_document_endpoint(doc_id: str):
    """Delete a document and all its indexed chunks."""
    _, _, meta_store = get_db()
    if not meta_store.get_document(doc_id):
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
    try:
        _delete_document(doc_id)
        return DeleteResponse(success=True, message=f"Document '{doc_id}' deleted.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------
@app.post("/api/query")
async def query_endpoint(request: QueryRequest):
    """
    Run the full RAG pipeline and return a structured result.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    valid_modes = {"vector", "bm25", "hybrid", "hybrid-rerank"}
    if request.mode not in valid_modes:
        raise HTTPException(
            status_code=400, detail=f"Invalid mode. Must be one of: {valid_modes}"
        )

    try:
        result = run_rag_pipeline(
            query=request.query,
            mode=request.mode,
            top_k=request.top_k,
        )
        return result
    except Exception as e:
        logger.error("Query pipeline error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@app.get("/api/analytics")
async def analytics():
    """Return system-level metrics."""
    qdrant, bm25, meta_store = get_db()
    docs = meta_store.get_all_documents()
    chunks = meta_store.get_all_chunks()

    total_chunks = bm25.size
    total_docs = len(docs)
    total_identifiers = sum(
        len(d.get("identifiers", [])) for d in docs.values()
    )

    # Aggregate processing time stats
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
