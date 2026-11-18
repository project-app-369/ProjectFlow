import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { ROLES, errorText, request, type AccessLevel, type Member, type PersonMatrix, type Role, type RoleMatrix, type WorkspaceId } from '../api';
import { Badge, Btn, ErrorBox, PageSkeleton } from '../ui';
import { useAccess, useApp, useToast } from '../state';
import type { Tone } from '../format';

const WORKSPACE_LABEL: Record<WorkspaceId, string> = { personal: 'Personal', epcic: 'EPCIC', governance: 'Governance', reports: 'Reports' };
const LEVEL_LABEL: Record<AccessLevel, string> = { none: 'No access', read: 'Read only', write: 'Read and change' };
const LEVEL_TONE: Record<AccessLevel, Tone> = { none: 'red', read: 'amber', write: 'green' };

/** One screen's setting: "default"/"inherit" (no setting of its own) or one of the three levels. Write is not offered above the ceiling. */
function LevelSelect({ value, onChange, cap, blank, label }: { value: AccessLevel | null; onChange: (v: AccessLevel | null) => void; cap: AccessLevel; blank: string; label: string }) {
  return (
    <select className="filter" aria-label={label} value={value ?? ''} onChange={e => onChange((e.target.value || null) as AccessLevel | null)}>
      <option value="">{blank}</option>
      <option value="none">{LEVEL_LABEL.none}</option>
      <option value="read">{LEVEL_LABEL.read}</option>
      {cap === 'write' && <option value="write">{LEVEL_LABEL.write}</option>}
    </select>
  );
}

/**
 * Settings → Project access: who may open or change each screen of the selected project. By role: one setting per project role.
 * By person: one member differs from their role. A setting on a screen applies to the screens under it until they have their own.
 * A Client is always read-only; the party a person belongs to (Settings → Party access) is applied first.
 */
export default function ProjectAccessTab() {
  const { project } = useApp();
  const access = useAccess();
  const [by, setBy] = useState<'role' | 'person'>('role');
  if (!project.id) return <div className="panel empty">Select a project first.</div>;
  if (!access.canConfigure) return <div className="panel empty">Project access is set by an administrator or the Project Manager of this project.</div>;
  return (
    <>
      <p className="page-sub" style={{ margin: '-6px 0 16px' }}>
        Decide who may open or change each screen of <strong>{project.shortName ?? project.code}</strong>. Start with the role, then give a person more or less than their role where needed.
        The party a person belongs to (Settings → Party access) is applied first, and a screen that is switched off or read-only for the whole project stays that way for everyone.
      </p>
      <div className="seg" role="group" aria-label="Set access by" style={{ marginBottom: 16 }}>
        <button type="button" className={by === 'role' ? 'on' : ''} aria-pressed={by === 'role'} onClick={() => setBy('role')}>By role</button>
        <button type="button" className={by === 'person' ? 'on' : ''} aria-pressed={by === 'person'} onClick={() => setBy('person')}>By person</button>
      </div>
      {by === 'role' ? <RoleAccess projectId={project.id} /> : <PersonAccess projectId={project.id} />}
    </>
  );
}

function useTree<T extends { key: string; parent: string | null; depth: number; workspace: WorkspaceId; availability: string }>(modules: T[], only: 'all' | 'available') {
  return useMemo(() => {
    const kids = new Map<string, string[]>();
    for (const m of modules) if (m.parent) kids.set(m.parent, [...(kids.get(m.parent) ?? []), m.key]);
    const descendants = (key: string): string[] => (kids.get(key) ?? []).flatMap(k => [k, ...descendants(k)]);
    const rows = modules.filter(m => only === 'all' || m.availability === 'Available');
    return { rows, descendants };
  }, [modules, only]);
}

