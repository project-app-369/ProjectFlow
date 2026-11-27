import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CONCERN_AREAS, CONCERN_STATUSES, CONCERN_TYPES, errorText, request, SEVERITIES, type Concern, type Page } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useApp, useToast } from '../state';
import { Badge, Btn, Confirm, DateInput, Field, Modal } from '../ui';
import { StateSelect } from './governance';
import type { StateTone } from '../ui';

const TYPE_ICON: Record<string, string> = { Risk: 'shield', Concern: 'flag', Issue: 'risk' };
const TYPE_TONE: Record<string, StateTone> = { Risk: 'info', Concern: 'warn', Issue: 'crit' };
const SEV_ICON: Record<string, string> = { Critical: 'urgency-urgent', High: 'urgency-high', Medium: 'urgency-normal', Low: 'urgency-low' };
const SEV_TONE: Record<string, StateTone> = { Critical: 'crit', High: 'warn', Medium: 'info', Low: 'neutral' };
const STATUS_ICON: Record<string, string> = { Open: 'status-backlog', Mitigating: 'status-ongoing', Resolved: 'status-completed', Closed: 'status-completed' };
const STATUS_TONE: Record<string, StateTone> = { Open: 'warn', Mitigating: 'info', Resolved: 'ok', Closed: 'neutral' };
const SEV_BADGE: Record<string, 'red' | 'amber' | 'green'> = { Critical: 'red', High: 'red', Medium: 'amber', Low: 'green' };

interface PackageInfo { code: string; label: string; vendor: string | null; status: string | null; source: 'Procurement' | 'Expediting' }

/** Packages from the procurement and expediting registers, by code; a register the user cannot open is skipped. */
export function usePackageDirectory(enabled = true) {
  const { project } = useApp();
  return useQuery({
    queryKey: ['package-directory', project.id], enabled, staleTime: 60_000,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        request<Page<{ code: string; description: string | null; vendor: string | null; status: string }>>(`/projects/${project.id}/procurement/packages?pageSize=200`).catch(() => null),
        request<Page<{ code: string; name: string | null; vendor: string | null; status: string }>>(`/projects/${project.id}/expediting/packages?pageSize=200`).catch(() => null),
      ]);
      const out = new Map<string, PackageInfo>();
      for (const p of a?.items ?? []) out.set(p.code, { code: p.code, label: p.description ?? '', vendor: p.vendor, status: p.status, source: 'Procurement' });
      for (const p of b?.items ?? []) if (!out.has(p.code)) out.set(p.code, { code: p.code, label: p.name ?? '', vendor: p.vendor, status: p.status, source: 'Expediting' });
      return out;
    },
  });
}

/**
 * One risk, concern or issue of a package, in a large dialog laid out like the risk detail: the state, ownership and dates
 * in one field bar, the story and the action on the left, the package and what else is open on it on the right.
 */
