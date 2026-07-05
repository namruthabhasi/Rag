"""
Phase 3 + 4 — Retrieval & Generation Pipeline

Query flow:
  1. Query Analysis + Identifier Detection
  2. Metadata Pre-Filter (optional)
  3. Dense Retrieval (Qdrant cosine similarity)
  4. Sparse Retrieval (BM25)
  5. Hybrid Fusion via Reciprocal Rank Fusion (RRF)
  6. Cohere Rerank v3
  7. Context Construction
  8. Gemini 2.5 Flash — Grounded Answer Generation
"""
import logging
import re
import time
import uuid
from typing import Any, Dict, List, Tuple

import cohere
from google import genai

from config import get_settings
from database import get_db

logger = logging.getLogger(__name__)
_settings = get_settings()


# ---------------------------------------------------------------------------
# Identifier patterns (same set as metadata_extractor)
# ---------------------------------------------------------------------------
_IDENTIFIER_PATTERNS = [
    r"\bArticle\s+\d+[-–]\w+\b",
    r"\bClause\s+\d+(?:\.\d+)+\b",
    r"\bSection\s+\d+(?:\.\d+)+\b",
    r"\bINV[-–]\d{4}[-–]\d+\b",
    r"\bSKU[-–][A-Z0-9]+-[A-Z0-9]+\b",
    r"\bISO[-–]\d+(?:[-–](?:Section[-–])?[\d.]+)?\b",
    r"\bRFC[-–]\d{4}\b",
    r"\bPROD[-–][A-Z0-9]{3,}\b",
]


def detect_identifiers(query: str) -> List[str]:
    found = []
    for pat in _IDENTIFIER_PATTERNS:
        matches = re.findall(pat, query, re.IGNORECASE)
        for m in matches:
            if m not in found:
                found.append(m)
    return found


# ---------------------------------------------------------------------------
# Step 1: Embed the query
# ---------------------------------------------------------------------------
def embed_query(query: str) -> List[float]:
    client = genai.Client(api_key=_settings.gemini_api_key)
    response = client.models.embed_content(
        model=_settings.embedding_model,
        contents=[query],
    )
    return response.embeddings[0].values


# ---------------------------------------------------------------------------
# Step 2: Dense Retrieval (Qdrant)
# ---------------------------------------------------------------------------
def dense_search(
    query_vector: List[float],
    top_k: int,
    metadata_filter: Dict | None = None,
) -> List[Dict[str, Any]]:
    qdrant, _, _ = get_db()

    query_filter = None
    if metadata_filter:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        conditions = [
            FieldCondition(key=k, match=MatchValue(value=v))
            for k, v in metadata_filter.items()
        ]
        query_filter = Filter(must=conditions)

    results = qdrant.search(
        collection_name=_settings.collection_name,
        query_vector=query_vector,
        limit=top_k,
        query_filter=query_filter,
        with_payload=True,
    )

    return [
        {
            "point_id": str(r.id),
            "score": float(r.score),
            "text": r.payload.get("text", ""),
            "doc_name": r.payload.get("doc_name", ""),
            "doc_id": r.payload.get("doc_id", ""),
            "chunk_index": int(r.payload.get("chunk_index", 0)),
            "metadata": {k: v for k, v in r.payload.items() if k not in ("text",)},
        }
        for r in results
    ]


# ---------------------------------------------------------------------------
# Step 3: Sparse Retrieval (BM25)
# ---------------------------------------------------------------------------
def sparse_search(query: str, top_k: int) -> List[Dict[str, Any]]:
    _, bm25, meta_store = get_db()
    results = bm25.search(query, top_k=top_k)
    enriched = []
    for r in results:
        chunk_meta = meta_store.get_chunk(r["point_id"]) or {}
        enriched.append(
            {
                "point_id": r["point_id"],
                "score": r["score"],
                "text": r["text"],
                "doc_name": chunk_meta.get("doc_name", ""),
                "doc_id": chunk_meta.get("doc_id", ""),
                "chunk_index": int(chunk_meta.get("chunk_index", 0)),
                "metadata": chunk_meta,
            }
        )
    return enriched


