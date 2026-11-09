import { Component, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import { signed, statusTone, type Tone } from './format';
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

/** A progress bar that shows the actual figure as the fill and the plan as a tick, with both numbers written out. */
export function ActualPlanBar({ actual, plan, label, compact }: { actual: number | null; plan: number | null; label?: ReactNode; compact?: boolean }) {
  const a = actual != null && Number.isFinite(actual) ? actual : null;
  const p = plan != null && Number.isFinite(plan) ? plan : null;
  const gap = p == null || a == null ? null : a - p;
  const at = (n: number) => `${Math.max(0, Math.min(100, n))}%`;
  const text = `${a == null ? 'Actual unavailable' : `${a.toFixed(1)}% actual`}, ${p == null ? 'plan unavailable' : `${p.toFixed(1)}% plan`}${gap == null ? '' : `, ${signed(gap)} pp`}`;
  return (
    <div className={`apbar ${compact ? 'compact' : ''}`}>
      <div className="apbar-figures">
        {label && <span className="apbar-label">{label}</span>}
        <span><strong>{a == null ? '—' : `${a.toFixed(1)}%`}</strong> <span className="muted">actual</span></span>
        <span className="muted">{p == null ? '—' : `${p.toFixed(1)}%`} plan</span>
        {gap != null && <span className={gap < 0 ? 'negative' : gap > 0 ? 'positive' : 'muted'}>{signed(gap)} pp</span>}
      </div>
      <div className="apbar-track" role="img" aria-label={text} title={text}>
        {a != null && <div className={`apbar-fill ${gap != null && gap < 0 ? 'behind' : ''}`} style={{ width: at(a) }} />}
        {p != null && <div className="apbar-plan" style={{ left: at(p) }} />}
      </div>
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
          {sheet && <a className="btn small icon-only" href={sheet.url} target="_blank" rel="noreferrer" title={`Open the "${sheet.name}" sheet`} aria-label={`Open the "${sheet.name}" sheet`}><Icon name="sheet" /></a>}
          {actions}
        </div>
      </div>
    </>
  );
}

/**
 * Verbs that read faster as a coloured icon alone (the label stays as tooltip and accessible name). Anything not listed
 * keeps its text; `iconOnly` on a button overrides this either way. Save, Cancel and Close keep their words next to the icon.
 */
const VERBS: Record<string, { icon: string; only: boolean }> = {
  Edit: { icon: 'edit', only: true }, Delete: { icon: 'trash', only: true }, Remove: { icon: 'trash', only: true },
  'Export CSV': { icon: 'down', only: true }, 'Import WBS': { icon: 'upload', only: true }, Refresh: { icon: 'refresh', only: true },
  Previous: { icon: 'chevron-left', only: true }, Next: { icon: 'chevron-right', only: true }, '‹': { icon: 'chevron-left', only: true }, '›': { icon: 'chevron-right', only: true },
  Members: { icon: 'people', only: true }, Status: { icon: 'flag', only: true }, Open: { icon: 'arrow', only: true }, Selected: { icon: 'tick', only: true },
  Clear: { icon: 'close', only: true }, Today: { icon: 'calendar', only: true }, Add: { icon: 'plus', only: true },
  'Collapse all': { icon: 'fold', only: true }, 'Expand all': { icon: 'unfold', only: true },
  Cancel: { icon: 'close', only: false }, Close: { icon: 'close', only: false }, Save: { icon: 'tick', only: false },
};
const LEADING: [RegExp, string][] = [[/^(Save|Create|Replace|Import \d)/, 'tick'], [/^Add /, 'plus']];

export function Btn({ children, icon, iconOnly, kind = '', ...rest }: { icon?: string; iconOnly?: boolean; kind?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const text = typeof children === 'string' ? children : undefined;
  const verb = text ? VERBS[text] : undefined;
  const glyph = icon ?? verb?.icon ?? (text ? LEADING.find(([re]) => re.test(text))?.[1] : undefined);
  const only = !!glyph && (iconOnly ?? verb?.only ?? false);
  const label = rest['aria-label'] ?? text;
  if (only) {
    return <button type="button" className={`btn ${kind} icon-only`} {...rest} aria-label={label} title={rest.title ?? label}><Icon name={glyph} /></button>;
  }
  return (
    <button type="button" className={`btn ${kind}`} {...rest}>
      {glyph && <Icon name={glyph} />}{children}
    </button>
  );
}

let modalLocks = 0;
const modalStack: symbol[] = [];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * A panel that slides in from the right edge, full height (full width on a phone). It is a plain overlay, not a native
 * <dialog>, so its position cannot depend on a browser's default dialog styles. It traps focus, closes on Escape or a
 * click on the dimmed page, locks page scrolling while open, and gives focus back when it closes.
 */
export function Modal({ title, onClose, children, actions, size = 'md' }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const id = useId();

  useEffect(() => {
    const el = panel.current!;
    const token = Symbol('modal');
    modalStack.push(token);
    const before = document.activeElement as HTMLElement | null;
    const { body, documentElement: root } = document;
    const saved = { overflow: body.style.overflow, padding: body.style.paddingRight };
    if (modalLocks++ === 0) {
      const gap = window.innerWidth - root.clientWidth;
      body.style.overflow = 'hidden';
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('input:not([type=hidden]),textarea,select') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return; // only the top-most modal reacts
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      if (--modalLocks === 0) { body.style.overflow = saved.overflow; body.style.paddingRight = saved.padding; }
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close.current(); }}>
      <div className={`modal size-${size}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={panel} tabIndex={-1}>
        <div className="dialog-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" type="button" aria-label="Close dialog" title="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
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
    <Modal title={title} size="sm" onClose={onClose} actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" icon={confirmLabel === 'Delete' ? 'trash' : 'tick'} iconOnly={false} disabled={busy} onClick={onConfirm}>{confirmLabel}</Btn></>}>
      <div className="dialog-body">{children}</div>
    </Modal>
  );
}
