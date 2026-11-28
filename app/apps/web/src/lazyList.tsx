import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from './api';
import { Btn } from './ui';

/**
 * Long lists load as you scroll. Registers that page on the server use `useInfiniteList`; lists that arrive whole use
 * `useProgressive`. Both hand a `LazySource` to `<LoadMore>`, which loads the next slice when its sentinel nears the
 * viewport and keeps a "Load more" button for keyboards and browsers without IntersectionObserver.
 */
export interface LazySource {
  /** Rows on screen now. */
  loaded: number;
  /** Every row that matches (the server total for paged registers). */
  total: number;
  hasMore: boolean;
  /** Something is being fetched (also a background refresh): no new slice is asked for meanwhile. */
  busy: boolean;
  /** The next slice is on its way (shown on the button). */
  loadingMore: boolean;
  /** Rows the next slice adds. */
  step: number;
  loadMore: () => void;
}

/** Adds page and pageSize to a query string made by `qs()` (which may be empty). */
export const withPage = (query: string, page: number, pageSize: number) => `${query}${query ? '&' : '?'}page=${page}&pageSize=${pageSize}`;

/**
 * A server-paged register as one growing list. `query` is the filter/sort query string without page/pageSize. The key
 * starts with `key`, so `invalidateQueries({ queryKey: [key[0]] })` refetches the pages already loaded. `data` keeps the
 * `Page` shape (items of every loaded page, the latest total, facets of the first page) so pages read it as before.
 */
export function useInfiniteList<P extends Pick<Page<unknown>, 'items' | 'total'>>({ key, query, pageSize, fetch, enabled = true }: {
  key: readonly unknown[];
  query: string;
  pageSize: number;
  fetch: (query: string) => Promise<P>;
  enabled?: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey: [...key, 'list', query, pageSize],
    queryFn: ({ pageParam }) => fetch(withPage(query, pageParam, pageSize)),
    initialPageParam: 1,
    getNextPageParam: (last: P, all: P[]) => (all.length * pageSize < last.total ? all.length + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });
  const pages = q.data?.pages;
  const data = useMemo<P | undefined>(() => {
    if (!pages?.length) return undefined;
    const last = pages[pages.length - 1];
    return { ...pages[0], items: pages.flatMap(p => p.items), total: last.total, page: pages.length } as P;
  }, [pages]);
  const loaded = data?.items.length ?? 0;
  const total = data?.total ?? 0;
  const lazy: LazySource = {
    loaded, total,
    hasMore: !!q.hasNextPage,
    busy: q.isFetching,
    loadingMore: q.isFetchingNextPage,
    step: Math.min(pageSize, Math.max(0, total - loaded)),
    loadMore: () => { if (q.hasNextPage && !q.isFetching) void q.fetchNextPage(); },
  };
  /** Rows from this index on arrived with the latest slice: they fade in (`DataTable revealFrom`). */
  const revealFrom = pages && pages.length > 1 ? (pages.length - 1) * pageSize : Infinity;
  return { data, error: q.error, isPending: q.isPending, isFetching: q.isFetching, lazy, revealFrom, refetch: q.refetch };
}

/**
 * Renders a long client-side list a slice at a time. `resetKey` (filters, sort, search) starts again from the first
 * slice; edits that keep the key keep what is shown. Pass a string or number as the key, not a fresh object.
 */
export function useProgressive<T>(items: readonly T[], step = 60, resetKey: unknown = undefined) {
  const [count, setCount] = useState(step);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) { setKey(resetKey); setCount(step); }
  const shown = useMemo(() => items.slice(0, count), [items, count]);
  const revealFrom = count > step ? count - step : Infinity;
  const lazy: LazySource = {
    loaded: shown.length, total: items.length,
    hasMore: items.length > count, busy: false, loadingMore: false,
    step: Math.min(step, Math.max(0, items.length - count)),
    loadMore: () => setCount(c => c + step),
  };
  return { shown, lazy, revealFrom };
}

const FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Foot of a long list: "Showing 50 of 214 shipments" (announced politely), a thin meter and "Load 50 more". A sentinel
 * just above it asks for the next slice while it is within 600 px of the viewport. After a click on the button, focus
 * moves to the first new row, so keyboard users carry on where the list grew; with nothing left it lands on the count.
 */
export function LoadMore({ source, noun, standalone = false }: {
  source: LazySource;
  noun: string;
  /** The list is not inside a panel (a grid of cards): the foot is its own card, not sticky, with the sentinel inside it. */
  standalone?: boolean;
}) {
  const { loaded, total, hasMore, busy, loadingMore, step, loadMore } = source;
  const sentinel = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const focusFrom = useRef<number | null>(null);
  const load = useRef(loadMore);
  load.current = loadMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => setNear(entries.some(e => e.isIntersecting)), { rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [total > 0]);

  // keeps loading while the sentinel stays near (a short first page, a tall screen), one slice at a time
  useEffect(() => { if (near && hasMore && !busy) load.current(); }, [near, hasMore, busy, loaded]);

  useEffect(() => {
    const from = focusFrom.current;
    if (from === null || loaded <= from || busy) return;
    focusFrom.current = null;
    const list = (standalone ? foot.current : sentinel.current)?.previousElementSibling;
    const rows = list?.querySelectorAll<HTMLElement>('tbody > tr, [data-lazy-item]');
    const target = rows?.[from]?.querySelector<HTMLElement>(FOCUSABLE) ?? (rows?.[from]?.matches(FOCUSABLE) ? rows[from] : null);
    (target ?? status.current)?.focus();
  }, [loaded, busy]);

  if (!total) return null;
  const ratio = Math.min(1, loaded / total);
  const mark = <div ref={sentinel} className="load-sentinel" aria-hidden="true" />;
  return (
    <>
      {!standalone && mark}
      <div ref={foot} className={`load-more${hasMore ? ' has-more' : ''}${standalone ? ' standalone panel' : ''}`}>
        {standalone && mark}
        <span ref={status} className="load-more-count" role="status" aria-live="polite" tabIndex={-1}>
          {hasMore ? `Showing ${loaded} of ${total} ${noun}` : `All ${total} ${noun} shown`}
        </span>
        <span className="load-meter" aria-hidden="true"><span style={{ '--p': ratio } as React.CSSProperties} /></span>
        {hasMore && (
          <Btn kind="small" disabled={loadingMore} aria-busy={loadingMore || undefined}
            onClick={() => { focusFrom.current = loaded; loadMore(); }}>
            {loadingMore ? 'Loading…' : `Load ${step} more`}
          </Btn>
        )}
      </div>
    </>
  );
}
