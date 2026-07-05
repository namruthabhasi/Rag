"""
Vercel serverless function entrypoint for the PrecisionRAG FastAPI backend.

Vercel Python runtime requires the ASGI/WSGI app to be importable
from api/index.py as a module-level variable called `app`.

We add the backend directory to sys.path so that all existing
backend modules (config, database, services.*) can be imported
without any changes.
"""
import sys
import os

# Make the backend directory importable from this api/ shim
_backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(_backend_dir))

# Import the FastAPI app — this triggers all startup logic
from main import app  # noqa: E402, F401  (re-exported for Vercel)

# Vercel picks up `app` automatically from this module.
