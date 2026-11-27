import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { qs } from './api';
import { Icon } from './icons';
import { Btn, useDebounced } from './ui';

/**
 * Pagination that feels instant: while the person reads a page, the next one is fetched into the cache (after a short pause,
 * so a quick click through pages does not fire a request per page). The next click then shows its rows at once.
 */
export function usePrefetchNext(page: number, total: number | undefined, pageSize: number, query: string, key: (q: string) => unknown[], fetch: (q: string) => Promise<unknown>) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!total || page * pageSize >= total) return;
    const next = query.replace(/([?&])page=\d+/, `$1page=${page + 1}`);
    if (next === query) return;
    const id = window.setTimeout(() => void qc.prefetchQuery({ queryKey: key(next), queryFn: () => fetch(next) }), 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, page, total, pageSize, query]);
}

export interface ListState { q: string; discipline: string; status: string; sort?: string; order: 'asc' | 'desc'; page: number }

export function useListState(start: Partial<Pick<ListState, 'status' | 'discipline' | 'sort' | 'order'>> = {}) {
  // a link may open a register already searched for something (?q=…), for example a package code from a concern
  const [state, setState] = useState<ListState>({ q: typeof location !== 'undefined' ? new URLSearchParams(location.search).get('q') ?? '' : '', discipline: start.discipline ?? '', status: start.status ?? '', sort: start.sort, order: start.order ?? 'asc', page: 1 });
  const debouncedQ = useDebounced(state.q);
  const set = (patch: Partial<ListState>) => setState(s => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const toggleSort = (key: string) => setState(s => ({ ...s, sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc', page: 1 }));
  const setSort = (sort: string, order: 'asc' | 'desc') => setState(s => ({ ...s, sort, order, page: 1 }));
  /** Clearing returns to the page's starting filters, not to everything. */
  const clear = () => setState(s => ({ ...s, q: '', discipline: start.discipline ?? '', status: start.status ?? '', page: 1 }));
  /** Query string for the API; the search term is debounced so typing doesn't fire a request per keystroke. */
  const query = (extra: Record<string, string | number | undefined> = {}) =>
    qs({ q: debouncedQ, discipline: state.discipline, status: state.status, sort: state.sort, order: state.order, ...extra });
  return { state, set, toggleSort, setSort, clear, query, debouncedQ };
}

/**
 * "Sort by" for a register: pick the field and flip the direction. The column headers sort too, but they are not
 * there on phones (registers become cards) and cover only what is shown, so this lists every useful key (dates,
 * discipline, category…). `fallback` is the sort the API applies when none is chosen.
 */
export function SortBy({ options, sort, order, fallback, onChange }: {
  options: [key: string, label: string][];
  sort?: string;
  order: 'asc' | 'desc';
  fallback?: string;
  onChange: (sort: string, order: 'asc' | 'desc') => void;
}) {
  const current = sort ?? fallback ?? options[0][0];
  const label = options.find(([k]) => k === current)?.[1] ?? '';
  const flip = order === 'asc' ? 'desc' : 'asc';
  return (
    <span className="sort-by">
      <label className="task-filter" title="Sort by">
        <Icon name="sort" />
        <select className="filter" aria-label="Sort by" value={current} onChange={e => onChange(e.target.value, order)}>
          {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <button type="button" className="icon-btn sort-dir" aria-label={`${label}: ${order === 'asc' ? 'ascending' : 'descending'}. Switch to ${flip === 'asc' ? 'ascending' : 'descending'}`}
        title={order === 'asc' ? 'Ascending (A→Z, oldest first)' : 'Descending (Z→A, newest first)'} onClick={() => onChange(current, flip)}>
        <Icon name={order === 'asc' ? 'chevron-up' : 'chevron-down'} />
      </button>
    </span>
  );
}

export function Toolbar({ list, facets, placeholder, label, disciplineLabel = 'disciplines', sorts, defaultSort }: {
  list: ReturnType<typeof useListState>;
  facets?: { disciplines: string[]; statuses: string[] };
  placeholder: string;
  label: string;
  /** What the first filter groups by, e.g. "subcontract areas". */
  disciplineLabel?: string;
  /** Fields offered in the Sort by control, and the sort the API applies by default. */
  sorts?: [string, string][];
  defaultSort?: string;
}) {
  const { state, set, clear } = list;
  return (
    <div className="toolbar">
      <label className="search">
        <Icon name="search" />
        <input placeholder={placeholder} value={state.q} onChange={e => set({ q: e.target.value })} aria-label={label} />
      </label>
      <div className="filter-group">
        <select className="filter" aria-label={`Filter by ${disciplineLabel}`} value={state.discipline} onChange={e => set({ discipline: e.target.value })}>
          <option value="">All {disciplineLabel}</option>
          {facets?.disciplines.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter" aria-label="Filter by status" value={state.status} onChange={e => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {facets?.statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {sorts && <SortBy options={sorts} sort={state.sort} order={state.order} fallback={defaultSort} onChange={list.setSort} />}
        <Btn kind="small" onClick={clear}>Clear</Btn>
      </div>
    </div>
  );
}
