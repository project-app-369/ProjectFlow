/** Interface lifecycle (spec INT-02): Identified -> Assigned -> Information requested -> Responded -> Under review -> Agreed -> Closed. */
export const INTERFACE_STATUSES = ['Identified', 'Assigned', 'Information requested', 'Responded', 'Under review', 'Agreed', 'Closed'] as const;
export type InterfaceStatus = (typeof INTERFACE_STATUSES)[number];

export const INTERFACE_TYPES = ['Technical', 'Contractual', 'Physical', 'Organizational', 'Information', 'Schedule'] as const;
export const POINT_STATUSES = ['Open', 'Responded', 'Accepted', 'Closed'] as const;

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

/** A point is resolved once the receiving party accepted it or it was closed. */
export const pointResolved = (status: string) => status === 'Accepted' || status === 'Closed';

/** An interface is finished (no longer chasing anyone) once agreed or closed. */
export const interfaceSettled = (status: string) => status === 'Agreed' || status === 'Closed';
