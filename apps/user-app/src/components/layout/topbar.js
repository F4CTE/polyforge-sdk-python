import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sun, Moon, Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { useNotificationStore } from '@/stores/notification-store';
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
    const notifRef = useRef(null);
    const menuRef = useRef(null);
    // Close dropdowns on outside click
    useEffect(() => {
        function handleClick(e) {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);
    const initials = user
        ? (user.displayName ?? user.username).slice(0, 2).toUpperCase()
        : '?';
    const displayName = user?.displayName ?? user?.username ?? '';
    const unread = unreadCount();
    return (_jsxs("header", { className: "flex items-center h-14 px-4 border-b border-pf-border bg-pf-surface", children: [_jsx("div", { className: "flex-1" }), _jsx("button", { onClick: toggleTheme, className: "p-2 rounded-pf-sm text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text transition-colors", "aria-label": isDark ? 'Switch to light mode' : 'Switch to dark mode', children: isDark ? _jsx(Sun, { size: 18 }) : _jsx(Moon, { size: 18 }) }), _jsxs("div", { className: "relative", ref: notifRef, children: [_jsxs("button", { onClick: () => setNotifOpen((v) => !v), className: "relative p-2 rounded-pf-sm text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text transition-colors", "aria-label": "Notifications", "aria-expanded": notifOpen, children: [_jsx(Bell, { size: 18 }), unread > 0 && (_jsx("span", { className: "absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-pf-danger rounded-full", children: unread > 9 ? '9+' : unread })), _jsx("span", { className: "absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-pf-success animate-pulse-dot" })] }), notifOpen && (_jsxs("div", { className: "animate-slide-up absolute right-0 top-12 w-80 bg-pf-elevated border border-pf-border rounded-pf shadow-xl z-50", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-pf-border", children: [_jsx("strong", { className: "text-sm text-pf-text", children: "Notifications" }), _jsx("button", { onClick: markAllRead, className: "text-xs text-pf-cyan-400 hover:underline", children: "Mark all read" })] }), _jsx("div", { className: "max-h-80 overflow-y-auto", children: notifications.length === 0 ? (_jsx("p", { className: "text-center text-pf-text-muted text-sm py-6", children: "No notifications" })) : (notifications.slice(0, 8).map((n) => (_jsxs("div", { onClick: () => markRead(n.id), role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                                        markRead(n.id); }, className: `flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-pf-surface transition-colors ${!n.read ? 'bg-pf-cyan-500/5' : ''}`, children: [_jsx("span", { className: `mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.severity === 'error'
                                                ? 'bg-pf-danger'
                                                : n.severity === 'warning'
                                                    ? 'bg-yellow-500'
                                                    : n.severity === 'success'
                                                        ? 'bg-pf-success'
                                                        : 'bg-pf-cyan-500'}` }), _jsxs("div", { className: "min-w-0", children: [_jsx("strong", { className: "text-sm text-pf-text block truncate", children: n.title }), _jsx("p", { className: "text-xs text-pf-text-muted truncate", children: n.body })] })] }, n.id)))) }), _jsx("button", { onClick: () => {
                                    setNotifOpen(false);
                                    navigate('/settings');
                                }, className: "block w-full text-center text-xs text-pf-cyan-400 py-3 border-t border-pf-border hover:bg-pf-surface transition-colors", children: "Manage notification preferences" })] }))] }), _jsxs("div", { className: "relative ml-2", ref: menuRef, children: [_jsxs("button", { "data-testid": "user-menu-btn", onClick: () => setMenuOpen((v) => !v), className: "flex items-center gap-2 p-1 rounded-pf-sm hover:bg-pf-elevated transition-colors", "aria-label": "User menu", "aria-expanded": menuOpen, children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-pf-cyan-500/20 text-pf-cyan-400 flex items-center justify-center text-xs font-semibold", children: initials }), _jsx("span", { className: "text-sm text-pf-text hidden sm:inline", children: displayName }), _jsx(ChevronDown, { size: 14, className: "text-pf-text-secondary" })] }), menuOpen && (_jsxs("div", { className: "animate-slide-up absolute right-0 top-12 w-48 bg-pf-elevated border border-pf-border rounded-pf shadow-xl z-50 py-1", children: [_jsxs("button", { onClick: () => {
                                    setMenuOpen(false);
                                    navigate('/profile/me');
                                }, className: "flex items-center gap-2 w-full px-4 py-2 text-sm text-pf-text hover:bg-pf-surface transition-colors", children: [_jsx(User, { size: 16 }), "Profile"] }), _jsxs("button", { onClick: () => {
                                    setMenuOpen(false);
                                    navigate('/settings');
                                }, className: "flex items-center gap-2 w-full px-4 py-2 text-sm text-pf-text hover:bg-pf-surface transition-colors", children: [_jsx(Settings, { size: 16 }), "Settings"] }), _jsx("div", { className: "border-t border-pf-border my-1" }), _jsxs("button", { onClick: logout, className: "flex items-center gap-2 w-full px-4 py-2 text-sm text-pf-danger hover:bg-pf-surface transition-colors", children: [_jsx(LogOut, { size: 16 }), "Sign out"] })] }))] })] }));
}
