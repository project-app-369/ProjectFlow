import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, type ModuleRecords } from '../api';
import { pathOf } from '../nav';
import { useApp } from '../state';
import { Badge, Btn, ErrorBox, PageHead, PageSkeleton } from '../ui';

/** Rows kept for a module, shown read-only until the module has a screen of its own. */
function SheetRecords({ moduleKey }: { moduleKey: string }) {
  const { project } = useApp();
  const q = useQuery({ queryKey: ['records', project.id, moduleKey], queryFn: () => request<ModuleRecords>(`/projects/${project.id}/modules/${moduleKey}/records`) });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { columns, items } = q.data;
  return (
    <div className="panel">
      <div className="panel-head"><div><h2>Records</h2><p>Read-only here. This module has no screen for editing records yet.</p></div><Btn kind="small" onClick={() => q.refetch()}>{q.isFetching ? 'Refreshing…' : 'Refresh'}</Btn></div>
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map(c => <th key={c}>{c.toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {items.length ? items.map((r, i) => <tr key={i}>{columns.map(c => <td key={c}>{r[c] ?? ''}</td>)}</tr>) : <tr><td colSpan={columns.length} className="empty">No rows yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Placeholder({ moduleKey }: { moduleKey: string }) {
  const { modules } = useApp();
  const m = modules.modules.find(x => x.key === moduleKey);
  if (!m) return null;
  const parent = pathOf(modules, moduleKey).slice(0, -1).join(' / ');
  return (
    <>
      <PageHead title={m.label} desc={`${parent} · ${m.availability.toLowerCase()} (${m.phase}).`} />
      <div className="panel empty placeholder-panel">
        <h3 className="mb-2">No screen for this module yet <Badge tone="indigo">{m.phase}</Badge></h3>
        <p className="tiny muted" style={{ maxWidth: 560 }}>
          {m.label} is enabled for this project, but this build has no screen for it yet. It stays in the catalog so it can be switched on or off in module settings.
        </p>
        <div className="actions mt-4">
          <Link className="btn small" to="/settings/modules">Open module settings</Link>
        </div>
      </div>
      {m.sheet && <SheetRecords moduleKey={moduleKey} />}
    </>
  );
}
