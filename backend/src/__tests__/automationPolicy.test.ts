import { assessmentSchedule, assertAvailable, attemptDeadline, defaultAutomationSettings, emailPreference, isAssigned, practiceSuggestions } from '../services/automationPolicy';
describe('assessment automation policy', () => {
  test('Pakistan local time is saved as an absolute instant', () => {
    const schedule = assessmentSchedule({ scheduledStart: '2026-10-25T10:00:00+05:00', closesAt: '2026-10-25T12:00:00+05:00', timezone: 'Asia/Karachi' });
    expect(schedule.scheduled_start).toBe('2026-10-25T05:00:00.000Z');
    expect(schedule.closes_at).toBe('2026-10-25T07:00:00.000Z');
  });
  test('rejects ambiguous timestamps, invalid timezone, reversed window', () => {
    expect(() => assessmentSchedule({ scheduledStart: '2026-10-25T10:00' })).toThrow('offset');
    expect(() => assessmentSchedule({ timezone: 'Pakistan/Invalid' })).toThrow('timezone');
    expect(() => assessmentSchedule({ scheduledStart: '2026-10-25T10:00Z', closesAt: '2026-10-25T09:00Z' })).toThrow('after');
  });
  test('window boundaries include opening and exclude closing', () => {
    const q = { lifecycle: 'published', scheduled_start: '2026-10-25T05:00Z', closes_at: '2026-10-25T07:00Z' };
    expect(() => assertAvailable(q, Date.parse(q.scheduled_start))).not.toThrow();
    expect(() => assertAvailable(q, Date.parse(q.closes_at))).toThrow();
    expect(() => assertAvailable({ ...q, lifecycle: 'cancelled' }, Date.parse(q.scheduled_start))).toThrow();
  });
  test('duration never extends past closing; explicit empty assignments assign nobody', () => {
    expect(attemptDeadline({ closes_at: '2026-10-25T07:00Z',time_limit:30 }, { started_at:'2026-10-25T06:50Z' })).toBe(Date.parse('2026-10-25T07:00Z'));
    expect(isAssigned({ assigned_student_ids:[] },'student')).toBe(false);
    expect(isAssigned({ assigned_student_ids:null },'student')).toBe(true);
  });
  test('defaults minimize email and followups do not use proctoring evidence', () => {
    expect(emailPreference('welcome',defaultAutomationSettings)).toBe(false);
    expect(emailPreference('reminder',defaultAutomationSettings)).toBe(false);
    expect(emailPreference('announcement',defaultAutomationSettings)).toBe(true);
    const suggestions = practiceSuggestions({ teacher_feedback:'Review fractions',violations:[{ secret:'evidence' }],answers:[] }, { questions:[] });
    expect(suggestions).toEqual(['Teacher feedback: Review fractions']);
  });
});
