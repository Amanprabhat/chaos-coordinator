import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ForcePasswordChangeModal: React.FC = () => {
  const { user, token, clearMustChangePassword, logout } = useAuth();
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [saving, setSaving]                   = useState(false);

  if (!user?.must_change_password) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || ''}/api/users/${user.id}/change-password`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update password.');
      }

      clearMustChangePassword();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Set Your Password</h2>
              <p className="text-white/70 text-sm">Please choose a new password before continuing.</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={logout}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Sign Out
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChangeModal;
