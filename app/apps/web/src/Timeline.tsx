import { useMemo, useState } from 'react';
import type { MilestoneStatus, TimelineMilestone } from './api';
import { addDays, addMonths, diffDays, fmtDate, monthStart } from './format';

export interface TimelineRow {
  id: string;
  label: string;
  /** Lines under the label, for example the schedule span and the milestone count. */
  sub?: string | string[];
  later?: boolean;
  start?: string | null;
  finish?: string | null;
  /** The span of the working schedule, drawn as a thin bar under the planned span. */
  workStart?: string | null;
  workFinish?: string | null;
  /** Progress at the cut-off in percent, drawn as the filled part of the planned bar. */
  actual?: number | null;
  milestones: TimelineMilestone[];
}

const TONE: Record<MilestoneStatus, string> = { Done: 'done', Overdue: 'overdue', 'Due soon': 'soon', Planned: 'planned' };
const monthShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

const pct1 = (n: number) => n.toFixed(1);

/** The lines under a facility's name, the same on Schedule and on the Milestones roadmap. */
export function laneSub(f: { start: string | null; finish: string | null; actual: number | null; plan: number | null; basis: string | null } | undefined, ms: TimelineMilestone[]): string[] {
  const todo = ms.filter(m => m.status !== 'Done').map(m => milestoneAt(m)).filter(Boolean).sort()[0];
  const finished = ms.filter(m => m.status === 'Done').length;
  const schedule = f?.start && f.finish ? `Schedule ${fmtDate(f.start)} → ${fmtDate(f.finish)}` : null;
  const progress = f && f.actual != null ? `${f.basis ?? 'Progress'} ${pct1(f.actual)}%${f.plan != null ? ` of ${pct1(f.plan)}% plan` : ''}` : null;
  const count = ms.length ? `Milestones ${finished}/${ms.length}${todo ? ` · next ${fmtDate(todo)}` : ' · all achieved'}` : null;
  return [schedule, progress, count].filter(Boolean) as string[];
}

/** The date a milestone is drawn at: achieved, else forecast, else the working-schedule date, else the baseline. */
export const milestoneAt = (m: TimelineMilestone) => m.actual ?? m.forecast ?? m.working ?? m.baseline;

/** The four lines shown when a milestone is hovered. */
function TipCard({ m, x, y }: { m: TimelineMilestone; x: number; y: number }) {
  const rows: [string, string][] = [['Baseline', fmtDate(m.baseline)], ['Working', fmtDate(m.working)], ['Actual', fmtDate(m.actual)]];
  const left = Math.min(x + 14, window.innerWidth - 300);
  return (
    <div className="tl-tip" role="tooltip" style={{ left: Math.max(8, left), top: y + 16 }}>
      <strong>{m.description}</strong>
      {rows.map(([k, v]) => <span key={k}><em>{k}</em>{v}</span>)}
    </div>
  );
}

function describe(m: TimelineMilestone) {
  const parts = [`Baseline ${fmtDate(m.baseline)}`, m.working ? `Working schedule ${fmtDate(m.working)}` : null, m.forecast ? `Forecast ${fmtDate(m.forecast)}` : null, m.actual ? `Achieved ${fmtDate(m.actual)}` : null];
  return `${m.description} · ${m.status}\n${parts.filter(Boolean).join(' · ')}`;
}

/**
 * Rows on a shared time axis: a planned bar with its progress, the working-schedule span and the milestones on the bar.
 * With `chain` the milestones of a row are joined in date order, and each one shows the float between its working-schedule date
 * and its baseline date, which reads as a network of the key dates.
 */
