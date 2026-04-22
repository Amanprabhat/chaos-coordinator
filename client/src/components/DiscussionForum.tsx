/**
 * DiscussionForum — per-project discussion + document hub
 * Features: private chat (internal only), @mention tagging, expanded doc categories
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  project_id: number;
  user_id?: number;
  user_name: string;
  user_role: string;
  message: string;
  is_private?: boolean;
  tagged_users?: string; // JSON array string
  created_at: string;
}

interface ProjectDocument {
  id: number;
  project_id: number;
  user_id?: number;
  user_name: string;
  user_role: string;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type?: string;
  category: string;
  description?: string;
  created_at: string;
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { pill: string; avatar: string }> = {
  Admin:  { pill: 'bg-violet-100 text-violet-700', avatar: 'bg-violet-200 text-violet-800' },
  CSM:    { pill: 'bg-blue-100 text-blue-700',     avatar: 'bg-blue-200 text-blue-800'     },
  PM:     { pill: 'bg-indigo-100 text-indigo-700', avatar: 'bg-indigo-200 text-indigo-800' },
  Sales:  { pill: 'bg-emerald-100 text-emerald-700', avatar: 'bg-emerald-200 text-emerald-800' },
  Client: { pill: 'bg-amber-100 text-amber-700',   avatar: 'bg-amber-200 text-amber-800'   },
};

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  General:        { label: 'General',         color: 'bg-gray-50 text-gray-600 border-gray-200',         icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg> },
  MoM:            { label: 'MoM',             color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
  SOW:            { label: 'SOW',             color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  BRD:            { label: 'BRD',             color: 'bg-violet-50 text-violet-700 border-violet-200',    icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> },
  'Change Request': { label: 'CR',            color: 'bg-orange-50 text-orange-700 border-orange-200',   icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> },
  'Test Plan':    { label: 'Test Plan',       color: 'bg-teal-50 text-teal-700 border-teal-200',          icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7l2 2 4-4"/></svg> },
  'Other':        { label: 'Other',           color: 'bg-pink-50 text-pink-700 border-pink-200',          icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg> },
};

const DOC_CATEGORIES = ['General', 'MoM', 'Test Plan', 'Other'];

const INTERNAL_ROLES = ['Admin', 'CSM', 'PM', 'Sales'];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(d: string) {
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  projectName?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DiscussionForum: React.FC<Props> = ({ projectId, projectName }) => {
  const { user } = useAuth();
  const isClient = user?.role === 'Client';
  const isInternal = INTERNAL_ROLES.includes(user?.role || '');

  const [activeTab, setActiveTab] = useState<'messages' | 'documents'>('messages');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [posting, setPosting]     = useState(false);
  const [uploading, setUploading] = useState(false);

  // Compose state
  const [newMessage, setNewMessage]   = useState('');
  const [isPrivate, setIsPrivate]     = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<TeamMember[]>([]);
  const [showPrivateSection, setShowPrivateSection] = useState(false);

  // @mention state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Document upload
  const [uploadFile, setUploadFile]         = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('General');
  const [uploadDesc, setUploadDesc]         = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Private thread collapse state
  const [collapsedPrivate, setCollapsedPrivate] = useState<Set<number>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/projects/${projectId}/discussions?viewer_role=${user?.role || ''}`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setDocuments(data.documents || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId, user?.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch team members for @mention (internal only)
  useEffect(() => {
    if (!isInternal) return;
    fetch(`http://localhost:3001/api/projects/${projectId}/team-members`)
      .then(r => r.ok ? r.json() : [])
      .then(setTeamMembers)
      .catch(() => {});
  }, [projectId, isInternal]);

  useEffect(() => {
    if (activeTab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // ── @mention handling ───────────────────────────────────────────────────────

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    // Detect @ trigger
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const query = before.slice(atIdx + 1);
      if (!query.includes(' ')) {
        setMentionStart(atIdx);
        setMentionQuery(query);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const insertMention = (member: TeamMember) => {
    const before = newMessage.slice(0, mentionStart);
    const after  = newMessage.slice(mentionStart + 1 + mentionQuery.length);
    const inserted = `@${member.name} `;
    setNewMessage(before + inserted + after);
    setTaggedUsers(prev => prev.find(u => u.id === member.id) ? prev : [...prev, member]);
    setShowMentionDropdown(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredMembers = teamMembers.filter(m =>
    m.name.toLowerCase().includes(mentionQuery.toLowerCase()) && m.id !== user?.id
  );

  // ── Post message ────────────────────────────────────────────────────────────

  const postMessage = async () => {
    if (!newMessage.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`http://localhost:3001/api/projects/${projectId}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:      user?.id,
          user_name:    user?.name || 'Unknown',
          user_role:    user?.role || 'Unknown',
          message:      newMessage.trim(),
          is_private:   isPrivate,
          tagged_users: taggedUsers.map(u => u.id),
        }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
        setTaggedUsers([]);
        setIsPrivate(false);
      }
    } catch (e) { console.error(e); }
    finally { setPosting(false); }
  };

  const deleteMessage = async (id: number) => {
    if (!window.confirm('Delete this message?')) return;
    await fetch(`http://localhost:3001/api/projects/${projectId}/discussions/${id}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  // ── Upload document ─────────────────────────────────────────────────────────

  const uploadDocument = async () => {
    if (!uploadFile || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('user_id',   String(user?.id || ''));
      form.append('user_name', user?.name || 'Unknown');
      form.append('user_role', user?.role || 'Unknown');
      form.append('category',  uploadCategory);
      form.append('description', uploadDesc);
      const res = await fetch(`http://localhost:3001/api/projects/${projectId}/documents`, {
        method: 'POST', body: form,
      });
      if (res.ok) {
        const doc = await res.json();
        setDocuments(prev => [doc, ...prev]);
        setUploadFile(null);
        setUploadDesc('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const deleteDocument = async (id: number) => {
    if (!window.confirm('Delete this document?')) return;
    await fetch(`http://localhost:3001/api/projects/${projectId}/documents/${id}`, { method: 'DELETE' });
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const isOwner = (item: { user_id?: number; user_name: string }) =>
    (user?.id && item.user_id === user.id) || item.user_name === user?.name;

  const canDelete = (item: { user_id?: number; user_name: string }) =>
    user?.role === 'Admin' || isOwner(item);

  // Separate public + private message groups
  const publicMessages  = messages.filter(m => !m.is_private);
  const privateMessages = messages.filter(m => m.is_private);
  const privateGroups   = privateMessages.reduce<Record<string, Message[]>>((acc, m) => {
    // Group private messages by day for collapsible threads
    const day = m.created_at.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(m);
    return acc;
  }, {});

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            Discussion Forum
          </h3>
          {projectName && <p className="text-[11px] text-gray-400 mt-0.5">{projectName}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Private chat toggle — internal team only */}
          {isInternal && (
            <button
              onClick={() => setShowPrivateSection(s => !s)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                showPrivateSection
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
              title="Internal-only private messages (not visible to client)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              Private {privateMessages.length > 0 && <span className="bg-white/20 px-1 rounded">{privateMessages.length}</span>}
            </button>
          )}

          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setActiveTab('messages')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'messages' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
              Messages
              {publicMessages.length > 0 && (
                <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{publicMessages.length}</span>
              )}
            </button>
            <button onClick={() => setActiveTab('documents')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'documents' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              Docs
              {documents.length > 0 && (
                <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{documents.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ═══ MESSAGES TAB ═══════════════════════════════════════════════════ */}
          {activeTab === 'messages' && (
            <div className="flex flex-col" style={{ minHeight: 480 }}>

              {/* Private thread section — collapsible, internal only */}
              {isInternal && showPrivateSection && (
                <div className="border-b border-slate-200 bg-slate-900/5">
                  <div className="px-5 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <span className="text-xs font-bold text-slate-600">Internal Private Chat</span>
                      <span className="text-[10px] text-slate-400 font-medium">— not visible to client</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{privateMessages.length} message{privateMessages.length !== 1 ? 's' : ''}</span>
                  </div>

                  {privateMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3 pb-4">No private messages yet. Toggle "Private" below to send one.</p>
                  ) : (
                    Object.entries(privateGroups).map(([day, dayMsgs]) => {
                      const collapsed = collapsedPrivate.has(dayMsgs[0].id);
                      return (
                        <div key={day} className="border-t border-slate-200/60">
                          <button
                            onClick={() => setCollapsedPrivate(prev => {
                              const next = new Set(prev);
                              if (collapsed) next.delete(dayMsgs[0].id);
                              else next.add(dayMsgs[0].id);
                              return next;
                            })}
                            className="w-full flex items-center justify-between px-5 py-2 hover:bg-slate-100/50 transition-colors"
                          >
                            <span className="text-[11px] font-semibold text-slate-500">
                              {new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {dayMsgs.length} msg
                            </span>
                            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                            </svg>
                          </button>
                          {!collapsed && (
                            <div className="px-5 py-2 space-y-3 bg-slate-50/60">
                              {dayMsgs.map(msg => {
                                const mine = isOwner(msg);
                                const rc = ROLE_COLORS[msg.user_role] || ROLE_COLORS['Client'];
                                const tagged: number[] = (() => { try { return JSON.parse(msg.tagged_users || '[]'); } catch { return []; } })();
                                return (
                                  <div key={msg.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${rc.avatar}`}>
                                      {initials(msg.user_name)}
                                    </div>
                                    <div className={`max-w-sm group flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-600">{msg.user_name}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${rc.pill}`}>{msg.user_role}</span>
                                        {tagged.length > 0 && <span className="text-[9px] text-indigo-400">@tagged</span>}
                                        <span className="text-[9px] text-slate-300">{timeAgo(msg.created_at)}</span>
                                      </div>
                                      <div className="px-3.5 py-2 rounded-xl text-sm bg-slate-800 text-slate-100 rounded-tl-sm">
                                        {msg.message}
                                      </div>
                                      {canDelete(msg) && (
                                        <button onClick={() => deleteMessage(msg.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-600">
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Public messages thread */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {publicMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                    <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <p className="text-sm">No messages yet — start the conversation!</p>
                  </div>
                ) : publicMessages.map(msg => {
                  const mine = isOwner(msg);
                  const rc = ROLE_COLORS[msg.user_role] || ROLE_COLORS['Client'];
                  const tagged: number[] = (() => { try { return JSON.parse(msg.tagged_users || '[]'); } catch { return []; } })();
                  const taggedNames = tagged.map(tid => teamMembers.find(m => m.id === tid)?.name).filter(Boolean);
                  return (
                    <div key={msg.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${rc.avatar}`}>
                        {initials(msg.user_name)}
                      </div>
                      <div className={`max-w-xs lg:max-w-md group relative ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className={`flex items-center gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[10px] font-bold text-gray-500">{msg.user_name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${rc.pill}`}>{msg.user_role}</span>
                          {taggedNames.length > 0 && (
                            <span className="text-[9px] text-indigo-400 font-semibold">→ {taggedNames.join(', ')}</span>
                          )}
                          <span className="text-[9px] text-gray-300">{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          mine ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        }`}>
                          {msg.message}
                        </div>
                        {canDelete(msg) && (
                          <button onClick={() => deleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-600 self-end">
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose area */}
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">

                {/* Private toggle + tagged users — internal only */}
                {isInternal && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setIsPrivate(p => !p)}
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          isPrivate
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                        }`}
                        title="Private messages are only visible to internal team members"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        {isPrivate ? 'Private' : 'Public'}
                      </button>
                      {taggedUsers.map(tu => (
                        <span key={tu.id} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                          @{tu.name}
                          <button onClick={() => setTaggedUsers(prev => prev.filter(u => u.id !== tu.id))} className="text-indigo-400 hover:text-indigo-600 leading-none ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                    {isPrivate && <span className="text-[10px] text-slate-400">Not visible to client</span>}
                  </div>
                )}

                {/* @mention dropdown */}
                <div className="relative">
                  {showMentionDropdown && filteredMembers.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                      {filteredMembers.map(m => {
                        const rc = ROLE_COLORS[m.role] || ROLE_COLORS['Client'];
                        return (
                          <button key={m.id} onMouseDown={e => { e.preventDefault(); insertMention(m); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 transition-colors text-left">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${rc.avatar}`}>
                              {initials(m.name)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-800">{m.name}</p>
                              <p className={`text-[10px] font-semibold ${rc.pill.split(' ')[1]}`}>{m.role}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${ROLE_COLORS[user?.role || 'Client']?.avatar || 'bg-indigo-100 text-indigo-700'}`}>
                      {initials(user?.name || '?')}
                    </div>
                    <div className={`flex-1 bg-white rounded-xl border focus-within:ring-2 transition-all ${
                      isPrivate ? 'border-slate-400 focus-within:ring-slate-200' : 'border-gray-200 focus-within:border-indigo-300 focus-within:ring-indigo-100'
                    }`}>
                      <textarea
                        ref={textareaRef}
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setShowMentionDropdown(false); return; }
                          if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
                            e.preventDefault();
                            postMessage();
                          }
                        }}
                        placeholder={isInternal
                          ? `Type a message… (@ to mention teammate, Enter to send)`
                          : 'Type a message… (Enter to send, Shift+Enter for new line)'}
                        rows={2}
                        className="w-full px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none rounded-xl bg-transparent"
                      />
                    </div>
                    <button onClick={postMessage} disabled={!newMessage.trim() || posting}
                      className={`w-9 h-9 disabled:opacity-40 rounded-xl flex items-center justify-center text-white transition-colors flex-shrink-0 ${
                        isPrivate ? 'bg-slate-700 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}>
                      {posting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ DOCUMENTS TAB ═══════════════════════════════════════════════════ */}
          {activeTab === 'documents' && (
            <div className="flex flex-col" style={{ minHeight: 480 }}>
              {/* Upload panel */}
              <div className="border-b border-gray-100 px-5 py-4 bg-slate-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Upload Document</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1" style={{ minWidth: 200 }}>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">File</label>
                    <input ref={fileInputRef} type="file"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-xs file:font-bold hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Category</label>
                    <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {DOC_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c === 'MoM' ? 'MoM (Minutes of Meeting)' : c === 'SOW' ? 'SOW (Statement of Work)' : c === 'BRD' ? 'BRD (Business Requirements)' : c === 'Change Request' ? 'Change Request (CR)' : c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1" style={{ minWidth: 160 }}>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Description (optional)</label>
                    <input type="text" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)}
                      placeholder="Brief description…"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <button onClick={uploadDocument} disabled={!uploadFile || uploading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0">
                    {uploading ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                    )}
                    Upload
                  </button>
                </div>
              </div>

              {/* Category filter chips */}
              {documents.length > 0 && (
                <div className="px-5 py-2.5 border-b border-gray-100 flex gap-1.5 flex-wrap bg-white">
                  {Array.from(new Set(documents.map(d => d.category))).map(cat => {
                    const meta = CATEGORY_META[cat] || CATEGORY_META['Other'];
                    return (
                      <span key={cat} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.icon}{meta.label}
                        <span className="font-normal opacity-60 ml-0.5">{documents.filter(d => d.category === cat).length}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Document list */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                    <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                    <p className="text-sm">No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => {
                      const cat = CATEGORY_META[doc.category] || CATEGORY_META['Other'];
                      return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors group">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-bold text-gray-800 truncate">{doc.original_filename}</p>
                              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cat.color}`}>
                                {cat.icon}{cat.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
                              <span>{fmtSize(doc.file_size)}</span>
                              <span>·</span>
                              <span>by <strong>{doc.user_name}</strong> ({doc.user_role})</span>
                              <span>·</span>
                              <span>{fmtTime(doc.created_at)}</span>
                            </div>
                            {doc.description && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{doc.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={`http://localhost:3001/api/projects/${projectId}/documents/${doc.id}/download`}
                              target="_blank" rel="noreferrer"
                              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="Download">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                              </svg>
                            </a>
                            {canDelete(doc) && (
                              <button onClick={() => deleteDocument(doc.id)}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DiscussionForum;
