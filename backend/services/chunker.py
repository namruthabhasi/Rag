"""
Phase 2 — Text Chunker
Splits extracted document text into overlapping chunks using tiktoken.
Chunk size: 500 tokens / Overlap: 100 tokens
"""
import re
import logging
from dataclasses import dataclass, field
from typing import List

import tiktoken

logger = logging.getLogger(__name__)

# Use cl100k_base tokenizer (compatible with modern GPT / Gemini text)
_TOKENIZER = tiktoken.get_encoding("cl100k_base")


@dataclass
class TextChunk:
    chunk_index: int
    text: str
    token_count: int
    char_start: int
    char_end: int


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> List[TextChunk]:
    """
    Split text into overlapping chunks by token count.
    Returns a list of TextChunk objects.
    """
    tokens = _TOKENIZER.encode(text)
    total_tokens = len(tokens)

    if total_tokens == 0:
        return []

    chunks: List[TextChunk] = []
    start = 0
    chunk_index = 0

    while start < total_tokens:
        end = min(start + chunk_size, total_tokens)
        chunk_tokens = tokens[start:end]
        chunk_text_str = _TOKENIZER.decode(chunk_tokens)

        # Approximate character positions for metadata
        char_start = len(_TOKENIZER.decode(tokens[:start]))
        char_end = char_start + len(chunk_text_str)

        chunks.append(
            TextChunk(
                chunk_index=chunk_index,
                text=chunk_text_str.strip(),
                token_count=len(chunk_tokens),
                char_start=char_start,
                char_end=char_end,
            )
        )

        chunk_index += 1

        if end == total_tokens:
            break

        # Slide window forward by (chunk_size - overlap)
        start += chunk_size - chunk_overlap

    logger.debug(f"Chunked text into {len(chunks)} chunks ({total_tokens} tokens total).")
    return chunks
