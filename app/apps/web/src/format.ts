export const fmtDate = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const initials = (name?: string | null) =>
  String(name || '?').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w[0])).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export type Tone = 'green' | 'amber' | 'red' | 'indigo';

export function statusTone(status?: string | null): Tone {
  const s = String(status ?? '');
  if (/^(Normal|PO placed|Arrived|On track)$/i.test(s)) return 'green';
  if (/^(Delay|At High Risk|Blocked)$/i.test(s)) return 'red';
  if (/^(At Risk|LOA issued|FAT|On sailing|Final inspection)$/i.test(s)) return 'amber';
  return 'indigo';
}

export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

/** Calendar-date helpers on ISO yyyy-mm-dd strings (noon UTC, so day maths never crosses a DST boundary). */
export const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const localToday = () => isoOf(new Date());
const atNoon = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(atNoon(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((atNoon(b).getTime() - atNoon(a).getTime()) / 86_400_000);
export const weekStart = (iso: string) => addDays(iso, -((atNoon(iso).getUTCDay() + 6) % 7));
export const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;
export const addMonths = (iso: string, n: number) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n, 1, 12)).toISOString().slice(0, 10);
export const monthEnd = (iso: string) => addDays(addMonths(iso, 1), -1);
export const fmtDay = (iso: string) => atNoon(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
export const fmtMonth = (iso: string) => atNoon(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const fmtShort = (iso: string) => atNoon(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const hours = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
