"""
Phase 2 — Metadata Extractor
Extracts structured identifiers from document text using regex patterns.
Detects: Article/Clause/Section references, Invoice IDs, SKUs, ISO standards, RFC numbers, etc.
"""
import re
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

# Registry of identifier patterns
_IDENTIFIER_PATTERNS: List[Dict] = [
    {
        "name": "article_ref",
        "pattern": r"\bArticle\s+\d+[-–]\w+\b",
        "example": "Article 24-B",
    },
    {
        "name": "clause_ref",
        "pattern": r"\bClause\s+\d+(?:\.\d+)+\b",
        "example": "Clause 8.2",
    },
    {
        "name": "section_ref",
        "pattern": r"\bSection\s+\d+(?:\.\d+)+\b",
        "example": "Section 12.3",
    },
    {
        "name": "invoice_id",
        "pattern": r"\bINV[-–]\d{4}[-–]\d+\b",
        "example": "INV-2025-001",
    },
    {
        "name": "sku",
        "pattern": r"\bSKU[-–][A-Z0-9]+-[A-Z0-9]+\b",
        "example": "SKU-XP-998",
    },
    {
        "name": "iso_standard",
        "pattern": r"\bISO[-–]\d+(?:[-–](?:Section[-–])?[\d.]+)?\b",
        "example": "ISO-27001-Section-4.2",
    },
    {
        "name": "rfc_ref",
        "pattern": r"\bRFC[-–]\d{4}\b",
        "example": "RFC-7519",
    },
    {
        "name": "product_id",
        "pattern": r"\bPROD[-–][A-Z0-9]{3,}\b",
        "example": "PROD-AB123",
    },
    {
        "name": "regulation_ref",
        "pattern": r"\bRegulation\s+\([A-Z]+\)\s+\d+/\d+\b",
        "example": "Regulation (EU) 2016/679",
    },
    {
        "name": "employee_id",
        "pattern": r"\bEMP[-–]\d{4,}\b",
        "example": "EMP-45821",
    },
]


def extract_identifiers(text: str) -> List[str]:
    """
    Scan text and return a deduplicated list of all matched identifiers.
    """
    found: List[str] = []
    for spec in _IDENTIFIER_PATTERNS:
        matches = re.findall(spec["pattern"], text, re.IGNORECASE)
        for m in matches:
            if m not in found:
                found.append(m)
    return found


def extract_metadata_from_filename(filename: str) -> Dict[str, str]:
    """
    Infer basic metadata from the file name (type, name).
    """
    from pathlib import Path
    p = Path(filename)
    return {
        "source_filename": filename,
        "file_type": p.suffix.lstrip(".").upper(),
    }


def build_chunk_metadata(
    doc_id: str,
    doc_name: str,
    chunk_index: int,
    chunk_text: str,
    doc_metadata: Dict[str, str],
) -> Dict[str, str]:
    """
    Build the full metadata payload for a single chunk.
    Combines document-level metadata with per-chunk extracted identifiers.
    """
    identifiers = extract_identifiers(chunk_text)

    meta = {
        "doc_id": doc_id,
        "doc_name": doc_name,
        "chunk_index": str(chunk_index),
        "identifiers": ",".join(identifiers),
        **doc_metadata,
    }
    return meta
