/**
 * Apps Script entry points. Bundled by scripts/build.mjs into dist/Code.js; the build appends top-level
 * function stubs (doGet, doPost, onOpen, setup, showToken) because Apps Script looks them up by name.
 */
import { Api } from './api';
import { COLUMNS, SHEET } from './datasets';
import { handle, handleBatch, type ApiRequest, type Envelope } from './router';
import { noMailer, type Mailer } from './mailer';
import { seedStore, type SeedData } from './seed';
import { SheetsStore } from './sheets-store';

const TOKEN_PROPERTY = 'API_TOKEN';

function openStore() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const zone = spreadsheet.getSpreadsheetTimeZone();
  return new SheetsStore({
    spreadsheet,
    lock: LockService.getScriptLock(),
    uuid: () => Utilities.getUuid(),
    formatDate: d => Utilities.formatDate(d, zone, 'yyyy-MM-dd'),
  });
}

/** Email goes out as the deploying user. A failure (for example the daily quota) is swallowed by the caller, never fatal. */
const appsScriptMailer: Mailer = {
  send(to, subject, body) {
    if (typeof MailApp === 'undefined') return noMailer.send(to, subject, body);
    MailApp.sendEmail({ to: to.join(','), subject, body, name: 'Project Flow' });
  },
};

const json = (envelope: unknown) => ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(ContentService.MimeType.JSON);
const fail = (status: number, code: string, message: string): Envelope => ({ ok: false, status, error: { code, message } });

/** Fail closed until setup has created a token. A shared secret, not user authentication. */
function authorized(token: unknown) {
  const expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  return Boolean(expected) && token === expected;
}

/**
 * The same idempotent work as the menu's Set up sheets, for an administrator over the API: creates missing sheets and
 * runs the one-off upgrades (new columns, governance data). It never overwrites rows that are already there.
 */
function adminSetup(store: SheetsStore, user: unknown): Envelope {
  const admin = store.readRows(SHEET.users, [...COLUMNS.users]).find(u => u.id === user && /^(yes|true)$/i.test(String(u.isAdmin)) && u.status !== 'Inactive');
  if (!admin) return fail(403, 'ADMIN_ONLY', 'Only an administrator can run setup.');
  try {
    const seeded = seedStore(store, loadSeed());
    return { ok: true, status: 200, data: { seeded, sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName()) } };
  } catch (err) {
    return fail(500, 'SETUP_FAILED', err instanceof Error ? `${err.message}${err.stack ? `\n${err.stack.split('\n').slice(0, 4).join('\n')}` : ''}` : String(err));
  }
}

/** Paginated, read-only export for the PostgreSQL migration. Requires the API token and an administrator. */
function adminExport(store: SheetsStore, user: unknown, path: string): Envelope {
  const admin = store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === user && /^(yes|true)$/i.test(String(u.isAdmin)) && u.status !== 'Inactive');
  if (!admin) return fail(403, 'ADMIN_ONLY', 'Only an administrator can export the Sheet.');
  const query = Object.fromEntries((path.split('?')[1] ?? '').split('&').filter(Boolean).map(part => {
    const [key, value = ''] = part.split('=');
    return [decodeURIComponent(key), decodeURIComponent(value)];
  }));
  const key = query.dataset as keyof typeof SHEET | undefined;
  if (!key || !(key in SHEET)) return fail(400, 'BAD_DATASET', 'Choose a known dataset key.');
  const offset = Number(query.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return fail(400, 'BAD_OFFSET', 'offset must be a non-negative integer.');
  const columns = COLUMNS[key];
  const info = store.sheetInfo(SHEET[key]);
  const rows = info ? store.readRows(SHEET[key], columns) : [];
  return { ok: true, status: 200, data: {
    key, sheet: SHEET[key], gid: info?.gid ?? null, header: columns.map(c => c.key),
    offset, total: rows.length, rows: rows.slice(offset, offset + 100),
  } };
}

function respond(request: ApiRequest, token: unknown): Envelope {
  if (!authorized(token)) return fail(401, 'UNAUTHORIZED', 'Missing or invalid API token.');
  const store = openStore();
  if (!store.sheetInfo(SHEET.projects)) return fail(503, 'NOT_SET_UP', 'Run "Project Flow > Set up sheets" in the spreadsheet first.');
  if (request.method === 'POST' && request.path === '/admin/setup') return adminSetup(store, request.user);
  if (request.method === 'GET' && request.path.startsWith('/admin/export?')) return adminExport(store, request.user, request.path);
  // Public web requests must never send email as the spreadsheet owner.
  if (/\/remind(?:-due)?$/.test(request.path)) return fail(403, 'OWNER_ONLY', 'Email reminders are available only to the spreadsheet owner.');
  return handle(new Api(store, () => new Date(), noMailer), request);
}

