import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import { persistQueryCache, restoreQueryCache } from './persistCache';
import { registerServiceWorker } from './pwa';
import { PrefsProvider, ToastProvider } from './state';
import './styles.css';

// Reads from the sheets backend take seconds, so data is treated as fresh for a minute (every write refreshes what it touches)
// and the last cache is restored from storage so a reload does not start from an empty screen.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 24 * 60 * 60 * 1000, retry: 1, refetchOnWindowFocus: false } } });
const StaticRouter = import.meta.env.VITE_STATIC_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;
if (import.meta.env.VITE_STATIC_HASH_ROUTER !== 'true') registerServiceWorker();
restoreQueryCache(queryClient);
persistQueryCache(queryClient);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <ToastProvider>
          <StaticRouter>
            <App />
          </StaticRouter>
        </ToastProvider>
      </PrefsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
