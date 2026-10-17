export function zonedInput(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function zonedIso(value: string, timeZone: string): string | null {
  if (!value) return null;
  const nominal = Date.parse(`${value}:00Z`);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = nominal + hours * 3600_000;
    offsets.add(Date.parse(`${zonedInput(new Date(sample).toISOString(), timeZone)}:00Z`) - sample);
  }
  const candidates = [...offsets].map(offset => new Date(nominal - offset).toISOString())
    .filter(candidate => zonedInput(candidate, timeZone) === value);
  if (candidates.length !== 1) throw new Error('This local time is missing or ambiguous because clocks change. Choose an unambiguous time.');
  return candidates[0];
}
