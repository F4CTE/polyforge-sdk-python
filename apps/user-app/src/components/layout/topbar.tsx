import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sun, Moon, Bell, ChevronDown, User, Settings, LogOut, Keyboard } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { useNotificationStore } from '@/stores/notification-store';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function Topbar() {
  const { user, logout } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const notifications = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const initials = user
    ? (user.displayName ?? user.username).slice(0, 2).toUpperCase()
    : '?';

  const displayName = user?.displayName ?? user?.username ?? '';
  const unread = unreadCount();

  return (
    <header className="flex items-center h-12 px-4 border-b border-default bg-surface">
      <div className="flex-1" />

      {/* Keyboard shortcuts button */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-secondary hover:bg-elevated hover:text-primary active:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={18} />
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        data-tour="theme-toggle"
        onClick={toggleTheme}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-secondary hover:bg-elevated hover:text-primary active:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Notification bell */}
      <div className="relative" ref={notifRef} data-tour="notification-bell">
        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-secondary hover:bg-elevated hover:text-primary active:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="Notifications"
          aria-expanded={notifOpen}
          aria-haspopup="dialog"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-caption font-semibold text-primary bg-loss rounded-full" aria-label={`${unread} unread notifications`}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
          {/* WebSocket active indicator */}
          <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-gain animate-pulse-dot" aria-hidden="true" />
          <span className="sr-only">Connected</span>
        </button>

        {notifOpen && (
          <div role="dialog" aria-label="Notifications" className="animate-slide-up absolute right-0 top-12 w-80 bg-elevated border border-default rounded-pf shadow-xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-default">
              <strong className="text-body-md text-primary">Notifications</strong>
              <button
                type="button"
                onClick={markAllRead}
                className="text-label text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-sm"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-tertiary text-body-sm py-6">
                  No notifications
                </p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                      !n.read ? 'bg-accent-subtle' : ''
                    }`}
                    aria-label={`${n.read ? '' : 'Unread: '}${n.title}`}
                  >
                    <span
                      className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                        n.severity === 'error'
                          ? 'bg-loss'
                          : n.severity === 'warning'
                            ? 'bg-warning'
                            : n.severity === 'success'
                              ? 'bg-gain'
                              : 'bg-accent'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="text-body-md text-primary block truncate">
                        {n.title}
                      </strong>
                      <p className="text-label text-tertiary truncate">
                        {n.body}
                      </p>
                      <span className="text-caption text-tertiary/70" title={new Date(n.timestamp).toLocaleString()}>
                        {timeAgo(n.timestamp)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setNotifOpen(false);
                navigate('/settings');
              }}
              className="block w-full text-center text-label text-accent-text py-3 border-t border-default hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              Manage notification preferences
            </button>
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative ml-2" ref={menuRef}>
        <button
          type="button"
          data-testid="user-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 p-1 rounded-sm hover:bg-elevated active:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="User menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className="w-8 h-8 rounded-full bg-accent/20 text-accent-text flex items-center justify-center text-label font-semibold">
            {initials}
          </div>
          <span className="text-body-md text-primary hidden sm:inline">
            {displayName}
          </span>
          <ChevronDown size={14} className="text-secondary" />
        </button>

        {menuOpen && (
          <div role="menu" className="animate-slide-up absolute right-0 top-12 w-48 bg-elevated border border-default rounded-pf shadow-xl z-50 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile/me');
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-body-md text-primary hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <User size={16} />
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/settings');
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-body-md text-primary hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <Settings size={16} />
              Settings
            </button>
            <div className="border-t border-default my-1" role="separator" />
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex items-center gap-2 w-full px-4 py-2 text-body-md text-loss hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