export function doGet(e: GoogleAppsScript.Events.DoGet) {
  const path = e?.parameter?.path;
  if (!path) return json({ ok: true, status: 200, data: { name: 'Project Flow sheets API', usage: 'GET ?path=/health&token=…' } });
  return json(respond({ method: 'GET', path, user: e.parameter.user }, e.parameter.token));
}

export function doPost(e: GoogleAppsScript.Events.DoPost) {
  let payload: { method?: string; path?: string; body?: unknown; token?: string; user?: string; requests?: { method?: string; path: string }[] };
  try {
    payload = JSON.parse(e.postData.contents);
  } catch {
    return json(fail(400, 'BAD_REQUEST', 'Body must be JSON: {"method","path","body","token"}.'));
  }
  // Several GET requests in one round trip: the web app asks for what a screen needs together, and each call to Apps Script costs seconds.
  if (payload.method === 'BATCH' && Array.isArray(payload.requests)) {
    if (!authorized(payload.token)) return json([fail(401, 'UNAUTHORIZED', 'Missing or invalid API token.')]);
    const store = openStore();
    if (!store.sheetInfo(SHEET.projects)) return json(payload.requests.map(() => fail(503, 'NOT_SET_UP', 'Run "Project Flow > Set up sheets" in the spreadsheet first.')));
    const requests = payload.requests.slice(0, 20).map(q => ({ method: 'GET', path: q.path, user: payload.user }));
    return json(handleBatch(new Api(store, () => new Date(), noMailer), requests));
  }
  if (!payload.method || !payload.path) return json(fail(400, 'BAD_REQUEST', 'method and path are required.'));
  return json(respond({ method: payload.method, path: payload.path, body: payload.body, user: payload.user }, payload.token));
}

export function onOpen() {
  SpreadsheetApp.getUi().createMenu('Project Flow').addItem('Set up sheets', 'setup').addItem('Show API token', 'showToken').addToUi();
}

/** The daily job (a time trigger runs it): emails each person their issues and sub-tasks that are due soon or overdue. */
export function remindDue() {
  const store = openStore();
  if (!store.sheetInfo(SHEET.projects)) return [];
  return new Api(store, () => new Date(), appsScriptMailer).issues.remindAll();
}

/** Creates the daily 07:00 trigger for remindDue, once. */
export function installReminders() {
  const have = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'remindDue');
  if (!have) ScriptApp.newTrigger('remindDue').timeBased().everyDays(1).atHour(7).create();
  SpreadsheetApp.getUi().alert('Issue reminders', have ? 'Daily reminders were already on.' : 'Daily reminders are on: every morning around 07:00 each person in charge gets an email about issues and sub-tasks that are due within 3 days or overdue.', SpreadsheetApp.getUi().ButtonSet.OK);
  return { installed: !have };
}

/** Creates one sheet per dataset, loads the reference data, and makes sure an API token exists. */
/** The reference data lives in the project's seed.html (written by the build). It is read only here, never on a request. */
function loadSeed(): SeedData {
  return JSON.parse(HtmlService.createHtmlOutputFromFile('seed').getContent()) as SeedData;
}

export function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const store = openStore();
  const seeded = seedStore(store, loadSeed());
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) ss.deleteSheet(defaultSheet);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(TOKEN_PROPERTY)) props.setProperty(TOKEN_PROPERTY, Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));

  const names = Object.values(SHEET).join(', ');
  SpreadsheetApp.getUi().alert(
    seeded ? 'Sheets created' : 'Already set up',
    `${seeded ? 'Created and loaded' : 'Found'}: ${names}.\n\nNext: Deploy → New deployment → Web app (execute as you, access: anyone), then use Project Flow → Show API token.`,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
  return { seeded };
}

export function showToken() {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  let url = '(deploy as a web app to get the URL)';
  try { url = ScriptApp.getService().getUrl() || url; } catch { /* not deployed yet */ }
  SpreadsheetApp.getUi().alert('API connection', `Web app URL:\n${url}\n\nAPI token:\n${token ?? '(run Set up sheets first)'}`, SpreadsheetApp.getUi().ButtonSet.OK);
}
