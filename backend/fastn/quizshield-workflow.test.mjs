import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDelivery } from './quizshield.mjs';

const input = { preflightUrl: 'preflight', completeUrl: 'complete', emailDeliveryUrl: 'email', executionToken: 'controlled-token' };
const event = { eventId: 'stable-event-id', revision: 2, operation: 'upsert', summary: 'Assessment', start: {}, end: {} };
function harness(kind, payload) {
  const writes = [], callbacks = [];
  return { writes, callbacks, runtime: {
    request: async (url, body) => { callbacks.push([url,body]); return url === 'preflight' ? { kind, channel: kind === 'email' ? 'email' : 'fastn', payload } : { success: true }; },
    calendar: async (operation,p) => { writes.push([operation,p]); return operation === 'get' ? { status:404 } : { status:200,body:{ id:p.eventId } }; },
    sheets: async p => { writes.push(['update',p]); return { status:200,body:{ updatedRange:p.range } }; },
  } };
}
test('email flow delegates to the existing QuizShield Resend service exactly once', async () => {
  const h = harness('email',{}); await runDelivery(input,h.runtime);
  assert.deepEqual(h.callbacks.map(c => c[0]),['preflight','email']);
  assert.equal(h.writes.length,0);
});
test('Calendar retries always address the same deterministic event ID', async () => {
  const h = harness('calendar',event);
  await runDelivery(input,h.runtime); await runDelivery(input,h.runtime);
  assert.deepEqual(h.writes.filter(w => w[0] === 'insert').map(w => w[1].resource.id),['stable-event-id','stable-event-id']);
  assert.equal(h.writes[1][1].resource.attendees.length,0);
  assert.equal(h.writes[1][1].resource.reminders.useDefault,false);
});
test('existing Calendar events are updated rather than appended', async () => {
  const h = harness('calendar',event);
  h.runtime.calendar = async (operation,p) => { h.writes.push([operation,p]); return { status:200,body:{ id:p.eventId } }; };
  await runDelivery(input,h.runtime);
  assert.deepEqual(h.writes.map(w=>w[0]),['get','update']);
});
test('rescheduling or cancellation between read and write prevents the outdated write', async () => {
  const h = harness('calendar',event); let checks=0;
  h.runtime.request = async () => ++checks === 1 ? { kind:'calendar',payload:event } : { skipped:true };
  await runDelivery(input,h.runtime);
  assert.deepEqual(h.writes.map(w=>w[0]),['get']);
});
test('cancellation updates the existing event and treats missing records as already cancelled', async () => {
  const h = harness('calendar',{ ...event, operation:'cancel' });
  await runDelivery(input,h.runtime);
  assert.deepEqual(h.writes.map(w=>w[0]),['get']);
  assert.equal(h.callbacks.at(-1)[1].providerId,event.eventId);
});
test('Sheet retries write the reserved range with RAW values', async () => {
  const h = harness('sheets',{ spreadsheetId:'controlled-sheet',range:"'Results'!A2:F2",valueInputOption:'RAW',values:[['attempt']] });
  await runDelivery(input,h.runtime); await runDelivery(input,h.runtime);
  assert.equal(h.writes[0][1].range,h.writes[1][1].range);
  assert.equal(h.writes[0][1].valueInputOption,'RAW');
});
test('external failures never report successful delivery', async () => {
  const h = harness('sheets',{ spreadsheetId:'test',range:'A2:F2' });
  h.runtime.sheets = async () => ({ status:503 });
  await assert.rejects(runDelivery(input,h.runtime),/receipt/);
  assert.equal(h.callbacks.some(c=>c[0]==='complete'),false);
});