# ---------------------------------------------------------------------------
# Step 4: Hybrid Fusion — Reciprocal Rank Fusion
# ---------------------------------------------------------------------------
def reciprocal_rank_fusion(
    dense_results: List[Dict],
    sparse_results: List[Dict],
    dense_weight: float,
    sparse_weight: float,
    k: int = 60,
) -> List[Dict[str, Any]]:
    """
    Combine dense and sparse results using weighted RRF scores.
    """
    scores: Dict[str, float] = {}
    meta_map: Dict[str, Dict] = {}

    for rank, r in enumerate(dense_results):
        pid = r["point_id"]
        scores[pid] = scores.get(pid, 0.0) + dense_weight * (1.0 / (k + rank + 1))
        meta_map[pid] = r

    for rank, r in enumerate(sparse_results):
        pid = r["point_id"]
        scores[pid] = scores.get(pid, 0.0) + sparse_weight * (1.0 / (k + rank + 1))
        if pid not in meta_map:
            meta_map[pid] = r

    sorted_pids = sorted(scores.keys(), key=lambda p: scores[p], reverse=True)
    fused = []
    for pid in sorted_pids:
        entry = dict(meta_map[pid])
        entry["hybrid_score"] = round(scores[pid], 6)
        fused.append(entry)
    return fused


# ---------------------------------------------------------------------------
# Step 5: Cohere Rerank
# ---------------------------------------------------------------------------
def cohere_rerank(
    query: str,
    candidates: List[Dict[str, Any]],
    top_k: int,
) -> Tuple[List[Dict[str, Any]], List[Dict]]:
    """
    Rerank candidates using Cohere Rerank v3.
    Returns (reranked_list, raw_rerank_scores).
    """
    if not candidates:
        return [], []

    co = cohere.ClientV2(api_key=_settings.cohere_api_key)
    docs = [c["text"] for c in candidates]

    response = co.rerank(
        model="rerank-v3.5",
        query=query,
        documents=docs,
        top_n=top_k,
    )

    reranked = []
    raw_scores = []
    for r in response.results:
        item = dict(candidates[r.index])
        item["rerank_score"] = round(r.relevance_score, 6)
        reranked.append(item)
        raw_scores.append({"point_id": item["point_id"], "score": item["rerank_score"]})

    return reranked, raw_scores


# ---------------------------------------------------------------------------
# Step 6: Gemini Answer Generation
# ---------------------------------------------------------------------------
_GROUNDED_PROMPT_TEMPLATE = """\
You are an intelligent Retrieval-Augmented Generation assistant for PrecisionRAG.

Use ONLY the retrieved context below to answer the user's question.

Rules:
1. Never answer from your own training knowledge.
2. Never repeat or echo the user's question.
3. Never hallucinate or fabricate identifiers, numbers, or names.
4. If the answer is not found in the retrieved context, reply ONLY:
   "I could not find enough information in the uploaded documents to answer this question."
5. When multiple chunks contain relevant information, combine them into one coherent answer.
6. Always cite the source document names used in your answer (e.g., "Based on [document_name]...").
7. Be concise, accurate, and direct.

========================
Retrieved Context:

{context}
========================

Question:
{question}

========================
Answer (based only on the retrieved context):"""


def generate_answer(query: str, top_chunks: List[Dict[str, Any]]) -> Tuple[str, str, int]:
    """
    Call Gemini 2.5 Flash with the retrieved context and return:
      (answer_text, full_prompt, token_count)
    """
    if not top_chunks:
        no_ctx = "I could not find enough information in the uploaded documents to answer this question."
        prompt = _GROUNDED_PROMPT_TEMPLATE.format(
            context="NO RELEVANT CONTEXT FOUND IN THE DATABASE.",
            question=query,
        )
        return no_ctx, prompt, len(prompt.split())

    context_blocks = []
    for chunk in top_chunks:
        block = f"Document: {chunk['doc_name']}\nChunk {chunk['chunk_index']}:\n\n{chunk['text']}"
        context_blocks.append(block)

    context_str = "\n\n---\n\n".join(context_blocks)
    prompt = _GROUNDED_PROMPT_TEMPLATE.format(context=context_str, question=query)

    client = genai.Client(api_key=_settings.gemini_api_key)
    response = client.models.generate_content(
        model=_settings.llm_model,
        contents=prompt,
    )
    answer = response.text.strip()
    token_count = len(prompt.split())  # Approximate; Gemini API returns usage metadata too

    return answer, prompt, token_count


