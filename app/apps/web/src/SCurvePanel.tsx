import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { apiMode, request, type Milestone, type MilestoneSummary, type ScurvePoint } from './api';
import { useApp } from './state';
import { Btn, Loading, Modal } from './ui';

const SCurveChart = lazy(() => import('./SCurveChart'));

/**
 * The EPCIC S-curve card: plan, forecast and actual lines, the reporting cut-off and the project's major milestones.
 * The expand button opens the same chart, larger and with the milestone names written on it, in a dialog of its own.
 */
export function SCurvePanel({ points, sub, title = 'EPCIC S-curve', milestones: given, cutoff: givenCutoff, controls }: {
  points: ScurvePoint[]; sub: ReactNode; title?: string;
  /** Milestones to draw; the project's major milestones are loaded when not given. */
  milestones?: Milestone[];
  /** The line marking the reporting week; the project cut-off when not given. */
  cutoff?: string | null;
  /** Shown in the card head beside the expand button, for example a choice of curve. */
  controls?: ReactNode;
}) {
  const { project, modules } = useApp();
  const [open, setOpen] = useState(false);
  const milestonesOn = apiMode === 'sheets' && !!modules.modules.find(m => m.key === 'planning.milestones')?.effective;
  const summary = useQuery({ queryKey: ['milestone-summary', project.id], queryFn: () => request<MilestoneSummary>(`/projects/${project.id}/milestones/summary`), enabled: milestonesOn && !given, retry: false });
  const milestones = given ?? summary.data?.major ?? [];
  const cutoff = givenCutoff === undefined ? project.cutoff : givenCutoff;

  const chart = (expanded: boolean) => (
    <Suspense fallback={<Loading label="Loading chart…" />}><SCurveChart points={points} milestones={milestones} cutoff={cutoff} expanded={expanded} /></Suspense>
  );
  return (
    <div className="panel scurve-panel">
      <div className="panel-head">
        <div><h2>{title}</h2><p>{sub}</p></div>
        <div className="actions">{controls}<Btn kind="small" iconOnly icon="expand" aria-label="Expand the S-curve" title="Expand the S-curve" onClick={() => setOpen(true)}>Expand</Btn></div>
      </div>
      {chart(false)}
      {open && (
        <Modal title={title} size="xl" onClose={() => setOpen(false)}>
          <div className="dialog-body scurve-modal">{chart(true)}</div>
        </Modal>
      )}
    </div>
  );
}
