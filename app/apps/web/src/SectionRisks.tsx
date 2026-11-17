import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, type Dashboard, type Issue, type Page, type Risk } from './api';
import { disciplineList } from './disciplines';
import { fmtDate } from './format';
import { Icon } from './icons';
import { useApp } from './state';
import { Badge } from './ui';

/** What belongs to a section: the registers tag every item with discipline codes, and a section is a set of those codes. */
const SECTIONS: Record<string, { label: string; codes: string[] }> = {
  planning: { label: 'Planning & Progress', codes: ['PLN'] },
  engineering: { label: 'Engineering', codes: ['DE', 'CE'] },
  procurement: { label: 'Procurement', codes: ['PRO'] },
  construction: { label: 'Construction', codes: ['CON'] },
  ti: { label: 'T&I', codes: ['T&I'] },
  precom: { label: 'Onshore Precom-Commissioning', codes: ['COM'] },
  huc: { label: 'Offshore HUC', codes: ['HUC'] },
};
const LEVEL_TONE: Record<string, 'red' | 'amber' | 'green'> = { Critical: 'red', High: 'red', Medium: 'amber', Low: 'green' };
const SHOWN = 6;

interface Row { key: string; title: string; level: string; rank: number; tie: number; sub: string; to: string }

function Card({ title, sub, icon, rows, loading, off, empty, foot }: { title: string; sub: string; icon: string; rows: Row[]; loading: boolean; off: boolean; empty: string; foot: { to: string; label: string } }) {
  return (
    <div className="panel">
      <div className="panel-head"><div><h2>{title}</h2><p>{sub}</p></div><Icon name={icon} /></div>
      {loading && <div className="empty">Loading…</div>}
      {rows.slice(0, SHOWN).map(r => (
        <Link className="list-card" key={r.key} to={r.to}>
          <div className="grow"><p>{r.title}</p><small>{r.sub}</small></div>
          <Badge tone={LEVEL_TONE[r.level] ?? 'indigo'}>{r.level}</Badge>
        </Link>
      ))}
      {!loading && !rows.length && <div className="empty">{off ? `${title} are turned off.` : empty}</div>}
      {rows.length > SHOWN && <div className="list-card"><small className="muted">and {rows.length - SHOWN} more</small></div>}
      {!off && <div className="panel-foot"><Link className="btn text" to={foot.to}>{foot.label} →</Link></div>}
    </div>
  );
}

/** Two cards, Risks (risk register) and Concerns (issues), holding only the open items of one section, the most severe first. */
export function SectionRisks({ section }: { section: keyof typeof SECTIONS }) {
  const { project } = useApp();
  const base = `/projects/${project.id}`;
  const def = SECTIONS[section];
  const risks = useQuery({ queryKey: ['overall-risks', project.id], retry: false, queryFn: () => request<Page<Risk>>(`${base}/risks?flag=active&sort=currentRank&order=desc&pageSize=200`) });
  const issues = useQuery({ queryKey: ['overall-issues', project.id], retry: false, queryFn: () => request<Page<Issue>>(`${base}/issues?sort=priorityRank&order=desc&pageSize=200`) });
  const levels = useQuery({ queryKey: ['dashboard', project.id], queryFn: () => request<Dashboard>(`${base}/dashboard`) }).data?.risks?.levels ?? ['High', 'Medium', 'Low'];

  const riskRows: Row[] = (risks.data?.items ?? []).filter(r => r.currentLevel && disciplineList(r.discipline).some(c => def.codes.includes(c))).map(r => ({
    key: r.id, title: r.title, level: r.currentLevel!, rank: levels.length - levels.indexOf(r.currentLevel!), tie: (r.responseOverdue ? 100 : 0) + (r.currentScore ?? 0),
    sub: `${r.discipline}${r.owners[0] ? ` · ${r.owners[0]}` : ''} · ${r.status}`, to: `/m/management.risks?id=${encodeURIComponent(r.id)}`,
  })).sort((a, b) => b.rank - a.rank || b.tie - a.tie);

  const concernRows: Row[] = (issues.data?.items ?? []).filter(i => i.status !== 'Completed' && disciplineList(i.discipline).some(c => def.codes.includes(c))).map(i => ({
    key: i.id, title: i.title, level: i.priority, rank: { Critical: 4, High: 3, Medium: 2, Low: 1 }[i.priority] ?? 1, tie: (i.overdue ? 100 : 0) + (i.daysToDue != null ? Math.max(0, 30 - i.daysToDue) : 0),
    sub: `${i.discipline} · ${i.dueDate ? `${i.overdue ? 'overdue, ' : 'due '}${fmtDate(i.dueDate)}` : i.status}`, to: `/m/management.issues?id=${encodeURIComponent(i.id)}`,
  })).sort((a, b) => b.rank - a.rank || b.tie - a.tie);

  const high = (rows: Row[], min: number) => rows.filter(r => r.rank >= min).length;
  return (
    <>
      <Card title="Risks" icon="risk" rows={riskRows} loading={risks.isPending} off={!!risks.error} foot={{ to: '/m/management.risks', label: 'Open risk register' }}
        sub={`${riskRows.length} open in ${def.label} · ${high(riskRows, levels.length)} ${levels[0]?.toLowerCase() ?? 'high'}`} empty={`No open risks for ${def.label}.`} />
      <Card title="Concerns" icon="flag" rows={concernRows} loading={issues.isPending} off={!!issues.error} foot={{ to: '/m/management.issues', label: 'Open issues' }}
        sub={`${concernRows.length} open in ${def.label} · ${high(concernRows, 3)} critical or high`} empty={`No open concerns for ${def.label}.`} />
    </>
  );
}
