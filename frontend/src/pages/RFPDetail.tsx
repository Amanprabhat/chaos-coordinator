import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppSidebar from '../components/AppSidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RFPSection {
  id: number;
  rfp_id: number;
  title: string;
  description?: string;
  section_type: string;
  assigned_to_id?: number;
  assignee_name?: string;
  assignee_role?: string;
  status: 'not_started' | 'in_progress' | 'review' | 'done';
  content?: string;
  word_limit?: number;
  due_date?: string;
  order_index: number;
  saved_to_library: boolean;
}

interface RFPComment {
  id: number;
  rfp_id: number;
  section_id?: number;
  user_id: number;
  user_name?: string;
  user_role?: string;
  message: string;
  created_at: string;
}

interface RFP {
  id: number;
  title: string;
  client_name: string;
  client_contact_name?: string;
  client_contact_email?: string;
  estimated_value?: number;
  currency: string;
  submission_deadline?: string;
  decision_expected_date?: string;
  status: string;
  priority: string;
  owner_name?: string;
  owner_id: number;
  description?: string;
  submission_notes?: string;
  outcome_notes?: string;
  linked_project_name?: string;
  sections: RFPSection[];
  comments: RFPComment[];
  completion_percent: number;
  rfp_source?: string;
  created_at: string;
}

