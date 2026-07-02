import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformProvider } from './context/PlatformContext';
import { Landing } from './pages/Landing';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UploadDataset } from './pages/Upload';
import { Documents } from './pages/Documents';
import { QueryWorkspace } from './pages/Query';
import { RetrievalPipeline } from './pages/Pipeline';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

// Initialize React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function MainApp() {
  const [showLanding, setShowLanding] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchText, setSearchText] = useState('');

  // Handle logout / return to landing
  const handleLogout = () => {
    setShowLanding(true);
  };

  // Trigger search from dashboard quick actions
  const handleSearchQuery = (text: string) => {
    setSearchText(text);
    setActiveTab('query');
  };

  if (showLanding) {
    return <Landing onEnter={() => setShowLanding(false)} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
          onNavigate={setActiveTab} 
          onSearchQuery={handleSearchQuery} 
        />
      )}
      {activeTab === 'upload' && <UploadDataset />}
      {activeTab === 'documents' && <Documents />}
      {activeTab === 'query' && (
        <QueryWorkspace 
          searchText={searchText} 
          setSearchText={setSearchText} 
        />
      )}
      {activeTab === 'pipeline' && <RetrievalPipeline />}
      {activeTab === 'analytics' && <Analytics />}
      {activeTab === 'settings' && <Settings />}
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlatformProvider>
        <MainApp />
      </PlatformProvider>
    </QueryClientProvider>
  );
}
