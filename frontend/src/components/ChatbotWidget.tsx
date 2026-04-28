import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SearchResult {
  name: string;
  webUrl: string;
  folderPath: string;
  lastModified: string | null;
  summary: string | null;
}

interface Message {
  role: 'user' | 'bot';
  text: string;
  results?: SearchResult[];
  error?: boolean;
}

const CLIENT_ROLE = 'Client';

// ── Coming Soon pill for clients ─────────────────────────────────────────────
const ComingSoonWidget: React.FC = () => (
  <div
    className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3
                bg-white border border-gray-200 rounded-2xl shadow-lg cursor-default select-none"
    title="AI Assistant – coming soon"
  >
    <div className="relative">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />
    </div>
    <div>
      <p className="text-xs font-bold text-gray-900 leading-tight">AI Assistant</p>
      <p className="text-[10px] font-semibold text-amber-600 leading-tight">Coming Soon</p>
    </div>
  </div>
);

// ── Internal Knowledge Bot ────────────────────────────────────────────────────
const InternalBot: React.FC = () => {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hi! I can search the SharePoint knowledge base for you. Ask me anything — like "Is there a communication matrix?" or "Show me onboarding docs".' },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/chatbot/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await r.json();
      if (data.error && (!data.results || data.results.length === 0)) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `I couldn't reach the knowledge base right now. (${data.error})`,
          error: true,
        }]);
      } else if (data.results.length === 0) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `No documents found for "${q}". Try different keywords.`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `Found ${data.total} document${data.total !== 1 ? 's' : ''} matching "${q}":`,
          results: data.results,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'Something went wrong connecting to the knowledge base. Please try again.',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200
          ${open
            ? 'bg-slate-800 text-white scale-95'
            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:scale-105 active:scale-95'
          }`}
        title="Knowledge Assistant"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)]
                     bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Knowledge Assistant</p>
              <p className="text-[10px] text-white/70">Searches SharePoint · Internal only</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : msg.error
                        ? 'bg-red-50 text-red-700 border border-red-100 rounded-bl-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>

                  {/* Result cards */}
                  {msg.results && msg.results.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.results.map((r, ri) => (
                        <a
                          key={ri}
                          href={r.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2.5 p-3 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-100 transition-colors">
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 leading-snug truncate group-hover:text-indigo-600 transition-colors">
                              {r.name}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{r.folderPath}</p>
                            {r.summary && (
                              <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{r.summary}</p>
                            )}
                          </div>
                          <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map(d => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Search knowledge base…"
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-300 mt-2">Searches Technical Documentation Center on SharePoint</p>
          </div>
        </div>
      )}
    </>
  );
};

// ── Main export — renders based on role ──────────────────────────────────────
const ChatbotWidget: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return null;
  if (user.role === CLIENT_ROLE) return <ComingSoonWidget />;
  return <InternalBot />;
};

export default ChatbotWidget;
