import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Settings2, 
  Cpu
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { QueryResult } from '@/context/PlatformContext';

interface QueryWorkspaceProps {
  searchText: string;
  setSearchText: (text: string) => void;
}

export const QueryWorkspace: React.FC<QueryWorkspaceProps> = ({ searchText, setSearchText }) => {
  const { runQuery } = usePlatform();
  const [retrievalMode, setRetrievalMode] = useState<QueryResult['mode']>('hybrid-rerank');
  const [isSearching, setIsSearching] = useState(false);
  const [currentPipelineStep, setCurrentPipelineStep] = useState(-1);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const [devModeOpen, setDevModeOpen] = useState(false);

  // Example Query Prefills
  const examples = [
    { label: 'Explain Article 24-B', text: 'Explain Article 24-B data compliance obligations' },
    { label: 'Find INV-2025-001', text: 'Find invoice INV-2025-001 summary and details' },
    { label: 'Locate SKU-XP-998', text: 'Locate hardware SKU-XP-998 pricing and stock' },
    { label: 'Summarize Clause 8.2', text: 'Summarize GDPR Clause 8.2 technical audits' }
  ];

  // Pipeline execution sequence steps
  const searchSteps = [
    'Query Parsing',
    'Identifier Detection',
    'Metadata Extraction',
    'Metadata Filtering',
    'Dense Vector Search',
    'Sparse BM25 Search',
    'Hybrid Fusion (RRF)',
    'Cross Encoder Reranking',
    'Context Building',
    'LLM Synthesis'
  ];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;

    setIsSearching(true);
    setResult(null);
    setExpandedChunkId(null);

    // Simulate animated pipeline progression step-by-step
    setCurrentPipelineStep(0);
    const stepInterval = 120; // ms per pipeline node transition
    
    for (let i = 0; i < searchSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, stepInterval));
      setCurrentPipelineStep(i);
    }

    try {
      const queryRes = await runQuery(searchText, retrievalMode);
      setResult(queryRes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
      setCurrentPipelineStep(-1);
    }
  };

  const handleExampleClick = (text: string) => {
    setSearchText(text);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Central Input Workspace */}
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-white">
          Precision Retrieval Search
        </h1>
        <p className="text-xs text-[#9E9E9E] max-w-md mx-auto">
          Query the index. Exact identifiers will trigger structured metadata locks, while free-form queries route through dense vector matrices.
        </p>

        {/* Query Input */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-2xl mx-auto mt-6">
          <div className="relative group">
            <input
              type="text"
              placeholder="Query identifiers (e.g. Article 24-B) or ask semantic questions..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              disabled={isSearching}
              className="w-full bg-white/[0.02] border border-white/[0.08] group-hover:border-white/[0.15] focus:border-[#9EA9FF]/50 rounded-xl px-4 py-3.5 pl-11 pr-24 text-xs text-[#F5F5F5] focus:outline-none transition-all shadow-inner disabled:opacity-50"
            />
            <Search size={16} className="absolute left-4 top-4 text-[#9E9E9E]" />
            <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
              <button
                type="submit"
                disabled={isSearching || !searchText.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-[#9EA9FF] hover:bg-[#D8D3FF] text-[#050505] text-[10px] font-semibold tracking-wide transition-all disabled:opacity-40 disabled:hover:bg-[#9EA9FF] cursor-pointer"
              >
                {isSearching ? 'RUNNING' : 'RETRIEVE'}
              </button>
            </div>
          </div>
        </form>

        {/* Example Chips */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {examples.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExampleClick(ex.text)}
              disabled={isSearching}
              className="px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] text-[10px] text-[#9E9E9E] hover:text-[#F5F5F5] transition-all cursor-pointer font-mono"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Retrieval Mode selector */}
      <div className="max-w-2xl mx-auto bg-white/[0.02] border border-white/[0.06] p-1.5 rounded-lg flex justify-between gap-1.5 text-[10px] font-mono">
        <div className="flex items-center gap-1 px-2.5 text-[#9E9E9E]">
          <Settings2 size={12} />
          <span>Retrieval Engine:</span>
        </div>
        <div className="flex gap-1 flex-1 justify-end">
          {[
            { id: 'vector', name: 'Dense (Vector)' },
            { id: 'bm25', name: 'Sparse (BM25)' },
            { id: 'hybrid', name: 'Hybrid (RRF)' },
            { id: 'hybrid-rerank', name: 'Hybrid + Reranker' }
          ].map((mode) => {
            const isActive = retrievalMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setRetrievalMode(mode.id as QueryResult['mode'])}
                disabled={isSearching}
                className={`px-3 py-1 rounded-md transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? 'bg-white/[0.06] border border-white/[0.1] text-white font-medium shadow' 
                    : 'text-[#9E9E9E] hover:text-white'
                }`}
              >
                {mode.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Searching Pipeline Animation */}
      {isSearching && (
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur max-w-2xl mx-auto space-y-4">
          <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
            <span className="text-xs font-mono font-medium text-white flex items-center gap-1.5">
              <Cpu size={12} className="text-[#9EA9FF] animate-spin" /> Execution Pipeline Logs
            </span>
            <span className="text-[10px] text-[#9EA9FF] font-mono">Running hybrid synthesis...</span>
          </div>

          {/* Sequential nodes */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {searchSteps.map((step, idx) => {
              const isCompleted = idx < currentPipelineStep;
              const isCurrent = idx === currentPipelineStep;
              
              let stepColor = 'text-white/20 border-white/[0.04] bg-transparent';
              if (isCompleted) {
                stepColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.01]';
              } else if (isCurrent) {
                stepColor = 'text-[#9EA9FF] border-[#9EA9FF]/30 bg-[#9EA9FF]/5 shadow-[0_0_12px_rgba(158,169,255,0.06)] scale-102';
              }

              return (
                <div 
                  key={idx}
                  className={`p-2.5 border rounded-lg flex flex-col justify-between h-16 transition-all duration-300 font-mono text-[9px] ${stepColor}`}
                >
                  <span className="text-[8px] text-[#9E9E9E] block mb-1">NODE_{idx+1}</span>
                  <span className="font-semibold leading-tight line-clamp-2">{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RAG Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Answer Card */}
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur space-y-6">
            <div>
              <h3 className="text-xs uppercase font-mono tracking-wider text-[#9E9E9E] mb-2">Answer</h3>
              <div className="w-full h-[1px] bg-white/[0.08] mb-4" />
              <p className="text-xs text-[#F5F5F5] leading-relaxed font-sans bg-white/[0.01] border border-white/[0.04] p-4 rounded-lg whitespace-pre-wrap">
                {result.answer}
              </p>
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <h4 className="text-xs uppercase font-mono tracking-wider text-[#9E9E9E] mb-3">Sources Used</h4>
              <div className="space-y-3">
                {result.retrievedChunks.map((chunk) => (
                  <div key={chunk.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs border-b border-white/[0.02] pb-2 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <span className="text-white font-medium block truncate max-w-[300px]">{chunk.documentName}</span>
                      <span className="text-[10px] text-[#9E9E9E] font-mono block">Chunk {chunk.id.split('-').pop()}</span>
                    </div>
                    <div className="text-right text-[10px] font-mono text-[#9EA9FF]">
                      Similarity {(chunk.similarity * 100).toFixed(0)}% / Hybrid: {chunk.hybridScore}
                    </div>
                  </div>
                ))}
                {result.retrievedChunks.length === 0 && (
                  <span className="text-xs text-white/30 italic">No source documents cited.</span>
                )}
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#9E9E9E]">Retrieved Context</h4>
                <button
                  type="button"
                  onClick={() => setExpandedChunkId(prev => (prev === 'all' ? null : 'all'))}
                  className="text-[10px] font-mono text-[#9EA9FF] hover:underline cursor-pointer bg-transparent border-0"
                >
                  {expandedChunkId === 'all' ? 'Collapse context' : 'Expand context'}
                </button>
              </div>
              <AnimatePresence>
                {expandedChunkId === 'all' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 max-h-80 overflow-y-auto pr-1 overflow-hidden"
                  >
                    {result.retrievedChunks.map((chunk) => (
                      <div key={chunk.id} className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg space-y-1.5">
                        <div className="flex justify-between text-[9px] font-mono text-[#9E9E9E]">
                          <span>{chunk.documentName} (Chunk {chunk.id.split('-').pop()})</span>
                          <span>Score: {chunk.hybridScore}</span>
                        </div>
                        <p className="text-[11px] text-[#F5F5F5]/90 font-serif italic">
                          "{chunk.text}"
                        </p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Developer Debug Panel */}
          <div className="border border-white/[0.06] rounded-xl bg-white/[0.01] overflow-hidden">
            <button
              type="button"
              onClick={() => setDevModeOpen(!devModeOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors cursor-pointer text-xs font-mono text-[#9EA9FF] bg-transparent border-0"
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${devModeOpen ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`} />
                DEVELOPER DEBUG PANEL
              </span>
              <span>{devModeOpen ? 'HIDE LOGS [-]' : 'SHOW LOGS [+]'}</span>
            </button>

            <AnimatePresence>
              {devModeOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/[0.06] bg-[#070707] overflow-hidden font-mono text-[11px] text-[#9E9E9E]"
                >
                  <div className="p-5 space-y-6">
                    {/* General telemetry */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
                      <div>
                        <span className="block text-[9px] text-[#9E9E9E] font-semibold">TOKEN COUNT</span>
                        <span className="text-xs text-white font-semibold">{result.tokenCount || 0} tokens</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-[#9E9E9E] font-semibold">LLM LATENCY</span>
                        <span className="text-xs text-white font-semibold">{result.llmResponseTimeMs || 0} ms</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-[#9E9E9E] font-semibold">IDENTIFIERS DETECTED</span>
                        <span className="text-xs text-white font-semibold truncate max-w-full block">
                          {result.detectedIdentifiers && result.detectedIdentifiers.length > 0 ? result.detectedIdentifiers.join(', ') : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-[#9E9E9E] font-semibold">METADATA FILTERS</span>
                        <span className="text-xs text-white font-semibold truncate max-w-full block font-sans">
                          {result.metadataFiltersApplied && Object.keys(result.metadataFiltersApplied).length > 0 ? JSON.stringify(result.metadataFiltersApplied) : 'None'}
                        </span>
                      </div>
                    </div>

                    {/* Dense vs BM25 Search Results pools */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dense (Cosine) */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-semibold text-[#9EA9FF] block">Dense Search Results (Qdrant)</span>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3 divide-y divide-white/[0.03] max-h-48 overflow-y-auto">
                          {result.denseSearchResults?.map((c, i) => (
                            <div key={i} className="py-1.5 flex justify-between gap-2 text-[10px]">
                              <span className="truncate flex-1 font-sans text-white/70">{c.documentName} (Chunk {c.id.split('-').pop()})</span>
                              <span className="text-emerald-400 font-mono">{(c.similarity).toFixed(3)}</span>
                            </div>
                          ))}
                          {!result.denseSearchResults?.length && <span className="text-[10px] italic">No dense matches</span>}
                        </div>
                      </div>

                      {/* Sparse (BM25) */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-semibold text-[#D8D3FF] block">Sparse Search Results (BM25)</span>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3 divide-y divide-white/[0.03] max-h-48 overflow-y-auto">
                          {result.bm25SearchResults?.map((c, i) => (
                            <div key={i} className="py-1.5 flex justify-between gap-2 text-[10px]">
                              <span className="truncate flex-1 font-sans text-white/70">{c.documentName} (Chunk {c.id.split('-').pop()})</span>
                              <span className="text-emerald-400 font-mono">{c.bm25Score}</span>
                            </div>
                          ))}
                          {!result.bm25SearchResults?.length && <span className="text-[10px] italic">No sparse matches</span>}
                        </div>
                      </div>
                    </div>

                    {/* Hybrid & Reranker scores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-semibold text-white/70 block">Hybrid Fusion Scores (RRF)</span>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3 space-y-1.5">
                          {result.hybridScores?.map((s, i) => (
                            <div key={i} className="flex justify-between text-[10px]">
                              <span className="font-sans text-white/50 truncate max-w-[70%]">{s.chunkId}</span>
                              <span className="text-[#9EA9FF] font-mono">{s.score}</span>
                            </div>
                          ))}
                          {!result.hybridScores?.length && <span className="text-[10px] italic">No scores</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-semibold text-white/70 block">Reranker Scores (Cross Encoder)</span>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3 space-y-1.5">
                          {result.rerankerScores?.map((s, i) => (
                            <div key={i} className="flex justify-between text-[10px]">
                              <span className="font-sans text-white/50 truncate max-w-[70%]">{s.chunkId}</span>
                              <span className="text-[#D8D3FF] font-mono">{(s.score).toFixed(3)}</span>
                            </div>
                          ))}
                          {!result.rerankerScores?.length && <span className="text-[10px] italic">No scores</span>}
                        </div>
                      </div>
                    </div>

                    {/* Full Prompt Sent to Gemini */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-semibold text-white/70 block">Full Prompt Sent to Gemini</span>
                      <pre className="bg-[#0a0a0a] border border-white/5 p-4 rounded text-[10px] text-white/70 whitespace-pre-wrap max-h-60 overflow-y-auto select-all leading-normal">
                        {result.fullPromptSent}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
