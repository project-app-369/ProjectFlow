/** Interface lifecycle (spec INT-02): Identified -> Assigned -> Information requested -> Responded -> Under review -> Agreed -> Closed. */
export const INTERFACE_STATUSES = ['Identified', 'Assigned', 'Information requested', 'Responded', 'Under review', 'Agreed', 'Closed'] as const;
export type InterfaceStatus = (typeof INTERFACE_STATUSES)[number];

export const INTERFACE_TYPES = ['Technical', 'Contractual', 'Physical', 'Organizational', 'Information', 'Schedule'] as const;

const NEXT: Record<InterfaceStatus, InterfaceStatus[]> = {
  Identified: ['Assigned'],
  Assigned: ['Information requested'],
  'Information requested': ['Responded'],
  Responded: ['Under review'],
  'Under review': ['Agreed', 'Information requested'],
  Agreed: ['Closed', 'Under review'],
  Closed: ['Under review'],
};

export const allowedNext = (from: string): InterfaceStatus[] => NEXT[from as InterfaceStatus] ?? [];

/**
 * Interface points (queries) follow the project's register: raised Open to the target party, Responded once the target party
 * answered, Resolved when the originator accepts the answer, Closed when filed. A response is required before Responded and
 * Resolved; a point can be reopened. As for interfaces, status changes only through the transition action.
 */
export const POINT_STATUSES = ['Open', 'Responded', 'Resolved', 'Closed'] as const;
export type PointStatus = (typeof POINT_STATUSES)[number];
const POINT_NEXT: Record<PointStatus, PointStatus[]> = {
  Open: ['Responded', 'Resolved'],
  Responded: ['Resolved', 'Open'],
  Resolved: ['Closed', 'Open'],
  Closed: ['Open'],
};
export const pointAllowedNext = (from: string): PointStatus[] => POINT_NEXT[normPointStatus(from)] ?? [];

const POINT_WORDS: Record<string, PointStatus> = {
  open: 'Open', new: 'Open', raised: 'Open', pending: 'Open', responded: 'Responded', answered: 'Responded', replied: 'Responded',
  resolved: 'Resolved', accepted: 'Resolved', agreed: 'Resolved', closed: 'Closed', close: 'Closed', cancelled: 'Closed', void: 'Closed',
};
/** Status as typed in the sheet ("OPEN", "resolved"). */
export const normPointStatus = (v: unknown): PointStatus => POINT_WORDS[String(v ?? '').trim().toLowerCase()] ?? 'Open';
/** A point no longer waits on anyone once resolved or closed. */
export const pointResolved = (status: unknown) => { const s = normPointStatus(status); return s === 'Resolved' || s === 'Closed'; };

/** An interface is finished (no longer chasing anyone) once agreed or closed. */
export const interfaceSettled = (status: string) => status === 'Agreed' || status === 'Closed';