function Toolbar({ only, setOnly, changes, saving, onDiscard, onSave, title, sub }: {
  only: 'all' | 'available'; setOnly: (v: 'all' | 'available') => void; changes: number; saving: boolean; onDiscard: () => void; onSave: () => void; title: string; sub: string;
}) {
  return (
    <div className="panel-head">
      <div><h2>{title}</h2><p>{sub}</p></div>
      <div className="actions">
        <div className="seg" role="group" aria-label="Which screens to list">
          <button type="button" className={only === 'available' ? 'on' : ''} aria-pressed={only === 'available'} onClick={() => setOnly('available')}>Built</button>
          <button type="button" className={only === 'all' ? 'on' : ''} aria-pressed={only === 'all'} onClick={() => setOnly('all')}>All</button>
        </div>
        <Btn iconOnly={false} disabled={!changes || saving} onClick={onDiscard}>Discard</Btn>
        <Btn kind="primary" icon="tick" iconOnly={false} disabled={!changes || saving} onClick={onSave}>{saving ? 'Saving…' : changes ? `Save ${changes} change${changes === 1 ? '' : 's'}` : 'Save'}</Btn>
      </div>
    </div>
  );
}

function RoleAccess({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['access-roles', projectId], queryFn: () => request<RoleMatrix>(`/projects/${projectId}/access/roles`), staleTime: 0, refetchOnMount: 'always' });
  /** Unsaved settings, keyed `role|module`; null puts a screen back to the role's default. */
  const [draft, setDraft] = useState<Record<string, AccessLevel | null>>({});
  const [only, setOnly] = useState<'all' | 'available'>('available');
  const { rows, descendants } = useTree(q.data?.modules ?? [], only);
  void descendants;
  const save = useMutation({
    mutationFn: (cells: { role: Role; moduleKey: string; level: AccessLevel | null }[]) => request<RoleMatrix>(`/projects/${projectId}/access/roles`, { method: 'PUT', body: JSON.stringify({ cells }) }),
    onSuccess: data => { qc.setQueryData(['access-roles', projectId], data); qc.invalidateQueries({ queryKey: ['bootstrap'] }); qc.invalidateQueries({ queryKey: ['access-log'] }); setDraft({}); toast('Role access saved.'); },
    onError: (e: Error) => toast(errorText(e)),
  });
  if (q.isPending) return <PageSkeleton stats={0} panels={1} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const data = q.data!;
  const was = (key: string, role: Role) => data.modules.find(m => m.key === key)!.levels[role];
  const value = (key: string, role: Role) => (`${role}|${key}` in draft ? draft[`${role}|${key}`] : was(key, role));
  const changes = Object.entries(draft).flatMap(([k, level]) => {
    const [role, moduleKey] = k.split('|') as [Role, string];
    return was(moduleKey, role) === level ? [] : [{ role, moduleKey, level }];
  });
  const count = (role: Role) => data.modules.filter(m => m.levels[role] !== null).length;

  return (
    <section className="panel access-panel">
      <Toolbar only={only} setOnly={setOnly} changes={changes.length} saving={save.isPending} onDiscard={() => setDraft({})} onSave={() => save.mutate(changes)}
        title="Access by role" sub={ROLES.map(r => `${r}: ${count(r)} set`).join(' · ')} />
      <div className="table-wrap access-wrap">
        <table className="access-table">
          <thead><tr><th>SCREEN</th>{ROLES.map(r => <th key={r} className="access-col"><span>{r}</span></th>)}</tr></thead>
          <tbody>
            {rows.map((m, i) => (
              <Fragment key={m.key}>
                {(i === 0 || rows[i - 1].workspace !== m.workspace) && <tr className="access-ws"><td colSpan={ROLES.length + 1}>{WORKSPACE_LABEL[m.workspace]}</td></tr>}
                <tr className={m.availability === 'Available' ? '' : 'access-planned'}>
                  <td data-label="Screen"><span className="access-name" style={{ paddingLeft: `calc(${m.depth} * var(--sp-4))` }}>{m.label}{m.availability !== 'Available' && <small className="muted"> · {m.availability.toLowerCase()}</small>}</span></td>
                  {ROLES.map(r => (
                    <td key={r} className="access-col" data-label={r}>
                      <LevelSelect value={value(m.key, r)} cap={data.caps[r]} blank={`Default (${data.caps[r] === 'write' ? 'change' : 'read'})`} label={`${m.label} for ${r}`} onChange={v => setDraft(d => ({ ...d, [`${r}|${m.key}`]: v }))} />
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PersonAccess({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const members = useQuery({ queryKey: ['members', projectId], queryFn: () => request<Member[]>(`/projects/${projectId}/members`) });
  const [userId, setUserId] = useState('');
  const [only, setOnly] = useState<'all' | 'available'>('available');
  const [draft, setDraft] = useState<Record<string, AccessLevel | null>>({});
  const current = userId || members.data?.[0]?.userId || '';
  const q = useQuery({ queryKey: ['access-person', projectId, current], enabled: !!current, queryFn: () => request<PersonMatrix>(`/projects/${projectId}/access/users/${current}`), staleTime: 0, refetchOnMount: 'always' });
  const { rows } = useTree(q.data?.modules ?? [], only);
  const save = useMutation({
    mutationFn: (cells: { moduleKey: string; level: AccessLevel | null }[]) => request<PersonMatrix>(`/projects/${projectId}/access/users/${current}`, { method: 'PUT', body: JSON.stringify({ cells }) }),
    onSuccess: data => { qc.setQueryData(['access-person', projectId, current], data); qc.invalidateQueries({ queryKey: ['bootstrap'] }); qc.invalidateQueries({ queryKey: ['access-log'] }); setDraft({}); toast('Personal access saved.'); },
    onError: (e: Error) => toast(errorText(e)),
  });
  if (members.isPending) return <PageSkeleton stats={0} panels={1} />;
  if (members.error) return <ErrorBox error={members.error} />;
  if (!members.data.length) return <div className="panel empty">This project has no members yet. Add people under Projects → Members.</div>;
  const data = q.data;
  const was = (key: string) => data?.modules.find(m => m.key === key)?.override ?? null;
  const changes = Object.entries(draft).flatMap(([moduleKey, level]) => (was(moduleKey) === level ? [] : [{ moduleKey, level }]));
  const set = data?.modules.filter(m => m.override !== null).length ?? 0;

  return (
    <section className="panel access-panel">
      <div className="toolbar">
        <label className="field" style={{ minWidth: 260 }}>Member
          <select value={current} onChange={e => { setUserId(e.target.value); setDraft({}); }} aria-label="Member">
            {members.data.map(m => <option key={m.userId} value={m.userId}>{m.name} · {m.role}</option>)}
          </select>
        </label>
        {data && <span className="tiny muted">Ceiling of the {data.role} role: {LEVEL_LABEL[data.cap].toLowerCase()}{data.party ? ` · party ${data.party}` : ''}</span>}
      </div>
      {q.isPending ? <PageSkeleton stats={0} panels={1} /> : q.error ? <ErrorBox error={q.error} /> : (
        <>
          <Toolbar only={only} setOnly={setOnly} changes={changes.length} saving={save.isPending} onDiscard={() => setDraft({})} onSave={() => save.mutate(changes)}
            title={`Access of ${data!.name}`} sub={`${set} screen${set === 1 ? '' : 's'} set for this person, the rest follow their role`} />
          <div className="table-wrap access-wrap">
            <table className="access-table">
              <thead><tr><th>SCREEN</th><th className="access-col">FROM THEIR ROLE</th><th className="access-col">THEIR OWN SETTING</th><th className="access-col">RESULT</th></tr></thead>
              <tbody>
                {rows.map((m, i) => {
                  const own = m.key in draft ? draft[m.key] : m.override;
                  const result: AccessLevel = own ? (own === 'write' && data!.cap !== 'write' ? data!.cap : own) : m.effective;
                  return (
                    <Fragment key={m.key}>
                      {(i === 0 || rows[i - 1].workspace !== m.workspace) && <tr className="access-ws"><td colSpan={4}>{WORKSPACE_LABEL[m.workspace]}</td></tr>}
                      <tr className={m.availability === 'Available' ? '' : 'access-planned'}>
                        <td data-label="Screen"><span className="access-name" style={{ paddingLeft: `calc(${m.depth} * var(--sp-4))` }}>{m.label}</span></td>
                        <td className="access-col" data-label="From their role"><Badge tone={LEVEL_TONE[m.byRole]}>{LEVEL_LABEL[m.byRole]}</Badge></td>
                        <td className="access-col" data-label="Their own setting"><LevelSelect value={own} cap={data!.cap} blank="Same as role" label={`${m.label} for ${data!.name}`} onChange={v => setDraft(d => ({ ...d, [m.key]: v }))} /></td>
                        <td className="access-col" data-label="Result">{own === null || own === undefined ? <span className="tiny muted">follows role</span> : <Badge tone={LEVEL_TONE[result]}>{LEVEL_LABEL[result]}</Badge>}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
