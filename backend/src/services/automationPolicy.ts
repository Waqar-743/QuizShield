export const defaultAutomationSettings = {
  timezone: 'Asia/Karachi', announcement: true, deadline_reminder: false,
  reminder_hours: 24, results_email: true, schedule_email: true, welcome_email: false,
  calendar_id: '', spreadsheet_id: '', sheet_tab: 'Results', calendar_sync: false, sheets_sync: false,
};

export function validateTimezone(value: string) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); }
  catch { throw Object.assign(new Error('Choose a valid IANA timezone'), { statusCode: 400 }); }
}

// Require offsets at the API boundary. Never interpret a server-local date as UTC.
export function assessmentSchedule(data: { scheduledStart?: string | null; closesAt?: string | null; timezone?: string }) {
  const timezone = data.timezone || 'Asia/Karachi';
  validateTimezone(timezone);
  const parse = (v: string | null | undefined) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(v) || !Number.isFinite(Date.parse(v))) {
      throw Object.assign(new Error('Schedule timestamps must include a timezone offset'), { statusCode: 400 });
    }
    return new Date(v).toISOString();
  };
  const start = parse(data.scheduledStart), close = parse(data.closesAt);
  if (start && close && close <= start) throw Object.assign(new Error('Closing time must be after the start'), { statusCode: 400 });
  return { scheduled_start: start, closes_at: close, timezone };
}

export function isAssigned(quiz: any, studentId: string) {
  return quiz.assigned_student_ids == null || quiz.assigned_student_ids.includes(studentId);
}

export function attemptDeadline(quiz: any, attempt: any) {
  return Math.min(
    attempt.deadline_at ? Date.parse(attempt.deadline_at) : Date.parse(attempt.started_at) + (quiz.time_limit || 30) * 60_000,
    quiz.closes_at ? Date.parse(quiz.closes_at) : Infinity,
  );
}

export function assertAvailable(quiz: any, now = Date.now()) {
  if (quiz.lifecycle === 'draft' || quiz.lifecycle === 'cancelled' || quiz.is_active === false ||
    (quiz.scheduled_start && now < Date.parse(quiz.scheduled_start)) ||
    (quiz.closes_at && now >= Date.parse(quiz.closes_at))) {
    throw Object.assign(new Error('This quiz is outside its availability window'), { statusCode: 403 });
  }
}

export function emailPreference(kind: string, settings: any) {
  if (kind === 'announcement') return settings.announcement;
  if (kind === 'reminder') return settings.deadline_reminder;
  if (kind === 'results') return settings.results_email;
  if (kind === 'welcome') return settings.welcome_email;
  return settings.schedule_email;
}

// Reviewed teacher feedback takes precedence; no proctoring evidence enters suggestions.
export function practiceSuggestions(attempt: any, quiz: any) {
  const suggestions: string[] = [];
  if (attempt.teacher_feedback) suggestions.push(`Teacher feedback: ${attempt.teacher_feedback}`);
  for (const answer of attempt.answers || []) {
    const index = Number(String(answer.questionId).match(/-q(\d+)$/)?.[1]);
    const question = quiz.questions?.[index];
    if (question && question.questionType !== 'shortAnswer' && answer.selectedAnswer !== question.correctAnswer) {
      suggestions.push(`Practice: ${question.text}${question.explanation ? ` — ${question.explanation}` : ''}`);
    }
    if (suggestions.length >= 5) break;
  }
  return suggestions.length ? suggestions : ['Review your teacher’s feedback and revisit the course material before your next practice attempt.'];
}
