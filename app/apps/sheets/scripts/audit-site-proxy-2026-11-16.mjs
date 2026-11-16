// Offline probe: fetch is replaced before the worker receives a request.
import assert from 'node:assert/strict';
import worker from '../../../../sites/project-flow-v2/worker/runtime.js';

let forwarded;
globalThis.fetch = async (_url, options) => {
  forwarded = JSON.parse(options.body);
  return new Response(JSON.stringify({ ok: true, status: 200, data: {} }));
};
const response = await worker.fetch(new Request('https://audit.example.invalid/exec', {
  method: 'POST',
  body: JSON.stringify({ method: 'PATCH', path: '/users/u-member', user: 'u-admin', body: { isAdmin: true } }),
}), { SHEETS_URL: 'https://upstream.example.invalid/exec', SHEETS_TOKEN: 'audit-test-token' });
assert.equal(forwarded.user, 'u-admin');
assert.equal(forwarded.token, 'audit-test-token');
assert.equal(forwarded.method, 'PATCH');
console.log(JSON.stringify({
  noCookieOrAuthorization: true,
  forwardedUser: forwarded.user,
  forwardedMutation: forwarded.method,
  serverTokenInjected: true,
  envelope: await response.json(),
}, null, 2));
