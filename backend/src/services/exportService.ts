import { supabase } from '../config/supabase';

interface MarkRow {
  studentName: string;
  studentEmail: string;
  quizTitle: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
}

export const exportService = {
  async getTeacherMarksData(teacherId: string): Promise<MarkRow[]> {
    const { data: quizzes } = await supabase
      .from('teacher_quizzes')
      .select('id, title')
      .eq('teacher_id', teacherId);

    if (!quizzes || quizzes.length === 0) return [];

    const quizIds = quizzes.map(q => q.id);
    const quizMap = new Map(quizzes.map(q => [q.id, q.title]));

    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .in('quiz_id', quizIds)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (!attempts || attempts.length === 0) return [];

    const userIds = [...new Set(attempts.map(a => a.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    return attempts.map(attempt => {
      const user = userMap.get(attempt.user_id) || { name: 'Unknown', email: '' };
      const maxScore = attempt.max_score || 0;
      const score = attempt.score || 0;

      return {
        studentName: user.name || 'Unknown',
        studentEmail: user.email || '',
        quizTitle: quizMap.get(attempt.quiz_id) || 'Unknown Quiz',
        marksObtained: score,
        totalMarks: maxScore,
        percentage: maxScore > 0 ? Math.round((score / maxScore) * 100 * 10) / 10 : 0,
        submittedAt: attempt.completed_at
          ? new Date(attempt.completed_at).toISOString().split('T')[0]
          : 'N/A',
      };
    });
  },

  generateCSV(rows: MarkRow[]): string {
    const headers = [
      'Student Name',
      'Student Email',
      'Quiz / Test Name',
      'Marks Obtained',
      'Total Marks',
      'Percentage (%)',
      'Submitted Date',
    ];

    const escapeCsvField = (field: string | number) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];

    for (const row of rows) {
      csvLines.push([
        escapeCsvField(row.studentName),
        escapeCsvField(row.studentEmail),
        escapeCsvField(row.quizTitle),
        row.marksObtained,
        row.totalMarks,
        row.percentage,
        row.submittedAt,
      ].join(','));
    }

    return csvLines.join('\n');
  },
};
