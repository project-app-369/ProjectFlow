import { useState } from 'react';
import { qs } from './api';
import { Icon } from './icons';
import { Btn, useDebounced } from './ui';

export interface ListState { q: string; discipline: string; status: string; sort?: string; order: 'asc' | 'desc'; page: number }

export function useListState(start: Partial<Pick<ListState, 'status' | 'discipline'>> = {}) {
  const [state, setState] = useState<ListState>({ q: '', discipline: start.discipline ?? '', status: start.status ?? '', order: 'asc', page: 1 });
  const debouncedQ = useDebounced(state.q);
  const set = (patch: Partial<ListState>) => setState(s => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const toggleSort = (key: string) => setState(s => ({ ...s, sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc', page: 1 }));
  /** Clearing returns to the page's starting filters, not to everything. */
  const clear = () => setState(s => ({ ...s, q: '', discipline: start.discipline ?? '', status: start.status ?? '', page: 1 }));
  /** Query string for the API; the search term is debounced so typing doesn't fire a request per keystroke. */
  const query = (extra: Record<string, string | number | undefined> = {}) =>
    qs({ q: debouncedQ, discipline: state.discipline, status: state.status, sort: state.sort, order: state.order, ...extra });
  return { state, set, toggleSort, clear, query, debouncedQ };
}

export function Toolbar({ list, facets, placeholder, label, disciplineLabel = 'disciplines' }: {
  list: ReturnType<typeof useListState>;
  facets?: { disciplines: string[]; statuses: string[] };
  placeholder: string;
  label: string;
  /** What the first filter groups by, e.g. "subcontract areas". */
  disciplineLabel?: string;
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
        <Btn kind="small" onClick={clear}>Clear</Btn>
      </div>
    </div>
  );
}
