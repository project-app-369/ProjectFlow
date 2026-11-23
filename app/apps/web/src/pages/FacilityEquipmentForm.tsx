import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText, request, type FacilityEquipment } from '../api';
import { useToast } from '../state';
import { Btn, DateInput, Field, Modal } from '../ui';

export const METHODS = ['Lift by Crane', 'Skidding'] as const;
const PACKAGE_STATUSES = ['Normal', 'At Risk', 'Delay'] as const;

/** Add or edit one equipment of the facility list (Supabase through the API; the tag is the key and cannot change). */
export function FacilityEquipmentForm({ item, model = 'topside', decks, base, onClose, onSaved }: {
  item: FacilityEquipment | null; model?: FacilityEquipment['model']; decks: string[]; base: string; onClose: () => void; onSaved: (tag: string) => void;
}) {
  const toast = useToast();
  const [v, setV] = useState({
    tag: item?.tag ?? '', name: item?.name ?? '', deck: item?.deck ?? decks[0] ?? '', packageCode: item?.packageCode ?? '', vendor: item?.vendor ?? '',
    rosDate: item?.rosDate ?? '', etaDate: item?.etaDate ?? '', status: item?.status ?? '', packageStatus: item?.packageStatus ?? '', method: item?.method ?? '',
    remarks: item?.remarks ?? '', comments: item?.comments ?? '',
  });
  const [error, setError] = useState('');
  const up = (k: keyof typeof v, val: string) => setV(s => ({ ...s, [k]: val }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: v.name || null, deck: v.deck, packageCode: v.packageCode || null, vendor: v.vendor || null, rosDate: v.rosDate || null, etaDate: v.etaDate || null,
        status: v.status || null, packageStatus: v.packageStatus || null, method: v.method || null, remarks: v.remarks || null, comments: v.comments || null,
      };
      return item
        ? request<FacilityEquipment>(`${base}/${encodeURIComponent(item.tag)}`, { method: 'PATCH', body: JSON.stringify(body) })
        : request<FacilityEquipment>(base, { method: 'POST', body: JSON.stringify({ ...body, tag: v.tag.trim(), model }) });
    },
    onSuccess: saved => { toast(item ? 'Equipment updated.' : 'Equipment added.'); onSaved(saved.tag); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const ready = v.deck.trim() && (item || v.tag.trim());

  return (
    <Modal title={item ? `${item.tag} · Edit equipment` : 'Add equipment'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !ready} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="Tag" hint={item ? 'The tag cannot be changed: it names the part in the 3D model' : 'Unique in the project; matches the part name in the 3D model, e.g. MBD-2501'}>
            <input value={v.tag} disabled={!!item} maxLength={40} onChange={e => up('tag', e.target.value)} autoFocus={!item} />
          </Field>
          <Field label={model === 'lqm' ? 'Floor' : 'Deck'}>
            <input list="fl-decks" value={v.deck} maxLength={60} onChange={e => up('deck', e.target.value)} />
            <datalist id="fl-decks">{decks.map(d => <option key={d} value={d} />)}</datalist>
          </Field>
          <Field label="Equipment name" full><input value={v.name} maxLength={200} onChange={e => up('name', e.target.value)} autoFocus={!!item} /></Field>
          <Field label="ROS (required on site)"><DateInput value={v.rosDate} onChange={e => up('rosDate', e.target.value)} /></Field>
          <Field label="ETA (expected on site)"><DateInput value={v.etaDate} onChange={e => up('etaDate', e.target.value)} /></Field>
          <Field label="Installation method">
            <select value={v.method} onChange={e => up('method', e.target.value)}>
              <option value="">Not set</option>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Package status">
            <select value={v.packageStatus} onChange={e => up('packageStatus', e.target.value)}>
              <option value="">—</option>
              {[...new Set([...PACKAGE_STATUSES, v.packageStatus].filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Package code"><input value={v.packageCode} maxLength={60} onChange={e => up('packageCode', e.target.value)} /></Field>
          <Field label="Shipment status"><input value={v.status} maxLength={60} onChange={e => up('status', e.target.value)} /></Field>
          <Field label="Vendor" full><input value={v.vendor} maxLength={160} onChange={e => up('vendor', e.target.value)} /></Field>
          <Field label="Remarks" full><textarea value={v.remarks} maxLength={2000} onChange={e => up('remarks', e.target.value)} /></Field>
          <Field label="Comments" full><textarea value={v.comments} maxLength={2000} onChange={e => up('comments', e.target.value)} /></Field>
        </div>
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}
