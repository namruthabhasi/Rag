# PrecisionRAG - Intelligent RAG Retrieval System

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini%20API-4285F4?logo=google&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant%20Cloud-DC244C)
![BM25](https://img.shields.io/badge/Retrieval-BM25-orange)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)
![Railway](https://img.shields.io/badge/Backend-Railway-purple)

[Live Demo](https://rag-sable-five.vercel.app/) | [API Documentation](https://rag-production-30be.up.railway.app/docs)

A production-ready, full-stack Retrieval-Augmented Generation (RAG) application designed to improve document retrieval by combining semantic search with exact identifier matching. PrecisionRAG is built to handle structured references such as legal article numbers, invoice IDs, employee IDs, product SKUs, and other identifiers that can be difficult for traditional vector search to retrieve accurately.

## Features

* Hybrid Retrieval: Combines dense vector search and BM25 sparse retrieval to handle both semantic queries and exact keyword or identifier searches.
* Identifier-Aware Retrieval: Detects structured identifiers such as article numbers, invoice IDs, and product SKUs to improve retrieval precision.
* Metadata Extraction and Filtering: Extracts relevant document metadata and uses it to narrow retrieval results.
* Cross-Encoder Reranking: Reranks retrieved candidates based on query-document relevance before generating the final response.
* Document Ingestion Pipeline: Processes uploaded documents through text extraction, chunking, metadata extraction, embedding generation, BM25 indexing, and Qdrant vector storage.
* AI-Powered Answers: Uses Gemini to generate grounded responses from retrieved document context.
* Document Management: Upload, monitor, search, and manage indexed documents through an interactive dashboard.
* Retrieval Pipeline Monitoring: Provides visibility into the different stages of document ingestion and query processing.
* Cloud Deployment: Frontend and backend are deployed independently using Vercel and Railway, with Qdrant Cloud used for persistent vector storage.

## Tech Stack

* Frontend: React, TypeScript, Vite, Tailwind CSS
* Backend: Python, FastAPI
* AI and LLM: Google Gemini API
* Embeddings: Gemini Embedding
* Vector Database: Qdrant Cloud
* Sparse Retrieval: BM25
* Reranking: Cross-Encoder
* Deployment: Vercel and Railway

## How It Works

### Document Ingestion

```text
Document Upload
      |
      v
Text Extraction
      |
      v
Chunking
      |
      v
Metadata Extraction
      |
      v
Gemini Embeddings
      |
      v
BM25 Indexing
      |
      v
Qdrant Vector Storage
      |
      v
Document Ready
```

### Query Pipeline

```text
User Query
      |
      v
Identifier Detection
      |
      v
Metadata Filtering
      |
      v
Dense Vector Search + BM25 Search
      |
      v
Hybrid Retrieval
      |
      v
Cross-Encoder Reranking
      |
      v
Relevant Context
      |
      v
Gemini
      |
      v
Grounded Answer
```

## Getting Started

### Prerequisites

* Python 3.10 or higher
* Node.js 20 or higher
* npm
* Gemini API key
* Qdrant Cloud account and API credentials

### Installation

1. Clone the repository

```bash
git clone https://github.com/namruthabhasi/Rag.git
cd Rag
```

2. Install frontend dependencies

```bash
npm install
```

3. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

4. Configure the required environment variables

```env
GEMINI_API_KEY=your_gemini_api_key
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
```

5. Start the backend

```bash
uvicorn main:app --reload
```

6. Start the frontend from the project root

```bash
npm run dev
```

7. Open the application in your browser using the URL provided by Vite.

## Building for Production

Build the frontend using:

```bash
npm run build
```

The optimized production files will be generated in the dist directory.

The backend can be deployed independently using a production ASGI server such as Uvicorn.

## Deployment

PrecisionRAG uses a cloud-based architecture.

```text
React + Vite
     |
     v
Vercel
     |
     v
FastAPI Backend
     |
     v
Railway
     |
     +----------------+
     |                |
     v                v
  Gemini         Qdrant Cloud
```

### Live Demo

https://rag-sable-five.vercel.app/

### Backend API

https://rag-production-30be.up.railway.app/

### API Documentation

https://rag-production-30be.up.railway.app/docs

## Example Queries

PrecisionRAG is designed to handle both semantic and exact-identifier queries.

```text
Explain Article 24-B

Find invoice INV-2025-001

What is SKU-XP-998?

Who is EMP-45821?

How many annual leave days are available?

Which technologies are used in the PrecisionRAG project?
```

## Project Structure

```text
Rag/
|
+-- backend/
|   +-- services/
|   +-- database.py
|   +-- config.py
|   +-- main.py
|   +-- requirements.txt
|
+-- src/
|   +-- components/
|   +-- pages/
|   +-- context/
|   +-- ...
|
+-- public/
+-- package.json
+-- vite.config.ts
+-- tailwind.config.ts
+-- README.md
```

## Future Improvements

* User authentication and authorization
* Multi-tenant document isolation
* Document-level access control
* OCR for scanned documents
* Streaming LLM responses
* Citation and source highlighting
* Conversation memory
* Advanced retrieval evaluation
* Expanded document format support

## Author

Namrutha Bhasi

GitHub:
https://github.com/namruthabhasi

LinkedIn:
https://www.linkedin.com/in/namruthabhasi/
s.
