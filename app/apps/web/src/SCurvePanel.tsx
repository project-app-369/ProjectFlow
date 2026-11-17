import { useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { apiMode, request, type Milestone, type MilestoneSummary, type ScurvePoint } from './api';
import { isWeekly, toMonthly, type Cutoffs } from './scurveTime';
import { useApp } from './state';
import { Btn, Loading, Modal } from './ui';
import { lazyPage } from './lazyPage';

const SCurveChart = lazyPage(() => import('./SCurveChart'));

/** Weekly or monthly cut-offs. */
export function CutoffToggle({ value, onChange }: { value: Cutoffs; onChange: (v: Cutoffs) => void }) {
  return (
    <div className="seg" role="group" aria-label="Cut-offs">
      {(['weekly', 'monthly'] as const).map(v => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{v === 'weekly' ? 'Weekly' : 'Monthly'}</button>)}
    </div>
  );
}

/**
 * The EPCIC S-curve card: plan, forecast and actual lines, the reporting cut-off and the project's major milestones.
 * The expand button opens the same chart, larger and with the milestone names written on it, in a dialog of its own.
 */
export function SCurvePanel({ points, monthly, defaultCut, sub, title = 'EPCIC S-curve', milestones: given, cutoff: givenCutoff, controls, schedule }: {
  points: ScurvePoint[];
  /** The project's own monthly cut-offs, used for the monthly view when `points` are weekly (otherwise the month-end figures of `points`). */
  monthly?: ScurvePoint[];
  /** The cut-offs shown first; weekly when `points` are weekly. */
  defaultCut?: Cutoffs; sub: ReactNode; title?: string;
  /** Milestones to draw; the project's major milestones are loaded when not given. */
  milestones?: Milestone[];
  /** The line marking the reporting week; the project cut-off when not given. */
  cutoff?: string | null;
  /** Shown in the card head beside the expand button, for example a choice of curve. */
  controls?: ReactNode;
  /** The progress the baseline and working schedules imply at the dates of `points`, drawn as dashed lines. */
  schedule?: { date: string; baseline: number; working: number }[] | null;
}) {
  const { project, modules } = useApp();
  const [open, setOpen] = useState(false);
  const sourceWeekly = isWeekly(points);
  const [pickedCut, setPickedCut] = useState<Cutoffs | null>(null);
  const cut: Cutoffs = sourceWeekly ? pickedCut ?? defaultCut ?? 'weekly' : 'monthly';
  const milestonesOn = apiMode === 'sheets' && !!modules.modules.find(m => m.key === 'planning.milestones')?.effective;
  const summary = useQuery({ queryKey: ['milestone-summary', project.id], queryFn: () => request<MilestoneSummary>(`/projects/${project.id}/milestones/summary`), enabled: milestonesOn && !given, retry: false });
  const milestones = given ?? summary.data?.major ?? [];
  const cutoff = givenCutoff === undefined ? project.cutoff : givenCutoff;
  // monthly cut-offs are the last figure of each month; a month without one keeps the previous month's figure
  const shown = useMemo(() => (cut === 'monthly' ? toMonthly(monthly?.length ? monthly : points, ['plan', 'forecast', 'actual'], cutoff, ['actual']) : points), [points, monthly, cut, cutoff]);
  const shownSchedule = useMemo(() => (schedule && cut === 'monthly' ? toMonthly(schedule, ['baseline', 'working']) as { date: string; baseline: number; working: number }[] : schedule), [schedule, cut]);

  const chart = (expanded: boolean) => (
    <Suspense fallback={<Loading label="Loading chart…" />}><SCurveChart points={shown} milestones={milestones} cutoff={cutoff} expanded={expanded} schedule={shownSchedule} /></Suspense>
  );
  return (
    <div className="panel scurve-panel">
      <div className="panel-head">
        <div><h2>{title}</h2><p>{sub}</p></div>
        <div className="actions">{controls}{sourceWeekly && <CutoffToggle value={cut} onChange={setPickedCut} />}<Btn kind="small" iconOnly icon="popout" aria-label="Open the S-curve in a new window" title="Open in a new window" onClick={() => setOpen(true)}>New window</Btn></div>
      </div>
      {chart(false)}
      {open && (
        <Modal title={title} size="xl" startPopped onClose={() => setOpen(false)}>
          <div className="dialog-body scurve-modal">{chart(true)}</div>
        </Modal>
      )}
    </div>
  );
}
