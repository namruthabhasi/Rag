import React, { createContext, useContext, useState, useEffect } from 'react';

// Types
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
  chunks: Chunk[];
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
  
  // Developer Debug Panel Fields
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
  steps: { name: string; status: 'pending' | 'running' | 'completed' }[];
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
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetIndex: () => void;
  uploadFile: (file: File) => void;
  runQuery: (text: string, mode: QueryResult['mode']) => Promise<QueryResult>;
  deleteDocument: (id: string) => void;
  reindexDocument: (id: string) => void;
  clearQueryHistory: () => void;
}

const PlatformContext = createContext<PlatformContextProps | undefined>(undefined);

// Initial Mock Documents
const initialDocuments: Document[] = [
  {
    id: 'doc-1',
    name: 'gdpr_compliance_policy_2026.pdf',
    type: 'PDF',
    chunksCount: 12,
    identifiers: ['Article 24-B', 'Clause 8.2'],
    uploadDate: '2026-06-15T14:32:00Z',
    status: 'indexed',
    sizeBytes: 245000,
    metadata: {
      jurisdiction: 'EU',
      author: 'Legal Dept',
      classification: 'Confidential',
      version: 'v4.2',
    },
    chunks: [
      {
        id: 'chunk-1-1',
        documentId: 'doc-1',
        documentName: 'gdpr_compliance_policy_2026.pdf',
        chunkIndex: 0,
        text: 'Pursuant to Article 24-B of the Data Protection Regulation, all cross-border transfers of personal data to third-country processors must be accompanied by a validated Standard Contractual Clause (SCC) under Clause 8.2. In the absence of an adequacy decision, technical safeguards (including AES-256 encryption with client-managed keys) must be enforced.',
        similarity: 0.94,
        bm25Score: 8.7,
        hybridScore: 0.915,
        matchedMetadata: { jurisdiction: 'EU', classification: 'Confidential' },
        explanation: 'Exact metadata match (jurisdiction=EU) and semantic overlap on cross-border data transfer protocols.',
      },
      {
        id: 'chunk-1-2',
        documentId: 'doc-1',
        documentName: 'gdpr_compliance_policy_2026.pdf',
        chunkIndex: 1,
        text: 'Clause 8.2 dictates the standard of care for technical and organizational measures (TOMs). Specifically, data access audits must occur bi-annually, and anomalies must be reported to the supervising authority within 72 hours. Failure to comply invokes penalties up to 4% of global turnover or €20M, whichever is greater.',
        similarity: 0.88,
        bm25Score: 7.2,
        hybridScore: 0.832,
        matchedMetadata: { author: 'Legal Dept' },
        explanation: 'Strong semantic match regarding TOM compliance duties and audit records under Clause 8.2.',
      }
    ]
  },
  {
    id: 'doc-2',
    name: 'invoice_inv-2025-001.json',
    type: 'JSON',
    chunksCount: 3,
    identifiers: ['INV-2025-001'],
    uploadDate: '2026-06-20T09:15:00Z',
    status: 'indexed',
    sizeBytes: 1240,
    metadata: {
      docType: 'Invoice',
      vendor: 'Acme Corp',
      billingCycle: 'Q1-2025',
      taxId: 'TX-99881',
    },
    chunks: [
      {
        id: 'chunk-2-1',
        documentId: 'doc-2',
        documentName: 'invoice_inv-2025-001.json',
        chunkIndex: 0,
        text: '{"invoiceNumber": "INV-2025-001", "billingDate": "2025-01-10", "dueDate": "2025-02-10", "amount": 14250.00, "currency": "USD", "items": [{"description": "Enterprise API Access", "quantity": 1, "unitPrice": 14250.00}], "status": "Paid", "vendor": "Acme Corp"}',
        similarity: 0.98,
        bm25Score: 12.4,
        hybridScore: 0.976,
        matchedMetadata: { docType: 'Invoice', vendor: 'Acme Corp' },
        explanation: 'Exact keyword match on Invoice identifier (INV-2025-001) and metadata extraction matching Acme Corp.',
      }
    ]
  },
  {
    id: 'doc-3',
    name: 'product_catalog_v2.csv',
    type: 'CSV',
    chunksCount: 8,
    identifiers: ['SKU-XP-998', 'SKU-XP-999'],
    uploadDate: '2026-06-25T11:04:00Z',
    status: 'indexed',
    sizeBytes: 45200,
    metadata: {
      department: 'Logistics',
      system: 'ERP-v2',
      region: 'Global',
    },
    chunks: [
      {
        id: 'chunk-3-1',
        documentId: 'doc-3',
        documentName: 'product_catalog_v2.csv',
        chunkIndex: 0,
        text: 'SKU,Name,Category,Price,Location,Stock\nSKU-XP-998,Precision Sensor A,Hardware,299.99,Warehouse A,145\nSKU-XP-999,Quantum Calibrator B,Precision Tech,1899.50,Warehouse B,20',
        similarity: 0.95,
        bm25Score: 9.9,
        hybridScore: 0.938,
        matchedMetadata: { department: 'Logistics' },
        explanation: 'Exact keyword match for SKU identifier SKU-XP-998 and database lookup in logistics department.',
      }
    ]
  },
  {
    id: 'doc-4',
    name: 'iso_compliance_report.docx',
    type: 'DOCX',
    chunksCount: 15,
    identifiers: ['ISO-27001-Section-4.2'],
    uploadDate: '2026-06-28T16:45:00Z',
    status: 'indexed',
    sizeBytes: 152000,
    metadata: {
      scope: 'Security',
      certYear: '2025',
      auditor: 'CertVerify Ltd',
    },
    chunks: [
      {
        id: 'chunk-4-1',
        documentId: 'doc-4',
        documentName: 'iso_compliance_report.docx',
        chunkIndex: 0,
        text: 'Under ISO-27001-Section-4.2, the organization must determine the interested parties relevant to the Information Security Management System (ISMS) and their requirements. This includes regulatory authorities, external partners, and legal obligations, documenting how their security expectations are met and verified annually.',
        similarity: 0.91,
        bm25Score: 8.1,
        hybridScore: 0.88,
        matchedMetadata: { scope: 'Security' },
        explanation: 'Semantic similarity to security obligations, matching identifier ISO-27001-Section-4.2.',
      }
    ]
  },
  {
    id: 'doc-5',
    name: 'api_v3_specification.txt',
    type: 'TXT',
    chunksCount: 6,
    identifiers: ['Section 12.3', 'RFC-7519'],
    uploadDate: '2026-07-01T10:12:00Z',
    status: 'indexed',
    sizeBytes: 18400,
    metadata: {
      protocol: 'OAuth2/JWT',
      environment: 'Production',
      owner: 'Gateway Team',
    },
    chunks: [
      {
        id: 'chunk-5-1',
        documentId: 'doc-5',
        documentName: 'api_v3_specification.txt',
        chunkIndex: 2,
        text: 'Section 12.3 outlining Token Claims. In alignment with RFC-7519, the "sub" (subject), "iss" (issuer), and "exp" (expiration time) claims must be present in all requests passing through the API gateway. Unauthorized claims are rejected immediately with a 401 Unauthorized status, logged under environment auditing standards.',
        similarity: 0.96,
        bm25Score: 11.2,
        hybridScore: 0.952,
        matchedMetadata: { protocol: 'OAuth2/JWT', environment: 'Production' },
        explanation: 'High BM25 keyword overlap on Section 12.3 and RFC-7519, combined with high semantic score for OAuth token specifications.',
      }
    ]
  },
  {
    id: 'doc-6',
    name: 'Predictive_Maintenance_AutoML_Paper.pdf',
    type: 'PDF',
    chunksCount: 6,
    identifiers: ['SKU-XP-991', 'AutoML-Paper'],
    uploadDate: '2026-07-02T10:00:00Z',
    status: 'indexed',
    sizeBytes: 184500,
    metadata: {
      author: 'Dr. A. Carter',
      subject: 'AutoML',
      published: '2025',
      classification: 'Public'
    },
    chunks: [
      {
        id: 'chunk-6-1',
        documentId: 'doc-6',
        documentName: 'Predictive_Maintenance_AutoML_Paper.pdf',
        chunkIndex: 0,
        text: 'Abstract: Enhancing Predictive Maintenance with Interpretable AutoML. This paper presents an interpretable Automated Machine Learning (AutoML) framework designed for industrial predictive maintenance. We introduce an optimization pipeline that automatically selects feature representations, model structures, and hyperparameters, while enforcing SHAP-based explanations on high-vibration sensor signals. Our results show a 14% improvement in mean time to detection (MTTD) compared to heuristic baselines.',
        similarity: 0.96,
        bm25Score: 9.8,
        hybridScore: 0.95,
        matchedMetadata: { subject: 'AutoML' },
        explanation: 'Contains the complete research abstract for the AutoML Predictive Maintenance framework.',
      },
      {
        id: 'chunk-6-2',
        documentId: 'doc-6',
        documentName: 'Predictive_Maintenance_AutoML_Paper.pdf',
        chunkIndex: 1,
        text: 'Introduction: Predictive maintenance is critical in manufacturing to avoid costly downtime. Machine learning models are often used, but they act as black boxes. In this paper, we propose an AutoML system that not only automates the model development pipeline but also yields interpretable results, ensuring factory operators understand machine failure predictions.',
        similarity: 0.94,
        bm25Score: 8.5,
        hybridScore: 0.92,
        matchedMetadata: { subject: 'AutoML' },
        explanation: 'Matches introductory sentences describing system motivations and manufacturing downtime costs.',
      },
      {
        id: 'chunk-6-3',
        documentId: 'doc-6',
        documentName: 'Predictive_Maintenance_AutoML_Paper.pdf',
        chunkIndex: 2,
        text: 'Methodology: The system uses a multi-stage search space consisting of (1) sensor signal preprocessing via FFT, (2) feature extraction of time-domain statistics, (3) model training with XGBoost and Random Forests, and (4) SHAP (SHapley Additive exPlanations) values to output feature importance logs in real-time, explaining sensor threshold crossings.',
        similarity: 0.93,
        bm25Score: 8.2,
        hybridScore: 0.90,
        matchedMetadata: { subject: 'AutoML' },
        explanation: 'Outlines the technical signal processing and explanation algorithms utilized in the pipeline.',
      },
      {
        id: 'chunk-6-4',
        documentId: 'doc-6',
        documentName: 'Predictive_Maintenance_AutoML_Paper.pdf',
        chunkIndex: 3,
        text: 'Key Findings: The proposed AutoML framework achieved a precision of 94.2% and a recall of 91.8% on historical turbine failure data. The SHAP explanation modules successfully pinpointed bearing wear as the leading indicator of anomaly events 4.2 hours prior to threshold alarms, reducing unplanned downtime by 28%.',
        similarity: 0.95,
        bm25Score: 9.0,
        hybridScore: 0.93,
        matchedMetadata: { subject: 'AutoML' },
        explanation: 'Reports precision, recall, and time-to-alarm stats showing 28% downtime reduction.',
      },
      {
        id: 'chunk-6-5',
        documentId: 'doc-6',
        documentName: 'Predictive_Maintenance_AutoML_Paper.pdf',
        chunkIndex: 4,
        text: 'Conclusion: In conclusion, we demonstrated that AutoML can be both high-performing and interpretable for predictive maintenance. Future work will focus on integrating edge devices for real-time inference directly on factory sensors, optimizing latency and hardware footprints.',
        similarity: 0.92,
        bm25Score: 8.0,
        hybridScore: 0.88,
        matchedMetadata: { subject: 'AutoML' },
        explanation: 'Details concluding summaries and proposals for future hardware edge integrations.',
      },
      {
        id: 'chunk-6-6',
        documentId: 'doc-6',
        documentName: 'Predictive_Maintenance_AutoML_Paper.pdf',
        chunkIndex: 5,
        text: 'Reference SKU-XP-991: Critical replacement bearing sensor module calibrated for high-vibration predictive maintenance pipelines, manufactured in alignment with Section 4.2 compliance.',
        similarity: 0.98,
        bm25Score: 12.0,
        hybridScore: 0.97,
        matchedMetadata: { subject: 'AutoML' },
        explanation: 'Matches the exact SKU identifier query search for replacement parts SKU-XP-991.',
      }
    ]
  }
];

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [queries, setQueries] = useState<QueryResult[]>(() => {
    try {
      const saved = localStorage.getItem('precision_rag_queries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);

  useEffect(() => {
    localStorage.setItem('precision_rag_queries', JSON.stringify(queries));
  }, [queries]);

  const clearQueryHistory = () => {
    setQueries([]);
  };
  const [settings, setSettings] = useState<Settings>({
    embeddingModel: 'Gemini Text Embedding',
    chunkSize: 512,
    chunkOverlap: 64,
    bm25Weight: 0.3,
    denseWeight: 0.7,
    topK: 4,
    reranker: 'Cohere Rerank v3',
    temperature: 0.2,
    llm: 'Gemini Pro',
    database: 'Qdrant (Cloud)'
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetIndex = () => {
    setDocuments([]);
    setQueries([]);
    setActiveUploads([]);
  };

  const deleteDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const reindexDocument = (id: string) => {
    // Set document status to processing, simulate indexing, then set back to indexed
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'processing' } : d))
    );

    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'indexed' } : d))
      );
    }, 3000);
  };

  // Simulate file upload and pipeline stages
  const uploadFile = (file: File) => {
    const fileId = 'doc-' + Math.random().toString(36).substring(2, 9);
    const ext = file.name.split('.').pop()?.toUpperCase() as Document['type'] || 'TXT';
    
    const steps = [
      'Reading Document',
      'Extracting Text',
      'Chunking',
      'Extracting Metadata',
      'Generating Embeddings',
      'Updating BM25',
      'Uploading to Qdrant',
      'Completed'
    ];

    const newUploadTask: UploadTask = {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: ext,
      progress: 0,
      currentStep: 0,
      status: 'processing',
      steps: steps.map((name, i) => ({
        name,
        status: i === 0 ? 'running' : 'pending'
      }))
    };

    setActiveUploads((prev) => [newUploadTask, ...prev]);

    // Simulate progress through stages
    let stepIndex = 0;
    const interval = setInterval(() => {
      setActiveUploads((prev) => {
        return prev.map((task) => {
          if (task.id !== fileId) return task;

          const updatedSteps = task.steps.map((step, idx) => {
            if (idx < stepIndex) return { ...step, status: 'completed' as const };
            if (idx === stepIndex) return { ...step, status: 'running' as const };
            return step;
          });

          const isCompleted = stepIndex >= steps.length - 1;
          
          if (isCompleted) {
            clearInterval(interval);
            
            // Add file to documents database when complete
            const mockIdentifiers = file.name.toLowerCase().includes('invoice') ? ['INV-2026-X'] 
                                   : file.name.toLowerCase().includes('article') ? ['Article 99']
                                   : ['SKU-NEW-77'];
            const newDoc: Document = {
              id: fileId,
              name: file.name,
              type: ext,
              chunksCount: Math.max(3, Math.floor(file.size / 1000)),
              identifiers: mockIdentifiers,
              uploadDate: new Date().toISOString(),
              status: 'indexed',
              sizeBytes: file.size,
              metadata: {
                system: 'Auto-Uploaded',
                classification: 'Public',
                extractedFields: mockIdentifiers.join(', '),
              },
              chunks: [
                {
                  id: `chunk-${fileId}-1`,
                  documentId: fileId,
                  documentName: file.name,
                  chunkIndex: 0,
                  text: `Processed chunk content for ${file.name}. Found identifier references: ${mockIdentifiers.join(', ')}. Details include general semantic summaries regarding standard operating guidelines.`,
                  similarity: 0.89,
                  bm25Score: 8.2,
                  hybridScore: 0.87,
                  matchedMetadata: { system: 'Auto-Uploaded' },
                  explanation: 'Created via automated ingestion workflow; matches custom terms in upload sequence.',
                }
              ]
            };

            // Update documents list
            setDocuments((currentDocs) => [newDoc, ...currentDocs]);

            return {
              ...task,
              progress: 100,
              status: 'completed' as const,
              steps: updatedSteps.map(s => ({ ...s, status: 'completed' as const }))
            };
          }

          stepIndex++;
          return {
            ...task,
            currentStep: stepIndex,
            progress: Math.round((stepIndex / steps.length) * 100),
            steps: updatedSteps
          };
        });
      });
    }, 1200); // 1.2s per pipeline step
  };

  // Simulate complex RAG retrieval search and pipelines
  const runQuery = (text: string, mode: QueryResult['mode']): Promise<QueryResult> => {
    return new Promise((resolve) => {
      const matchedChunks: Chunk[] = [];
      const lowercaseText = text.toLowerCase();
      
      // 1. Scan for exact identifier matches
      let isIdentifierMatch = false;
      let detectedIdents: string[] = [];
      let matchedIdent = '';

      documents.forEach(doc => {
        doc.identifiers.forEach(ident => {
          if (lowercaseText.includes(ident.toLowerCase())) {
            isIdentifierMatch = true;
            matchedIdent = ident;
            if (!detectedIdents.includes(ident)) {
              detectedIdents.push(ident);
            }
            
            // Add chunks belonging to this matching document
            doc.chunks.forEach(chunk => {
              if (chunk.text.toLowerCase().includes(ident.toLowerCase()) || doc.identifiers.includes(ident)) {
                if (!matchedChunks.some(c => c.id === chunk.id)) {
                  matchedChunks.push({
                    ...chunk,
                    similarity: 0.98,
                    bm25Score: 12.5,
                    hybridScore: 0.98 * settings.denseWeight + (12.5 / 15) * settings.bm25Weight
                  });
                }
              }
            });
          }
        });
      });

      // 2. Semantic matching fallback/addition (Dense & BM25)
      const denseResultsPool: Chunk[] = [];
      const bm25ResultsPool: Chunk[] = [];

      documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          // Simulate scores
          let sim = 0.5 + Math.random() * 0.25;
          let bm = 1.0 + Math.random() * 5.0;

          // Boost specifically for the Predictive Maintenance AutoML Paper chunks
          if (doc.name.toLowerCase().includes('predictive') || doc.name.toLowerCase().includes('automl')) {
            if (lowercaseText.includes('abstract') && chunk.text.startsWith('Abstract:')) {
              sim = 0.96;
              bm = 9.8;
            } else if (lowercaseText.includes('introduction') && chunk.text.startsWith('Introduction:')) {
              sim = 0.94;
              bm = 8.5;
            } else if (lowercaseText.includes('methodology') && chunk.text.startsWith('Methodology:')) {
              sim = 0.93;
              bm = 8.2;
            } else if ((lowercaseText.includes('findings') || lowercaseText.includes('key findings')) && chunk.text.startsWith('Key Findings:')) {
              sim = 0.95;
              bm = 9.0;
            } else if ((lowercaseText.includes('conclusion') || lowercaseText.includes('conclude')) && chunk.text.startsWith('Conclusion:')) {
              sim = 0.92;
              bm = 8.0;
            }
          }

          // Boost other semantic areas
          if (lowercaseText.includes('security') && chunk.text.toLowerCase().includes('security')) {
            sim += 0.15;
            bm += 3.0;
          }
          if (lowercaseText.includes('gdpr') && chunk.text.toLowerCase().includes('gdpr')) {
            sim += 0.18;
            bm += 3.5;
          }
          if (lowercaseText.includes('api') && chunk.text.toLowerCase().includes('api')) {
            sim += 0.12;
            bm += 2.5;
          }

          const cappedSim = Math.min(0.99, sim);
          const cappedBm = parseFloat(bm.toFixed(1));

          const denseChunk = { ...chunk, similarity: cappedSim, bm25Score: 0, hybridScore: cappedSim };
          const bm25Chunk = { ...chunk, similarity: 0, bm25Score: cappedBm, hybridScore: cappedBm };

          denseResultsPool.push(denseChunk);
          bm25ResultsPool.push(bm25Chunk);

          // Add to candidates if not already matched
          if (!matchedChunks.some(c => c.id === chunk.id)) {
            matchedChunks.push({
              ...chunk,
              similarity: cappedSim,
              bm25Score: cappedBm,
              hybridScore: parseFloat((cappedSim * settings.denseWeight + (cappedBm / 15) * settings.bm25Weight).toFixed(3))
            });
          }
        });
      });

      // Sort pools
      denseResultsPool.sort((a, b) => b.similarity - a.similarity);
      bm25ResultsPool.sort((a, b) => b.bm25Score - a.bm25Score);

      // Sort matches depending on mode
      matchedChunks.sort((a, b) => {
        if (mode === 'vector') return b.similarity - a.similarity;
        if (mode === 'bm25') return b.bm25Score - a.bm25Score;
        return b.hybridScore - a.hybridScore; // hybrid or hybrid-rerank
      });

      // Filter by Top-K
      const topChunks = matchedChunks.slice(0, settings.topK);

      // Apply metadata pre-filtering simulation
      let metadataFiltersApplied: Record<string, string> = {};
      if (lowercaseText.includes('eu') || lowercaseText.includes('gdpr')) {
        metadataFiltersApplied = { jurisdiction: 'EU' };
      } else if (lowercaseText.includes('invoice') || lowercaseText.includes('acme')) {
        metadataFiltersApplied = { docType: 'Invoice' };
      }

      // 3. Grounded Answer Synthesis Selector
      let answerText = '';
      let confidenceScore = 0.65;

      // Determine top match similarity
      const topMatchScore = topChunks[0] ? (mode === 'vector' ? topChunks[0].similarity : (mode === 'bm25' ? topChunks[0].bm25Score / 15 : topChunks[0].hybridScore)) : 0;
      const isRelevanceLow = topChunks.length === 0 || (mode === 'vector' && topMatchScore < 0.65) || (mode === 'hybrid-rerank' && topMatchScore < 0.5);

      if (isRelevanceLow) {
        answerText = 'I could not find enough information in the uploaded documents to answer this question.';
        confidenceScore = 0.1;
      } else {
        // Grounded answer mappings based on prompt instructions
        if (isIdentifierMatch) {
          confidenceScore = 0.98;
          if (matchedIdent.includes('Article 24-B')) {
            answerText = 'Based on gdpr_compliance_policy_2026.pdf, Article 24-B of the Data Protection Regulation mandates that all cross-border transfers of personal data to third-country processors must be accompanied by a validated Standard Contractual Clause (SCC) under Clause 8.2. In the absence of an adequacy decision, technical safeguards (including client-managed AES-256 encryption) must be enforced.';
          } else if (matchedIdent.includes('INV-2025-001')) {
            answerText = 'Based on invoice_inv-2025-001.json, the invoice INV-2025-001 from Acme Corp records a payment status of "Paid" for "Enterprise API Access". The billing date was 2025-01-10, the due date was 2025-02-10, and the amount billed is $14,250.00 USD.';
          } else if (matchedIdent.includes('SKU-XP-998')) {
            answerText = 'Based on product_catalog_v2.csv, SKU-XP-998 represents "Precision Sensor A", classified under Hardware. Its unit price is $299.99 and it is stored in Warehouse A. There are currently 145 units in stock managed under the ERP-v2 system in the Logistics department.';
          } else if (matchedIdent.includes('SKU-XP-991')) {
            answerText = 'According to Predictive_Maintenance_AutoML_Paper.pdf, SKU-XP-991 corresponds to a critical replacement bearing sensor module calibrated for high-vibration predictive maintenance pipelines. It is manufactured in alignment with Section 4.2 compliance standards.';
          } else if (matchedIdent.includes('Clause 8.2')) {
            answerText = 'Based on gdpr_compliance_policy_2026.pdf, Clause 8.2 dictates the standard of care for technical and organizational measures (TOMs). Specifically, data access audits must occur bi-annually, and anomalies must be reported to the supervising authority within 72 hours. Non-compliance invites penalties up to 4% of global turnover or €20M.';
          } else {
            answerText = `Based on the matching retrieved context, reference is found to the identifier "${matchedIdent}" in the indexed database files. Details correspond to active records managed under collection: ${settings.database}.`;
          }
        } else {
          // Semantic queries mappings
          if (lowercaseText.includes('abstract') && (lowercaseText.includes('paper') || lowercaseText.includes('maintenance') || lowercaseText.includes('automl'))) {
            confidenceScore = 0.96;
            answerText = 'Based on Predictive_Maintenance_AutoML_Paper.pdf, the abstract details an interpretable Automated Machine Learning (AutoML) framework designed for industrial predictive maintenance. The optimization pipeline automatically selects feature representations, model structures, and hyperparameters, while enforcing SHAP-based explanations on high-vibration sensor signals. Results show a 14% improvement in mean time to detection (MTTD) compared to heuristic baselines.';
          } else if (lowercaseText.includes('introduction')) {
            confidenceScore = 0.94;
            answerText = 'According to Predictive_Maintenance_AutoML_Paper.pdf, the introduction explains that predictive maintenance is critical in manufacturing to avoid costly downtime. Machine learning models are often black boxes, so the paper proposes an AutoML system that automates the model development pipeline and provides interpretable failure explanations to factory operators.';
          } else if (lowercaseText.includes('methodology')) {
            confidenceScore = 0.93;
            answerText = 'Based on Predictive_Maintenance_AutoML_Paper.pdf, the methodology uses a multi-stage search space consisting of (1) sensor signal preprocessing via FFT, (2) feature extraction of time-domain statistics, (3) model training with XGBoost and Random Forests, and (4) SHAP (SHapley Additive exPlanations) values to output feature importance logs in real-time, explaining sensor threshold crossings.';
          } else if (lowercaseText.includes('findings') || lowercaseText.includes('key findings')) {
            confidenceScore = 0.95;
            answerText = 'Based on Predictive_Maintenance_AutoML_Paper.pdf, the key findings report that the proposed AutoML framework achieved a precision of 94.2% and a recall of 91.8% on historical turbine failure data. The SHAP explanation modules successfully pinpointed bearing wear as the leading indicator of anomaly events 4.2 hours prior to threshold alarms, reducing unplanned downtime by 28%.';
          } else if (lowercaseText.includes('conclusion')) {
            confidenceScore = 0.92;
            answerText = 'According to Predictive_Maintenance_AutoML_Paper.pdf, the paper concludes that AutoML can deliver both high performance and interpretability for predictive maintenance. Future work focuses on integrating edge hardware devices for real-time inference directly on factory sensors, optimizing latency and hardware footprints.';
          } else if (lowercaseText.includes('security') || lowercaseText.includes('iso')) {
            confidenceScore = 0.88;
            answerText = 'Based on the compliance documents (iso_compliance_report.docx), ISO-27001-Section-4.2 requires the organization to document and verify interested parties expectations regarding the ISMS annually. Also, OAuth token claims (RFC-7519) are verified by the API gateway in text spec api_v3_specification.txt.';
          } else if (lowercaseText.includes('transfer') || lowercaseText.includes('cross-border')) {
            confidenceScore = 0.91;
            answerText = 'Based on gdpr_compliance_policy_2026.pdf, cross-border transfers require standard contractual clauses (SCC) under Clause 8.2, alongside technical safeguards (including AES-256 encryption with client-managed keys) pursuant to Article 24-B.';
          } else {
            // General semantic summary
            confidenceScore = 0.75;
            answerText = `Based on the retrieved context, the documents describe specifications related to "${text}". The most relevant source is "${topChunks[0].documentName}" which outlines these details. Retrieval was conducted using ${settings.embeddingModel} and reranked using ${settings.reranker}.`;
          }
        }
      }

      // 4. Construct Prompt Context exactly as expected
      let retrievedContextStr = '';
      if (topChunks.length > 0) {
        retrievedContextStr = topChunks.map((c) => `Document:\n${c.documentName}\n\nChunk ${c.id.split('-').pop()}\n\n${c.text}`).join('\n\n--------------------------------\n\n');
      } else {
        retrievedContextStr = 'NO RELEVANT CONTEXT FOUND IN THE DATABASE.';
      }

      const fullPrompt = `You are an intelligent Retrieval-Augmented Generation assistant.

Use ONLY the retrieved context below to answer the user's question.

Rules:

1. Never answer from your own knowledge.
2. Never repeat the user's question.
3. Never hallucinate.
4. If the answer is not found in the retrieved context, reply:

"I could not find enough information in the uploaded documents to answer this question."

5. When multiple chunks contain relevant information, combine them into one coherent answer.
6. Cite the source document names used.

========================

Retrieved Context:

${retrievedContextStr}

========================

Question:

${text}

========================

Provide a concise, accurate answer based only on the retrieved context.`;

      // Approximated token counts (characters / 4)
      const tokenCount = Math.round(fullPrompt.length / 4);

      // Latency Calculations (simulated stages in ms)
      const latencies = {
        identDetect: isIdentifierMatch ? 12 : 28,
        metaExtract: 15,
        metaFilter: 8,
        denseSearch: mode === 'bm25' ? 0 : 42,
        sparseSearch: mode === 'vector' ? 0 : 35,
        hybridFusion: (mode === 'hybrid' || mode === 'hybrid-rerank') ? 14 : 0,
        rerank: (mode === 'hybrid-rerank' && settings.reranker !== 'None') ? 48 : 0,
        llm: isRelevanceLow ? 100 : 450
      };

      const totalTime = Object.values(latencies).reduce((a, b) => a + b, 0);

      // 5. Create detailed Pipeline Nodes
      const nodes: PipelineNodeInfo[] = [
        {
          name: 'Query Input',
          status: 'completed',
          durationMs: 2,
          input: text,
          output: text
        },
        {
          name: 'Identifier Detection',
          status: 'completed',
          durationMs: latencies.identDetect,
          input: text,
          output: isIdentifierMatch ? `Identifier Detected: "${matchedIdent}"` : 'No direct identifier match found (falling back to semantic vector lookup)',
          details: { regexPattern: '/([A-Z]+-\\d+-\\d+|Article\\s\\d+-[A-Z]|Clause\\s\\d+\\.\\d+|Section\\s\\d+\\.\\d+)/i', matches: detectedIdents }
        },
        {
          name: 'Metadata Extraction',
          status: 'completed',
          durationMs: latencies.metaExtract,
          input: text,
          output: 'Metadata entities extracted',
          details: { entities: Object.keys(metadataFiltersApplied).length > 0 ? metadataFiltersApplied : {} }
        },
        {
          name: 'Metadata Filtering',
          status: 'completed',
          durationMs: latencies.metaFilter,
          input: 'Query metadata: ' + JSON.stringify(metadataFiltersApplied),
          output: Object.keys(metadataFiltersApplied).length > 0 ? `Applied filter: ${Object.entries(metadataFiltersApplied).map(([k,v]) => `${k} == "${v}"`).join(', ')}` : 'No pre-filtering rules triggered',
          details: { prefilteredDocsCount: Object.keys(metadataFiltersApplied).length > 0 ? 1 : documents.length }
        },
        {
          name: 'Dense Search',
          status: mode === 'bm25' ? 'skipped' : 'completed',
          durationMs: latencies.denseSearch,
          input: `Embedding vector of size 1536 generated via ${settings.embeddingModel}`,
          output: `Retrieved top ${settings.topK} vectors from Qdrant`,
          details: { embeddingDimensions: 1536, distanceMetric: 'Cosine similarity' }
        },
        {
          name: 'Sparse Search',
          status: mode === 'vector' ? 'skipped' : 'completed',
          durationMs: latencies.sparseSearch,
          input: text,
          output: `Retrieved top ${settings.topK} document chunks from BM25 sparse index`,
          details: { k1: 1.2, b: 0.75, dictionarySize: 12450 }
        },
        {
          name: 'Hybrid Fusion',
          status: (mode === 'hybrid' || mode === 'hybrid-rerank') ? 'completed' : 'skipped',
          durationMs: latencies.hybridFusion,
          input: 'Vector lists from Dense and Sparse indices',
          output: 'Merged list using Reciprocal Rank Fusion (RRF) algorithm',
          details: { rrfConstant: 60, denseWeight: settings.denseWeight, sparseWeight: settings.bm25Weight }
        },
        {
          name: 'Cross Encoder (Reranking)',
          status: (mode === 'hybrid-rerank' && settings.reranker !== 'None') ? 'completed' : 'skipped',
          durationMs: latencies.rerank,
          input: `Top ${topChunks.length} documents prior to rerank`,
          output: `Reranked documents list using model: ${settings.reranker}`,
          details: { modelName: settings.reranker, threshold: 0.3 }
        },
        {
          name: 'Top Chunks Selector',
          status: 'completed',
          durationMs: 5,
          input: `Ranked pool of size ${topChunks.length}`,
          output: `Selected top ${topChunks.length} chunks for context window`,
          details: { selectedIds: topChunks.map(c => c.id) }
        },
        {
          name: 'LLM Generation',
          status: 'completed',
          durationMs: latencies.llm,
          input: `Context size: ${topChunks.reduce((a, b) => a + b.text.length, 0)} characters + system instructions`,
          output: `Final synthesis answer generated using model: ${settings.llm}`,
          details: { model: settings.llm, temp: settings.temperature, tokenCount }
        }
      ];

      // Delay execution slightly to simulate RAG latency in user interface
      setTimeout(() => {
        const uniqueDocsUsed = Array.from(new Set(topChunks.map(c => c.documentId))).length;
        const newQuery: QueryResult = {
          id: 'q-' + Math.random().toString(36).substring(2, 9),
          query: text,
          mode,
          answer: answerText,
          confidence: parseFloat(confidenceScore.toFixed(2)),
          processingTimeMs: totalTime,
          documentsUsedCount: uniqueDocsUsed,
          retrievedChunks: topChunks,
          pipelineNodes: nodes,
          timestamp: new Date().toISOString(),
          
          // Debugging Fields
          fullPromptSent: fullPrompt,
          tokenCount,
          llmResponseTimeMs: latencies.llm,
          detectedIdentifiers: detectedIdents,
          metadataFiltersApplied,
          denseSearchResults: denseResultsPool.slice(0, 5),
          bm25SearchResults: bm25ResultsPool.slice(0, 5),
          hybridScores: topChunks.map(c => ({ chunkId: c.id, score: c.hybridScore })),
          rerankerScores: topChunks.map(c => ({ chunkId: c.id, score: c.hybridScore * 1.05 })) // simulated rerank offset
        };

        const cleanQueryText = text.trim();
        const isMultiLine = cleanQueryText.includes('\n') || cleanQueryText.includes('\r');
        const isDeveloperOrDebug = 
          cleanQueryText.startsWith('/') ||
          cleanQueryText.toLowerCase().includes('debug') ||
          cleanQueryText.toLowerCase().includes('developer') ||
          cleanQueryText.toLowerCase().includes('test') ||
          cleanQueryText.toLowerCase().includes('mock') ||
          cleanQueryText.toLowerCase().includes('system instruction');
        const isLong = cleanQueryText.length > 150;
        const isEmpty = cleanQueryText.length === 0;

        const shouldSave = !isMultiLine && !isDeveloperOrDebug && !isLong && !isEmpty;

        if (shouldSave) {
          setQueries((prev) => {
            const filtered = prev.filter(q => q.query.trim().toLowerCase() !== cleanQueryText.toLowerCase());
            return [newQuery, ...filtered].slice(0, 10);
          });
        }
        resolve(newQuery);
      }, 1000); // 1-second query processing delay
    });
  };

  return (
    <PlatformContext.Provider
      value={{
        documents,
        queries,
        activeUploads,
        settings,
        updateSettings,
        resetIndex,
        uploadFile,
        runQuery,
        deleteDocument,
        reindexDocument,
        clearQueryHistory
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
