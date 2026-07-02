import React, { useState } from 'react';
import { 
  Search, 
  UploadCloud, 
  HardDrive, 
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSearchQuery: (text: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSearchQuery }) => {
  const { documents, queries, settings, clearQueryHistory } = usePlatform();
  const [quickSearch, setQuickSearch] = useState('');

  // Handle quick search trigger
  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    onSearchQuery(quickSearch);
    onNavigate('query');
  };

  // Calculated statistics
  const totalDocs = documents.length;
  const totalChunks = documents.reduce((acc, curr) => acc + curr.chunksCount, 0);
  const totalIdentifiers = documents.reduce((acc, curr) => acc + curr.identifiers.length, 0);
  const totalSizeKB = (documents.reduce((acc, curr) => acc + curr.sizeBytes, 0) / 1024).toFixed(1);

  // Status lists
  const statusItems = [
    { name: 'Qdrant Instance', status: 'Healthy', details: settings.database },
    { name: 'BM25 Sparse Index', status: 'Healthy', details: 'Initialized' },
    { name: 'Embedding Model', status: 'Loaded', details: settings.embeddingModel },
    { name: 'Gemini LLM Connection', status: 'Connected', details: settings.llm },
    { name: 'Cross Encoder (Reranker)', status: 'Loaded', details: settings.reranker },
  ];

  // Activities timeline
  const activities = [
    { time: 'Just now', event: 'Index updated', desc: `BM25 & Vector sync successful for ${totalDocs} documents.` },
    { time: '2 mins ago', event: 'Query executed', desc: queries[0] ? `Search query completed: "${queries[0].query}" in ${queries[0].processingTimeMs}ms.` : 'Platform ready for search queries.' },
    { time: '10 mins ago', event: 'Metadata extracted', desc: 'Auto-categorization mapped schema entities.' },
    { time: '1 hour ago', event: 'Embedding completed', desc: 'Text blocks converted to dense vector dimensions.' },
    { time: '1 day ago', event: 'Knowledge base initialized', desc: 'PrecisionRAG workspace mounted successfully.' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-heading font-medium text-[#F5F5F5] mb-1">
            Welcome back, Operator
          </h1>
          <p className="text-xs text-[#9E9E9E]">
            Last login: Today, 18:30 • Embedding Model: <span className="text-[#9EA9FF] font-mono">{settings.embeddingModel}</span>
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => onNavigate('upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] text-xs font-medium text-[#F5F5F5] transition-all cursor-pointer"
          >
            <UploadCloud size={14} className="text-[#9EA9FF]" />
            Upload Dataset
          </button>
          <button
            onClick={() => onNavigate('query')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9EA9FF] hover:bg-[#D8D3FF] text-xs font-medium text-[#050505] transition-all duration-300 shadow-[0_0_12px_rgba(158,169,255,0.1)] cursor-pointer"
          >
            Query Workspace
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Grid: Quick Search & Knowledge Base */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Search */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-heading font-semibold text-[#F5F5F5] mb-1.5">
              Quick Query Input
            </h2>
            <p className="text-xs text-[#9E9E9E] mb-4">
              Submit immediate queries to test identifier detection and hybrid retrieval.
            </p>
            <form onSubmit={handleQuickSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Ask about Article 24-B or INV-2025-001..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full bg-[#0c0c0c] border border-white/[0.08] focus:border-[#9EA9FF]/50 hover:border-white/[0.12] rounded-lg px-4 py-2.5 text-xs text-[#F5F5F5] focus:outline-none transition-all pr-10"
              />
              <button 
                type="submit"
                className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-white/[0.04] text-[#9E9E9E] hover:text-[#F5F5F5] transition-colors cursor-pointer"
              >
                <Search size={14} />
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[10px] uppercase font-mono text-[#9E9E9E] tracking-wider">
                Recent Queries
              </span>
              {queries.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueryHistory}
                  className="text-[9px] font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer bg-transparent border-0"
                >
                  Clear History
                </button>
              )}
            </div>
            <div className="space-y-1.5 font-mono">
              {queries.length > 0 ? (
                queries.slice(0, 10).map((q) => {
                  const displayQuery = q.query.length > 60 ? q.query.substring(0, 60) + '...' : q.query;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        onSearchQuery(q.query);
                        onNavigate('query');
                      }}
                      className="w-full flex items-center justify-between text-xs text-[#9E9E9E] hover:text-[#F5F5F5] py-1.5 px-2 rounded hover:bg-white/[0.01] transition-all text-left"
                    >
                      <span className="truncate flex-1 max-w-[75%]">"{displayQuery}"</span>
                      <span className="text-[10px] text-white/30 shrink-0">{q.mode} • {(q.confidence * 100).toFixed(0)}%</span>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-white/30 italic font-mono">No recent searches.</p>
              )}
            </div>
          </div>
        </div>

        {/* Knowledge Base Statistics */}
        <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur space-y-5">
          <h2 className="text-sm font-heading font-semibold text-[#F5F5F5]">
            Knowledge Base Index
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg">
              <span className="text-[10px] text-[#9E9E9E] block mb-1">Documents</span>
              <span className="text-xl font-heading font-semibold text-[#F5F5F5]">{totalDocs}</span>
            </div>
            <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg">
              <span className="text-[10px] text-[#9E9E9E] block mb-1">Total Chunks</span>
              <span className="text-xl font-heading font-semibold text-[#F5F5F5]">{totalChunks}</span>
            </div>
            <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg">
              <span className="text-[10px] text-[#9E9E9E] block mb-1">Identifiers</span>
              <span className="text-xl font-heading font-semibold text-[#F5F5F5]">{totalIdentifiers}</span>
            </div>
            <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg flex items-center gap-1">
              <HardDrive size={14} className="text-[#D8D3FF] mb-3" />
              <div>
                <span className="text-[10px] text-[#9E9E9E] block mb-1">Storage</span>
                <span className="text-sm font-semibold text-[#F5F5F5]">{totalSizeKB} KB</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#9E9E9E] bg-[#0c0c0c] border border-white/[0.05] p-2.5 rounded-lg space-y-1 font-mono">
            <div>Engine Mode: <span className="text-[#9EA9FF]">Precision Search Enabled</span></div>
            <div>Retrieval Status: <span className="text-emerald-400">Ready</span></div>
          </div>
        </div>
      </div>

      {/* Grid: Recent Documents & Retrieval Status / Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents Table */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-heading font-semibold text-[#F5F5F5]">
                Recent Indexed Documents
              </h2>
              <button
                onClick={() => onNavigate('documents')}
                className="text-[10px] text-[#9EA9FF] hover:text-[#D8D3FF] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                View all <ChevronRight size={10} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[#9E9E9E] pb-2 font-medium">
                    <th className="py-2.5">Document</th>
                    <th className="py-2.5">Identifiers</th>
                    <th className="py-2.5">Chunks</th>
                    <th className="py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] text-[#F5F5F5]">
                  {documents.slice(0, 4).map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.01] transition-all">
                      <td className="py-3 font-medium flex flex-col">
                        <span className="truncate max-w-[180px]">{doc.name}</span>
                        <span className="text-[10px] text-[#9E9E9E]">{doc.type} • {(doc.sizeBytes/1024).toFixed(1)}KB</span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {doc.identifiers.map((ident) => (
                            <span 
                              key={ident} 
                              className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] font-mono text-[#D8D3FF]"
                            >
                              {ident}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 font-mono">{doc.chunksCount}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                          <span className="h-1 w-1 bg-emerald-400 rounded-full" />
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Status Indicators & Activity Log */}
        <div className="space-y-6">
          {/* Retrieval Status */}
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur">
            <h2 className="text-sm font-heading font-semibold text-[#F5F5F5] mb-4">
              Retrieval Environment
            </h2>
            <div className="space-y-3">
              {statusItems.map((item) => (
                <div key={item.name} className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[#F5F5F5] font-medium">{item.name}</span>
                    <span className="text-[10px] text-[#9E9E9E] block font-mono">{item.details}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-400 font-mono text-[10px]">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur">
            <h2 className="text-sm font-heading font-semibold text-[#F5F5F5] mb-4">
              Workspace Operations
            </h2>
            <div className="space-y-4">
              {activities.map((act, idx) => (
                <div key={idx} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#9EA9FF] mt-1" />
                    {idx < activities.length - 1 && (
                      <div className="w-[1px] bg-white/[0.06] flex-1 my-1" />
                    )}
                  </div>
                  <div className="space-y-0.5 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#F5F5F5] font-medium">{act.event}</span>
                      <span className="text-[9px] text-[#9E9E9E] font-mono">{act.time}</span>
                    </div>
                    <span className="text-[10px] text-[#9E9E9E] leading-relaxed block">
                      {act.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
