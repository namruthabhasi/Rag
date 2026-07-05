import React, { useState } from 'react';
import { 
  GitFork, 
  Search, 
  Binary, 
  Filter, 
  Database, 
  Merge, 
  Shuffle, 
  Layers, 
  Cpu, 
  FileCheck2,
  Clock,
  Info
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { QueryResult } from '@/context/PlatformContext';

export const RetrievalPipeline: React.FC = () => {
  const { queries } = usePlatform();
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);

  // If there are no queries run yet, create a default query context to inspect
  const activeQuery: QueryResult = queries[0] || {
    id: 'default-pipeline',
    query: 'Explain Article 24-B data compliance obligations',
    mode: 'hybrid-rerank',
    answer: 'Article 24-B of the Data Protection Regulation mandates that any cross-border transfers of personal data to third-country processors must carry Standard Contractual Clauses (specifically conforming to Clause 8.2). If no adequacy decision exists, you must enforce technical safeguards such as AES-256 encryption using client-managed keys. Access logs must be audited twice a year.',
    confidence: 0.95,
    processingTimeMs: 147,
    documentsUsedCount: 1,
    timestamp: new Date().toISOString(),
    retrievedChunks: [],
    pipelineNodes: [
      {
        name: 'Query Input',
        status: 'completed',
        durationMs: 2,
        input: 'Explain Article 24-B data compliance obligations',
        output: 'Explain Article 24-B data compliance obligations'
      },
      {
        name: 'Identifier Detection',
        status: 'completed',
        durationMs: 12,
        input: 'Explain Article 24-B data compliance obligations',
        output: 'Identifier Detected: "Article 24-B"',
        details: { regexPattern: '/(Article\\s\\d+-[A-Z]|Clause\\s\\d+\\.\\d+)/i', matches: ['Article 24-B'] }
      },
      {
        name: 'Metadata Filter',
        status: 'completed',
        durationMs: 8,
        input: 'Metadata Extraction Entities: {}',
        output: 'No pre-filtering rules triggered',
        details: { prefilteredDocsCount: 5 }
      },
      {
        name: 'Dense Search',
        status: 'completed',
        durationMs: 42,
        input: 'Generating 1536-dimensional vector via Gemini Text Embedding',
        output: 'Retrieved 4 chunks from Qdrant dense index',
        details: { metric: 'Cosine similarity', vectorsFetched: 4, topCosineScore: 0.94 }
      },
      {
        name: 'BM25 Search',
        status: 'completed',
        durationMs: 35,
        input: 'Tokenized terms: ["explain", "article", "24-b", "data", "compliance", "obligations"]',
        output: 'Retrieved 4 chunks from BM25 inverted index',
        details: { avgDocLength: 428, vocabularySize: 12450, topBm25Score: 8.7 }
      },
      {
        name: 'Fusion',
        status: 'completed',
        durationMs: 14,
        input: 'List A (Dense rank) + List B (BM25 rank)',
        output: 'Merged candidates pool of size 6 using Reciprocal Rank Fusion',
        details: { constant: 60, formula: 'RRF(d) = sum(1 / (60 + r_m(d)))' }
      },
      {
        name: 'Cross Encoder',
        status: 'completed',
        durationMs: 48,
        input: 'Candidates pool of size 6',
        output: 'Reranked and scored using Cohere Rerank v3',
        details: { model: 'Cohere Rerank v3', topRerankScore: 0.915, belowThresholdDropped: 2 }
      },
      {
        name: 'Top Chunks',
        status: 'completed',
        durationMs: 5,
        input: '4 reranked documents',
        output: 'Context window package size: 540 tokens',
        details: { chunksCount: 2, tokenBudget: 2048 }
      },
      {
        name: 'LLM Generation',
        status: 'completed',
        durationMs: 450,
        input: 'Context: GDPR pdf Article 24-B reference + System prompts',
        output: 'Synthesized 54-word response',
        details: { model: 'Gemini Pro', temperature: 0.2 }
      },
      {
        name: 'Answer Output',
        status: 'completed',
        durationMs: 2,
        input: 'LLM complete tokens stream',
        output: 'Rendered finalized Answer card in Query view'
      }
    ]
  };

  const nodes = activeQuery.pipelineNodes;
  const currentNode = nodes[selectedNodeIndex];

  // Helper icons mapper
  const getNodeIcon = (name: string) => {
    switch (name) {
      case 'Query Input': return <Search size={16} />;
      case 'Identifier Detection': return <Binary size={16} />;
      case 'Metadata Filter': return <Filter size={16} />;
      case 'Dense Search': return <Database size={16} />;
      case 'BM25 Search': return <Shuffle size={16} />;
      case 'Fusion': return <Merge size={16} />;
      case 'Cross Encoder': return <Layers size={16} />;
      case 'Top Chunks': return <GitFork size={16} />;
      case 'LLM Generation': return <Cpu size={16} />;
      case 'Answer Output': return <FileCheck2 size={16} />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-heading font-medium text-[#F5F5F5] mb-1">
          Retrieval Pipeline Map
        </h1>
        <p className="text-xs text-[#9E9E9E]">
          Inspect intermediate algorithmic stages. Trace queries from parsing down to vector distances, RRF fusion weights, reranker scores, and final generation context.
        </p>
      </div>

      {/* Query Banner */}
      <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.05] flex justify-between items-center text-xs">
        <div className="truncate pr-4 space-y-0.5">
          <span className="text-[10px] text-[#9E9E9E] uppercase font-mono tracking-wider">Active Inspection Query</span>
          <h3 className="text-[#F5F5F5] font-serif italic truncate">"{activeQuery.query}"</h3>
        </div>
        <div className="flex gap-4 font-mono text-[10px] flex-shrink-0 text-[#9E9E9E]">
          <div>Mode: <span className="text-white">{activeQuery.mode}</span></div>
          <div className="border-l border-white/[0.06] pl-4">Latency: <span className="text-white">{activeQuery.processingTimeMs}ms</span></div>
        </div>
      </div>

      {/* Horizontal Flow Container */}
      <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur overflow-x-auto relative">
        <div className="flex items-center min-w-[1000px] py-4 relative z-10 justify-between">
          {nodes.map((node, idx) => {
            const isSelected = selectedNodeIndex === idx;
            const isSkipped = node.status === 'skipped';

            return (
              <React.Fragment key={idx}>
                {/* Node Box */}
                <button
                  onClick={() => setSelectedNodeIndex(idx)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all duration-300 relative cursor-pointer group flex-shrink-0 w-24 ${
                    isSelected 
                      ? 'border-[#9EA9FF] bg-[#9EA9FF]/5 shadow-[0_0_15px_rgba(158,169,255,0.08)] scale-105' 
                      : 'border-white/[0.06] bg-[#0c0c0c]/85 hover:border-white/[0.12] hover:bg-white/[0.01]'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    isSelected 
                      ? 'bg-[#9EA9FF] text-[#050505] border-transparent' 
                      : isSkipped 
                        ? 'bg-transparent text-white/20 border-white/[0.04]'
                        : 'bg-white/[0.03] text-[#9E9E9E] group-hover:text-white border-white/[0.08]'
                  }`}>
                    {getNodeIcon(node.name)}
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-heading font-medium tracking-wide text-white block truncate w-20">
                      {node.name}
                    </span>
                    <span className="text-[8px] text-[#9E9E9E] font-mono block">
                      {isSkipped ? 'skipped' : `${node.durationMs}ms`}
                    </span>
                  </div>

                  {/* Active Indicator Pulse */}
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9EA9FF] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9EA9FF]"></span>
                    </span>
                  )}
                </button>

                {/* Connecting arrow/line */}
                {idx < nodes.length - 1 && (
                  <div className="flex-1 h-[1px] bg-white/[0.06] mx-2 relative min-w-[20px]">
                    <div 
                      className={`absolute inset-0 bg-gradient-to-r from-[#9EA9FF] to-[#D8D3FF] transition-all duration-300 ${
                        idx < selectedNodeIndex ? 'w-full opacity-60' : 'w-0 opacity-0'
                      }`} 
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Node Inspector Sheet */}
      {currentNode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Node Summary details */}
          <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9E9E9E]">NODE INFO</span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 uppercase tracking-wide bg-emerald-400/5 border border-emerald-400/10 px-2 py-0.5 rounded">
                {currentNode.status}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-heading font-semibold text-white mb-1">
                {currentNode.name}
              </h3>
              <p className="text-[11px] text-[#9E9E9E] leading-relaxed">
                Platform retrieval process node executing in workspace session.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.04] text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-[#9E9E9E] flex items-center gap-1.5"><Clock size={12} /> Execution Time</span>
                <span className="text-white font-medium">{currentNode.durationMs} ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9E9E9E] flex items-center gap-1.5"><Layers size={12} /> Node Index</span>
                <span className="text-[#9EA9FF] font-medium">#{selectedNodeIndex + 1} of {nodes.length}</span>
              </div>
            </div>
          </div>

          {/* Node Input / Output logs */}
          <div className="md:col-span-2 p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
            <h4 className="text-[10px] uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold">
              Node Execution logs
            </h4>

            <div className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <span className="text-[#9E9E9E] block text-[10px]">INPUT</span>
                <div className="bg-[#0c0c0c] border border-white/[0.04] p-3 rounded-lg text-white/90 whitespace-pre-wrap leading-relaxed">
                  {currentNode.input}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[#9E9E9E] block text-[10px]">OUTPUT</span>
                <div className="bg-[#0c0c0c] border border-white/[0.04] p-3 rounded-lg text-[#9EA9FF] whitespace-pre-wrap leading-relaxed">
                  {currentNode.output}
                </div>
              </div>

              {currentNode.details && Object.keys(currentNode.details).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/[0.03]">
                  <span className="text-[#9E9E9E] block text-[10px]">ALGORITHMIC DETAILS</span>
                  <div className="bg-[#0c0c0c]/30 border border-white/[0.04] p-3 rounded-lg text-[#9E9E9E] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    {Object.entries(currentNode.details).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center border-b border-white/[0.02] pb-1 last:border-0 last:pb-0">
                        <span className="truncate pr-2">{k}</span>
                        <span className="text-white font-medium truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
