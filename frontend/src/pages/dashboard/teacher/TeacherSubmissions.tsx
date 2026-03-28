import { useEffect, useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Violation {
  type: string;
  violation_type?: string;
  timestamp: string;
  details?: string;
}

interface Submission {
  id: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: string;
  startedAt: string;
  completedAt: string;
  teacherGrade?: number;
  teacherFeedback?: string;
  answers: any[];
  violations?: Violation[];
  autoSubmitted?: boolean;
  submissionReason?: string;
}

interface QuizDetails {
  id: string;
  title: string;
  questions: any[];
}

const TeacherSubmissions = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'graded'>('all');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes/teacher/submissions');
      setSubmissions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = async (submission: Submission) => {
    setSelectedSubmission(submission);
    setGradeInput(submission.teacherGrade?.toString() || submission.percentage.toString());
    setFeedbackInput(submission.teacherFeedback || '');
    
    // Fetch quiz details and violations
    try {
      const [quizResponse, violationsResponse] = await Promise.all([
        api.get(`/quizzes/teacher/quiz/${submission.quizId}`),
        api.get(`/quizzes/attempts/${submission.id}/violations`)
      ]);
      
      setQuizDetails(quizResponse.data.data);
      setSelectedSubmission(prev => prev ? { 
        ...prev, 
        violations: violationsResponse.data.data 
      } : null);
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  };

  const closeModal = () => {
    setSelectedSubmission(null);
    setQuizDetails(null);
    setGradeInput('');
    setFeedbackInput('');
  };

  const handleSaveGrade = async () => {
    if (!selectedSubmission) return;
    
    setSaving(true);
    try {
      await api.put(`/quizzes/submissions/${selectedSubmission.id}/grade`, {
        grade: parseFloat(gradeInput),
        feedback: feedbackInput,
      });
      
      toast.success('Grade saved and student notified!');
      
      // Update local state
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id 
          ? { ...s, teacherGrade: parseFloat(gradeInput), teacherFeedback: feedbackInput }
          : s
      ));
      
      closeModal();
    } catch (error) {
      toast.error('Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      (sub.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.quizTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'pending') return matchesSearch && sub.teacherGrade === undefined;
    if (filter === 'graded') return matchesSearch && sub.teacherGrade !== undefined;
    return matchesSearch;
  });

  const pendingCount = submissions.filter(s => s.teacherGrade === undefined).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and grade student quiz submissions
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg">
            <ClockIcon className="h-5 w-5" />
            <span className="font-medium">{pendingCount} pending review</span>
          </div>
        )}
      </header>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student or quiz..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('graded')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'graded' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Graded
            </button>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AcademicCapIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p>No submissions found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredSubmissions.map((submission) => (
              <div key={submission.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-primary-700" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{submission.studentName}</p>
                      <p className="text-sm text-gray-500">{submission.studentEmail}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Quiz</p>
                      <p className="font-medium text-gray-900">{submission.quizTitle}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Auto Score</p>
                      <p className="font-medium text-gray-900">{submission.score}/{submission.maxScore}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Grade</p>
                      {submission.teacherGrade !== undefined ? (
                        <p className="font-medium text-green-600">{submission.teacherGrade}%</p>
                      ) : (
                        <p className="font-medium text-orange-600">Pending</p>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Submitted</p>
                      <p className="font-medium text-gray-900">
                        {new Date(submission.completedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {submission.violations && submission.violations.length > 0 && (
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Violations</p>
                        <p className="font-medium text-red-600 flex items-center gap-1">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          {submission.violations.length}
                        </p>
                      </div>
                    )}
                    
                    <button
                      onClick={() => openReviewModal(submission)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Review Submission</h3>
                <p className="text-sm text-gray-500">
                  {selectedSubmission.studentName} - {selectedSubmission.quizTitle}
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6">
              {/* Score Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-primary-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-primary-700">{selectedSubmission.percentage}%</p>
                  <p className="text-sm text-gray-500">Auto Score</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {selectedSubmission.score}/{selectedSubmission.maxScore}
                  </p>
                  <p className="text-sm text-gray-500">Correct Answers</p>
                </div>
                <div className="bg-primary-50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-primary-700">
                    {new Date(selectedSubmission.completedAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Submitted At</p>
                </div>
              </div>

              {/* Questions Review */}
              {quizDetails && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-4">Questions & Answers</h4>
                  <div className="space-y-4">
                    {quizDetails.questions.map((question: any, qIndex: number) => {
                      const answer = selectedSubmission.answers.find((a: any) => 
                        a.questionId?.endsWith(`-q${qIndex}`)
                      );
                      const selectedIndex = answer?.selectedAnswer ?? -1;
                      const isCorrect = selectedIndex === question.correctAnswer;

                      return (
                        <div key={qIndex} className="border rounded-lg p-4">
                          <div className="flex items-start gap-3 mb-3">
                            {isCorrect ? (
                              <CheckCircleIcon className="h-6 w-6 text-green-500" />
                            ) : (
                              <span className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">✗</span>
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">Q{qIndex + 1}: {question.text}</p>
                              <div className="mt-2 space-y-1">
                                {question.options.map((opt: string, oIndex: number) => (
                                  <div
                                    key={oIndex}
                                    className={`p-2 rounded text-sm ${
                                      oIndex === question.correctAnswer
                                        ? 'bg-green-100 text-green-800'
                                        : oIndex === selectedIndex
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-50 text-gray-600'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oIndex)}. {opt}
                                    {oIndex === question.correctAnswer && ' ✓'}
                                    {oIndex === selectedIndex && oIndex !== question.correctAnswer && ' (Student)'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Violations Section */}
              <div className="mb-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Security & Rule Violations</h4>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    (selectedSubmission.violations?.length || 0) >= 100 ? 'bg-red-100 text-red-700' :
                    (selectedSubmission.violations?.length || 0) > 10 ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedSubmission.violations?.length || 0} Total Violations
                  </div>
                </div>

                {selectedSubmission.autoSubmitted && (
                  <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      <strong className="font-bold">Auto-Submitted! </strong>
                    </div>
                    <span className="block sm:inline ml-7">This quiz was automatically submitted by the system due to excessive violations (Over 100).</span>
                  </div>
                )}

                {selectedSubmission.violations && selectedSubmission.violations.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-3">Violation Timeline</p>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {selectedSubmission.violations.map((v, i) => (
                        <div key={i} className="flex gap-4 relative">
                          {/* Timeline Line */}
                          {i !== (selectedSubmission.violations?.length || 0) - 1 && (
                            <div className="absolute left-[11px] top-6 bottom-[-12px] w-[2px] bg-gray-200"></div>
                          )}
                          
                          <div className={`h-6 w-6 rounded-full flex-shrink-0 z-10 flex items-center justify-center ${
                            (v.type || v.violation_type || '').includes('tab') ? 'bg-orange-500' :
                            (v.type || v.violation_type || '').includes('copy') ? 'bg-red-500' :
                            'bg-primary-500'
                          }`}>
                            <ExclamationTriangleIcon className="h-4 w-4 text-white" />
                          </div>
                          
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-gray-900 capitalize">
                                {(v.type || v.violation_type || 'unknown').replace(/_/g, ' ')}
                              </p>
                              <span className="text-xs text-gray-500">
                                {new Date(v.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {v.details && (
                              <p className="text-xs text-gray-600 mt-1">
                                {v.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5" />
                    No violations detected during this attempt.
                  </div>
                )}
              </div>

              {/* Grading Section */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">Grade & Feedback Corner</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Final Grade (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={gradeInput}
                      onChange={(e) => setGradeInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter grade"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Feedback for Student
                    </label>
                    <textarea
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Write feedback for the student..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGrade}
                disabled={saving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Save Grade
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherSubmissions;
