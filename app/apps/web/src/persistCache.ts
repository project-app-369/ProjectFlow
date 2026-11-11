import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { apiMode, getCurrentAsOf, getUserId } from './api';

/**
 * Keeps the query cache in localStorage so a reload shows the last data at once and refreshes it in the background.
 * Every call to the sheets backend costs seconds, so waiting for them on each visit is the slow part of the app.
 * The cache is dropped after a day, when the backend or the user changes, on sign-out, and while a saved cut-off
 * report is open (its data must never be shown as the current data).
 */
const KEY = 'projectflow.query-cache.v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CHARS = 2_500_000;
const SAVE_DELAY_MS = 1_500;

const scope = () => `${apiMode}|${String(import.meta.env.VITE_SHEETS_URL ?? '').slice(-16)}|${getUserId() ?? ''}`;

interface Stored { scope: string; savedAt: number; state: ReturnType<typeof dehydrate> }

export function restoreQueryCache(client: QueryClient) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Stored;
    if (stored.scope !== scope() || Date.now() - stored.savedAt > MAX_AGE_MS) { localStorage.removeItem(KEY); return; }
    hydrate(client, stored.state);
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }
}

export function persistQueryCache(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    if (getCurrentAsOf()) return;
    try {
      const text = JSON.stringify({ scope: scope(), savedAt: Date.now(), state: dehydrate(client) } satisfies Stored);
      if (text.length <= MAX_CHARS) localStorage.setItem(KEY, text);
    } catch { /* storage full or unavailable: the app works without it */ }
  };
  client.getQueryCache().subscribe(() => { if (timer === undefined) timer = setTimeout(save, SAVE_DELAY_MS); });
  window.addEventListener('projectflow:signed-out', () => { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } });
}
