import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const loaders: (() => Promise<unknown>)[] = [];

/** `lazy` that also remembers its loader, so the chunk can be fetched ahead of the click. */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): LazyExoticComponent<T> {
  let pending: Promise<{ default: T }> | undefined;
  const once = () => (pending ??= load());
  loaders.push(once);
  if (started && !running) pump(); // a chunk registered after the walk ended (a chart used by a screen that has just loaded)
  return lazy(once);
}

let started = false;
let running = false;
let cursor = 0;
const idle = (fn: () => void) => ('requestIdleCallback' in window ? (window as Window & { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(fn) : setTimeout(fn, 300));

function pump() {
  running = true;
  idle(function next() {
    if (cursor >= loaders.length) { running = false; return; }
    void loaders[cursor++]().catch(() => undefined).finally(() => idle(next));
  });
}

/** Fetches every screen's code one at a time once the browser is idle (never on Save-Data or a slow link), so opening a screen needs no download. */
export function prefetchPages() {
  if (started) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
  started = true;
  pump();
}
