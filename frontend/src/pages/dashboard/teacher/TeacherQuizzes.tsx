import { useEffect, useState } from 'react';
import { DataTable } from '../../../components/shared';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { zonedInput, zonedIso } from '../../../utils/schedule';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  courseId?: string;
  courseTitle?: string;
  questions: QuestionItem[];
  timeLimit?: number;
  scheduledStart?: string;
  closesAt?: string;
  timezone?: string;
  lifecycle?: 'draft' | 'published' | 'cancelled';
  assignedStudentIds?: string[] | null;
  createdAt: string;
  accessCode: string;
}

interface TeacherCourse {
  _id: string;
  title: string;
}

interface QuestionItem {
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
  explanation?: string;
  timeLimit: number; // in seconds
  answerText?: string;
}

const TeacherQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [teacherCourses, setTeacherCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [defaultTimezone, setDefaultTimezone] = useState('Asia/Karachi');
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [formMode, setFormMode] = useState<'quiz' | 'question'>('quiz');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    timeLimit: 30,
    scheduledStart: '',
    closesAt: '', timezone: 'Asia/Karachi', assignedStudentIds: null as string[] | null,
    questionTitle: '',
    questionScheduledStart: '',
    questions: [
      { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '', timeLimit: 60, answerText: '' }
    ] as QuestionItem[],
  });

  useEffect(() => {
    fetchQuizzes();
    fetchTeacherCourses();
    api.get('/automations/settings').then(r => setDefaultTimezone(r.data.data.settings.timezone)).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setStudents([]);
    if (formData.courseId) api.get(`/automations/courses/${formData.courseId}/students`)
      .then(r => { if (active) setStudents(r.data.data); }).catch(() => { if (active) toast.error('Could not load enrolled students'); });
    return () => { active = false; };
  }, [formData.courseId]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes/teacher/my-quizzes');
      setQuizzes(response.data.data || []);
    } catch (error: any) {
      console.error('Error fetching quizzes:');
      const message = error.response?.data?.message || 'Failed to load quizzes';
      toast.error(message);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherCourses = async () => {
    try {
      const response = await api.get('/courses/teacher/my-courses');
      setTeacherCourses(response.data.data || []);
    } catch (error) {
      console.error('Error fetching teacher courses:');
      setTeacherCourses([]);
    }
  };

  // Convert UTC date to local datetime-local format
  const handleOpenModal = (quiz?: Quiz) => {
    if (quiz) {
      setFormMode('quiz');
      setEditingQuiz(quiz);
      setFormData({
        title: quiz.title,
        description: quiz.description,
        courseId: quiz.courseId || '',
        timeLimit: quiz.timeLimit || 30,
        scheduledStart: quiz.scheduledStart ? zonedInput(quiz.scheduledStart, quiz.timezone || defaultTimezone) : '',
        closesAt: quiz.closesAt ? zonedInput(quiz.closesAt, quiz.timezone || defaultTimezone) : '',
        timezone: quiz.timezone || defaultTimezone,
        assignedStudentIds: quiz.assignedStudentIds ?? null,
        questionTitle: '',
        questionScheduledStart: '',
        questions: quiz.questions.length > 0 ? quiz.questions.map(q => ({
          ...q,
          timeLimit: q.timeLimit || 60,
          answerText: q.answerText || ''
        })) : [
          { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '', timeLimit: 60, answerText: '' }
        ],
      });
    } else {
      setEditingQuiz(null);
      setFormMode('quiz');
      setFormData({
        title: '',
        description: '',
        courseId: '',
        timeLimit: 30,
        scheduledStart: '',
        closesAt: '', timezone: defaultTimezone, assignedStudentIds: null,
        questionTitle: '',
        questionScheduledStart: '',
        questions: [
          { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '', timeLimit: 60, answerText: '' }
        ],
      });
    }
    setModalOpen(true);
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '', timeLimit: 60, answerText: '' }
      ],
    });
  };

  const removeQuestion = (index: number) => {
    if (formData.questions.length <= 1) {
      toast.error('Quiz must have at least one question');
      return;
    }
    const newQuestions = [...formData.questions];
    newQuestions.splice(index, 1);
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateQuestion = (index: number, field: keyof QuestionItem, value: any) => {
    const newQuestions = [...formData.questions];
    (newQuestions[index] as any)[field] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingQuiz) return;
    let start: string | null, close: string | null;
    try {
      start = zonedIso(formMode === 'question' ? formData.questionScheduledStart : formData.scheduledStart, formData.timezone);
      close = zonedIso(formData.closesAt, formData.timezone);
      if (start && close && close <= start) throw new Error('Closing time must be after the start');
    } catch (error: any) { toast.error(error.message); return; }

    if (formMode === 'question') {
      if (!formData.courseId) {
        toast.error('Please select a course');
        return;
      }
      if (!formData.questionTitle.trim()) {
        toast.error('Title is required');
        return;
      }
      for (const q of formData.questions) {
        if (!q.text.trim()) {
          toast.error('All questions must have text');
          return;
        }
      }

      try {
        setSavingQuiz(true);

        const totalSeconds = formData.questions.reduce((sum, q) => sum + (q.timeLimit || 60), 0);

        await api.post('/quizzes', {
          title: formData.questionTitle,
          description: formData.description || 'Short-answer assessment',
          courseId: formData.courseId,
          scheduledStart: start,
          closesAt: close, timezone: formData.timezone, assignedStudentIds: formData.assignedStudentIds,
          timeLimit: Math.max(1, Math.ceil(totalSeconds / 60)),
          questions: formData.questions.map((q) => ({
            text: q.text,
            options: [],
            correctAnswer: -1,
            questionType: 'shortAnswer',
            difficulty: q.difficulty,
            explanation: q.explanation,
            timeLimit: q.timeLimit || 60,
          })),
        });

        toast.success(formData.questions.length > 1
          ? `${formData.questions.length} questions created successfully`
          : 'Question created successfully');
        setModalOpen(false);
        fetchQuizzes();
      } catch (error: any) {
        console.error('Save Question Error:');
        const message = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Failed to save question';
        toast.error(message);
      } finally {
        setSavingQuiz(false);
      }
      return;
    }

    for (const q of formData.questions) {
      if (!q.text.trim()) {
        toast.error('All questions must have text');
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        toast.error('All options must be filled');
        return;
      }
    }

    if (!formData.courseId) {
      toast.error('Please select a course');
      return;
    }

    // Convert local datetime to ISO string for proper timezone handling
    const submitData = {
      ...formData,
      scheduledStart: start, closesAt: close,
    };

    try {
      setSavingQuiz(true);
      if (editingQuiz) {
        await api.put(`/quizzes/${editingQuiz._id}`, submitData);
        toast.success('Quiz updated successfully');
      } else {
        await api.post('/quizzes', submitData);
        toast.success('Draft saved. Publish it when ready.');
      }
      setModalOpen(false);
      fetchQuizzes();
    } catch (error: any) {
      console.error('Save Quiz Error:');
      const message = error.response?.data?.message || error.message || 'Failed to save quiz';
      toast.error(message);
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDelete = async (quiz: Quiz) => {
    if (!confirm(quiz.lifecycle === 'draft' ? `Delete draft "${quiz.title}"?` : `Cancel "${quiz.title}" and notify assigned students under your saved settings?`)) return;

    try {
      await api.delete(`/quizzes/${quiz._id}`);
      toast.success(quiz.lifecycle === 'draft' ? 'Draft deleted' : 'Quiz cancelled');
      fetchQuizzes();
    } catch (error) {
      toast.error('Failed to delete quiz');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Code copied to clipboard!');
  };

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'title' as keyof Quiz,
      header: 'Quiz',
      render: (quiz: Quiz) => (
        <div>
          <p className="font-medium text-gray-900">{quiz.title}</p>
          <span className="text-xs capitalize text-primary-700">{quiz.lifecycle || 'published'}</span>
          <p className="text-sm text-gray-500 line-clamp-1">{quiz.description}</p>
        </div>
      ),
    },
    {
      key: 'accessCode' as keyof Quiz,
      header: 'Access Code',
      render: (quiz: Quiz) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
            {quiz.accessCode}
          </span>
          <button
            onClick={() => copyToClipboard(quiz.accessCode)}
            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
            title="Copy code"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
    {
      key: 'courseTitle' as keyof Quiz,
      header: 'Course',
      render: (quiz: Quiz) => (
        <span className="text-gray-700">{quiz.courseTitle || 'General'}</span>
      ),
    },
    {
      key: 'questions' as keyof Quiz,
      header: 'Questions',
      render: (quiz: Quiz) => (
        <span className="text-gray-600">{quiz.questions?.length || 0} questions</span>
      ),
    },
    {
      key: 'timeLimit' as keyof Quiz,
      header: 'Time',
      render: (quiz: Quiz) => (
        <span className="text-gray-600">{quiz.timeLimit || 30} min</span>
      ),
    },
    {
      key: 'scheduledStart' as keyof Quiz,
      header: 'Scheduled',
      render: (quiz: Quiz) => (
        quiz.scheduledStart ? (
          <span className="text-indigo-600 text-sm">
            {new Date(quiz.scheduledStart).toLocaleString('en-GB', { timeZone: quiz.timezone || 'Asia/Karachi' })}<br />{quiz.timezone || 'Asia/Karachi'}
            {quiz.closesAt && <span className="block text-gray-500">Closes {new Date(quiz.closesAt).toLocaleString('en-GB', { timeZone: quiz.timezone || 'Asia/Karachi' })}</span>}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">Anytime</span>
        )
      ),
    },
    {
      key: '_id' as keyof Quiz,
      header: 'Actions',
      render: (quiz: Quiz) => (
        <div className="flex items-center gap-2">
          {quiz.lifecycle === 'draft' && <button className="text-sm text-primary-700" onClick={async () => {
            try { await api.post(`/quizzes/teacher/${quiz._id}/publish`); toast.success('Published. Notifications queued.'); fetchQuizzes(); }
            catch (error: any) { toast.error(error.response?.data?.error?.message || 'Set a start and future closing time before publishing'); }
          }}>Publish</button>}
          <button
            onClick={() => handleOpenModal(quiz)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
            disabled={quiz.lifecycle === 'cancelled'}
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDelete(quiz)}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={quiz.lifecycle === 'draft' ? 'Delete draft' : 'Cancel quiz'}
            disabled={quiz.lifecycle === 'cancelled'}
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Quizzes</h1>
          <p className="text-sm text-gray-500 mt-1">Create quizzes and share them with students via code</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Create Quiz
        </button>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search quizzes" placeholder="Search quizzes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <DataTable
          columns={columns}
          data={filteredQuizzes}
          isLoading={loading}
          emptyMessage="No quizzes found. Click 'Create Quiz' to create your first quiz!"
        />
      </div>

      {/* Create/Edit Quiz Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingQuiz ? 'Edit Quiz' : 'Create'}
            </h3>

            {!editingQuiz && (
              <div className="mb-4 inline-flex rounded-lg border border-gray-300 p-1">
                <button
                  type="button"
                  onClick={() => setFormMode('quiz')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    formMode === 'quiz' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Quiz
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('question');
                    setFormData((prev) => ({
                      ...prev,
                      title: '',
                      description: '',
                      scheduledStart: '',
                      questionTitle: '',
                      questionScheduledStart: '',
                      questions: [prev.questions[0] || { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '', timeLimit: 60, answerText: '' }],
                    }));
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    formMode === 'question' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Question
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-xl bg-gray-50 p-4 space-y-4">
                <p className="text-sm text-gray-600">{editingQuiz?.lifecycle === 'published' ? 'Schedule changes notify students under your saved settings.' : 'Saving creates a draft. Publication queues one announcement.'} The closing window is separate from each student’s attempt duration.</p>
                <label className="block text-sm font-medium">Schedule timezone<input required className="mt-1 w-full rounded-lg border p-2" value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} placeholder="Asia/Karachi" /></label>
                <label className="block text-sm font-medium">Closing time<input type="datetime-local" className="mt-1 w-full rounded-lg border p-2" value={formData.closesAt} onChange={e => setFormData({ ...formData, closesAt: e.target.value })} /></label>
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.assignedStudentIds === null} onChange={e => setFormData({ ...formData, assignedStudentIds: e.target.checked ? null : [] })} />Assign to all enrolled students in this course</label>
                {formData.assignedStudentIds !== null && <label className="block text-sm">Selected students<select multiple className="mt-1 w-full min-h-[100px] rounded-lg border p-2" value={formData.assignedStudentIds} onChange={e => setFormData({ ...formData, assignedStudentIds: Array.from(e.target.selectedOptions, o => o.value) })}>{students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}</select><span className="text-xs text-gray-500">Hold Ctrl or Command to select multiple students. An empty selection assigns nobody.</span></label>}
              </div>
              {formMode === 'quiz' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter quiz title"
                        aria-label="Quiz title"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                      <select
                        aria-label="Quiz course"
                        value={formData.courseId}
                        disabled={Boolean(editingQuiz)}
                        onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="">Select a course</option>
                        {teacherCourses.map((course) => (
                          <option key={course._id} value={course._id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="attempt-duration">Attempt duration (minutes)</label>
                      <input id="attempt-duration" type="number" min={1} max={600} required value={formData.timeLimit} onChange={e => setFormData({ ...formData, timeLimit: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      <p className="mt-1 text-xs text-gray-500">Each attempt ends at its duration or the closing time, whichever comes first.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opening time (required to publish)
                    </label>
                    <input
                      type="datetime-local"
                      aria-label="Opening time"
                      value={formData.scheduledStart}
                      onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      If set, students cannot start the quiz before this time
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Brief description of the quiz"
                      aria-label="Quiz description"
                    />
                  </div>


                </>
              )}

              {formMode === 'question' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                    <select
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="">Select a course</option>
                      {teacherCourses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Title</label>
                    <input
                      type="text"
                      value={formData.questionTitle}
                      onChange={(e) => setFormData({ ...formData, questionTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter question title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Start Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.questionScheduledStart}
                      onChange={(e) => setFormData({ ...formData, questionScheduledStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      If set, students cannot start the question before this time
                    </p>
                  </div>

                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-900">Questions</h4>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Question
                  </button>
                </div>

                <div className="space-y-6">
                  {formData.questions.map((question, qIndex) => (
                    <div key={qIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-700">Question {qIndex + 1}</span>
                        <div className="flex items-center gap-3">
                          {/* Time Section */}
                          <div className="flex items-center gap-2 bg-white px-2 py-1 border border-gray-300 rounded-lg">
                            <ClockIcon className="h-4 w-4 text-gray-400" />
                            <input
                              type="number"
                              min="30"
                              max="2700"
                              step="5"
                              value={question.timeLimit}
                              onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                              className="w-16 text-sm border-none focus:ring-0 p-0"
                              placeholder="60"
                            />
                            <span className="text-[10px] font-bold text-gray-400 uppercase">sec</span>
                          </div>

                          {/* Difficulty Section */}
                          <select
                            value={question.difficulty}
                            onChange={(e) => updateQuestion(qIndex, 'difficulty', e.target.value)}
                            className="text-sm px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>

                          {formData.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(qIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        value={question.text}
                        onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                        placeholder="Enter question text"
                        aria-label={`Question ${qIndex+1} text`}
                        required
                      />

                      {formMode === 'quiz' ? (
                        <div className="space-y-2 mb-3">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <input
                                type="radio"
                                aria-label={`Question ${qIndex+1}: correct answer is option ${oIndex+1}`}
                                name={`correct-${qIndex}`}
                                checked={question.correctAnswer === oIndex}
                                onChange={() => updateQuestion(qIndex, 'correctAnswer', oIndex)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder={`Option ${oIndex + 1}`}
                                aria-label={`Question ${qIndex+1} option ${oIndex+1}`}
                                required
                              />
                              {question.correctAnswer === oIndex && (
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                          Students will type their own answer. You will grade their submissions manually from the Submissions page.
                        </div>
                      )}

                      <input
                        type="text"
                        value={question.explanation || ''}
                        onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Explanation (optional)"
                        aria-label={`Question ${qIndex+1} explanation`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuiz}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                >
                  {savingQuiz ? 'Saving…' : editingQuiz ? 'Save changes' : 'Save draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default TeacherQuizzes;
