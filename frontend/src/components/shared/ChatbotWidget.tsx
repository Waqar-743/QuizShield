import { useEffect, useMemo, useRef, useState } from 'react';
import { FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import api from '../../services/api';

const initialTips = [
  'Ask me about quiz rules and violations.',
  'I can guide you to reports, quizzes, and teacher pages.',
  'I will not help with cheating or bypassing rules.'
];

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hi! I am the QuizShield assistant. I can explain rules, violations, and help you navigate quizzes, reports, and teacher pages.'
    }
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const tips = useMemo(() => initialTips, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/ai/assistant', {
        messages: nextMessages
      });

      const reply = response?.data?.data?.reply || 'Sorry, I could not generate a reply.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (error: any) {
      const serverMsg = error?.response?.data?.error?.message;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: serverMsg
            ? `Error: ${serverMsg}`
            : 'I am having trouble right now. Please try again in a moment or contact your instructor.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-40">
      {isOpen && (
        <div className="mb-3 w-[22rem] max-w-[90vw] rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">QuizShield Assistant</p>
              <p className="text-xs text-gray-500">Rules, navigation, and safe guidance</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
              aria-label="Close assistant"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[55vh] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === 'user'
                    ? 'ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary-600 px-3 py-2 text-sm text-white'
                    : 'w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-700'
                }
              >
                {message.content}
              </div>
            ))}

            {loading && (
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-500">
                Thinking...
              </div>
            )}

            {messages.length === 1 && (
              <div className="rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-700">
                <p className="font-semibold">Try asking:</p>
                <ul className="mt-1 space-y-1">
                  {tips.map((tip) => (
                    <li key={tip}>- {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask about rules or navigation..."
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="btn btn-primary h-10 w-10 rounded-xl p-0"
                aria-label="Send message"
              >
                <FiSend className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              This assistant will not help with cheating or bypassing rules.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700"
        aria-label="Open assistant"
      >
        <FiMessageCircle className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ChatbotWidget;
