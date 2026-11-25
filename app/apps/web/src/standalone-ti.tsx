import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrefsProvider } from './state';
import TISequence from './pages/TISequence';
import './styles.css';

// The Jacket T&I sequence on its own page (ProjectFlow/ti.jacket.sequence): the same view as in the app, without the app shell, the router or the API.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <TISequence standalone />
      </PrefsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
