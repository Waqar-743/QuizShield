import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validateCallbacks } from './quizshield.mjs';

const source = await readFile(new URL('./quizshield-email.mjs', import.meta.url), 'utf8');
const base = 'https://staging.example.test/api/automations/delivery';
const id = '11111111-1111-4111-8111-111111111111';
const input = { channel: 'email', executionToken: 'test-only-token',
  preflightUrl: `${base}/${id}/preflight`, emailDeliveryUrl: `${base}/${id}/email`, completeUrl: `${base}/${id}/complete` };
function harness(responses = []) {
  const calls = [];
  // Match Fastn's documented absence of browser and Node globals.
  const context = { fastn: { envConfig: { get: async () => base } }, fetch: async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected side effect');
    return { ok: next.status === undefined || next.status < 400, status: next.status || 200, json: async () => next.body };
  } };
  const run = vm.runInNewContext(source.replace('export default ', '') + '\nquizshieldEmail', context);
  return { calls, run: value => run({ input: value }) };
}
test('email workflow runs without URL, process, imports, or connectors and returns a provider receipt', async () => {
  const h = harness([{ body: { channel: 'email', payload: { deliverViaQuizShield: true } } },
    { body: { delivered: true, providerId: 'resend-test-receipt' } }]);
  assert.equal((await h.run(input)).providerId, 'resend-test-receipt');
  assert.deepEqual(h.calls.map(c => c.url), [input.preflightUrl, input.emailDeliveryUrl]);
  assert.equal(h.calls[1].options.headers['x-quizshield-execution-token'], input.executionToken);
});
test('ineligible or previously completed jobs stop before the send endpoint', async () => {
  for (const body of [{ skipped: true }, { alreadyCompleted: true }]) {
    const h = harness([{ body }]); await h.run(input); assert.equal(h.calls.length, 1);
  }
});
test('non-email jobs, hostile callback URLs and mismatched jobs cause no requests', async () => {
  const variants = [
    { ...input, channel: 'fastn' }, { ...input, executionToken: '' },
    { ...input, emailDeliveryUrl: input.emailDeliveryUrl + '?secret=1' },
    { ...input, emailDeliveryUrl: input.emailDeliveryUrl + '#fragment' },
    { ...input, emailDeliveryUrl: input.emailDeliveryUrl.replace('staging.example.test', 'staging.example.test.evil.test') },
    { ...input, emailDeliveryUrl: input.emailDeliveryUrl.replace('/api/', '/api/../api/') },
    { ...input, emailDeliveryUrl: input.emailDeliveryUrl.replace(id, '22222222-2222-4222-8222-222222222222') },
  ];
  for (const value of variants) {
    const h = harness(); await assert.rejects(h.run(value)); assert.equal(h.calls.length, 0);
  }
  for (const value of variants.slice(2)) assert.throws(() => validateCallbacks(base, value));
  validateCallbacks(base, input);
});
test('HTTP failures, unexpected preflight channels and missing provider receipts fail visibly', async () => {
  const eligible = { body: { channel: 'email', payload: { deliverViaQuizShield: true } } };
  for (const responses of [[{ status: 401 }], [{ body: { channel: 'fastn' } }],
    [eligible, { status: 502 }], [eligible, { body: { success: true } }]]) {
    await assert.rejects(harness(responses).run(input));
  }
});
test('eligibility changing between preflight and send remains a skipped delivery', async () => {
  const h = harness([{ body: { channel: 'email', payload: { deliverViaQuizShield: true } } }, { body: { skipped: true } }]);
  assert.equal((await h.run(input)).skipped, true);
});
