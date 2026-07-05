from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # API Keys
    gemini_api_key: str = ""
    qdrant_url: str = ""
    qdrant_api_key: str = ""

    # Storage paths
    upload_dir: str = "./uploads"
    qdrant_data_dir: str = "./qdrant_data"
    collection_name: str = "precision_rag"
    bm25_index_path: str = "./bm25_index.pkl"
    metadata_store_path: str = "./metadata_store.json"

    # Retrieval defaults
    chunk_size: int = 500
    chunk_overlap: int = 100
    top_k: int = 6
    dense_weight: float = 0.6
    bm25_weight: float = 0.4
    # gemini-embedding-001 is the correct model for google-genai SDK v1.x (v1beta API)
    # text-embedding-004 is only available on v1 API, not v1beta used by this SDK
    embedding_model: str = "gemini-embedding-001"
    llm_model: str = "gemini-2.5-flash"
    # Using 768 via output_dimensionality (MRL) — keeps Qdrant collection compatible
    embedding_dimensions: int = 768

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
