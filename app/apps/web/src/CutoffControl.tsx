import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiMode, errorText, request, type Snapshot } from './api';
import { addDays, fmtDate, localToday } from './format';
import { Icon } from './icons';
import { useAccess, useApp, useToast } from './state';
import { Btn, Field, Modal, DateInput } from './ui';

const isFriday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() === 5;
/** The most recent Friday on or before a date: reports are normally dated the Friday the data was imported. */
const latestFriday = (iso: string) => addDays(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 2) % 7));

/**
 * Header control for the reporting cut-off: a dropdown of the current data and every saved cut-off report, and an
 * icon button that saves the current data as a new report. Choosing a saved report shows that date's data read-only.
 */
export function CutoffControl() {
  const { project, asOf, setAsOf } = useApp();
  const access = useAccess();
  const enabled = apiMode === 'sheets' && !!project.id && !!project.myRole;
  const snaps = useQuery({ queryKey: ['snapshots', project.id], queryFn: () => request<Snapshot[]>(`/projects/${project.id}/snapshots`), enabled });
  const [saving, setSaving] = useState(false);

  if (!project.id) return null;
  if (!enabled) return <span className="date-label"><Icon name="calendar" /> Cut-off {fmtDate(project.cutoff)}</span>;

  const list = snaps.data ?? [];
  return (
    <div className="cutoff" role="group" aria-label="Reporting cut-off">
      <label className={`cutoff-select ${asOf ? 'is-snapshot' : ''}`}>
        <Icon name="calendar" />
        <span className="sr-only">Cut-off date</span>
        <select aria-label="Cut-off date" value={asOf ?? ''} onChange={e => setAsOf(e.target.value || null)}>
          <option value="">{fmtDate(project.cutoff)} · current data</option>
          {list.map(s => <option key={s.cutoff} value={s.cutoff}>{fmtDate(s.cutoff)} · saved report</option>)}
        </select>
      </label>
      {access.canManage && (
        <button type="button" className="icon-btn snapshot-btn" aria-label="Save a snapshot of the current data as a cut-off report" title="Save snapshot: store the current data as a cut-off report" onClick={() => setSaving(true)}>
          <Icon name="camera" />
        </button>
      )}
      {saving && <SnapshotDialog existing={list} onClose={() => setSaving(false)} />}
    </div>
  );
}

function SnapshotDialog({ existing, onClose }: { existing: Snapshot[]; onClose: () => void }) {
  const { project } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [cutoff, setCutoff] = useState(project.cutoff);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const exists = existing.some(s => s.cutoff === cutoff);

  const save = useMutation({
    mutationFn: () => request<Snapshot>(`/projects/${project.id}/snapshots`, { method: 'POST', body: JSON.stringify({ cutoff, note: note || null, replace: exists }) }),
    onSuccess: r => { qc.invalidateQueries({ queryKey: ['snapshots'] }); toast(`Cut-off report saved for ${fmtDate(r.cutoff)}.`); onClose(); },
    onError: (e: Error) => setError(errorText(e)),
  });

  return (
    <Modal popout={false} title="Save cut-off report" onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !cutoff} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : exists ? 'Replace report' : 'Save report'}</Btn></>}>
      <div className="dialog-body">
        <p style={{ marginBottom: 16 }}>Stores a copy of the project's current data (schedule, milestones, procurement, expediting, risks and interfaces) so it can be opened later from the cut-off dropdown. Saved reports are read-only.</p>
        <div className="form-grid">
          <Field label="Cut-off date" hint={cutoff && !isFriday(cutoff) ? 'Reports are usually dated the Friday the data was imported.' : undefined}>
            <DateInput value={cutoff} max={addDays(localToday(), 1)} onChange={e => setCutoff(e.target.value)} />
          </Field>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <Btn kind="small" onClick={() => setCutoff(latestFriday(localToday()))}>Latest Friday ({fmtDate(latestFriday(localToday()))})</Btn>
          </div>
          <Field label="Note (optional)" full><input value={note} maxLength={200} placeholder="e.g. Weekly progress report, week 45" onChange={e => setNote(e.target.value)} /></Field>
        </div>
        {exists && <p className="warning" style={{ marginTop: 14 }}>A report for {fmtDate(cutoff)} already exists. Saving replaces it with the current data.</p>}
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}
