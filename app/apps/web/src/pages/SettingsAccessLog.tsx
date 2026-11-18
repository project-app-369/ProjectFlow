import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { request, type AccessLogEntry } from '../api';
import { fmtDate, type Tone } from '../format';
import { useAccess, useApp } from '../state';
import { Badge, ErrorBox, PageSkeleton } from '../ui';

const ACTION: Record<string, [label: string, tone: Tone]> = {
  login: ['Signed in', 'green'], 'login-failed': ['Wrong password', 'amber'], 'login-locked': ['Account locked', 'red'],
  'password-reset': ['Password reset', 'indigo'], 'password-change': ['Password changed', 'indigo'],
  'user-create': ['User created', 'indigo'], 'user-update': ['User changed', 'indigo'],
  'member-add': ['Member added', 'indigo'], 'member-update': ['Role changed', 'indigo'], 'member-remove': ['Member removed', 'amber'],
  'party-access': ['Party access', 'green'], 'role-access': ['Role access', 'green'], 'person-access': ['Personal access', 'green'],
};
const when = (iso: string) => `${fmtDate(iso.slice(0, 10))} ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * Settings → Access log: who signed in, was changed or was given access to what, newest first. An administrator can read all of it;
 * a Project Manager reads the entries of their project. Passwords are never written to it.
 */
export default function AccessLogTab() {
  const { project, me } = useApp();
  const access = useAccess();
  const [scope, setScope] = useState<'project' | 'all'>(me?.isAdmin && !project.id ? 'all' : 'project');
  const [action, setAction] = useState('');
  const path = scope === 'all' ? '/access-log?limit=300' : `/access-log?projectId=${project.id}&limit=300`;
  const log = useQuery({ queryKey: ['access-log', scope, scope === 'all' ? '' : project.id], queryFn: () => request<AccessLogEntry[]>(path), enabled: scope === 'all' ? !!me?.isAdmin : !!project.id && access.canConfigure, staleTime: 0, refetchOnMount: 'always' });
  if (!me?.isAdmin && !access.canConfigure) return <div className="panel empty">The access log is available to administrators and Project Managers.</div>;
  const rows = (log.data ?? []).filter(e => !action || e.action === action);

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Access log</h2><p>{scope === 'all' ? 'Everything, across projects' : `Changes in ${project.shortName ?? project.code}`} · newest first · up to 300 entries</p></div>
        <div className="actions">
          {me?.isAdmin && (
            <div className="seg" role="group" aria-label="Scope">
              <button type="button" className={scope === 'project' ? 'on' : ''} aria-pressed={scope === 'project'} disabled={!project.id} onClick={() => setScope('project')}>This project</button>
              <button type="button" className={scope === 'all' ? 'on' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Everything</button>
            </div>
          )}
          <select className="filter" aria-label="Filter by event" value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All events</option>
            {Object.entries(ACTION).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>
      {log.isPending ? <PageSkeleton stats={0} panels={1} /> : log.error ? <ErrorBox error={log.error} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>WHEN</th><th>EVENT</th><th>BY</th><th>ABOUT</th><th>WHAT</th></tr></thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id}>
                  <td data-label="When" style={{ whiteSpace: 'nowrap' }}>{when(e.at)}</td>
                  <td data-label="Event"><Badge tone={ACTION[e.action]?.[1] ?? 'indigo'}>{ACTION[e.action]?.[0] ?? e.action}</Badge></td>
                  <td data-label="By">{e.actorName ?? <span className="muted">—</span>}</td>
                  <td data-label="About">{e.target}</td>
                  <td data-label="What" style={{ whiteSpace: 'normal' }}>{e.detail}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="empty">Nothing recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
