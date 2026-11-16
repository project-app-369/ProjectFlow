import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { PARTIES, errorText, request, type Party, type PartyAccess, type PartyAccessModule, type WorkspaceId } from '../api';
import { useApp, useToast } from '../state';
import { Btn, ErrorBox, Loading } from '../ui';

const WORKSPACE_LABEL: Record<WorkspaceId, string> = { personal: 'Personal', epcic: 'EPCIC', governance: 'Governance', reports: 'Reports' };
type Cell = { moduleKey: string; party: Party; visible: boolean };

/**
 * Settings → Party access: which screens each party (Contractor, Client, Subcontractor) is shown. A screen switched off for
 * a party disappears from their menu and their requests for its data are refused. Administrators always see everything.
 * Untick a screen and the screens under it follow; changes are saved together.
 */
export default function AccessTab() {
  const { me } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const access = useQuery({ queryKey: ['party-access'], queryFn: () => request<PartyAccess>('/party-access'), enabled: !!me?.isAdmin, staleTime: 0, refetchOnMount: 'always' });
  /** Unsaved changes, keyed `module|party`. */
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [only, setOnly] = useState<'all' | 'available'>('available');

  const save = useMutation({
    mutationFn: (cells: Cell[]) => request<PartyAccess>('/party-access', { method: 'PUT', body: JSON.stringify({ cells }) }),
    onSuccess: data => { qc.setQueryData(['party-access'], data); qc.invalidateQueries({ queryKey: ['bootstrap'] }); qc.invalidateQueries({ queryKey: ['party-access'] }); setDraft({}); toast('Party access saved.'); },
    onError: (e: Error) => toast(errorText(e)),
  });

  const modules = access.data?.modules ?? [];
  const byKey = useMemo(() => new Map(modules.map(m => [m.key, m])), [modules]);
  const kids = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const m of modules) if (m.parent) out.set(m.parent, [...(out.get(m.parent) ?? []), m.key]);
    return out;
  }, [modules]);
  const descendants = (key: string): string[] => (kids.get(key) ?? []).flatMap(k => [k, ...descendants(k)]);

  const value = (m: PartyAccessModule, p: Party) => draft[`${m.key}|${p}`] ?? m.visible[p];
  /** Shown only when this screen and every screen above it is on. */
  const effective = (m: PartyAccessModule, p: Party): boolean => value(m, p) && (!m.parent || effective(byKey.get(m.parent)!, p));
  const set = (m: PartyAccessModule, p: Party, on: boolean) => setDraft(d => {
    const next = { ...d };
    for (const k of [m.key, ...descendants(m.key)]) next[`${k}|${p}`] = on;
    return next;
  });
  const setColumn = (p: Party, on: boolean) => setDraft(d => ({ ...d, ...Object.fromEntries(modules.map(m => [`${m.key}|${p}`, on])) }));

  const changes: Cell[] = Object.entries(draft).flatMap(([k, visible]) => {
    const [moduleKey, party] = k.split('|') as [string, Party];
    const was = byKey.get(moduleKey)?.visible[party];
    return was === visible ? [] : [{ moduleKey, party, visible }];
  });

  if (!me?.isAdmin) return <div className="panel empty">Party access is limited to administrators.</div>;
  if (access.isPending) return <Loading />;
  if (access.error) return <ErrorBox error={access.error} />;

  const rows = modules.filter(m => only === 'all' || m.availability === 'Available');
  const shownFor = (p: Party) => modules.filter(m => m.availability === 'Available' && effective(m, p)).length;
  const total = modules.filter(m => m.availability === 'Available').length;

  return (
    <>
      <p className="page-sub" style={{ margin: '-6px 0 16px' }}>
        Tick the screens each party can see. Someone with no party set sees everything their project role allows; administrators always do.
      </p>
      <section className="panel access-panel">
        <div className="panel-head">
          <div><h2>Screens by party</h2><p>{PARTIES.map(p => `${p} ${shownFor(p)}/${total}`).join(' · ')}</p></div>
          <div className="actions">
            <div className="seg" role="group" aria-label="Which screens to list">
              <button type="button" className={only === 'available' ? 'on' : ''} aria-pressed={only === 'available'} onClick={() => setOnly('available')}>Built</button>
              <button type="button" className={only === 'all' ? 'on' : ''} aria-pressed={only === 'all'} onClick={() => setOnly('all')}>All</button>
            </div>
            <Btn iconOnly={false} disabled={!changes.length || save.isPending} onClick={() => setDraft({})}>Discard</Btn>
            <Btn kind="primary" icon="tick" iconOnly={false} disabled={!changes.length || save.isPending} onClick={() => save.mutate(changes)}>{save.isPending ? 'Saving…' : changes.length ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Save'}</Btn>
          </div>
        </div>
        <div className="table-wrap access-wrap">
          <table className="access-table">
            <thead>
              <tr>
                <th>SCREEN</th>
                {PARTIES.map(p => (
                  <th key={p} className="access-col">
                    <span>{p}</span>
                    <span className="access-bulk"><button type="button" className="link-button" onClick={() => setColumn(p, true)}>all</button> · <button type="button" className="link-button" onClick={() => setColumn(p, false)}>none</button></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <Fragment key={m.key}>
                  {(i === 0 || rows[i - 1].workspace !== m.workspace) && <tr key={`ws-${m.workspace}`} className="access-ws"><td colSpan={PARTIES.length + 1}>{WORKSPACE_LABEL[m.workspace]}</td></tr>}
                  <tr key={m.key} className={m.availability === 'Available' ? '' : 'access-planned'}>
                    <td data-label="Screen"><span className="access-name" style={{ paddingLeft: `calc(${m.depth} * var(--sp-4))` }}>{m.label}{m.availability !== 'Available' && <small className="muted"> · {m.availability.toLowerCase()}</small>}</span></td>
                    {PARTIES.map(p => {
                      const own = value(m, p);
                      const shown = effective(m, p);
                      return (
                        <td key={p} className="access-col" data-label={p}>
                          <input type="checkbox" className="switch" checked={own} aria-label={`${m.label} is shown to ${p}`} title={own && !shown ? 'On, but hidden because a screen above it is off' : undefined} onChange={e => set(m, p, e.target.checked)} />
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