export function ConcernDrawer({ base, concern, defaults, canWrite, canManage, onClose }: {
  base: string; concern: Concern | null; defaults?: Partial<Concern>; canWrite: boolean; canManage: boolean; onClose: () => void;
}) {
  const { project } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const init = concern ?? defaults ?? {};
  const [v, setV] = useState({
    title: init.title ?? '', type: init.type ?? 'Risk', severity: (init.severity as string) ?? 'Medium', area: init.area ?? 'Delivery', status: init.status ?? 'Open',
    packageCode: init.packageCode ?? '', owner: init.owner ?? '', raisedDate: init.raisedDate ?? '', dueDate: init.dueDate ?? '', description: init.description ?? '', action: init.action ?? '',
  });
  const set = (k: keyof typeof v, x: string) => setV(s => ({ ...s, [k]: x }));
  const off = !canWrite;
  const dir = usePackageDirectory();
  const pkg = dir.data?.get(v.packageCode.trim());
  const code = v.packageCode.trim();
  const related = useQuery({
    queryKey: ['concern-related', project.id, code], enabled: !!code, staleTime: 30_000,
    queryFn: async () => {
      const [c, i] = await Promise.all([
        request<Page<Concern>>(`${base}?packageCode=${encodeURIComponent(code)}&active=true&pageSize=6`).catch(() => null),
        request<Page<{ id: string; title: string; status: string; priority: string }>>(`/projects/${project.id}/issues?packageCode=${encodeURIComponent(code)}&active=true&pageSize=6`).catch(() => null),
      ]);
      return { concerns: (c?.items ?? []).filter(x => x.id !== concern?.id), issues: i?.items ?? null, issueTotal: i?.total ?? 0 };
    },
  });

  const body = () => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() === '' ? null : x.trim()]));
  const dirty = !concern || JSON.stringify(body()) !== JSON.stringify(Object.fromEntries(Object.keys(v).map(k => [k, (concern as unknown as Record<string, unknown>)[k] ?? null])));
  const refresh = () => Promise.all(['concerns', 'concern-summary', 'procurement-dashboard', 'insights', 'concern-related'].map(k => qc.invalidateQueries({ queryKey: [k] })));
  const save = useMutation({
    mutationFn: () => request<Concern>(concern ? `${base}/${concern.id}` : base, { method: concern ? 'PATCH' : 'POST', body: JSON.stringify(body()) }),
    onSuccess: () => { refresh(); toast(concern ? 'Saved.' : 'Concern created.'); onClose(); }, onError: (e: Error) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/${concern!.id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Deleted.'); onClose(); }, onError: (e: Error) => { setConfirming(false); setError(errorText(e)); },
  });

  return (
    <>
      <Modal title={concern ? `${concern.id} · ${concern.type}` : 'New risk, concern or issue'} size="xl" onClose={onClose}
        actions={<>
          {concern && canManage && <Btn onClick={() => setConfirming(true)}>Delete</Btn>}
          <Btn onClick={onClose}>{canWrite && dirty ? 'Cancel' : 'Close'}</Btn>
          {canWrite && <Btn kind="primary" disabled={save.isPending || !v.title.trim() || !dirty} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn>}
        </>}>
        <div className="dialog-body">
          {concern && (
            <div className="drawer-intro">
              <div className="eyebrow">{[concern.packageCode ?? 'No package', concern.area].join(' · ')}</div>
              <h1>{concern.title}</h1>
              <Badge tone={SEV_BADGE[concern.severity]}>{concern.severity}</Badge> <Badge>{concern.status}</Badge>{' '}
              {concern.overdue && <Badge tone="red">Action overdue</Badge>}{' '}
              <span className="tiny muted">{concern.ageDays != null ? `open for ${concern.ageDays} days` : ''}{concern.raisedDate ? ` · raised ${fmtDate(concern.raisedDate)}` : ''}</span>
            </div>
          )}
          {concern && concern.source !== 'Manual' && <p className="banner">Raised from {concern.source === 'Expediting' ? 'the expediting register' : 'the weekly logistics report'}{concern.sourceRef ? ` (${concern.sourceRef})` : ''}. Change it here as the situation changes.</p>}
          <fieldset disabled={off} className="plain-fieldset gov">
            <Field label="Title *" full><input value={v.title} maxLength={200} autoFocus={!concern} onChange={e => set('title', e.target.value)} /></Field>
            <div className="gov-meta">
              <div className="meta-group"><span className="meta-title">State</span><div className="meta-row">
                <span className="meta-item" title="Type: a risk may happen, a concern is worrying, an issue is already happening"><StateSelect label="Type" value={v.type} options={CONCERN_TYPES.map(t => ({ value: t, label: t, icon: TYPE_ICON[t] ?? 'flag', tone: TYPE_TONE[t] ?? 'neutral' }))} onChange={x => set('type', x ?? 'Risk')} /></span>
                <span className="meta-item" title="Severity"><StateSelect label="Severity" value={v.severity} options={[...SEVERITIES].reverse().map(t => ({ value: t, label: t, icon: SEV_ICON[t], tone: SEV_TONE[t] }))} onChange={x => set('severity', x ?? 'Medium')} /></span>
                <span className="meta-item" title="Status"><StateSelect label="Status" value={v.status} options={CONCERN_STATUSES.map(t => ({ value: t, label: t, icon: STATUS_ICON[t], tone: STATUS_TONE[t] }))} onChange={x => set('status', x ?? 'Open')} /></span>
              </div></div>
              <div className="meta-group"><span className="meta-title">Ownership</span><div className="meta-row">
                <label className="meta-item meta-wide" title="Package: a code from the procurement or expediting register"><Icon name="box" /><input className="meta-input" list="concern-packages" placeholder="Package code" aria-label="Package" value={v.packageCode} maxLength={60} onChange={e => set('packageCode', e.target.value)} /></label>
                <datalist id="concern-packages">{[...(dir.data?.values() ?? [])].map(p => <option key={p.code} value={p.code}>{[p.label, p.vendor].filter(Boolean).join(' · ')}</option>)}</datalist>
                <label className="meta-item" title="Area"><Icon name="layers" /><select className="meta-input" aria-label="Area" value={v.area} onChange={e => set('area', e.target.value)}>{CONCERN_AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
                <label className="meta-item" title="Owner"><Icon name="people" /><input className="meta-input" placeholder="Owner" aria-label="Owner" value={v.owner} maxLength={80} onChange={e => set('owner', e.target.value)} /></label>
              </div></div>
              <div className="meta-group"><span className="meta-title">Dates</span><div className="meta-row">
                <label className="meta-item" title="Raised (defaults to the cut-off date)"><Icon name="doc" /><DateInput className="meta-input" aria-label="Raised" value={v.raisedDate} onChange={e => set('raisedDate', e.target.value)} /></label>
                <label className="meta-item" title="Action due"><Icon name="calendar" /><DateInput className="meta-input" aria-label="Action due" value={v.dueDate} onChange={e => set('dueDate', e.target.value)} /></label>
              </div></div>
            </div>
            <div className="gov-cols">
              <section>
                <h3><Icon name="doc" />Description <span className="tiny muted">what is happening and why it matters</span></h3>
                <textarea className="gov-text" rows={6} aria-label="Description" value={v.description} maxLength={1500} onChange={e => set('description', e.target.value)} />
                <h3><Icon name="arrow" />Mitigation / action <span className="tiny muted">who does what, by when</span></h3>
                <textarea className="gov-text" rows={5} aria-label="Mitigation or action" value={v.action} maxLength={1500} onChange={e => set('action', e.target.value)} />
              </section>
              <section>
                <h3><Icon name="box" />Package</h3>
                {code ? (
                  <div className="detail-card">
                    <div className="detail-card-head"><strong className="mono">{code}</strong>{pkg && <Badge>{pkg.status ?? '—'}</Badge>}</div>
                    {pkg ? <p className="tiny">{pkg.label || 'No description'}{pkg.vendor ? <> · <span className="muted">{pkg.vendor}</span></> : null}</p> : <p className="tiny warning">Not found in the procurement or expediting register.</p>}
                    <div className="detail-links">
                      {pkg && <Link className="btn text" to={pkg.source === 'Procurement' ? `/m/procurement.procurement-plan?q=${encodeURIComponent(code)}` : `/m/procurement.expediting.vendor-overview?q=${encodeURIComponent(code)}`}>Open in {pkg.source === 'Procurement' ? 'Procurement Plan' : 'Vendor Overview'}</Link>}
                      <Link className="btn text" to={`/m/management.issues?package=${encodeURIComponent(code)}`}>Issues for this package</Link>
                    </div>
                  </div>
                ) : <p className="tiny muted">No package yet. Pick one in the field bar to see its vendor, status and what else is open on it.</p>}
                {code && (
                  <>
                    <h3><Icon name="flag" />Also open on this package</h3>
                    {related.isPending ? <p className="tiny muted">Loading…</p> : (
                      <ul className="related-list">
                        {related.data?.concerns.map(c => <li key={c.id}><Badge tone={SEV_BADGE[c.severity]}>{c.severity}</Badge><span className="mono tiny">{c.id}</span><span className="grow">{c.title}</span></li>)}
                        {related.data?.issues?.map(i => <li key={i.id}><Badge tone="indigo">Issue</Badge><span className="mono tiny">{i.id}</span><span className="grow">{i.title}</span></li>)}
                        {!related.data?.concerns.length && !related.data?.issues?.length && <li className="tiny muted">Nothing else open.</li>}
                      </ul>
                    )}
                  </>
                )}
              </section>
            </div>
          </fieldset>
          {error && <p className="negative mt-3" role="alert">{error}</p>}
        </div>
      </Modal>
      {confirming && concern && (
        <Confirm title={`Delete ${concern.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirming(false)}>
          <p>This removes the {concern.type.toLowerCase()} from the register. It cannot be undone.</p>
        </Confirm>
      )}
    </>
  );
}
