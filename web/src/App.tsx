/**
 * MaxTrade App
 * Main application with routing
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Screener } from './pages/Screener';
import { Strategies } from './pages/Strategies';
import { Portfolio } from './pages/Portfolio';
import { AIAssistant } from './pages/AIAssistant';
import { Settings } from './pages/Settings';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="screener" element={<Screener />} />
            <Route path="strategies" element={<Strategies />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
