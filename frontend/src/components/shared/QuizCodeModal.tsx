import { useState, useEffect } from 'react';
import { FiX, FiCopy, FiTrash2, FiToggleLeft, FiToggleRight, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface QuizCode {
  code: string;
  createdAt: string;
  accessCount: number;
  isActive: boolean;
  maxAttempts: number | null;
  expiresAt: string | null;
}

interface QuizCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  courseId: string;
  quizTitle: string;
}

const QuizCodeModal = ({ isOpen, onClose, quizId, courseId, quizTitle }: QuizCodeModalProps) => {
  const [codes, setCodes] = useState<QuizCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState<string>('');

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/quizzes/${quizId}/codes`);
      setCodes(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch codes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && quizId) {
      fetchCodes();
    }
  }, [isOpen, quizId]);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      await api.post(`/quizzes/${quizId}/generate-code`, {
        courseId,
        maxAttempts: maxAttempts ? parseInt(maxAttempts) : null
      });
      toast.success('Code generated successfully!');
      fetchCodes();
      setMaxAttempts('');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const handleToggleCode = async (code: string, currentStatus: boolean) => {
    try {
      await api.put(`/quizzes/codes/${code}/toggle`, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Code deactivated' : 'Code activated');
      fetchCodes();
    } catch (error: any) {
      toast.error('Failed to update code status');
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (!window.confirm('Are you sure you want to delete this code?')) return;
    
    try {
      await api.delete(`/quizzes/codes/${code}`);
      toast.success('Code deleted');
      fetchCodes();
    } catch (error: any) {
      toast.error('Failed to delete code');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Share Quiz: {quizTitle}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* Generate new code */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Generate New Code</h4>
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Max Attempts (optional)</label>
                <input
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center text-sm"
              >
                {generating ? (
                  <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                ) : null}
                Generate Code
              </button>
            </div>
          </div>

          {/* Existing codes */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Existing Codes</h4>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : codes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No codes generated yet</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {codes.map((codeItem) => (
                  <div
                    key={codeItem.code}
                    className={`border rounded-lg p-3 ${codeItem.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-lg font-bold tracking-wider">
                          {codeItem.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(codeItem.code)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Copy code"
                        >
                          <FiCopy className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleCode(codeItem.code, codeItem.isActive)}
                          className={`p-1 ${codeItem.isActive ? 'text-green-600' : 'text-gray-400'}`}
                          title={codeItem.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {codeItem.isActive ? (
                            <FiToggleRight className="h-5 w-5" />
                          ) : (
                            <FiToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteCode(codeItem.code)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Delete code"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-gray-500 space-x-4">
                      <span>Used: {codeItem.accessCount} times</span>
                      {codeItem.maxAttempts && (
                        <span>Max: {codeItem.maxAttempts}</span>
                      )}
                      <span className={codeItem.isActive ? 'text-green-600' : 'text-red-600'}>
                        {codeItem.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizCodeModal;
