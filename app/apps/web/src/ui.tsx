import { Component, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { statusTone, type Tone } from './format';
import { CrumbContext, SheetContext, useApp } from './state';

export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill ${tone ?? statusTone(String(children))}`}>{children}</span>;
}

export function Stat({ label, value, unit, foot, icon }: { label: string; value: ReactNode; unit?: string; foot: ReactNode; icon: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}<Icon name={icon} /></div>
      <div className="stat-value mono">{value}{unit && <small>{unit}</small>}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

export function Breadcrumb({ parts }: { parts: string[] }) {
  return (
    <div className="breadcrumb">
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep">/</span>}
          {i === parts.length - 1 ? <strong>{p}</strong> : <span>{p}</span>}
        </span>
      ))}
    </div>
  );
}

export function PageHead({ title, desc, actions }: { title: string; desc: ReactNode; actions?: ReactNode }) {
  const { project } = useApp();
  const crumbs = useContext(CrumbContext);
  const sheet = useContext(SheetContext);
  return (
    <>
      <Breadcrumb parts={crumbs} />
      <div className="page-head">
        <div>
          <div className="eyebrow">{project.code} · {project.contract}</div>
          <h1>{title}</h1>
          <p className="page-sub">{desc}</p>
        </div>
        <div className="actions">
          {sheet && <a className="btn small" href={sheet.url} target="_blank" rel="noreferrer" title={`Open the "${sheet.name}" sheet`}><Icon name="doc" />Open sheet</a>}
          {actions}
        </div>
      </div>
    </>
  );
}

export function Btn({ children, icon, kind = '', ...rest }: { icon?: string; kind?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn ${kind}`} {...rest}>
      {icon && <Icon name={icon} />}{children}
    </button>
  );
}

export function Modal({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={e => {
        const r = e.currentTarget.getBoundingClientRect();
        if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-btn" type="button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
      </div>
      {children}
      {actions && <div className="dialog-actions">{actions}</div>}
    </dialog>
  );
}

export const Loading = ({ label = 'Loading…' }: { label?: string }) => <div className="empty">{label}</div>;

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="panel empty">{error instanceof Error ? error.message : 'Something went wrong.'}</div>;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="table-footer">
      <span>{from}–{Math.min(total, page * pageSize)} of {total}</span>
      <span className="actions">
        <Btn kind="small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
        <span>Page {page} / {pages}</span>
        <Btn kind="small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
      </span>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** A page fault shows a local unavailable state and keeps the shell usable (spec ARCH-03). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="panel empty">This screen is unavailable right now. {this.state.error.message}</div>;
  }
}

export function Field({ label, full, hint, children }: { label: string; full?: boolean; hint?: string; children: ReactNode }) {
  return <label className={`field ${full ? 'full' : ''}`}>{label}{children}{hint && <small className="muted">{hint}</small>}</label>;
}

/** Asks before something that cannot be undone. */
export function Confirm({ title, children, confirmLabel = 'Delete', busy, onConfirm, onClose }: { title: string; children: ReactNode; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={busy} onClick={onConfirm}>{confirmLabel}</Btn></>}>
      <div className="dialog-body">{children}</div>
    </Modal>
  );
}