export function Timeline({ rows, cutoff, chain = false, label, onPick }: { rows: TimelineRow[]; cutoff: string; chain?: boolean; label: string; onPick?: (id: string) => void }) {
  const [tip, setTip] = useState<{ m: TimelineMilestone; x: number; y: number } | null>(null);
  const axis = useMemo(() => {
    const dates = rows.flatMap(r => [r.start, r.finish, r.workStart, r.workFinish, ...r.milestones.flatMap(m => [m.baseline, m.working, m.forecast, m.actual])]).filter(Boolean) as string[];
    dates.push(cutoff);
    dates.sort();
    const from = monthStart(dates[0]);
    const to = addDays(addMonths(monthStart(dates[dates.length - 1]), 1), -1);
    const total = Math.max(1, diffDays(from, to));
    const months = Math.round(total / 30.4);
    const step = months > 30 ? 6 : months > 14 ? 3 : 1;
    const ticks: { at: number; text: string }[] = [];
    for (let d = from; d <= to; d = addMonths(d, step)) ticks.push({ at: (diffDays(from, d) / total) * 100, text: monthShort(d) });
    return { from, total, ticks, pos: (iso: string) => Math.min(100, Math.max(0, (diffDays(from, iso) / total) * 100)) };
  }, [rows, cutoff]);
  const pos = axis.pos;
  const cut = pos(cutoff);

  return (
    <div className="tl-scroll">
      <div className="tl" role="group" aria-label={label}>
        <div className="tl-row tl-head">
          <div className="tl-label" />
          <div className="tl-track tl-axis">
            {axis.ticks.map(t => <span key={t.at} className="tl-tick" style={{ left: `${t.at}%` }}>{t.text}</span>)}
            <span className="tl-cut-label" style={{ left: `${cut}%` }}>Cut-off {fmtDate(cutoff)}</span>
          </div>
        </div>
        {rows.map(r => {
          const ms = r.milestones.map(m => ({ m, at: milestoneAt(m) })).filter((x): x is { m: TimelineMilestone; at: string } => !!x.at).sort((a, b) => a.at.localeCompare(b.at));
          const first = ms[0] ? pos(ms[0].at) : 0, last = ms.length ? pos(ms[ms.length - 1].at) : 0;
          return (
            <div key={r.id} className={`tl-row ${r.later ? 'later' : ''}`}>
              <div className="tl-label"><strong>{r.label}</strong>{r.sub && ([] as string[]).concat(r.sub).map(line => <small key={line}>{line}</small>)}</div>
              <div className="tl-track">
                {axis.ticks.map(t => <i key={t.at} className="tl-grid" style={{ left: `${t.at}%` }} />)}
                <i className="tl-cut" style={{ left: `${cut}%` }} />
                {r.start && r.finish && (
                  <span className="tl-bar" style={{ left: `${pos(r.start)}%`, width: `${Math.max(0.4, pos(r.finish) - pos(r.start))}%` }} title={`Planned ${fmtDate(r.start)} – ${fmtDate(r.finish)}`}>
                    {r.actual != null && <i style={{ width: `${Math.min(100, Math.max(0, r.actual))}%` }} />}
                  </span>
                )}
                {r.workStart && r.workFinish && <span className="tl-work" style={{ left: `${pos(r.workStart)}%`, width: `${Math.max(0.4, pos(r.workFinish) - pos(r.workStart))}%` }} title={`Working schedule ${fmtDate(r.workStart)} – ${fmtDate(r.workFinish)}`} />}
                {chain && ms.length > 1 && <i className="tl-chain" style={{ left: `${first}%`, width: `${Math.max(0, last - first)}%` }} />}
                {ms.map(({ m, at }) => (
                  <span key={m.id} className={`tl-ms ${TONE[m.status]} ${m.major ? 'major' : ''}`} style={{ left: `${pos(at)}%` }} tabIndex={0} role={onPick ? 'button' : 'img'} aria-label={describe(m).replace('\n', ' · ')}
                    onMouseEnter={e => setTip({ m, x: e.clientX, y: e.clientY })} onMouseMove={e => setTip({ m, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}
                    onFocus={e => { const b = e.currentTarget.getBoundingClientRect(); setTip({ m, x: b.left, y: b.top }); }} onBlur={() => setTip(null)}
                    onClick={onPick ? () => { setTip(null); onPick(m.id); } : undefined} onKeyDown={onPick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTip(null); onPick(m.id); } } : undefined} />
                ))}
                {r.later && <span className="tl-later">No schedule yet</span>}
              </div>
            </div>
          );
        })}
      </div>
      {tip && <TipCard {...tip} />}
      {tip && <TipCard {...tip} />}
      <ul className="tl-legend" aria-label="Legend">
        <li><i className="k bar" />Planned span, filled by progress</li>
        <li><i className="k work" />Working schedule</li>
        <li><i className="k ms done" />Achieved</li>
        <li><i className="k ms planned" />Planned</li>
        <li><i className="k ms soon" />Due within 30 days</li>
        <li><i className="k ms overdue" />Overdue</li>
        <li><i className="k ms planned major" />Major milestone</li>
      </ul>
    </div>
  );
}
