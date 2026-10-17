// Single-file Fastn workflow. Connector names and input/output mappings are read
// from verified workspace schemas; no guessed connector action names are used.
export async function runDelivery(input, runtime) {
  const headers = { 'x-quizshield-execution-token': input.executionToken };
  const preflight = () => runtime.request(input.preflightUrl, {}, headers);
  const complete = providerId => runtime.request(input.completeUrl, { success: true, providerId }, headers);
  const current = await preflight();
  if (current.skipped || current.alreadyCompleted) return { skipped: true };
  if (current.channel === 'email') {
    return runtime.request(input.emailDeliveryUrl, {}, headers);
  }
  const payload = current.payload;
  if (current.kind === 'calendar') {
    const existing = await runtime.calendar('get', payload);
    if (![200,404,410].includes(existing.status)) throw new Error('Calendar lookup failed');
    // Recheck after connector reads, immediately before the write.
    const latest = await preflight();
    if (latest.skipped || latest.alreadyCompleted) return { skipped: true };
    const p = latest.payload;
    if (p.revision !== payload.revision) throw new Error('Schedule revision changed');
    if (p.operation === 'cancel') {
      if (existing.status === 200) {
        const result = await runtime.calendar('cancel', p);
        if (![200,204,404,410].includes(result.status)) throw new Error('Calendar cancellation failed');
      }
      await complete(p.eventId);
      return { success: true, providerId: p.eventId };
    }
    const resource = { id: p.eventId, summary: p.summary, description: p.description,
      start: p.start, end: p.end, extendedProperties: { private: { quizshieldRevision: String(p.revision) } },
      reminders: { useDefault: false }, attendees: [] };
    let result = await runtime.calendar(existing.status === 200 ? 'update' : 'insert', { ...p, resource });
    // A concurrent insert is an existing deterministic ID, never a second event.
    if (result.status === 409) result = await runtime.calendar('update', { ...p, resource });
    if (![200,201].includes(result.status) || result.body?.id !== p.eventId) throw new Error('Calendar provider receipt missing');
    await complete(result.body.id);
    return { success: true, providerId: result.body.id };
  }
  if (current.kind === 'sheets') {
    const latest = await preflight();
    if (latest.skipped || latest.alreadyCompleted) return { skipped: true };
    const result = await runtime.sheets(latest.payload);
    if (result.status !== 200 || !result.body?.updatedRange) throw new Error('Sheets provider receipt missing');
    const receipt = `${latest.payload.spreadsheetId}:${result.body.updatedRange}`;
    await complete(receipt);
    return { success: true, providerId: receipt };
  }
  throw new Error('Unsupported QuizShield workflow action');
}

function at(object, path) {
  return path ? path.split('.').reduce((value, key) => value?.[key], object) : object;
}
function mapTemplate(template, payload) {
  if (typeof template === 'string' && template.startsWith('$')) return at(payload, template.slice(1));
  if (Array.isArray(template)) return template.map(value => mapTemplate(value, payload));
  if (template && typeof template === 'object') return Object.fromEntries(Object.entries(template).map(([key,value]) => [key,mapTemplate(value,payload)]));
  return template;
}

// Fastn's V8 sandbox has no URL constructor. Match the complete callback against
// a trusted environment value instead of parsing an attacker-supplied URL.
export function validateCallbacks(base, input) {
  if (typeof base !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?\/api\/automations\/delivery$/.test(base)) {
    throw new Error('Invalid QuizShield callback base');
  }
  let jobId;
  for (const [key, suffix] of [['preflightUrl','preflight'],['completeUrl','complete'],['emailDeliveryUrl','email']]) {
    const value = input?.[key];
    const prefix = `${base}/`;
    if (typeof value !== 'string' || !value.startsWith(prefix)) throw new Error('Invalid callback URL');
    const tail = value.slice(prefix.length);
    const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/(preflight|complete|email)$/.exec(tail);
    if (!match || match[2] !== suffix || (jobId && match[1] !== jobId)) throw new Error('Invalid callback URL');
    jobId = match[1];
  }
  if (typeof input.executionToken !== 'string' || !input.executionToken) throw new Error('Missing delivery token');
}

export default async function quizshield(ctx) {
  const base = await fastn.envConfig.get('QUIZSHIELD_API_BASE');
  const configuration = await fastn.envConfig.get('QUIZSHIELD_ACTIONS');
  const actions = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
  const input = ctx.input;
  // Do not let a webhook payload turn the workflow into an arbitrary URL caller.
  validateCallbacks(base, input);
  const request = async (url, body, headers) => {
    const response = await fetch(url, { method: 'POST', redirect: 'error',
      headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`QuizShield callback HTTP ${response.status}`);
    return response.json();
  };
  const invoke = async (name, payload) => {
    const tenant = ctx.headers?.['x-end-org-id'];
    if (!tenant || tenant !== payload.tenantId) throw new Error('Fastn tenant context is missing or mismatched');
    const action = actions?.[name];
    if (!action?.connector || !action?.action || !action?.input) throw new Error(`Verified action mapping missing: ${name}`);
    // Select the tenant-bound connection in Fastn; never use an account-wide Google connection.
    try {
      const raw = await fastn.connector[action.connector][action.action](mapTemplate(action.input,payload));
      return { status: action.statusPath ? at(raw,action.statusPath) : 200, body: at(raw,action.bodyPath) };
    } catch (error) {
      const status = action.errorStatusPath ? at(error,action.errorStatusPath) : undefined;
      if ((name === 'calendar.get' || name === 'calendar.cancel') && [404,410].includes(status)) return { status, body: {} };
      if (name === 'calendar.insert' && status === 409) return { status, body: {} };
      throw error;
    }
  };
  return runDelivery(input, { request, calendar: (operation,payload) => invoke(`calendar.${operation}`,payload), sheets: payload => invoke('sheets.update',payload) });
}