# ---------------------------------------------------------------------------
# Main Pipeline Entry Point
# ---------------------------------------------------------------------------
def run_rag_pipeline(
    query: str,
    mode: str = "hybrid-rerank",
    top_k: int | None = None,
) -> Dict[str, Any]:
    """
    Execute the full RAG pipeline and return a structured result
    matching the shape expected by the frontend.
    """
    start = time.perf_counter()
    top_k = top_k or _settings.top_k
    pipeline_timings: Dict[str, int] = {}

    # --- Step 0: Identifier Detection ---
    t0 = time.perf_counter()
    detected_identifiers = detect_identifiers(query)
    pipeline_timings["identifier_detection"] = _ms(t0)

    # --- Step 1: Metadata Filtering ---
    t1 = time.perf_counter()
    metadata_filter: Dict[str, str] = {}
    # Build a simple filter if identifiers suggest a known category
    # (future: LLM-based filter extraction)
    pipeline_timings["metadata_filter"] = _ms(t1)

    # --- Step 2: Embed Query ---
    t2 = time.perf_counter()
    query_vector = embed_query(query)
    pipeline_timings["embed_query"] = _ms(t2)

    # --- Step 3: Dense Search ---
    dense_results: List[Dict] = []
    t3 = time.perf_counter()
    if mode in ("vector", "hybrid", "hybrid-rerank"):
        dense_results = dense_search(query_vector, top_k=top_k * 2, metadata_filter=metadata_filter or None)
    pipeline_timings["dense_search"] = _ms(t3)

    # --- Step 4: Sparse Search ---
    sparse_results: List[Dict] = []
    t4 = time.perf_counter()
    if mode in ("bm25", "hybrid", "hybrid-rerank"):
        sparse_results = sparse_search(query, top_k=top_k * 2)
    pipeline_timings["sparse_search"] = _ms(t4)

    # --- Step 5: Fusion ---
    t5 = time.perf_counter()
    if mode == "vector":
        fused = dense_results[:top_k]
        for r in fused:
            r["hybrid_score"] = r["score"]
    elif mode == "bm25":
        fused = sparse_results[:top_k]
        for r in fused:
            r["hybrid_score"] = r["score"]
    else:
        fused = reciprocal_rank_fusion(
            dense_results,
            sparse_results,
            dense_weight=_settings.dense_weight,
            sparse_weight=_settings.bm25_weight,
        )[: top_k * 2]
    pipeline_timings["hybrid_fusion"] = _ms(t5)

    # --- Step 6: Reranking ---
    rerank_scores: List[Dict] = []
    t6 = time.perf_counter()
    if mode == "hybrid-rerank" and fused:
        fused, rerank_scores = cohere_rerank(query, fused, top_k=top_k)
    else:
        fused = fused[:top_k]
    pipeline_timings["reranking"] = _ms(t6)

    top_chunks = fused[:top_k]

    # --- Step 7: Answer Generation ---
    t7 = time.perf_counter()
    answer, full_prompt, token_count = generate_answer(query, top_chunks)
    llm_time = _ms(t7)
    pipeline_timings["llm_generation"] = llm_time

    total_ms = _ms(start)

    # --- Build hybrid score display for debug panel ---
    hybrid_scores_display = [
        {"chunkId": r["point_id"], "score": round(r.get("hybrid_score", 0), 4)}
        for r in fused
    ]

    # --- Map chunks to frontend shape ---
    retrieved_chunks = []
    for r in top_chunks:
        retrieved_chunks.append(
            {
                "id": r["point_id"],
                "documentId": r["doc_id"],
                "documentName": r["doc_name"],
                "text": r["text"],
                "similarity": round(r.get("score", 0), 4) if mode in ("vector", "bm25") else round(r.get("hybrid_score", 0), 4),
                "bm25Score": round(r.get("score", 0), 2) if mode == "bm25" else 0.0,
                "hybridScore": round(r.get("hybrid_score", r.get("score", 0)), 4),
                "matchedMetadata": r.get("metadata", {}),
                "explanation": f"Retrieved via {mode} pipeline.",
                "chunkIndex": r["chunk_index"],
            }
        )

    # --- Build pipeline nodes for frontend ---
    pipeline_nodes = _build_pipeline_nodes(
        query=query,
        mode=mode,
        detected_identifiers=detected_identifiers,
        metadata_filter=metadata_filter,
        dense_count=len(dense_results),
        sparse_count=len(sparse_results),
        top_k=top_k,
        timings=pipeline_timings,
    )

    result_id = str(uuid.uuid4())

    return {
        "id": result_id,
        "query": query,
        "mode": mode,
        "answer": answer,
        "confidence": _confidence(top_chunks, mode),
        "processingTimeMs": total_ms,
        "documentsUsedCount": len({r["doc_id"] for r in top_chunks}),
        "retrievedChunks": retrieved_chunks,
        "pipelineNodes": pipeline_nodes,
        "timestamp": _now_iso(),
        # Developer Debug Panel fields
        "fullPromptSent": full_prompt,
        "tokenCount": token_count,
        "llmResponseTimeMs": llm_time,
        "detectedIdentifiers": detected_identifiers,
        "metadataFiltersApplied": metadata_filter,
        "denseSearchResults": [
            {
                "id": r["point_id"],
                "documentName": r["doc_name"],
                "similarity": round(r["score"], 4),
                "bm25Score": 0.0,
                "hybridScore": round(r["score"], 4),
                "text": r["text"],
                "chunkIndex": r["chunk_index"],
                "documentId": r["doc_id"],
                "matchedMetadata": r.get("metadata", {}),
                "explanation": "Dense result",
            }
            for r in dense_results[:top_k]
        ],
        "bm25SearchResults": [
            {
                "id": r["point_id"],
                "documentName": r["doc_name"],
                "similarity": 0.0,
                "bm25Score": round(r["score"], 2),
                "hybridScore": round(r["score"], 2),
                "text": r["text"],
                "chunkIndex": r["chunk_index"],
                "documentId": r["doc_id"],
                "matchedMetadata": r.get("metadata", {}),
                "explanation": "BM25 result",
            }
            for r in sparse_results[:top_k]
        ],
        "hybridScores": hybrid_scores_display,
        "rerankerScores": rerank_scores,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _confidence(top_chunks: List[Dict], mode: str) -> float:
    if not top_chunks:
        return 0.1
    top = top_chunks[0]
    if mode == "hybrid-rerank":
        score = top.get("rerank_score", top.get("hybrid_score", 0))
    elif mode == "vector":
        score = top.get("score", 0)
    else:
        score = top.get("hybrid_score", top.get("score", 0))
    # Normalize to 0–1 range
    return round(min(1.0, max(0.1, float(score))), 3)


def _build_pipeline_nodes(
    query: str,
    mode: str,
    detected_identifiers: List[str],
    metadata_filter: Dict,
    dense_count: int,
    sparse_count: int,
    top_k: int,
    timings: Dict[str, int],
) -> List[Dict]:
    nodes = [
        {
            "name": "Query Input",
            "status": "completed",
            "durationMs": 1,
            "input": query,
            "output": query,
        },
        {
            "name": "Identifier Detection",
            "status": "completed",
            "durationMs": timings.get("identifier_detection", 0),
            "input": query,
            "output": f"Detected: {detected_identifiers}" if detected_identifiers else "No identifiers found.",
            "details": {"matches": detected_identifiers},
        },
        {
            "name": "Metadata Extraction",
            "status": "completed",
            "durationMs": timings.get("metadata_filter", 0),
            "input": query,
            "output": f"Filter applied: {metadata_filter}" if metadata_filter else "No metadata pre-filter applied.",
            "details": {"filters": metadata_filter},
        },
        {
            "name": "Metadata Filtering",
            "status": "completed" if metadata_filter else "skipped",
            "durationMs": 0,
            "input": str(metadata_filter),
            "output": f"Pre-filtered by {list(metadata_filter.keys())}" if metadata_filter else "Skipped.",
        },
        {
            "name": "Dense Search",
            "status": "completed" if mode != "bm25" else "skipped",
            "durationMs": timings.get("dense_search", 0),
            "input": f"Query vector (dim={_settings.embedding_dimensions})",
            "output": f"Retrieved {dense_count} candidates from Qdrant." if mode != "bm25" else "Skipped.",
            "details": {"candidatesRetrieved": dense_count},
        },
        {
            "name": "Sparse BM25 Search",
            "status": "completed" if mode != "vector" else "skipped",
            "durationMs": timings.get("sparse_search", 0),
            "input": query,
            "output": f"Retrieved {sparse_count} candidates from BM25." if mode != "vector" else "Skipped.",
            "details": {"candidatesRetrieved": sparse_count},
        },
        {
            "name": "Hybrid Fusion (RRF)",
            "status": "completed" if mode in ("hybrid", "hybrid-rerank") else "skipped",
            "durationMs": timings.get("hybrid_fusion", 0),
            "input": f"Dense ({_settings.dense_weight}) + Sparse ({_settings.bm25_weight})",
            "output": f"Fused into ranked list." if mode in ("hybrid", "hybrid-rerank") else "Skipped.",
        },
        {
            "name": "Cross Encoder Reranking",
            "status": "completed" if mode == "hybrid-rerank" else "skipped",
            "durationMs": timings.get("reranking", 0),
            "input": f"Cohere Rerank v3.5 on top candidates",
            "output": f"Re-ranked to top {top_k}." if mode == "hybrid-rerank" else "Skipped.",
        },
        {
            "name": "Context Building",
            "status": "completed",
            "durationMs": 2,
            "input": f"{top_k} chunks selected",
            "output": f"Assembled {top_k} chunks into prompt context.",
        },
        {
            "name": "LLM Synthesis",
            "status": "completed",
            "durationMs": timings.get("llm_generation", 0),
            "input": "Grounded prompt with context",
            "output": "Answer generated via Gemini 2.5 Flash.",
        },
    ]
    return nodes
