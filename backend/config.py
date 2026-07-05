from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # API Keys
    gemini_api_key: str = ""
    cohere_api_key: str = ""
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
    embedding_model: str = "text-embedding-004"
    llm_model: str = "gemini-2.5-flash"
    embedding_dimensions: int = 768

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
