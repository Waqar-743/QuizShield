// Phase one: no Google connectors or external completion callback are callable.
// The backend owns eligibility, recipient restrictions, and Resend idempotency.
export default async function quizshieldEmail(ctx) {
  const base = await fastn.envConfig.get('QUIZSHIELD_API_BASE');
  if (typeof base !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?\/api\/automations\/delivery$/.test(base)) {
    throw new Error('Invalid QuizShield callback base');
  }
  const input = ctx.input;
  if (input?.channel !== 'email') throw new Error('Email-only workflow');
  if (typeof input.executionToken !== 'string' || !input.executionToken) throw new Error('Missing delivery token');
  let jobId;
  for (const [key, suffix] of [['preflightUrl','preflight'],['emailDeliveryUrl','email']]) {
    const value = input[key];
    const prefix = `${base}/`;
    if (typeof value !== 'string' || !value.startsWith(prefix)) throw new Error('Invalid callback URL');
    const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/(preflight|email)$/.exec(value.slice(prefix.length));
    if (!match || match[2] !== suffix || (jobId && jobId !== match[1])) throw new Error('Invalid callback URL');
    jobId = match[1];
  }
  const request = async url => {
    const response = await fetch(url, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-quizshield-execution-token': input.executionToken },
      body: '{}' });
    if (!response.ok) throw new Error(`QuizShield callback HTTP ${response.status}`);
    return response.json();
  };
  const current = await request(input.preflightUrl);
  if (current.skipped || current.alreadyCompleted) return { skipped: true };
  if (current.channel !== 'email' || current.payload?.deliverViaQuizShield !== true) throw new Error('Email preflight contract failed');
  // This endpoint rechecks submission and schedule state immediately before send.
  const receipt = await request(input.emailDeliveryUrl);
  if (receipt.skipped || receipt.alreadyCompleted) return receipt;
  if (receipt.delivered !== true || typeof receipt.providerId !== 'string' || !receipt.providerId) throw new Error('Email provider receipt missing');
  return receipt;
}
