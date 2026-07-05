import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types — these match the backend response shapes exactly
// ============================================================================
export interface Document {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'TXT' | 'CSV' | 'JSON';
  chunksCount: number;
  identifiers: string[];
  uploadDate: string;
  status: 'indexed' | 'processing' | 'failed';
  sizeBytes: number;
  metadata: Record<string, string>;
  chunks?: Chunk[];
}

export interface Chunk {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  similarity: number;
  bm25Score: number;
  hybridScore: number;
  matchedMetadata: Record<string, string>;
  explanation: string;
  chunkIndex: number;
}

export interface PipelineNodeInfo {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'skipped';
  durationMs: number;
  input: string;
  output: string;
  details?: Record<string, any>;
}

export interface QueryResult {
  id: string;
  query: string;
  mode: 'vector' | 'bm25' | 'hybrid' | 'hybrid-rerank';
  answer: string;
  confidence: number;
  processingTimeMs: number;
  documentsUsedCount: number;
  retrievedChunks: Chunk[];
  pipelineNodes: PipelineNodeInfo[];
  timestamp: string;

  // Developer Debug Panel
  fullPromptSent?: string;
  tokenCount?: number;
  llmResponseTimeMs?: number;
  detectedIdentifiers?: string[];
  metadataFiltersApplied?: Record<string, string>;
  denseSearchResults?: Chunk[];
  bm25SearchResults?: Chunk[];
  hybridScores?: { chunkId: string; score: number }[];
  rerankerScores?: { chunkId: string; score: number }[];
}

export interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: 'PDF' | 'DOCX' | 'TXT' | 'CSV' | 'JSON';
  progress: number;
  currentStep: number;
  status: 'processing' | 'completed' | 'failed';
  steps: { name: string; status: 'pending' | 'running' | 'completed' | 'failed' }[];
  error?: string;
}

export interface Settings {
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  bm25Weight: number;
  denseWeight: number;
  topK: number;
  reranker: string;
  temperature: number;
  llm: string;
  database: string;
}

interface PlatformContextProps {
  documents: Document[];
  queries: QueryResult[];
  activeUploads: UploadTask[];
  settings: Settings;
  isLoadingDocuments: boolean;
  backendStatus: 'checking' | 'online' | 'offline';
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetIndex: () => void;
  uploadFile: (file: File) => void;
  runQuery: (text: string, mode: QueryResult['mode']) => Promise<QueryResult>;
  deleteDocument: (id: string) => Promise<void>;
  reindexDocument: (id: string) => void;
  clearQueryHistory: () => void;
  refreshDocuments: () => Promise<void>;
}

// ============================================================================
// Upload pipeline steps — for visual feedback only (backend is async)
// ============================================================================
const UPLOAD_STEPS = [
  'Reading Document',
  'Extracting Text',
  'Chunking',
  'Extracting Metadata',
  'Generating Embeddings',
  'Updating BM25',
  'Uploading to Qdrant',
  'Completed',
];

const PlatformContext = createContext<PlatformContextProps | undefined>(undefined);

