import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { request, type InsightBox, type Insights } from './api';
import type { useListState } from './Register';
import { Btn, ErrorBox, Loading, Stat } from './ui';

const InsightChartView = lazy(() => import('./InsightChart'));

/** Loads the summary for a register from `${base}/${path}`; `key` keeps each page's cache apart. */
export function useInsights(key: string, projectId: string, url: string) {
  return useQuery({ queryKey: ['insights', key, projectId], queryFn: () => request<Insights>(url) });
}

const LIST_KEYS = ['status', 'discipline'] as const;
const LABEL: Record<string, string> = { within: 'Due', month: 'Month', yard: 'Yard', workPackage: 'Work package', buyer: 'Buyer', category: 'Category', area: 'Area', owner: 'Owner', packageCode: 'Package', severity: 'Severity', facility: 'Facility', sub: 'Subcontract area', status: 'Status', discipline: 'Discipline' };
const WINDOW: Record<string, string> = { overdue: 'overdue', none: 'no date', '30': 'within 30 days', '45': 'within 45 days', '60': 'within 60 days' };

/**
 * Filters a register from its summary. `status` and `discipline` live in the list state; every other key is kept here.
 * Choosing the value that is already set clears it.
 */
export function usePick<K extends string>(list: ReturnType<typeof useListState>, none: Record<K, string>) {
  const [extra, setExtra] = useState<Record<K, string>>(none);
  const inList = (k: string): k is 'status' | 'discipline' => (LIST_KEYS as readonly string[]).includes(k);
  const pick = (f: Record<string, string>) => {
    const [k, v] = Object.entries(f)[0];
    if (inList(k)) list.set({ [k]: list.state[k] === v ? '' : v });
    else { setExtra(s => ({ ...s, [k]: s[k as K] === v ? '' : v })); list.set({}); }
  };
  const isOn = (f: Record<string, string>) => Object.entries(f).every(([k, v]) => (inList(k) ? list.state[k] === v : extra[k as K] === v));
  const reset = () => { list.clear(); setExtra(none); };
  const chips = (Object.entries(extra) as [string, string][]).filter(([, v]) => v);
  return { extra, setExtra, pick, isOn, reset, chips };
}

/** What the register is filtered by from the summary, with a way to take it off. */
export function FilterChips({ chips, onClear }: { chips: [string, string][]; onClear: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="banner active-filters">
      <span>Showing</span>
      {chips.map(([k, v]) => <span key={k} className="chip">{LABEL[k] ?? k}: {k === 'within' ? WINDOW[v] ?? v : k === 'month' ? new Date(`${v}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : v}</span>)}
      <Btn kind="small" onClick={onClear}>Show all</Btn>
    </div>
  );
}

function Boxes({ title, sub, boxes, onFilter, active }: { title: string; sub: string; boxes: InsightBox[]; onFilter?: (f: Record<string, string>) => void; active?: (f: Record<string, string>) => boolean }) {
  return (
    <section className="panel ins-panel">
      <div className="panel-head"><div><h2>{title}</h2><p>{sub}</p></div></div>
      <div className="ins-boxes">
        {boxes.map(b => {
          const body = <><strong className="mono">{b.value.toLocaleString('en-GB')}</strong><span className="ins-label">{b.label}</span><span className="ins-sub">{b.sub}</span></>;
          const cls = `ins-box ${b.tone ?? ''} ${b.filter && active?.(b.filter) ? 'on' : ''}`;
          return b.filter && onFilter
            ? <button key={b.label} type="button" className={cls} aria-pressed={!!active?.(b.filter)} onClick={() => onFilter(b.filter!)}>{body}</button>
            : <div key={b.label} className={cls}>{body}</div>;
        })}
      </div>
    </section>
  );
}

/**
 * The summary at the top of a procurement page: six cards in one row, a pipeline or status strip, a look-ahead,
 * and charts. A box or a bar can set a filter on the register below it when the page passes `onFilter`.
 */
export function InsightsView({ data, error, onFilter, active }: {
  data?: Insights; error?: unknown; onFilter?: (f: Record<string, string>) => void; active?: (f: Record<string, string>) => boolean;
}): ReactNode {
  if (error) return <section className="panel ins-panel"><div className="panel-head"><div><h2>Summary unavailable</h2><p>The register remains available below.</p></div></div><ErrorBox error={error} /></section>;
  if (!data) return <div className="stats">{Array.from({ length: 6 }, (_, i) => <Stat key={i} label="…" value="—" foot="Loading" icon="chart" />)}</div>;
  return (
    <>
      <div className="stats">
        {data.cards.map(c => <Stat key={c.label} label={c.label} value={c.value} icon={c.icon} foot={<span className={c.tone === 'red' ? 'negative' : c.tone === 'amber' ? 'warning' : c.tone === 'green' ? 'positive' : ''}>{c.foot}</span>} />)}
      </div>
      {data.strip && <Boxes {...data.strip} onFilter={onFilter} active={active} />}
      {data.lookAhead && <Boxes {...data.lookAhead} onFilter={onFilter} active={active} />}
      {data.charts.length > 0 && (
        <div className="ins-charts">
          {data.charts.map(c => (
            <section key={c.title} className={`panel ins-panel ${c.layout === 'column' && c.categories.length > 8 ? 'wide' : ''}`}>
              <div className="panel-head"><div><h2>{c.title}</h2><p>{c.sub}</p></div></div>
              {c.categories.length ? (
                <Suspense fallback={<Loading label="Loading chart…" />}>
                  <InsightChartView chart={c} onPick={onFilter && c.filterKey ? v => onFilter({ [c.filterKey!]: v }) : undefined} />
                </Suspense>
              ) : <div className="empty">Nothing to chart yet.</div>}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
