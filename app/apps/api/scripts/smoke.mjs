// End-to-end smoke test against a running API: `pnpm --filter @projectflow/api smoke`.
// Leaves the database as it found it (restores module states, deletes created tasks).
import assert from 'node:assert/strict';

const base = process.env.API_URL ?? 'http://localhost:3100/api/v1';
const P = '/projects/sttp2b';

async function call(path, init) {
  const res = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json' } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
const put = (key, state) => call(`${P}/modules/${key}`, { method: 'PUT', body: JSON.stringify({ state }) });
let passed = 0;
const check = (name, fn) => fn().then(() => { passed++; console.log(`ok  ${name}`); }, e => { console.error(`FAIL ${name}\n  ${e.message}`); process.exitCode = 1; });

await check('health', async () => assert.equal((await call('/health')).body.status, 'ok'));

await check('dashboard aggregates the three data modules', async () => {
  const { status, body } = await call(`${P}/dashboard`);
  assert.equal(status, 200);
  assert.equal(body.procurement.total, 137);
  assert.equal(body.expediting.total, 153);
  assert.equal(body.workPackages.items.length, 5);
  assert.ok(body.overallProgress.latest.actual > 0);
});

await check('procurement list paginates, filters, sorts and validates', async () => {
  const r = await call(`${P}/procurement/packages?discipline=Piping&pageSize=5&sort=code&order=desc`);
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 5);
  assert.equal(r.body.total, 30);
  assert.ok(r.body.items[0].code > r.body.items[4].code);
  assert.equal((await call(`${P}/procurement/packages?sort=password`)).status, 400);
});

await check('expediting detail is flattened', async () => {
  const r = await call(`${P}/expediting/packages/EX-001`);
  assert.equal(r.status, 200);
  assert.equal(r.body.discipline, 'Equipment');
  assert.ok(r.body.highlight);
});

await check('csv export neutralises formulas and quotes cells', async () => {
  const r = await call(`${P}/expediting/packages.csv?pageSize=3`);
  assert.equal(r.status, 200);
  assert.match(r.body, /^﻿?"Code","Discipline"/); // fetch strips the BOM on decode
  assert.ok(!/^"[=+@]/m.test(r.body));
});

await check('module registry rules (core, required-by, guard)', async () => {
  assert.equal((await put('dashboard', 'Disabled')).body.code, 'CORE_MODULE');
  assert.equal((await put('document-control', 'Disabled')).body.code, 'REQUIRED_BY');
  assert.equal((await put('nope', 'Enabled')).status, 409);
  const off = await put('procurement.procurement-plan', 'Disabled');
  try {
    assert.equal(off.body.state, 'Disabled');
    assert.equal((await call(`${P}/procurement/packages`)).status, 403);
    assert.equal((await call(`${P}/dashboard`)).body.procurement, null);
  } finally {
    assert.equal((await put('procurement.procurement-plan', 'Enabled')).body.state, 'Enabled');
  }
  assert.equal((await call(`${P}/procurement/packages?pageSize=1`)).status, 200);
});

await check('a later-phase module can be switched on and off', async () => {
  assert.equal((await put('ti', 'Enabled')).body.effective, true);
  assert.equal((await put('ti', 'Disabled')).body.effective, false);
});

await check('task CRUD, including a null note', async () => {
  const created = await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'smoke', due: '2026-11-09', note: null }) });
  assert.equal(created.status, 201);
  try {
    assert.equal((await call(`/tasks/${created.body.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Done' }) })).body.status, 'Done');
    assert.equal((await call('/tasks', { method: 'POST', body: JSON.stringify({ title: '', due: 'x' }) })).status, 400);
  } finally {
    assert.equal((await fetch(`${base}/tasks/${created.body.id}`, { method: 'DELETE' })).status, 204);
  }
});

await check('unknown project is a 404', async () => assert.equal((await call('/projects/nope/modules')).status, 404));

console.log(`${passed} checks passed`);
