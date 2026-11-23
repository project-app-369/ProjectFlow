import { Component, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import { signed, statusTone, type Tone } from './format';
import { Link } from 'react-router-dom';
import { CrumbContext, type Crumb } from './state';

/**
 * One colour language for every state shown as an icon: grey = not started or low, blue = planned, waiting or normal,
 * amber = in progress or needs attention, green = done, red = critical or overdue. Always icon and words together.
 */
export type StateTone = 'neutral' | 'info' | 'warn' | 'ok' | 'crit';
export function StateTag({ icon, label, tone, title }: { icon: string; label: string; tone: StateTone; title?: string }) {
  return <span className={`state-tag t-${tone}`} title={title ?? label}><Icon name={icon} /><span>{label}</span></span>;
}

export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill ${tone ?? statusTone(String(children))}`}>{children}</span>;
}

/** Runs a number up from 0 (or from its previous value) to the target. Text that is not a plain number is shown as is. */
function CountUp({ value }: { value: ReactNode }) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const m = /^([+-]?)(\d+(?:\.(\d+))?)$/.exec(raw);
  const target = m ? Number(m[1] + m[2]) : null;
  const decimals = m?.[3]?.length ?? 0;
  const sign = m?.[1] === '+';
  const [shown, setShown] = useState<number | null>(target == null ? null : 0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null) { setShown(null); return; }
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setShown(target); return; }
    const start = from.current, t0 = performance.now(), ms = 900;
    let id = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      const v = start + (target - start) * e;
      from.current = v; setShown(v);
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target]);
  if (target == null || shown == null) return <>{value}</>;
  const text = shown.toFixed(decimals);
  return <span aria-label={raw}>{sign && shown > 0 ? '+' : ''}{text}</span>;
}

export function Stat({ label, value, unit, foot, icon, tone }: { label: string; value: ReactNode; unit?: string; foot: ReactNode; icon: string; /** Tints the card, to group related figures. */ tone?: 'overall' | 'week' }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <div className="stat-label">{label}<Icon name={icon} /></div>
      <div className="stat-value mono"><CountUp value={value} />{unit && <small>{unit}</small>}</div>
      <div className="stat-foot" title={typeof foot === 'string' ? foot : undefined}>{foot}</div>
    </div>
  );
}

/** A progress bar that shows the actual figure as the fill and the plan as a tick, with both numbers written out. */
export function ActualPlanBar({ actual, plan, label, compact, hideActual, animate }: { actual: number | null; plan: number | null; label?: ReactNode; compact?: boolean; /** Inside a KPI card the actual is already the big number. */ hideActual?: boolean; /** Counts the figures up and grows the bar when it appears. */ animate?: boolean }) {
  const a = actual != null && Number.isFinite(actual) ? actual : null;
  const p = plan != null && Number.isFinite(plan) ? plan : null;
  const gap = p == null || a == null ? null : a - p;
  const at = (n: number) => `${Math.max(0, Math.min(100, n))}%`;
  const text = `${a == null ? 'Actual unavailable' : `${a.toFixed(1)}% actual`}, ${p == null ? 'plan unavailable' : `${p.toFixed(1)}% plan`}${gap == null ? '' : `, ${signed(gap)}%`}`;
  return (
    <div className={`apbar ${compact ? 'compact' : ''}${animate ? ' anim' : ''}`}>
      <div className="apbar-figures">
        {label && <span className="apbar-label">{label}</span>}
        {!hideActual && <span><strong>{a == null ? '—' : animate ? <><CountUp value={a.toFixed(1)} />%</> : `${a.toFixed(1)}%`}</strong> <span className="muted">actual</span></span>}
        <span className="muted">{p == null ? '—' : animate ? <><CountUp value={p.toFixed(1)} />%</> : `${p.toFixed(1)}%`} plan</span>
        {gap != null && <span className={`apbar-gap ${gap < 0 ? 'negative' : gap > 0 ? 'positive' : 'muted'}`}>{signed(gap)}%</span>}
      </div>
      <div className="apbar-track" role="img" aria-label={text} title={text}>
        {a != null && <div className={`apbar-fill ${gap != null && gap < 0 ? 'behind' : ''}`} style={{ width: at(a) }} />}
        {p != null && <div className="apbar-plan" style={{ left: at(p) }} />}
      </div>
    </div>
  );
}

export function Breadcrumb({ parts }: { parts: Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {parts.map((c, i) => {
        const p = typeof c === 'string' ? { label: c } : c;
        return (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span className="sep">/</span>}
            {i === parts.length - 1 ? <strong aria-current="page">{p.label}</strong> : p.to ? <Link className="crumb-link" to={p.to}>{p.label}</Link> : <span>{p.label}</span>}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHead({ title, desc, actions }: { title: string; desc: ReactNode; actions?: ReactNode }) {
  const crumbs = useContext(CrumbContext);
  return (
    <>
      <Breadcrumb parts={crumbs} />
      <div className="page-head">
        <div>
          <h1 title={typeof desc === 'string' ? desc : undefined}>{title}</h1>
        </div>
        <div className="actions">
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
/** When on-screen content swaps one Modal for another (a loading placeholder for the loaded record), the new one must not slide in again. */
let lastModalGone: { at: number; who: object } = { at: 0, who: {} };

export function Modal({ title, onClose, children, actions, size = 'md', popout = size !== 'sm', startPopped = false }: {
  title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Offers a button that moves the dialog into a window of its own (on by default, except for small confirmations). */
  popout?: boolean;
  /** Opens straight into a window of its own; shown as a dialog in the page only when the browser blocks the window. */
  startPopped?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [popped, setPopped] = useState<{ win: Window; host: HTMLElement } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const poppedRef = useRef(popped);
  poppedRef.current = popped;
  /** This window was opened by a pop-out of a detail with its own address: show only the dialog, and closing it closes the window. */
  const [ownWindow] = useState(() => popout && typeof window !== 'undefined' && window.name.startsWith('pf-popout'));
  const close = useRef(onClose);
  close.current = ownWindow ? () => window.close() : onClose;
  useEffect(() => { if (!ownWindow) return; document.body.classList.add('is-popout'); return () => document.body.classList.remove('is-popout'); }, [ownWindow]);
  const id = useId();
  const me = useRef({});
  // A Modal that replaces another in the same commit (placeholder -> record) appears in place; the layout phase is before the first paint.
  useLayoutEffect(() => { if (lastModalGone.who !== me.current && performance.now() - lastModalGone.at < 250) { const el = panel.current; el?.classList.add('still'); el?.parentElement?.classList.add('still'); } return () => { lastModalGone = { at: performance.now(), who: me.current }; }; }, []);

  /** Opens a window beside the app and copies the page's styles and theme into it; the dialog is then drawn there, from this same component. */
  const openWindow = () => {
    // A detail that is open at its own address (?id=…) pops out as that address in a new window, so the window's URL can be copied and shared.
    const here = new URL(window.location.href);
    if (!startPopped && here.searchParams.get('id') && here.searchParams.get('id') !== 'new') {
      const own = window.open(here.href, `pf-popout-${Date.now()}`, 'popup=yes,width=1100,height=860');
      if (own) { close.current(); return true; }
    }
    const win = window.open('', '', 'popup=yes,width=1100,height=860');
    if (!win) return false;
    const doc = win.document;
    doc.title = `${title} · Project Flow`;
    document.head.querySelectorAll('link[rel="stylesheet"],style').forEach(n => doc.head.appendChild(n.cloneNode(true)));
    const viewport = doc.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width,initial-scale=1';
    doc.head.appendChild(viewport);
    for (const a of Array.from(document.documentElement.attributes)) doc.documentElement.setAttribute(a.name, a.value);
    doc.body.className = document.body.className;
    const host = doc.createElement('div');
    host.className = 'popout-root';
    doc.body.appendChild(host);
    let finished = false;
    const done = () => { if (!finished) { finished = true; close.current(); } };
    win.addEventListener('pagehide', done);
    doc.addEventListener('keydown', e => { if (e.key === 'Escape') done(); });
    setPopped({ win, host });
    return true;
  };
  const autoOpened = useRef(false); // StrictMode runs effects twice in development; one window is enough
  useEffect(() => { if (startPopped && !autoOpened.current) { autoOpened.current = true; if (!openWindow()) setBlocked(true); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { const p = poppedRef.current; if (p && !p.win.closed) p.win.close(); }, []);

  useEffect(() => {
    if (popped) return; // the page behind is free to scroll while the dialog lives in its own window
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
    // focus after the slide-in so the first frames are not spent on focus styles and scrolling
    const focusTimer = window.setTimeout(() => { if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('input:not([type=hidden]),textarea,select') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus({ preventScroll: true }); }, 240);

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
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      if (--modalLocks === 0) { body.style.overflow = saved.overflow; body.style.paddingRight = saved.padding; }
      before?.focus?.({ preventScroll: true });
    };
  }, [popped]);

  if (startPopped && !popped && !blocked) return null;
  const frame = (
    <div className={`modal-backdrop${popped || ownWindow ? ' popout' : ''}`} onMouseDown={popped ? undefined : e => { if (e.target === e.currentTarget) close.current(); }}>
      <div className={`modal size-${size}${popped || ownWindow ? ' popout' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={panel} tabIndex={-1}>
        <div className="dialog-head">
          <h2 id={id}>{title}</h2>
          {popout && !popped && !ownWindow && <button className="icon-btn" type="button" aria-label="Open in a new window" title="Open in a new window" onClick={openWindow}><Icon name="popout" /></button>}
          <button className="icon-btn" type="button" aria-label="Close dialog" title="Close" onClick={() => close.current()}><Icon name="close" /></button>
        </div>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
  return createPortal(frame, popped ? popped.host : document.body);
}

/**
 * Placeholders that hold the shape of what is loading, so the page does not jump when the data arrives and nothing is
 * re-animated on arrival: the shimmer only runs while the placeholder is there, and the content that replaces it simply appears.
 */
export function Skeleton({ lines = 3, height }: { lines?: number; height?: string }) {
  return (
    <div className="sk-block" role="status" aria-busy="true" aria-label="Loading" style={height ? { minHeight: height } : undefined}>
      {Array.from({ length: lines }, (_, i) => <span key={i} className="sk sk-line" style={{ width: `${92 - ((i * 17) % 40)}%` }} />)}
    </div>
  );
}

/** The body of a detail drawer while its record loads: a heading, a row of chips, a grid of fields and some text. */
export function ModalSkeleton() {
  return (
    <div className="dialog-body sk-modal" role="status" aria-busy="true" aria-label="Loading">
      <span className="sk sk-title" />
      <div className="sk-chips"><span className="sk" /><span className="sk" /><span className="sk" /><span className="sk" /></div>
      <div className="sk-fields">{Array.from({ length: 6 }, (_, i) => <span key={i} className="sk sk-field" />)}</div>
      <Skeleton lines={4} />
    </div>
  );
}

/** A whole page while its first data loads: title, a row of figures and two panels. */
export function PageSkeleton({ stats = 4, panels = 2 }: { stats?: number; panels?: number }) {
  return (
    <div className="sk-page" role="status" aria-busy="true" aria-label="Loading">
      <span className="sk sk-title" />
      {stats > 0 && <div className="stats">{Array.from({ length: stats }, (_, i) => <span key={i} className="sk sk-card" />)}</div>}
      {Array.from({ length: panels }, (_, i) => <span key={i} className="sk sk-panel" />)}
    </div>
  );
}

/** Rows of a register while its page loads (the header stays, so only the rows are waiting). */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="table-wrap sk-table" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <span key={i} className="sk sk-row" />)}
    </div>
  );
}