// ============================================================================
// API helpers
// ============================================================================
const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  // If the user provided a URL without /api at the end, append it
  const cleanUrl = envUrl.replace(/\/$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const API_BASE = getApiBase();

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // path already includes a leading slash, e.g. '/documents'
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Provider
// ============================================================================
export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [queries, setQueries] = useState<QueryResult[]>(() => {
    try {
      const saved = localStorage.getItem('precision_rag_queries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const [settings, setSettings] = useState<Settings>({
    embeddingModel: 'text-embedding-004',
    chunkSize: 500,
    chunkOverlap: 100,
    bm25Weight: 0.4,
    denseWeight: 0.6,
    topK: 6,
    reranker: 'CrossEncoder MiniLM-L-6-v2',
    temperature: 0.2,
    llm: 'Gemini 2.5 Flash',
    database: 'Qdrant',
  });

  // ── Persist query history ──────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('precision_rag_queries', JSON.stringify(queries));
  }, [queries]);

  // ── Health check & initial document load ──────────────────────────────────
  const checkHealth = useCallback(async () => {
    try {
      await apiFetch('/health');
      setBackendStatus('online');
    } catch {
      setBackendStatus('offline');
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      const data = await apiFetch<{ documents: Document[] }>('/documents');
      setDocuments(data.documents);
    } catch (e) {
      console.error('Failed to load documents:', e);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    checkHealth().then(() => refreshDocuments());
  }, [checkHealth, refreshDocuments]);

  // ── Settings ───────────────────────────────────────────────────────────────
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetIndex = () => {
    // Clear local state; actual deletion from backend is done per-document
    setDocuments([]);
    setQueries([]);
    setActiveUploads([]);
  };

  // ── Clear query history ───────────────────────────────────────────────────
  const clearQueryHistory = () => {
    setQueries([]);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadFile = (file: File) => {
    const taskId = `upload-${Date.now()}`;
    const ext = (file.name.split('.').pop()?.toUpperCase() ?? 'TXT') as UploadTask['fileType'];

    const newTask: UploadTask = {
      id: taskId,
      fileName: file.name,
      fileSize: file.size,
      fileType: ext,
      progress: 0,
      currentStep: 0,
      status: 'processing',
      steps: UPLOAD_STEPS.map((name, i) => ({
        name,
        status: i === 0 ? 'running' : 'pending',
      })),
    };

    setActiveUploads((prev) => [newTask, ...prev]);

    // Animate pipeline steps while the real upload happens in parallel
    let stepIndex = 0;

    // Real upload via FormData
    const formData = new FormData();
    formData.append('file', file);

    const uploadPromise = apiFetch<{ success: boolean; document: Document }>(
      '/upload',
      { method: 'POST', body: formData }
    );

    // Advance animation every ~1.2s until backend responds
    const interval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, UPLOAD_STEPS.length - 2); // stop before "Completed"
      setActiveUploads((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            currentStep: stepIndex,
            progress: Math.round((stepIndex / (UPLOAD_STEPS.length - 1)) * 90),
            steps: UPLOAD_STEPS.map((name, i) => ({
              name,
              status: i < stepIndex ? 'completed' : i === stepIndex ? 'running' : 'pending',
            })),
          };
        })
      );
    }, 1200);

    uploadPromise
      .then((data) => {
        clearInterval(interval);
        setActiveUploads((prev) =>
          prev.map((t) =>
            t.id !== taskId
              ? t
              : {
                  ...t,
                  progress: 100,
                  currentStep: UPLOAD_STEPS.length - 1,
                  status: 'completed',
                  steps: UPLOAD_STEPS.map((name) => ({ name, status: 'completed' as const })),
                }
          )
        );
        // Add the real document returned by backend
        setDocuments((prev) => [data.document, ...prev]);
      })
      .catch((err) => {
        clearInterval(interval);
        setActiveUploads((prev) =>
          prev.map((t) =>
            t.id !== taskId
              ? t
              : { ...t, status: 'failed', error: String(err), steps: t.steps.map(s => ({ ...s, status: s.status === 'running' ? 'failed' as const : s.status })) }
          )
        );
        console.error('Upload failed:', err);
      });
  };

  // ── Query ──────────────────────────────────────────────────────────────────
  const runQuery = async (text: string, mode: QueryResult['mode']): Promise<QueryResult> => {
    const result = await apiFetch<QueryResult>('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, mode, top_k: settings.topK }),
    });

    // Save to history with filtering
    const cleaned = text.trim();
    const isMultiLine = cleaned.includes('\n') || cleaned.includes('\r');
    const isDebug =
      cleaned.startsWith('/') ||
      cleaned.toLowerCase().includes('debug') ||
      cleaned.toLowerCase().includes('system instruction');
    const isLong = cleaned.length > 150;

    if (!isMultiLine && !isDebug && !isLong && cleaned.length > 0) {
      setQueries((prev) => {
        const deduped = prev.filter(
          (q) => q.query.trim().toLowerCase() !== cleaned.toLowerCase()
        );
        const displayQuery = cleaned.length > 60
          ? cleaned.slice(0, 60) + '…'
          : cleaned;
        return [{ ...result, query: displayQuery }, ...deduped].slice(0, 10);
      });
    }

    return result;
  };

  // ── Delete Document ────────────────────────────────────────────────────────
  const deleteDocument = async (id: string): Promise<void> => {
    await apiFetch(`/documents/${id}`, { method: 'DELETE' });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // ── Re-index (triggers backend refresh for now) ────────────────────────────
  const reindexDocument = (_id: string) => {
    // Placeholder: could call a /api/reindex endpoint in a future iteration
    refreshDocuments();
  };

  return (
    <PlatformContext.Provider
      value={{
        documents,
        queries,
        activeUploads,
        settings,
        isLoadingDocuments,
        backendStatus,
        updateSettings,
        resetIndex,
        uploadFile,
        runQuery,
        deleteDocument,
        reindexDocument,
        clearQueryHistory,
        refreshDocuments,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = () => {
  const context = useContext(PlatformContext);
  if (context === undefined) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
};
