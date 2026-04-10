import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  project_id?: number;
  task_id?: number;
  is_read: boolean;
  created_at: string;
}

interface Props {
  userId: number;
  /** 'dark' = designed for dark sidebars/navbars; 'light' = designed for white headers */
  theme?: 'dark' | 'light';
}

const TYPE_ICON: Record<string, { bg: string; icon: React.ReactNode }> = {
  task_overdue: {
    bg: 'bg-red-100',
    icon: (
      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  task_nudge_manager: {
    bg: 'bg-orange-100',
    icon: (
      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  project_approved: {
    bg: 'bg-emerald-100',
    icon: (
      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  project_rejected: {
    bg: 'bg-red-100',
    icon: (
      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NotificationBell: React.FC<Props> = ({ userId, theme = 'dark' }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/notifications?user_id=${userId}&limit=20`);
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: number) => {
    await fetch(`http://localhost:3001/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch(`http://localhost:3001/api/notifications/read-all?user_id=${userId}`, { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const defaultIcon = {
    bg: 'bg-indigo-100',
    icon: (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  };

  const btnBase = theme === 'dark'
    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100';

  return (
    <>
      {/* Bell shake keyframe — injected once */}
      <style>{`
        @keyframes bell-ring {
          0%,100%{transform:rotate(0)}
          10%{transform:rotate(-18deg)}
          20%{transform:rotate(18deg)}
          30%{transform:rotate(-12deg)}
          40%{transform:rotate(12deg)}
          50%{transform:rotate(-6deg)}
          60%{transform:rotate(6deg)}
          70%{transform:rotate(0)}
        }
        .bell-ring { animation: bell-ring 1.2s ease-in-out; }
        .bell-ring-pulse { animation: bell-ring 1.2s ease-in-out infinite; animation-delay: 0.3s; }
      `}</style>

      <div ref={ref} className="relative">
        {/* Bell button */}
        <button
          onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
          className={`relative p-2 rounded-lg transition-colors ${btnBase}`}
          aria-label="Notifications"
        >
          {/* Animated ring behind bell when unread */}
          {unreadCount > 0 && (
            <span className="absolute inset-0 rounded-lg bg-red-400/20 animate-ping pointer-events-none" />
          )}

          <svg
            className={`w-5 h-5 ${unreadCount > 0 ? 'bell-ring-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>

          {/* Unread badge — sits on top of the bell */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md ring-2 ring-white/20">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel — attached right below bell */}
        {open && (
          <div className="absolute right-0 top-[calc(100%+4px)] w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            {/* Tiny arrow pointing up to bell */}
            <div className="absolute -top-2 right-3 w-4 h-2 overflow-hidden">
              <div className="w-4 h-4 bg-white border border-gray-100 rotate-45 translate-y-1 shadow" />
            </div>

            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
              <div>
                <p className="text-sm font-bold text-gray-900">Notifications</p>
                {unreadCount > 0 && (
                  <p className="text-xs text-gray-400">{unreadCount} unread</p>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">All caught up!</p>
                  <p className="text-xs text-gray-400 mt-1">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const { bg, icon } = TYPE_ICON[n.type] ?? defaultIcon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        n.is_read ? 'bg-white' : 'bg-indigo-50/60 hover:bg-indigo-50 cursor-pointer'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${n.is_read ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 whitespace-pre-line">{n.message}</p>
                        <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationBell;
