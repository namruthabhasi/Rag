import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  UploadCloud, 
  FileText, 
  Search, 
  GitFork, 
  BarChart2, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Cpu,
  LogOut,
  Bell
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { documents, activeUploads, settings } = usePlatform();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', name: 'Upload Dataset', icon: UploadCloud, badge: activeUploads.filter(u => u.status === 'processing').length || undefined },
    { id: 'documents', name: 'Documents', icon: FileText, badge: documents.length || undefined },
    { id: 'query', name: 'Query Workspace', icon: Search },
    { id: 'pipeline', name: 'Retrieval Pipeline', icon: GitFork },
    { id: 'analytics', name: 'Analytics', icon: BarChart2 },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5] flex overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
        className="h-screen bg-[#080808] border-r border-white/[0.06] flex flex-col justify-between z-20 relative flex-shrink-0"
      >
        <div>
          {/* Logo & Toggle */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06]">
            {!collapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="h-7 w-7 rounded bg-accent-grad flex items-center justify-center font-heading font-bold text-black text-sm">
                  P
                </div>
                <span className="font-heading font-semibold text-base tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                  PrecisionRAG
                </span>
              </motion.div>
            )}

            {collapsed && (
              <div className="h-7 w-7 rounded bg-accent-grad flex items-center justify-center font-heading font-bold text-black text-sm mx-auto">
                P
              </div>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative cursor-pointer ${
                    isActive 
                      ? 'bg-white/[0.04] border border-white/[0.08] text-[#F5F5F5]' 
                      : 'text-[#9E9E9E] hover:text-[#F5F5F5] hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-[#9EA9FF]' : 'text-[#9E9E9E] group-hover:text-white transition-colors'} />
                  
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-medium tracking-wide flex-1 text-left"
                    >
                      {item.name}
                    </motion.span>
                  )}

                  {/* Badge */}
                  {!collapsed && item.badge !== undefined && (
                    <span className="bg-[#9EA9FF]/10 text-[#9EA9FF] text-[10px] px-2 py-0.5 rounded-full border border-[#9EA9FF]/20 font-mono font-medium">
                      {item.badge}
                    </span>
                  )}

                  {/* Collapsed Badge Dot */}
                  {collapsed && item.badge !== undefined && (
                    <span className="absolute top-2 right-2 h-2 w-2 bg-[#9EA9FF] rounded-full border border-[#080808]" />
                  )}

                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 w-1 h-5 bg-gradient-to-b from-[#9EA9FF] to-[#D8D3FF] rounded-r"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          {/* Status logs */}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5 space-y-2 text-[11px] text-[#9E9E9E]"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono">
                  <Database size={10} className="text-[#9EA9FF]" /> Qdrant
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono text-emerald-500">online</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono">
                  <Cpu size={10} className="text-[#D8D3FF]" /> {settings.llm}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono text-emerald-500">ready</span>
                </span>
              </div>
            </motion.div>
          )}

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.03] transition-all cursor-pointer"
          >
            <LogOut size={16} />
            {!collapsed && <span className="font-medium">Exit Workspace</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-md px-6 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-heading font-medium tracking-wide text-[#F5F5F5]">
              {menuItems.find(i => i.id === activeTab)?.name}
            </h2>
            <span className="text-[#9E9E9E] text-xs">/</span>
            <span className="text-xs text-[#9E9E9E] font-mono uppercase bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
              {settings.database.split(' ')[0]}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick status summary */}
            <div className="hidden sm:flex items-center gap-4 text-xs text-[#9E9E9E] font-mono">
              <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.05] px-2.5 py-1 rounded">
                <span>Model:</span>
                <span className="text-[#F5F5F5]">{settings.embeddingModel}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.05] px-2.5 py-1 rounded">
                <span>Reranker:</span>
                <span className="text-[#F5F5F5]">{settings.reranker}</span>
              </div>
            </div>

            {/* Notification bell */}
            <button className="p-2 rounded-lg hover:bg-white/[0.04] text-[#9E9E9E] hover:text-[#F5F5F5] transition-colors relative cursor-pointer">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-[#FFB3C7] rounded-full" />
            </button>

            {/* User profile */}
            <div className="h-7 w-7 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-xs font-heading font-medium text-[#F5F5F5]">
              JD
            </div>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto px-6 py-8 relative">
          <div className="max-w-[1400px] mx-auto w-full pb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
                className="w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};