/** What is shown in place of a panel or chart while it loads. The wording is kept for screen readers; the picture is a placeholder. */
export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  /chart/i.test(label)
    ? <div className="sk-chart" role="status" aria-busy="true" aria-label={label}><span className="sk sk-panel" /></div>
    : <Skeleton lines={4} />
);

/** True once the element has come near the viewport, and stays true: below-the-fold work starts when the person scrolls to it. */
export function useInView<T extends Element>(margin = '240px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}

/** Renders its children only once scrolled near, with a placeholder of the same height until then. */
export function Deferred({ children, height = '16rem' }: { children: ReactNode; height?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return <div ref={ref}>{seen ? children : <Skeleton lines={0} height={height} />}</div>;
}

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

/* ---------- Dates: typed or picked, written the same way everywhere (dd/mm/yyyy, stored as yyyy-mm-dd) ---------- */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const isoOf = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};
/** Reads what a person types: 13/11/2026, 13-11-26, 13.11.2026, 2026-11-13 or 13 Nov 2026. Null when it is not a real date. */
export function parseDateText(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isoOf(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t);
  if (m) return isoOf(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[\s\-/]([a-z]{3})[a-z]*[\s\-/,]*(\d{2}|\d{4})$/.exec(t);
  if (m && MONTHS.includes(m[2])) return isoOf(m[3].length === 2 ? 2000 + +m[3] : +m[3], MONTHS.indexOf(m[2]) + 1, +m[1]);
  return null;
}
export const showDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

type DateChange = { target: { value: string } };
/**
 * The one date field: type the date, or press the calendar button to pick it. Takes the props of the native date input it
 * replaces (value or defaultValue as yyyy-mm-dd, min, max, name, onChange(e) with e.target.value as yyyy-mm-dd).
 */
export function DateInput({ value, defaultValue, onChange, min, max, name, required, disabled, className, style, ...aria }: {
  value?: string; defaultValue?: string; onChange?: (e: DateChange) => void; min?: string; max?: string; name?: string; required?: boolean; disabled?: boolean;
  className?: string; style?: React.CSSProperties; 'aria-label'?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? '');
  const iso = value ?? inner;
  const [text, setText] = useState(showDate(iso));
  const [bad, setBad] = useState(false);
  const editing = useRef(false);
  const native = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing.current) { setText(showDate(iso)); setBad(false); } }, [iso]);
  const commit = (next: string) => { if (value === undefined) setInner(next); onChange?.({ target: { value: next } }); };
  const finish = () => {
    editing.current = false;
    if (!text.trim()) { setBad(false); if (iso) commit(''); return; }
    const parsed = parseDateText(text);
    if (parsed) { setBad(false); setText(showDate(parsed)); if (parsed !== iso) commit(parsed); } else { setBad(false); setText(showDate(iso)); }
  };
  const pick = () => { const el = native.current; if (!el || disabled) return; try { el.showPicker(); } catch { el.focus(); el.click(); } };
  return (
    <span className="date-input" style={style}>
      <input type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/yyyy" className={`${className ?? ''}${bad ? ' invalid' : ''}`} value={text} disabled={disabled} required={required} aria-label={aria['aria-label']} aria-invalid={bad || undefined}
        onFocus={() => { editing.current = true; }}
        onChange={e => { setText(e.target.value); setBad(!!e.target.value.trim() && parseDateText(e.target.value) === null); }}
        onBlur={finish}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); finish(); } else if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); pick(); } }} />
      <button type="button" className="date-pick" tabIndex={-1} disabled={disabled} aria-label="Pick a date" title="Pick a date" onClick={pick}><Icon name="calendar" /></button>
      <input ref={native} type="date" className="date-native" tabIndex={-1} aria-hidden="true" value={iso} min={min} max={max} disabled={disabled} onChange={e => { editing.current = false; setBad(false); setText(showDate(e.target.value)); commit(e.target.value); }} />
      {name && <input type="hidden" name={name} value={iso} />}
    </span>
  );
}

/** Asks before something that cannot be undone. */
export function Confirm({ title, children, confirmLabel = 'Delete', busy, onConfirm, onClose }: { title: string; children: ReactNode; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} size="sm" onClose={onClose} actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" icon={confirmLabel === 'Delete' ? 'trash' : 'tick'} iconOnly={false} disabled={busy} onClick={onConfirm}>{confirmLabel}</Btn></>}>
      <div className="dialog-body">{children}</div>
    </Modal>
  );
}