interface LibraryItem {
  id: number;
  title: string;
  section_type: string;
  content: string;
  tags?: string;
  used_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; next?: string }> = {
  draft:        { label: 'Draft',        bg: 'bg-stone-100',  text: 'text-stone-600',  dot: 'bg-stone-400',   next: 'in_progress' },
  in_progress:  { label: 'In Progress',  bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500',    next: 'under_review' },
  under_review: { label: 'Under Review', bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500',   next: 'submitted' },
  submitted:    { label: 'Submitted',    bg: 'bg-violet-50',  text: 'text-violet-700', dot: 'bg-violet-500' },
  won:          { label: 'Won',          bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-500' },
  lost:         { label: 'Lost',         bg: 'bg-rose-50',    text: 'text-rose-700',   dot: 'bg-rose-500' },
};

const SECTION_STATUS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'text-stone-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-600' },
  review:      { label: 'In Review',   color: 'text-amber-600' },
  done:        { label: 'Done',        color: 'text-emerald-600' },
};

const SECTION_TYPES = [
  { value: 'executive_summary',   label: 'Executive Summary' },
  { value: 'company_overview',    label: 'Company Overview' },
  { value: 'technical_solution',  label: 'Technical Solution' },
  { value: 'implementation_plan', label: 'Implementation Plan' },
  { value: 'commercial',          label: 'Commercial / Pricing' },
  { value: 'support_maintenance', label: 'Support & Maintenance' },
  { value: 'compliance',          label: 'Compliance' },
  { value: 'custom',              label: 'Custom' },
];

const NAV_ITEMS = (dashPath: string) => [
  { label: 'Dashboard',     path: dashPath,     icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { label: 'All Projects',  path: '/projects',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
  { label: 'RFP Workspace', path: '/rfp',       icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { label: 'Analytics',     path: '/analytics', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
];

const ROLE_LABEL: Record<string, string> = {
  Admin: 'Administrator', Sales: 'Sales', CSM: 'Customer Success Manager',
  PM: 'Project Manager', 'Product Manager': 'Product Manager',
};

function wordCount(text?: string) {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ─── Section Drawer ───────────────────────────────────────────────────────────

interface SectionDrawerProps {
  section: RFPSection;
  rfpId: number;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: number;
}

const SectionDrawer: React.FC<SectionDrawerProps> = ({ section, rfpId, canEdit, onClose, onSaved, userId }) => {
  const [content,  setContent]  = useState(section.content ?? '');
  const [status,   setStatus]   = useState(section.status);
  const [saving,   setSaving]   = useState(false);
  const [library,  setLibrary]  = useState<LibraryItem[]>([]);
  const [showLib,  setShowLib]  = useState(false);
  const [libSearch,setLibSearch]= useState('');
  const [saveToLib,setSaveToLib]= useState(false);
  const [libTitle, setLibTitle] = useState(section.title);

  useEffect(() => {
    if (showLib) {
      fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/library?section_type=${section.section_type}${libSearch ? `&search=${libSearch}` : ''}`)
        .then(r => r.json()).then(setLibrary).catch(() => {});
    }
  }, [showLib, libSearch, section.section_type]);

  const handleSave = async (markDone = false) => {
    setSaving(true);
    try {
      const newStatus = markDone ? 'done' : status;
      await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${rfpId}/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, status: newStatus }),
      });
      if (markDone && saveToLib && content.trim()) {
        await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: libTitle, section_type: section.section_type, content, created_by: userId }),
        });
      }
      onSaved();
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const pullFromLibrary = async (item: LibraryItem) => {
    setContent(prev => prev ? `${prev}\n\n${item.content}` : item.content);
    await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/library/${item.id}/use`, { method: 'POST' });
    setShowLib(false);
  };

  const wc = wordCount(content);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
    >
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-2xl bg-white flex flex-col shadow-warm-xl overflow-hidden"
      >
        {/* Drawer header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                {SECTION_TYPES.find(t => t.value === section.section_type)?.label ?? section.section_type}
              </span>
              <span className={`text-xs font-medium ${SECTION_STATUS[status]?.color}`}>
                {SECTION_STATUS[status]?.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-stone-900 truncate">{section.title}</h2>
            {section.description && <p className="text-sm text-stone-400 mt-0.5 line-clamp-2">{section.description}</p>}
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-2 text-stone-400 hover:text-stone-600 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status bar */}
        {canEdit && (
          <div className="flex items-center gap-2 px-6 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
            <span className="text-xs text-stone-500 font-medium">Status:</span>
            {(['not_started', 'in_progress', 'review', 'done'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  status === s ? 'bg-indigo-600 text-white' : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200'
                }`}>
                {SECTION_STATUS[s].label}
              </button>
            ))}
          </div>
        )}

        {/* Library panel */}
        <AnimatePresence>
          {showLib && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="border-b overflow-hidden" style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="px-6 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-stone-600">Pull from Content Library</p>
                  <button onClick={() => setShowLib(false)} className="text-xs text-stone-400 hover:text-stone-600">Close</button>
                </div>
                <input value={libSearch} onChange={e => setLibSearch(e.target.value)}
                  placeholder="Search library..."
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50" />
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {library.length === 0 && <p className="text-xs text-stone-400 text-center py-3">No matching library items</p>}
                  {library.map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-3 p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-700 truncate">{item.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">{item.content.slice(0, 120)}...</p>
                      </div>
                      <button onClick={() => pullFromLibrary(item)}
                        className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content editor */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-stone-500">Response Content</label>
            <div className="flex items-center gap-3">
              {section.word_limit && (
                <span className={`text-xs font-medium ${wc > section.word_limit ? 'text-rose-600' : 'text-stone-400'}`}>
                  {wc} / {section.word_limit} words
                </span>
              )}
              {!section.word_limit && wc > 0 && (
                <span className="text-xs text-stone-400">{wc} words</span>
              )}
              {canEdit && (
                <button onClick={() => setShowLib(!showLib)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Library
                </button>
              )}
            </div>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            readOnly={!canEdit}
            placeholder={canEdit ? 'Write your response here...' : 'No content yet.'}
            className="w-full h-80 px-4 py-3 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50 resize-none leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          />

          {/* Metadata */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-stone-500">
            {section.assignee_name && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span>{section.assignee_name} ({section.assignee_role})</span>
              </div>
            )}
            {section.due_date && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Due {new Date(section.due_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Save to library option when marking done */}
          {canEdit && status !== 'done' && content.trim().length > 50 && (
            <div className="mt-4 flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <input type="checkbox" id="saveLib" checked={saveToLib} onChange={e => setSaveToLib(e.target.checked)}
                className="mt-0.5 rounded accent-indigo-600" />
              <div className="flex-1">
                <label htmlFor="saveLib" className="text-xs font-medium text-indigo-700 cursor-pointer">
                  Save response to Content Library
                </label>
                {saveToLib && (
                  <input value={libTitle} onChange={e => setLibTitle(e.target.value)}
                    placeholder="Library item title..."
                    className="mt-2 w-full px-3 py-1.5 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canEdit && (
          <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
            <button onClick={onClose} className="text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-stone-100">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSave(false)} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-60">
                Save Draft
              </button>
              <button onClick={() => handleSave(true)} disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                Mark as Done
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── Add Section Modal ────────────────────────────────────────────────────────

interface AddSectionModalProps {
  rfpId: number;
  users: { id: number; name: string; role: string }[];
  onClose: () => void;
  onAdded: () => void;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({ rfpId, users, onClose, onAdded }) => {
  const [form, setForm] = useState({ title: '', description: '', section_type: 'custom', assigned_to_id: '', word_limit: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${rfpId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          assigned_to_id: form.assigned_to_id ? parseInt(form.assigned_to_id) : null,
          word_limit: form.word_limit ? parseInt(form.word_limit) : null,
        }),
      });
      onAdded(); onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-warm-xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold text-stone-900">Add Section</h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Section Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required
              placeholder="e.g. Technical Architecture Overview"
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Section Type</label>
              <select value={form.section_type} onChange={e => set('section_type', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50">
                {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Assign To</label>
              <select value={form.assigned_to_id} onChange={e => set('assigned_to_id', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Word Limit</label>
              <input type="number" value={form.word_limit} onChange={e => set('word_limit', e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Description / Instructions</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="What should this section cover?"
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50 resize-none" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60">
              Add Section
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const RFPDetail: React.FC = () => {
  const { id }            = useParams<{ id: string }>();
  const navigate          = useNavigate();
  const location          = useLocation();
  const { user, logout }  = useAuth();

  const [rfp,            setRfp]           = useState<RFP | null>(null);
  const [loading,        setLoading]       = useState(true);
  const [sidebarOpen,    setSidebarOpen]   = useState(false);
  const [activeSection,  setActiveSection] = useState<RFPSection | null>(null);
  const [showAddSection, setShowAddSection]= useState(false);
  const [users,          setUsers]         = useState<{ id: number; name: string; role: string }[]>([]);
  const [comment,        setComment]       = useState('');
  const [postingComment, setPostingComment]= useState(false);
  const [outcomeModal,   setOutcomeModal]  = useState<'won' | 'lost' | null>(null);
  const [outcomeNotes,   setOutcomeNotes]  = useState('');

  // RFP document parsing
  const [parseStep,      setParseStep]     = useState<null | 'reading' | 'analyzing' | 'creating' | 'done'>(null);
  const [parseError,     setParseError]    = useState('');
  const [dragOver,       setDragOver]      = useState(false);
  const [exporting,      setExporting]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';
  const dashPath = user?.role === 'Admin' ? '/admin-dashboard' : user?.role === 'CSM' ? '/csm-dashboard' : user?.role === 'PM' ? '/pm-dashboard' : '/sales-dashboard';

  const canManage  = user?.role === 'Sales' || user?.role === 'Admin';
  const canEdit    = (sec: RFPSection) => canManage || sec.assigned_to_id === user?.id;

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  const fetchRFP = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${id}`);
      if (!res.ok) throw new Error('Not found');
      setRfp(await res.json());
    } catch { navigate('/rfp'); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchRFP(); }, [fetchRFP]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/users`)
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data.filter((u: any) => u.role !== 'Client') : []))
      .catch(() => {});
  }, []);

  const updateStatus = async (newStatus: string) => {
    await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchRFP();
  };

  const handleOutcome = async (outcome: 'won' | 'lost') => {
    await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${id}/${outcome}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome_notes: outcomeNotes }),
    });
    setOutcomeModal(null);
    fetchRFP();
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPostingComment(true);
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, message: comment }),
      });
      setComment('');
      fetchRFP();
    } finally { setPostingComment(false); }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setParseError('');
    setParseStep('reading');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setParseStep('analyzing');
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${id}/parse`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parsing failed');
      setParseStep('creating');
      await new Promise(r => setTimeout(r, 600)); // brief pause so user sees "creating" step
      setParseStep('done');
      await fetchRFP();
      setTimeout(() => setParseStep(null), 1800);
    } catch (err: any) {
      setParseError(err.message);
      setParseStep(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/${id}/export`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Export failed');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `RFP_Response_${rfp?.title?.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) || 'export'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!rfp) return null;

  const s             = STATUS_CONFIG[rfp.status] ?? STATUS_CONFIG.draft;
  const days          = daysUntil(rfp.submission_deadline);
  const progressStages = ['draft', 'in_progress', 'under_review', 'submitted'];
  const progressIdx    = progressStages.indexOf(rfp.status);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <AppSidebar
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={NAV_ITEMS(dashPath).map(item => ({
          label: item.label, icon: item.icon,
          active: item.path === '/rfp' ? location.pathname.startsWith('/rfp') : location.pathname === item.path,
          onClick: () => { navigate(item.path); setSidebarOpen(false); },
        }))}
        userName={user?.name ?? ''}
        userRole={ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? ''}
        userInitials={initials}
        onLogout={() => { logout(); navigate('/login'); }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <button onClick={() => navigate('/rfp')} className="text-stone-400 hover:text-stone-600 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold text-stone-900 truncate">{rfp.title}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${s.bg} ${s.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">{rfp.client_name}{rfp.owner_name ? ` · ${rfp.owner_name}` : ''}</p>
            </div>

            {/* Action buttons */}
            {canManage && !['won', 'lost'].includes(rfp.status) && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {rfp.sections.length > 0 && (
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    {exporting
                      ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    }
                    Export Doc
                  </button>
                )}
                {rfp.sections.length > 0 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition-colors"
                    title="Re-upload RFP to regenerate sections"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Re-parse
                  </button>
                )}
                {s.next && (
                  <button onClick={() => updateStatus(s.next!)}
                    className="px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                    Move to {STATUS_CONFIG[s.next]?.label}
                  </button>
                )}
                {rfp.status === 'submitted' && (
                  <>
                    <button onClick={() => setOutcomeModal('won')}
                      className="px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
                      Mark Won
                    </button>
                    <button onClick={() => setOutcomeModal('lost')}
                      className="px-3 py-2 text-xs font-semibold bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors">
                      Mark Lost
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {!['won', 'lost'].includes(rfp.status) && (
            <div className="px-6 pb-3">
              <div className="flex items-center gap-2">
                {progressStages.map((stage, i) => (
                  <React.Fragment key={stage}>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= progressIdx ? 'text-indigo-600' : 'text-stone-300'}`}>
                      <div className={`w-2 h-2 rounded-full ${i < progressIdx ? 'bg-indigo-600' : i === progressIdx ? 'bg-indigo-500 ring-2 ring-indigo-200' : 'bg-stone-200'}`} />
                      {STATUS_CONFIG[stage]?.label}
                    </div>
                    {i < progressStages.length - 1 && (
                      <div className={`flex-1 h-px ${i < progressIdx ? 'bg-indigo-200' : 'bg-stone-100'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main - Sections */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-stone-700">Sections</h2>
                <p className="text-xs text-stone-400 mt-0.5">{rfp.sections.length} section{rfp.sections.length !== 1 ? 's' : ''} · {rfp.completion_percent}% complete</p>
              </div>
              {canManage && (
                <button onClick={() => setShowAddSection(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Add Section
                </button>
              )}
            </div>

            {rfp.sections.length === 0 ? (
              <div className="space-y-4">
                {/* Upload zone - primary CTA */}
                {canManage && (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault(); setDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f) handleFileUpload(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center py-14 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-150 ${
                      dragOver
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-stone-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
                    />
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOver ? 'bg-indigo-100' : 'bg-stone-100'}`}>
                      <svg className={`w-7 h-7 transition-colors ${dragOver ? 'text-indigo-500' : 'text-stone-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-stone-700 mb-1">Upload RFP Document</p>
                    <p className="text-xs text-stone-400">Drag and drop or click to browse</p>
                    <p className="text-xs text-stone-300 mt-1">PDF, Word (.docx), Excel (.xlsx) up to 20 MB</p>
                    <div className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                      Browse File
                    </div>
                  </div>
                )}

                {parseError && (
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                    <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="text-xs font-semibold text-rose-700">Could not process document</p>
                      <p className="text-xs text-rose-600 mt-0.5">{parseError}</p>
                    </div>
                  </div>
                )}

                {/* Fallback: add manually */}
                <div className="flex flex-col items-center py-4 text-center">
                  <p className="text-xs text-stone-400">Or add sections manually</p>
                  {canManage && (
                    <button onClick={() => setShowAddSection(true)}
                      className="mt-2 px-4 py-2 bg-white border border-stone-200 text-stone-600 text-xs font-medium rounded-xl hover:bg-stone-50 transition-colors">
                      Add Section Manually
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <motion.div
                initial="hidden" animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                className="space-y-2"
              >
                {rfp.sections.map(sec => {
                  const ss     = SECTION_STATUS[sec.status];
                  const secDays= daysUntil(sec.due_date);
                  const editable = canEdit(sec);

                  return (
                    <motion.div
                      key={sec.id}
                      variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                      onClick={() => setActiveSection(sec)}
                      className="bg-white border rounded-2xl px-4 py-3.5 cursor-pointer hover:shadow-warm-sm transition-all duration-150 hover:border-indigo-200 group"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Done checkbox indicator */}
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                          sec.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-stone-200 group-hover:border-indigo-300'
                        }`}>
                          {sec.status === 'done' && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${sec.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                                {sec.title}
                              </p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                                  {SECTION_TYPES.find(t => t.value === sec.section_type)?.label ?? sec.section_type}
                                </span>
                                {sec.assignee_name && (
                                  <span className="text-xs text-stone-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    {sec.assignee_name}
                                  </span>
                                )}
                                {sec.due_date && (
                                  <span className={`text-xs flex items-center gap-1 ${secDays !== null && secDays <= 2 ? 'text-rose-500' : 'text-stone-400'}`}>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    {secDays === null ? '' : secDays < 0 ? `${Math.abs(secDays)}d overdue` : secDays === 0 ? 'Due today' : `${secDays}d`}
                                  </span>
                                )}
                                {sec.word_limit && sec.content && (
                                  <span className={`text-xs ${wordCount(sec.content) > sec.word_limit ? 'text-rose-500' : 'text-stone-400'}`}>
                                    {wordCount(sec.content)}/{sec.word_limit}w
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`text-xs font-medium flex-shrink-0 ${ss.color}`}>{ss.label}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Comments */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-stone-700 mb-3">Comments</h3>
              <div className="space-y-3">
                {rfp.comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {c.user_name?.slice(0, 2).toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 bg-white border rounded-xl px-3.5 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-stone-700">{c.user_name}</span>
                        <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{c.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 flex gap-2">
                  <input value={comment} onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                    placeholder="Add a comment..."
                    className="flex-1 px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white" />
                  <button onClick={postComment} disabled={postingComment || !comment.trim()}
                    className="px-3.5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40">
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel - Metadata */}
          <div className="hidden xl:flex xl:w-72 flex-shrink-0 border-l flex-col overflow-y-auto px-5 py-5 gap-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-sidebar)' }}>

            {/* Completion ring */}
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#F5F3EE" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#6366F1" strokeWidth="3"
                    strokeDasharray={`${(rfp.completion_percent / 100) * 87.9} 87.9`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-indigo-600">
                  {rfp.completion_percent}%
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">
                  {rfp.sections.filter(s => s.status === 'done').length}/{rfp.sections.length} done
                </p>
                <p className="text-xs text-stone-400 mt-0.5">Sections completed</p>
              </div>
            </div>

            {/* RFP metadata */}
            <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              {[
                { label: 'Client', value: rfp.client_name },
                { label: 'Contact', value: rfp.client_contact_name ?? '-' },
                { label: 'Email', value: rfp.client_contact_email ?? '-' },
                { label: 'Value', value: rfp.estimated_value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: rfp.currency, maximumFractionDigits: 0 }).format(rfp.estimated_value) : '-' },
                { label: 'Deadline', value: rfp.submission_deadline ? new Date(rfp.submission_deadline).toLocaleDateString() : '-' },
                { label: 'Decision by', value: rfp.decision_expected_date ? new Date(rfp.decision_expected_date).toLocaleDateString() : '-' },
                { label: 'Priority', value: rfp.priority.charAt(0).toUpperCase() + rfp.priority.slice(1) },
                { label: 'Source', value: rfp.rfp_source ?? '-' },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-3 text-xs">
                  <span className="text-stone-400 flex-shrink-0">{row.label}</span>
                  <span className="text-stone-700 font-medium text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Days left badge */}
            {days !== null && !['won','lost'].includes(rfp.status) && (
              <div className={`rounded-2xl border p-4 text-center ${days < 0 ? 'bg-rose-50 border-rose-100' : days <= 7 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className={`text-2xl font-bold ${days < 0 ? 'text-rose-600' : days <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {days < 0 ? `${Math.abs(days)}d` : `${days}d`}
                </p>
                <p className={`text-xs mt-1 ${days < 0 ? 'text-rose-500' : days <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {days < 0 ? 'Past deadline' : days === 0 ? 'Due today' : 'Until deadline'}
                </p>
              </div>
            )}

            {rfp.description && (
              <div className="bg-white rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-medium text-stone-500 mb-2">Description</p>
                <p className="text-xs text-stone-600 leading-relaxed">{rfp.description}</p>
              </div>
            )}

            {rfp.linked_project_name && (
              <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
                <p className="text-xs font-medium text-indigo-600 mb-1">Linked Project</p>
                <p className="text-xs text-indigo-700 font-medium">{rfp.linked_project_name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section Drawer */}
      <AnimatePresence>
        {activeSection && (
          <SectionDrawer
            section={activeSection}
            rfpId={rfp.id}
            canEdit={canEdit(activeSection)}
            onClose={() => setActiveSection(null)}
            onSaved={() => { setActiveSection(null); fetchRFP(); }}
            userId={user?.id ?? 0}
          />
        )}
      </AnimatePresence>

      {/* Add Section Modal */}
      <AnimatePresence>
        {showAddSection && (
          <AddSectionModal
            rfpId={rfp.id}
            users={users}
            onClose={() => setShowAddSection(false)}
            onAdded={fetchRFP}
          />
        )}
      </AnimatePresence>

      {/* Hidden file input for re-parse when sections already exist */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
      />

      {/* Parsing progress overlay */}
      <AnimatePresence>
        {parseStep && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="bg-white rounded-3xl shadow-warm-xl w-full max-w-sm mx-4 p-8 flex flex-col items-center text-center"
            >
              {parseStep === 'done' ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4"
                  >
                    <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <p className="text-base font-semibold text-stone-900">Sections Created</p>
                  <p className="text-sm text-stone-400 mt-1">Your RFP has been analysed and sections are ready.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-5 relative">
                    <svg className="w-16 h-16 absolute inset-0 animate-spin" viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="32" r="28" stroke="#E0E7FF" strokeWidth="4" />
                      <path d="M60 32A28 28 0 0 1 32 60" stroke="#6366F1" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <svg className="w-7 h-7 text-indigo-500 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-stone-900 mb-1">
                    {parseStep === 'reading'   && 'Reading document...'}
                    {parseStep === 'analyzing' && 'Analysing with AI...'}
                    {parseStep === 'creating'  && 'Creating sections...'}
                  </p>
                  <p className="text-sm text-stone-400">
                    {parseStep === 'reading'   && 'Extracting text from your file'}
                    {parseStep === 'analyzing' && 'Claude is identifying all requirements'}
                    {parseStep === 'creating'  && 'Saving sections to your RFP'}
                  </p>
                  <div className="flex gap-1.5 mt-5">
                    {(['reading', 'analyzing', 'creating'] as const).map(step => (
                      <div key={step} className={`h-1.5 rounded-full transition-all duration-500 ${
                        parseStep === step ? 'w-6 bg-indigo-500' :
                        ['analyzing','creating'].includes(parseStep) && step === 'reading' ? 'w-3 bg-indigo-300' :
                        parseStep === 'creating' && step === 'analyzing' ? 'w-3 bg-indigo-300' :
                        'w-3 bg-stone-200'
                      }`} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Won / Lost Outcome Modal */}
      <AnimatePresence>
        {outcomeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-warm-xl w-full max-w-md p-6"
            >
              <h2 className={`text-base font-semibold mb-1 ${outcomeModal === 'won' ? 'text-emerald-700' : 'text-rose-600'}`}>
                {outcomeModal === 'won' ? 'Mark RFP as Won' : 'Mark RFP as Lost'}
              </h2>
              <p className="text-sm text-stone-400 mb-4">
                {outcomeModal === 'won' ? 'Great work! Add any notes about the win.' : 'Add notes about why this was lost to improve future responses.'}
              </p>
              <textarea value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)}
                rows={4} placeholder="Add outcome notes (optional)..."
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50 resize-none mb-4" />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setOutcomeModal(null)} className="px-4 py-2.5 text-sm text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleOutcome(outcomeModal)}
                  className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${outcomeModal === 'won' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-500 hover:bg-rose-600'}`}>
                  Confirm {outcomeModal === 'won' ? 'Won' : 'Lost'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RFPDetail;
