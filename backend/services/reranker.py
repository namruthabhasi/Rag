"""
Local Cross-Encoder Reranker using sentence-transformers.

Model: cross-encoder/ms-marco-MiniLM-L-6-v2
  - Lightweight, fast, high-quality MS MARCO-trained cross-encoder
  - Runs fully locally on CPU (or GPU if available)
  - No external API keys required

The model is loaded ONCE on first use and cached as a singleton.
If the model fails to load (e.g. download timeout on Railway), reranking
gracefully falls back to returning candidates sorted by hybrid score.
"""
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
_reranker = None
_reranker_failed = False  # set True permanently if load fails


def _get_reranker():
    """Lazily load the CrossEncoder model and cache it. Returns None on failure."""
    global _reranker, _reranker_failed
    if _reranker_failed:
        return None
    if _reranker is None:
        try:
            logger.info("Loading CrossEncoder model: %s", _MODEL_NAME)
            t0 = time.perf_counter()
            from sentence_transformers import CrossEncoder
            _reranker = CrossEncoder(_MODEL_NAME)
            elapsed = round((time.perf_counter() - t0) * 1000)
            logger.info("CrossEncoder loaded in %dms", elapsed)
        except Exception as exc:
            _reranker_failed = True
            logger.warning(
                "CrossEncoder model failed to load (%s). "
                "Reranking will be skipped — hybrid scores used instead.",
                exc,
            )
            return None
    return _reranker


def rerank(
    query: str,
    candidates: List[Dict[str, Any]],
    top_k: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    Rerank candidate chunks using the local CrossEncoder model.

    Falls back gracefully to hybrid-score ordering if the model is unavailable.

    Returns:
        (reranked_chunks, raw_scores, latency_ms)
    """
    if not candidates:
        return [], [], 0

    model = _get_reranker()

    # ── Fallback: model not available ────────────────────────────────────────
    if model is None:
        logger.info("Reranker unavailable — returning top-%d by hybrid score", top_k)
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.get("hybrid_score", c.get("score", 0)),
            reverse=True,
        )[:top_k]
        raw_scores = [
            {"chunkId": c["point_id"], "score": round(c.get("hybrid_score", 0), 6)}
            for c in sorted_candidates
        ]
        return sorted_candidates, raw_scores, 0

    # ── Normal path: CrossEncoder inference ──────────────────────────────────
    pairs = [(query, c["text"]) for c in candidates]

    t0 = time.perf_counter()
    try:
        scores = model.predict(pairs)
    except Exception as exc:
        logger.warning("CrossEncoder inference failed: %s — falling back", exc)
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.get("hybrid_score", c.get("score", 0)),
            reverse=True,
        )[:top_k]
        raw_scores = [
            {"chunkId": c["point_id"], "score": round(c.get("hybrid_score", 0), 6)}
            for c in sorted_candidates
        ]
        return sorted_candidates, raw_scores, 0

    latency_ms = round((time.perf_counter() - t0) * 1000)

    scored = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)

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
