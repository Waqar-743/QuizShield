import { useEffect, useState } from 'react';
import { DataTable } from '../../../components/shared';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface QuestionWithMeta {
  _id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
  topicId: string;
  explanation?: string;
  topicName?: string;
  courseName?: string;
}

interface TopicOption {
  _id: string;
  title: string;
  courseName?: string;
}

const TeacherQuestions = () => {
  const [questions, setQuestions] = useState<QuestionWithMeta[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithMeta | null>(null);
  const [formData, setFormData] = useState({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    topicId: '',
    explanation: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [questionsRes, topicsRes] = await Promise.all([
        api.get('/courses/teacher/questions'),
        api.get('/courses/teacher/topics'),
      ]);
      setQuestions(questionsRes.data.data || []);
      setTopics(topicsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setTopics([]);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (question?: QuestionWithMeta) => {
    if (topics.length === 0) {
      toast.error('Please create a topic first before adding questions');
      return;
    }
    
    if (question) {
      setEditingQuestion(question);
      setFormData({
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty as 'Easy' | 'Medium' | 'Hard',
        topicId: question.topicId,
        explanation: question.explanation || '',
      });
    } else {
      setEditingQuestion(null);
      setFormData({
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        difficulty: 'Medium',
        topicId: topics[0]?._id || '',
        explanation: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate options
    if (formData.options.some((opt) => !opt.trim())) {
      toast.error('All options must be filled');
      return;
    }

    try {
      if (editingQuestion) {
        await api.put(`/courses/questions/${editingQuestion._id}`, formData);
        toast.success('Question updated successfully');
      } else {
        await api.post('/courses/questions', formData);
        toast.success('Question created successfully');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save question');
    }
  };

  const handleDelete = async (question: QuestionWithMeta) => {
    if (!confirm(`Delete this question?`)) return;
    
    try {
      await api.delete(`/courses/questions/${question._id}`);
      toast.success('Question deleted');
      setQuestions(questions.filter((q) => q._id !== question._id));
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    const styles: Record<string, string> = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[difficulty] || 'bg-gray-100 text-gray-800'}`}>
        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
      </span>
    );
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = selectedTopic === 'all' || q.topicId === selectedTopic;
    const matchesDifficulty = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesTopic && matchesDifficulty;
  });

  const columns = [
    {
      key: 'text' as keyof QuestionWithMeta,
      header: 'Question',
      render: (q: QuestionWithMeta) => (
        <div className="max-w-md">
          <p className="text-gray-900 line-clamp-2">{q.text}</p>
          <p className="text-sm text-gray-500 mt-1">{q.topicName}</p>
        </div>
      ),
    },
    {
      key: 'difficulty' as keyof QuestionWithMeta,
      header: 'Difficulty',
      render: (q: QuestionWithMeta) => getDifficultyBadge(q.difficulty),
    },
    {
      key: 'options' as keyof QuestionWithMeta,
      header: 'Options',
      render: (q: QuestionWithMeta) => (
        <span className="text-gray-600">{q.options.length} options</span>
      ),
    },
    {
      key: 'correctAnswer' as keyof QuestionWithMeta,
      header: 'Answer',
      render: (q: QuestionWithMeta) => (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircleIcon className="h-4 w-4" />
          <span className="text-sm">Option {q.correctAnswer + 1}</span>
        </div>
      ),
    },
    {
      key: '_id' as keyof QuestionWithMeta,
      header: 'Actions',
      render: (q: QuestionWithMeta) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(q)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDelete(q)}
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
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Questions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage quiz questions for your topics</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Question
        </button>
      </header>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Topics</option>
            {topics.map((topic) => (
              <option key={topic._id} value={topic._id}>
                {topic.title}
              </option>
            ))}
          </select>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {topics.length === 0 && !loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">You need to create topics before adding questions.</p>
            <a href="/dashboard/teacher/topics" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Go to Topics →
            </a>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredQuestions}
            isLoading={loading}
            emptyMessage="No questions found. Click 'Add Question' to create your first question!"
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingQuestion ? 'Edit Question' : 'Add Question'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                <textarea
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your question..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                <div className="space-y-2">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={formData.correctAnswer === index}
                        onChange={() => setFormData({ ...formData, correctAnswer: index })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...formData.options];
                          newOptions[index] = e.target.value;
                          setFormData({ ...formData, options: newOptions });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={`Option ${index + 1}`}
                        required
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-1">Select the radio button next to the correct answer.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                  <select
                    value={formData.topicId}
                    onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select a topic</option>
                    {topics.map((topic) => (
                      <option key={topic._id} value={topic._id}>
                        {topic.title} ({topic.courseName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as 'Easy' | 'Medium' | 'Hard' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Optional)</label>
                <textarea
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Explain why this answer is correct..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
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
                  {editingQuestion ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherQuestions;
