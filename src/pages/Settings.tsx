import React, { useState } from 'react';
import { 
  Database, 
  Trash2, 
  Sliders, 
  Download, 
  CheckCircle2
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';

export const Settings: React.FC = () => {
  const { settings, updateSettings, resetIndex } = usePlatform();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSelectChange = (key: keyof typeof settings, val: any) => {
    updateSettings({ [key]: val });
    triggerSaveNotification();
  };

  const handleSliderChange = (key: keyof typeof settings, val: number) => {
    updateSettings({ [key]: val });
    triggerSaveNotification();
  };

  const triggerSaveNotification = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  const handleResetClick = () => {
    resetIndex();
    setShowResetConfirm(false);
    triggerSaveNotification();
  };

  // Export settings helper
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "precisionrag_settings.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-2 font-mono">
          <CheckCircle2 size={14} />
          <span>Configuration updated successfully. Indices synchronized.</span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-xl font-heading font-medium text-[#F5F5F5] mb-1">
          Hyperparameter Settings
        </h1>
        <p className="text-xs text-[#9E9E9E]">
          Tune the retrieval weights, chunking variables, vector index configurations, and synthesis LLM model targets.
        </p>
      </div>

      <div className="space-y-6">
        {/* Core RAG Infrastructure Configuration */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
          <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold flex items-center gap-1.5 border-b border-white/[0.04] pb-3">
            <Database size={14} className="text-[#9EA9FF]" /> Retrieval Environment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Embedding Model */}
            <div className="space-y-1.5">
              <label className="text-[#F5F5F5] font-medium block">Vector Embedding Model</label>
              <select
                value={settings.embeddingModel}
                onChange={(e) => handleSelectChange('embeddingModel', e.target.value)}
                className="w-full bg-[#0c0c0c] border border-white/[0.08] focus:border-[#9EA9FF]/50 rounded-lg px-3 py-2 text-[#F5F5F5] outline-none"
              >
                <option value="Gemini Text Embedding">Gemini Text Embedding (1536d)</option>
                <option value="Cohere V3">Cohere Embed V3 (1024d)</option>
                <option value="OpenAI text-embedding-3-small">OpenAI text-embedding-3-small</option>
              </select>
              <span className="text-[10px] text-[#9E9E9E] block">Defines semantic vector dimension mapping.</span>
            </div>

            {/* Vector DB */}
            <div className="space-y-1.5">
              <label className="text-[#F5F5F5] font-medium block">Vector Database Instance</label>
              <select
                value={settings.database}
                onChange={(e) => handleSelectChange('database', e.target.value)}
                className="w-full bg-[#0c0c0c] border border-white/[0.08] focus:border-[#9EA9FF]/50 rounded-lg px-3 py-2 text-[#F5F5F5] outline-none"
              >
                <option value="Qdrant (Cloud)">Qdrant (Cloud Cluster)</option>
                <option value="Qdrant (Local)">Qdrant (Local Docker Node)</option>
              </select>
              <span className="text-[10px] text-[#9E9E9E] block">Target instance for collection index stores.</span>
            </div>

            {/* Reranker */}
            <div className="space-y-1.5">
              <label className="text-[#F5F5F5] font-medium block">Cross Encoder Reranker</label>
              <select
                value={settings.reranker}
                onChange={(e) => handleSelectChange('reranker', e.target.value)}
                className="w-full bg-[#0c0c0c] border border-white/[0.08] focus:border-[#9EA9FF]/50 rounded-lg px-3 py-2 text-[#F5F5F5] outline-none"
              >
                <option value="Cohere Rerank v3">Cohere Rerank v3</option>
                <option value="BGE-Reranker-Large">BGE-Reranker-Large</option>
                <option value="None">None (Direct Fusion Rank)</option>
              </select>
              <span className="text-[10px] text-[#9E9E9E] block">Reranks candidate results for high precision.</span>
            </div>

            {/* LLM Synthesis */}
            <div className="space-y-1.5">
              <label className="text-[#F5F5F5] font-medium block">Synthesis LLM</label>
              <select
                value={settings.llm}
                onChange={(e) => handleSelectChange('llm', e.target.value)}
                className="w-full bg-[#0c0c0c] border border-white/[0.08] focus:border-[#9EA9FF]/50 rounded-lg px-3 py-2 text-[#F5F5F5] outline-none"
              >
                <option value="Gemini Pro">Gemini Pro</option>
                <option value="GPT-4o">GPT-4o</option>
                <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
              </select>
              <span className="text-[10px] text-[#9E9E9E] block">Synthesizes final answer from top context chunks.</span>
            </div>
          </div>
        </div>

        {/* Chunking & Retrieval Parameters */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
          <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold flex items-center gap-1.5 border-b border-white/[0.04] pb-3">
            <Sliders size={14} className="text-[#D8D3FF]" /> Chunking & Tuning Params
          </h2>

          <div className="space-y-5 text-xs">
            {/* Chunk Size / Overlap Slider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[#F5F5F5] font-medium">Chunk Size (Words)</label>
                  <span className="font-mono text-[#9EA9FF]">{settings.chunkSize}</span>
                </div>
                <input
                  type="range"
                  min="128"
                  max="1024"
                  step="64"
                  value={settings.chunkSize}
                  onChange={(e) => handleSliderChange('chunkSize', parseInt(e.target.value))}
                  className="w-full accent-[#9EA9FF] bg-[#0c0c0c] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[#F5F5F5] font-medium">Chunk Overlap (Words)</label>
                  <span className="font-mono text-[#9EA9FF]">{settings.chunkOverlap}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="256"
                  step="16"
                  value={settings.chunkOverlap}
                  onChange={(e) => handleSliderChange('chunkOverlap', parseInt(e.target.value))}
                  className="w-full accent-[#9EA9FF] bg-[#0c0c0c] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Retrieval Weights & Top-K */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[#F5F5F5] font-medium">Dense Weight</label>
                  <span className="font-mono text-[#9EA9FF]">{settings.denseWeight}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.denseWeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateSettings({ denseWeight: val, bm25Weight: parseFloat((1 - val).toFixed(1)) });
                    triggerSaveNotification();
                  }}
                  className="w-full accent-[#9EA9FF] bg-[#0c0c0c] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[#F5F5F5] font-medium">Sparse (BM25) Weight</label>
                  <span className="font-mono text-[#9EA9FF]">{settings.bm25Weight}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.bm25Weight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateSettings({ bm25Weight: val, denseWeight: parseFloat((1 - val).toFixed(1)) });
                    triggerSaveNotification();
                  }}
                  className="w-full accent-[#9EA9FF] bg-[#0c0c0c] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[#F5F5F5] font-medium">Top K Chunks</label>
                  <span className="font-mono text-[#9EA9FF]">{settings.topK}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={settings.topK}
                  onChange={(e) => handleSliderChange('topK', parseInt(e.target.value))}
                  className="w-full accent-[#9EA9FF] bg-[#0c0c0c] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-1.5 md:w-1/2 pt-2">
              <div className="flex justify-between">
                <label className="text-[#F5F5F5] font-medium">LLM Temperature</label>
                <span className="font-mono text-[#9EA9FF]">{settings.temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.temperature}
                onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
                className="w-full accent-[#9EA9FF] bg-[#0c0c0c] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Index Control & Maintenance actions */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
          <h2 className="text-xs uppercase font-mono text-red-400 tracking-wider font-semibold flex items-center gap-1.5 border-b border-white/[0.04] pb-3">
            <Trash2 size={14} /> Index Administration
          </h2>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
            <div className="space-y-0.5 max-w-md">
              <span className="text-[#F5F5F5] font-medium block">Clear Knowledge Base Index</span>
              <span className="text-[11px] text-[#9E9E9E] leading-relaxed block">
                Permanently drops the Qdrant collection tables and resets the BM25 sparse inverted indices. This action is irreversible.
              </span>
            </div>
            
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex-shrink-0"
              >
                Reset Index
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0 bg-red-950/30 border border-red-500/30 p-2 rounded-lg">
                <span className="text-[10px] text-red-300 font-medium">Are you sure?</span>
                <button
                  onClick={handleResetClick}
                  className="px-2.5 py-1 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-1 text-[10px] bg-white/5 text-[#9E9E9E] rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Sharing */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
          <div className="space-y-0.5">
            <span className="text-[#F5F5F5] font-medium block">Export/Import Settings Schema</span>
            <span className="text-[11px] text-[#9E9E9E] leading-relaxed block">
              Back up or sync the active hyperparameter settings array using local JSON templates.
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] font-medium transition-colors cursor-pointer"
            >
              <Download size={12} />
              Export Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
