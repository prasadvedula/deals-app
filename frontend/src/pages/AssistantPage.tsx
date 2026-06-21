import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2, Trash2, Zap } from 'lucide-react';
import { chatStream } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const STARTER_PROMPTS = [
  'Best deals under ₹2000 today?',
  'boAt Airdopes price on Amazon India?',
  'Compare OnePlus vs Samsung earbuds',
  'Which kitchen deals are trending?',
  'Cheapest platform for Woodland shoes?',
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI shopping assistant for Indian e-commerce. I can compare prices across Flipkart, Amazon India, Meesho, Snapdeal and more — all in ₹ INR. Ask me about any product!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text = input) => {
    if (!text.trim() || isLoading) return;
    setInput('');
    setIsLoading(true);

    const history = messages
      .filter((m) => !m.loading)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: Message = { role: 'user', content: text };
    const assistantMsg: Message = { role: 'assistant', content: '', loading: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let accumulated = '';
    abortRef.current = chatStream(
      text,
      history,
      (chunk) => {
        accumulated += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated, loading: true };
          return updated;
        });
      },
      () => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
        setIsLoading(false);
      },
      (err) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Sorry, I encountered an error: ${err}` };
          return updated;
        });
        setIsLoading(false);
      }
    );
  };

  const clearChat = () => {
    abortRef.current?.();
    setIsLoading(false);
    setMessages([
      { role: 'assistant', content: 'Chat cleared. How can I help you find deals today?' },
    ]);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800">Shopping Assistant</h1>
            <p className="text-xs text-gray-400">Powered by Claude AI</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
        >
          <Trash2 size={14} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'assistant' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
            }`}>
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {msg.content}
              {msg.loading && !msg.content && (
                <Loader2 size={16} className="animate-spin" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-full hover:bg-blue-100 transition-colors"
            >
              <Zap size={12} /> {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about deals, compare products, get recommendations..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
