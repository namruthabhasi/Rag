import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  HelpCircle,
  HardDrive,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';

export const UploadDataset: React.FC = () => {
  const { activeUploads, uploadFile, documents } = usePlatform();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File icons selector
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'csv') return <FileSpreadsheet className="text-teal-400" size={18} />;
    if (ext === 'json') return <FileCode className="text-amber-400" size={18} />;
    return <FileText className="text-[#9EA9FF]" size={18} />;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(file => {
        // Validate extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && ['pdf', 'docx', 'txt', 'csv', 'json'].includes(ext)) {
          uploadFile(file);
        }
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        uploadFile(file);
      });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-8">
      {/* Page header intro */}
      <div>
        <h1 className="text-xl font-heading font-medium text-[#F5F5F5] mb-1">
          Ingestion Workspace
        </h1>
        <p className="text-xs text-[#9E9E9E]">
          Upload documents to construct hybrid search indexes. PrecisionRAG parses structured identifiers automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Action Area */}
        <div className="lg:col-span-2 space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[260px] ${
              dragActive 
                ? 'border-[#9EA9FF] bg-[#9EA9FF]/5 shadow-[0_0_25px_rgba(158,169,255,0.08)]' 
                : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.15] hover:bg-white/[0.02]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.csv,.json"
              className="hidden"
            />
            <div className="h-12 w-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[#9E9E9E] mb-4">
              <Upload size={20} className="animate-pulse" />
            </div>
            <h3 className="text-sm font-heading font-medium text-[#F5F5F5] mb-1.5">
              Drag & Drop files here, or <span className="text-[#9EA9FF] underline hover:text-[#D8D3FF]">Browse Files</span>
            </h3>
            <p className="text-[11px] text-[#9E9E9E] max-w-xs leading-relaxed mb-1">
              Supports PDF, DOCX, TXT, CSV, and JSON formats.
            </p>
            <span className="text-[10px] text-white/30 font-mono">Max file size: 50MB</span>
          </div>

          {/* Active Ingest Pipelines */}
          {activeUploads.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold">
                Ingestion Pipelines
              </h2>
              <div className="space-y-4">
                <AnimatePresence>
                  {activeUploads.map((upload) => (
                    <motion.div
                      key={upload.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4"
                    >
                      {/* Upload header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileIcon(upload.fileName)}
                          <div className="min-w-0">
                            <h4 className="text-xs text-[#F5F5F5] font-medium truncate max-w-[250px] sm:max-w-[400px]">
                              {upload.fileName}
                            </h4>
                            <span className="text-[10px] text-[#9E9E9E] font-mono">
                              {(upload.fileSize / 1024).toFixed(1)} KB • {upload.progress}% Complete
                            </span>
                          </div>
                        </div>

                        {upload.status === 'completed' ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-medium">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[10px] text-[#9EA9FF] font-mono">
                            <Loader2 size={12} className="animate-spin" />
                            Ingesting...
                          </span>
                        )}
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-[#0d0d0d] h-1 rounded-full overflow-hidden border border-white/[0.04]">
                        <motion.div 
                          className="bg-accent-grad h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>

                      {/* Interactive Step Timeline visualization */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        {upload.steps.map((step, idx) => {
                          let stepColor = 'text-white/20 border-white/[0.04] bg-transparent';
                          let icon = <span className="h-1.5 w-1.5 rounded-full bg-white/20" />;

                          if (step.status === 'completed') {
                            stepColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.02]';
                            icon = <CheckCircle2 size={10} className="text-emerald-400" />;
                          } else if (step.status === 'running') {
                            stepColor = 'text-[#9EA9FF] border-[#9EA9FF]/20 bg-[#9EA9FF]/[0.02]';
                            icon = <Loader2 size={10} className="text-[#9EA9FF] animate-spin" />;
                          }

                          return (
                            <div 
                              key={idx}
                              className={`p-2 border rounded-lg flex items-center gap-1.5 text-[10px] transition-all duration-300 font-mono ${stepColor}`}
                            >
                              {icon}
                              <span className="truncate">{step.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Info panel & Recent lists */}
        <div className="space-y-6">
          {/* Index Guidelines */}
          <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4">
            <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold flex items-center gap-1.5">
              <HelpCircle size={14} className="text-[#9EA9FF]" /> Ingestion Schema
            </h2>
            <div className="space-y-3.5 text-xs text-[#9E9E9E]">
              <div className="space-y-1">
                <span className="font-heading font-medium text-white block">Identifier Detection</span>
                <span className="text-[11px] leading-relaxed block">
                  Exact keys (e.g. <span className="font-mono text-[#D8D3FF]">Article 24-B</span>, <span className="font-mono text-[#D8D3FF]">INV-2025-001</span>) are extracted via regex and mapped into high-priority index tables.
                </span>
              </div>
              <div className="space-y-1">
                <span className="font-heading font-medium text-white block">Semantic Embedding</span>
                <span className="text-[11px] leading-relaxed block">
                  Paragraph text is converted into multi-dimensional floating point embeddings, allowing meaning-based matching.
                </span>
              </div>
              <div className="space-y-1">
                <span className="font-heading font-medium text-white block">Sparse Inverted Indexing</span>
                <span className="text-[11px] leading-relaxed block">
                  BM25 values are calculated to ensure keyword queries (names, codes) match with pixel-perfect accuracy.
                </span>
              </div>
            </div>
          </div>

          {/* Recently Uploaded Quick List */}
          <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4">
            <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold flex items-center gap-1.5">
              <HardDrive size={14} className="text-[#D8D3FF]" /> Recently Indexed
            </h2>
            <div className="space-y-3">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex justify-between items-center text-xs border-b border-white/[0.03] pb-2 last:border-0 last:pb-0">
                  <div className="space-y-0.5 truncate max-w-[70%]">
                    <span className="text-white block font-medium truncate">{doc.name}</span>
                    <span className="text-[10px] text-[#9E9E9E] block font-mono">
                      {(doc.sizeBytes / 1024).toFixed(1)} KB • {doc.chunksCount} chunks
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#9EA9FF] bg-[#9EA9FF]/5 border border-[#9EA9FF]/10 px-2 py-0.5 rounded font-mono">
                      {doc.type}
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
