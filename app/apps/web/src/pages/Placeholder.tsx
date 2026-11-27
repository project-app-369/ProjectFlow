import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, type ModuleRecords, type SheetInfo } from '../api';
import { pathOf } from '../nav';
import { useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, PageSkeleton } from '../ui';

/** Rows of a module's sheet, shown read-only; edit them in the spreadsheet itself. */
function SheetRecords({ moduleKey }: { moduleKey: string }) {
  const { project } = useApp();
  const q = useQuery({ queryKey: ['records', project.id, moduleKey], queryFn: () => request<ModuleRecords>(`/projects/${project.id}/modules/${moduleKey}/records`) });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { columns, items } = q.data;
  return (
    <div className="panel">
      <div className="panel-head"><div><h2>Sheet rows</h2><p>Read-only here. Add or edit rows in the spreadsheet, then refresh.</p></div><Btn kind="small" onClick={() => q.refetch()}>{q.isFetching ? 'Refreshing…' : 'Refresh'}</Btn></div>
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
  const { project, modules } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const m = modules.modules.find(x => x.key === moduleKey);
  const generate = useMutation({
    mutationFn: () => request<{ sheet: SheetInfo; created: boolean }>(`/projects/${project.id}/modules/${moduleKey}/sheet`, { method: 'POST' }),
    onSuccess: r => qc.invalidateQueries({ queryKey: ['modules', project.id] }).then(() => toast(`Sheet created: ${r.sheet.name}`)),
    onError: (e: Error) => toast(e.message),
  });
  if (!m) return null;
  const parent = pathOf(modules, moduleKey).slice(0, -1).join(' / ');
  return (
    <>
      <PageHead title={m.label} desc={`${parent} · ${m.availability.toLowerCase()} (${m.phase}).`} />
      <div className="panel empty placeholder-panel">
        <h3 className="mb-2">No screen for this module yet <Badge tone="indigo">{m.phase}</Badge></h3>
        <p className="tiny muted" style={{ maxWidth: 560 }}>
          {m.label} is enabled for this project, but this build has no screen for it yet.
          {m.sheetCapable ? ' Its records can already be kept in a spreadsheet sheet, listed below once the sheet exists.' : ' It stays in the catalog so it can be switched on or off now.'}
        </p>
        <div className="actions mt-4">
          {m.sheetCapable && !m.sheet && <Btn kind="small primary" onClick={() => generate.mutate()} disabled={generate.isPending}>{generate.isPending ? 'Generating…' : 'Generate sheet'}</Btn>}
          <Link className="btn small" to="/settings/modules">Open module settings</Link>
        </div>
      </div>
      {m.sheet && <SheetRecords moduleKey={moduleKey} />}
    </>
  );
}
