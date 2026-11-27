import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText, request } from './api';
import { useToast } from './state';
import { Btn, Confirm, Field, Modal } from './ui';

export interface FieldDef {
  key: string;
  label: string;
  kind?: 'text' | 'textarea' | 'number' | 'date' | 'select';
  options?: readonly string[];
  /** Text shown for an option whose stored value is a code. */
  /** A select that starts on its blank entry for a new record instead of the first option. */
  startBlank?: boolean;
  optionLabels?: Readonly<Record<string, string>>;
  /** Suggestions for a text field. */
  suggestions?: readonly string[];
  full?: boolean;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  /** Shown only when editing, and not sent. */
  readOnly?: boolean;
  max?: number;
  min?: number;
  rows?: number;
}

type Rec = Record<string, unknown>;
const asText = (v: unknown) => (v == null ? '' : String(v));

/**
 * One record, in a panel from the right: a form built from field definitions, with Save, and Delete when allowed.
 * Create posts to `base`; edit patches `${base}/${id}`. Blank fields are sent as null so a value can be cleared.
 */
export function RecordDrawer({ title, fields, record, defaults, base, id, canDelete, deleteNote, invalidate, onClose, onSaved, size = 'md', children }: {
  title: string; fields: FieldDef[]; record?: Rec | null; defaults?: Rec; base: string; id?: string; canDelete?: boolean; deleteNote?: string;
  /** Query-key prefixes to refresh after a change. */
  invalidate: string[]; onClose: () => void; onSaved?: (saved: Rec) => void; size?: 'sm' | 'md' | 'lg'; children?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.key, asText(record?.[f.key] ?? defaults?.[f.key] ?? (f.kind === 'select' && !record && !f.startBlank ? f.options?.[0] : ''))])));
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const editing = !!record && !!id;
  const refresh = () => Promise.all(invalidate.map(k => qc.invalidateQueries({ queryKey: [k] })));

  const body = () => Object.fromEntries(fields.filter(f => !f.readOnly).map(f => {
    const raw = (v[f.key] ?? '').trim();
    if (f.kind === 'number') return [f.key, raw === '' ? null : Number(raw)];
    return [f.key, raw === '' ? null : raw];
  }));
  const save = useMutation({
    mutationFn: () => (editing ? request<Rec>(`${base}/${encodeURIComponent(id!)}`, { method: 'PATCH', body: JSON.stringify(body()) }) : request<Rec>(base, { method: 'POST', body: JSON.stringify(body()) })),
    onSuccess: r => { refresh(); toast(editing ? 'Saved.' : 'Created.'); onSaved?.(r); onClose(); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/${encodeURIComponent(id!)}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Deleted.'); onClose(); },
    onError: (e: Error) => { setConfirming(false); setError(errorText(e)); },
  });

  const missing = fields.some(f => f.required && !(v[f.key] ?? '').trim());
  const set = (k: string, val: string) => setV(s => ({ ...s, [k]: val }));

  return (
    <>
      <Modal title={title} size={size} onClose={onClose}
        actions={<>
          {editing && canDelete && <Btn kind="text" onClick={() => setConfirming(true)}>Delete</Btn>}
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" disabled={save.isPending || missing} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn>
        </>}>
        <div className="dialog-body">
          {children}
          <div className="form-grid">
            {fields.map(f => (
              <Field key={f.key} label={f.label + (f.required ? ' *' : '')} full={f.full || f.kind === 'textarea'} hint={f.hint}>
                {f.kind === 'textarea' ? <textarea value={v[f.key]} rows={f.rows ?? 3} maxLength={f.max} placeholder={f.placeholder} disabled={f.readOnly && editing} onChange={e => set(f.key, e.target.value)} />
                  : f.kind === 'select' ? (
                    <select value={v[f.key]} onChange={e => set(f.key, e.target.value)}>
                      {!f.required && <option value="">—</option>}
                      {[...(f.options ?? []), ...(v[f.key] && !(f.options ?? []).includes(v[f.key]) ? [v[f.key]] : [])].map(o => <option key={o} value={o}>{f.optionLabels?.[o] ?? o}</option>)}
                    </select>
                  ) : (
                    <>
                      <input type={f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : 'text'} step={f.kind === 'number' ? 'any' : undefined} min={f.min} value={v[f.key]} maxLength={f.max}
                        placeholder={f.placeholder} list={f.suggestions ? `dl-${f.key}` : undefined} disabled={f.readOnly && editing} onChange={e => set(f.key, e.target.value)} />
                      {f.suggestions && <datalist id={`dl-${f.key}`}>{f.suggestions.map(o => <option key={o} value={o} />)}</datalist>}
                    </>
                  )}
              </Field>
            ))}
          </div>
          {error && <p className="negative mt-3" role="alert">{error}</p>}
        </div>
      </Modal>
      {confirming && (
        <Confirm title={`Delete ${id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirming(false)}>
          <p>{deleteNote ?? 'This record will be removed. This cannot be undone.'}</p>
        </Confirm>
      )}
    </>
  );
}

/** Distinct, sorted suggestions for a text field, taken from the rows already loaded. */
export const suggest = (rows: Rec[], key: string): string[] => [...new Set(rows.map(r => r[key]).filter((x): x is string => typeof x === 'string' && x !== ''))].sort();
