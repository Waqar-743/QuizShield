import { useEffect, useState } from 'react';
import { DataTable } from '../../../components/shared';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  questions: QuestionItem[];
  timeLimit?: number;
  scheduledStart?: string;
  createdAt: string;
  accessCode: string;
}

interface QuestionItem {
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
  explanation?: string;
}

const TeacherQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    timeLimit: 30,
    scheduledStart: '',
    questions: [
      { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '' }
    ] as QuestionItem[],
  });

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes/teacher/my-quizzes');
      setQuizzes(response.data.data || []);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  // Convert UTC date to local datetime-local format
  const utcToLocal = (utcDate: string) => {
    const date = new Date(utcDate);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  };

  const handleOpenModal = (quiz?: Quiz) => {
    if (quiz) {
      setEditingQuiz(quiz);
      setFormData({
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit || 30,
        scheduledStart: quiz.scheduledStart ? utcToLocal(quiz.scheduledStart) : '',
        questions: quiz.questions.length > 0 ? quiz.questions : [
          { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '' }
        ],
      });
    } else {
      setEditingQuiz(null);
      setFormData({
        title: '',
        description: '',
        timeLimit: 30,
        scheduledStart: '',
        questions: [
          { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '' }
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
        { text: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'Medium', explanation: '' }
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

    // Convert local datetime to ISO string for proper timezone handling
    const submitData = {
      ...formData,
      scheduledStart: formData.scheduledStart 
        ? new Date(formData.scheduledStart).toISOString() 
        : null,
    };

    try {
      if (editingQuiz) {
        await api.put(`/quizzes/${editingQuiz._id}`, submitData);
        toast.success('Quiz updated successfully');
      } else {
        await api.post('/quizzes', submitData);
        toast.success('Quiz created successfully');
      }
      setModalOpen(false);
      fetchQuizzes();
    } catch (error) {
      toast.error('Failed to save quiz');
    }
  };

  const handleDelete = async (quiz: Quiz) => {
    if (!confirm(`Delete quiz "${quiz.title}"?`)) return;

    try {
      await api.delete(`/quizzes/${quiz._id}`);
      toast.success('Quiz deleted');
      setQuizzes(quizzes.filter((q) => q._id !== quiz._id));
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
            {new Date(quiz.scheduledStart).toLocaleString()}
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
          <button
            onClick={() => handleOpenModal(quiz)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDelete(quiz)}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
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
            placeholder="Search quizzes..."
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
              {editingQuiz ? 'Edit Quiz' : 'Create Quiz'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter quiz title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
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
                />
              </div>

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
                        <div className="flex items-center gap-2">
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
                        required
                      />

                      <div className="space-y-2 mb-3">
                        {question.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
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
                              required
                            />
                            {question.correctAnswer === oIndex && (
                              <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={question.explanation || ''}
                        onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Explanation (optional)"
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                >
                  {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
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
