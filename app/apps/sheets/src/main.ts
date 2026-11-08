/**
 * Apps Script entry points. Bundled by scripts/build.mjs into dist/Code.js; the build appends top-level
 * function stubs (doGet, doPost, onOpen, setup, showToken) because Apps Script looks them up by name.
 */
import { Api } from './api';
import { SHEET } from './datasets';
import { handle, type ApiRequest, type Envelope } from './router';
import { seedStore } from './seed';
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

const json = (envelope: unknown) => ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(ContentService.MimeType.JSON);
const fail = (status: number, code: string, message: string): Envelope => ({ ok: false, status, error: { code, message } });

/** When an API_TOKEN script property exists, every request must carry it. A shared secret, not user authentication. */
function authorized(token: unknown) {
  const expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  return !expected || token === expected;
}

function respond(request: ApiRequest, token: unknown): Envelope {
  if (!authorized(token)) return fail(401, 'UNAUTHORIZED', 'Missing or invalid API token.');
  const store = openStore();
  if (!store.sheetInfo(SHEET.projects)) return fail(503, 'NOT_SET_UP', 'Run "Project Flow > Set up sheets" in the spreadsheet first.');
  return handle(new Api(store), request);
}

export function doGet(e: GoogleAppsScript.Events.DoGet) {
  const path = e?.parameter?.path;
  if (!path) return json({ ok: true, status: 200, data: { name: 'Project Flow sheets API', usage: 'GET ?path=/health&token=…' } });
  return json(respond({ method: 'GET', path, user: e.parameter.user }, e.parameter.token));
}

export function doPost(e: GoogleAppsScript.Events.DoPost) {
  let payload: { method?: string; path?: string; body?: unknown; token?: string; user?: string };
  try {
    payload = JSON.parse(e.postData.contents);
  } catch {
    return json(fail(400, 'BAD_REQUEST', 'Body must be JSON: {"method","path","body","token"}.'));
  }
  if (!payload.method || !payload.path) return json(fail(400, 'BAD_REQUEST', 'method and path are required.'));
  return json(respond({ method: payload.method, path: payload.path, body: payload.body, user: payload.user }, payload.token));
}

export function onOpen() {
  SpreadsheetApp.getUi().createMenu('Project Flow').addItem('Set up sheets', 'setup').addItem('Show API token', 'showToken').addToUi();
}

/** Creates one sheet per dataset, loads the reference data, and makes sure an API token exists. */
export function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const store = openStore();
  const seeded = seedStore(store);
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
