import { SPREADSHEET_URL, type SheetInfo } from './api';

/**
 * Tab ids (gid) of the live workbook, by sheet name. The local simulator has no real tabs, so its sheet links are
 * rewritten to the real workbook; against the real backend the API already returns the right link and is used as is.
 * A sheet missing here (for instance one the next setup run creates) opens the workbook at its first tab.
 */
const GID: Record<string, number> = {
  'Settings - Projects': 0, 'Settings - Modules': 1, 'Settings - Module changes': 2, 'Settings - Users': 8, 'Settings - Memberships': 9,
  'Personal - Tasks': 7, 'Personal - Subtasks': 14,
  'EPCIC - S-curve': 3, 'EPCIC - Work packages': 4, 'EPCIC - Procurement packages': 5, 'EPCIC - Expediting packages': 6, 'EPCIC - Milestones': 10,
  'EPCIC - Logistics shipments': 19, 'EPCIC - Material balance': 20, 'EPCIC - Material summary': 21, 'EPCIC - Procurement concerns': 22,
  'EPCIC - Construction budget': 17, 'EPCIC - Procurement S-curves': 1986359366, 'EPCIC - Phase progress': 1544980209,
  'Governance - Risks': 11, 'Governance - Interfaces': 12, 'Governance - Interface points': 13, 'Governance - Risk actions': 1029361657,
  'Governance - Risk matrix': 776081673, 'Governance - Risk breakdown': 744727472, 'Governance - Interface parties': 1176683749,
  'Governance - Responsibility matrix': 219097383, 'Governance - RASCI': 1399118925, 'Governance - Issues': 2041623119,
  'Governance - Issue sub-tasks': 1069201100, 'Governance - Issue log': 600536664,
  'Reports - Knowledge': 18, 'Reports - Cut-off snapshots': 15, 'Reports - Snapshot data': 16,
};

/** Where a "Sheet" button goes: the actual Google Sheet, on the tab of that register when it is known. */
export function sheetHref(sheet: Pick<SheetInfo, 'name' | 'url'>): string {
  if (!/LOCAL-SIMULATOR/.test(sheet.url) || !SPREADSHEET_URL) return sheet.url;
  const base = SPREADSHEET_URL.replace(/#.*$/, '');
  const gid = GID[sheet.name];
  return gid === undefined ? base : `${base}#gid=${gid}`;
}
