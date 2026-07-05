"""
Local Cross-Encoder Reranker using sentence-transformers.

Model: cross-encoder/ms-marco-MiniLM-L-6-v2
  - Lightweight, fast, high-quality MS MARCO-trained cross-encoder
  - Runs fully locally on CPU (or GPU if available)
  - No external API keys required

The model is loaded ONCE at import time and reused for all requests.
"""
import logging
import time
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton model — loaded once at startup
# ---------------------------------------------------------------------------
_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
_reranker = None


def _get_reranker():
    """Lazily load the CrossEncoder model and cache it."""
    global _reranker
    if _reranker is None:
        logger.info("Loading CrossEncoder model: %s", _MODEL_NAME)
        t0 = time.perf_counter()
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(_MODEL_NAME)
        elapsed = round((time.perf_counter() - t0) * 1000)
        logger.info("CrossEncoder loaded in %dms", elapsed)
    return _reranker


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def rerank(
    query: str,
    candidates: List[Dict[str, Any]],
    top_k: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    Rerank candidate chunks using the local CrossEncoder model.

    Args:
        query:      The user's query string.
        candidates: List of chunk dicts, each must have a "text" key.
        top_k:      Number of top results to return.

    Returns:
        (reranked_chunks, raw_scores, latency_ms)
        - reranked_chunks: sorted by cross-encoder score (descending), limited to top_k
        - raw_scores:      list of {chunkId, score} dicts for the debug panel
        - latency_ms:      wall-clock time for inference
    """
    if not candidates:
        return [], [], 0

    model = _get_reranker()

    # Build (query, passage) pairs for the cross-encoder
    pairs = [(query, c["text"]) for c in candidates]

    t0 = time.perf_counter()
    scores = model.predict(pairs)          # returns numpy array of floats
    latency_ms = round((time.perf_counter() - t0) * 1000)

    # Attach scores and sort descending
    scored = sorted(
        zip(scores, candidates),
        key=lambda x: x[0],
        reverse=True,
    )

    reranked: List[Dict[str, Any]] = []
    raw_scores: List[Dict[str, Any]] = []

    for score, chunk in scored[:top_k]:
        item = dict(chunk)
        item["rerank_score"] = round(float(score), 6)
        reranked.append(item)
        raw_scores.append({
            "chunkId": chunk["point_id"],
            "score": round(float(score), 6),
        })

    logger.info(
        "CrossEncoder reranked %d → %d candidates in %dms (top score: %.4f)",
        len(candidates),
        len(reranked),
        latency_ms,
        raw_scores[0]["score"] if raw_scores else 0.0,
    )

    return reranked, raw_scores, latency_ms
