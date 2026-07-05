import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Trash2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Tag, 
  Hash, 
  Loader2
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import { EmptyState } from '@/components/EmptyState';

export const Documents: React.FC = () => {
  const { documents, deleteDocument, reindexDocument } = usePlatform();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDocument(id);
    } catch (e) {
      console.error('Failed to delete document:', e);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter documents by search
  const filteredDocs = documents.filter((doc) => {
    return (
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.identifiers.some(id => id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      doc.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const toggleExpandRow = (id: string) => {
    if (expandedDocId === id) {
      setExpandedDocId(null);
    } else {
      setExpandedDocId(id);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-heading font-medium text-[#F5F5F5] mb-1">
            Documents Explorer
          </h1>
          <p className="text-xs text-[#9E9E9E]">
            Manage and inspect ingested documents. View chunk mappings, metadata bindings, and exact identifiers.
          </p>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by name, ID, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0c0c0c] border border-white/[0.08] focus:border-[#9EA9FF]/50 rounded-lg pl-9 pr-4 py-2 text-xs text-[#F5F5F5] focus:outline-none transition-all"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-[#9E9E9E]" />
        </div>
      </div>

      {filteredDocs.length > 0 ? (
        /* Document Table */
        <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[#9E9E9E] font-medium font-mono">
                  <th className="p-4 w-6"></th>
                  <th className="p-4">Document</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Identifiers</th>
                  <th className="p-4">Chunks</th>
                  <th className="p-4">Index Status</th>
                  <th className="p-4">Upload Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredDocs.map((doc) => {
                  const isExpanded = expandedDocId === doc.id;
                  const isProcessing = doc.status === 'processing';

                  return (
                    <React.Fragment key={doc.id}>
                      {/* Standard Table Row */}
                      <tr 
                        onClick={() => toggleExpandRow(doc.id)}
                        className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${
                          isExpanded ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        <td className="p-4">
                          {isExpanded ? (
                            <ChevronUp size={14} className="text-[#9E9E9E]" />
                          ) : (
                            <ChevronDown size={14} className="text-[#9E9E9E]" />
                          )}
                        </td>
                        <td className="p-4 font-medium text-white max-w-[200px] truncate">
                          {doc.name}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] text-[#9EA9FF] bg-[#9EA9FF]/5 border border-[#9EA9FF]/10 px-2 py-0.5 rounded font-mono">
                            {doc.type}
                          </span>
                        </td>
                        <td className="p-4">
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
                        <td className="p-4 font-mono">{doc.chunksCount}</td>
                        <td className="p-4">
                          {isProcessing ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#9EA9FF] font-mono">
                              <Loader2 size={10} className="animate-spin" />
                              reindexing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                              <span className="h-1 w-1 bg-emerald-400 rounded-full" />
                              {doc.status}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-[#9E9E9E] font-mono">
                          {formatDate(doc.uploadDate)}
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => reindexDocument(doc.id)}
                              disabled={isProcessing}
                              title="Re-index Document"
                              className="p-1.5 rounded hover:bg-white/[0.04] text-[#9E9E9E] hover:text-[#F5F5F5] disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              <RefreshCw size={12} className={isProcessing ? 'animate-spin' : ''} />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              title="Delete Document"
                              className="p-1.5 rounded hover:bg-red-500/[0.04] text-[#9E9E9E] hover:text-red-400 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              {deletingId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Detail View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="p-0 bg-[#080808]/50 border-b border-white/[0.06]">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
                                  {/* Metadata Column */}
                                  <div className="space-y-4">
                                    <h4 className="text-[10px] uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold flex items-center gap-1.5">
                                      <Tag size={12} className="text-[#9EA9FF]" /> Extracted Metadata Schema
                                    </h4>
                                    <div className="bg-white/[0.01] border border-white/[0.05] p-4 rounded-lg space-y-2">
                                      {Object.entries(doc.metadata).map(([key, val]) => (
                                        <div key={key} className="flex justify-between items-center py-1 border-b border-white/[0.02] last:border-0">
                                          <span className="font-mono text-[#9E9E9E]">{key}</span>
                                          <span className="font-mono text-[#F5F5F5] font-medium">{val}</span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between items-center py-1">
                                        <span className="font-mono text-[#9E9E9E]">fileSize</span>
                                        <span className="font-mono text-[#F5F5F5] font-medium">{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Chunks Explorer Column */}
                                  <div className="md:col-span-2 space-y-4">
                                    <h4 className="text-[10px] uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold flex items-center gap-1.5">
                                      <Hash size={12} className="text-[#D8D3FF]" /> Document Chunks preview
                                    </h4>
                                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                      {(doc.chunks ?? []).length === 0 && (
                                        <p className="text-[11px] text-[#9E9E9E] italic px-2">
                                          Chunk previews are stored in the vector index. Run a query to retrieve them.
                                        </p>
                                      )}
                                      {(doc.chunks ?? []).map((chunk, idx) => (
                                        <div 
                                          key={chunk.id} 
                                          className="p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-lg transition-all"
                                        >
                                          <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[9px] font-mono text-[#9EA9FF]">
                                              Chunk #{idx + 1}
                                            </span>
                                            <span className="text-[9px] font-mono text-[#9E9E9E] uppercase">
                                              Index ID: {chunk.id}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-[#F5F5F5]/90 font-serif italic">
                                            "{chunk.text}"
                                          </p>
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {Object.entries(chunk.matchedMetadata).map(([k, v]) => (
                                              <span key={k} className="text-[8px] font-mono px-1 rounded bg-[#D8D3FF]/10 text-[#D8D3FF] border border-[#D8D3FF]/20">
                                                {k}: {v}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <EmptyState
          icon={FileText}
          title="No documents match search"
          description="Try adjusting your filter keyword or upload a new file to proceed."
          actionLabel="Clear Filter"
          onAction={() => setSearchTerm('')}
        />
      )}
    </div>
  );
};
