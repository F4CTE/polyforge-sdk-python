import { NavLink, Link } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Blocks,
  ShoppingBag,
  ShoppingCart,
  FlaskConical,
  Database,
  Flag,
  ScrollText,
  Hammer,
  TicketCheck,
  Mail,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  DollarSign,
  UserCheck,
} from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
import { usePollingStore } from '@/stores/polling-store';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
  superAdminOnly?: boolean;
}

const iconSize = 18;

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={iconSize} aria-hidden="true" /> },
      { label: 'Revenue', path: '/revenue', icon: <DollarSign size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Users', path: '/users', icon: <Users size={iconSize} aria-hidden="true" /> },
      { label: 'Approvals', path: '/approvals', icon: <UserCheck size={iconSize} aria-hidden="true" /> },
      { label: 'Strategies', path: '/strategies', icon: <Blocks size={iconSize} aria-hidden="true" /> },
      { label: 'Listings', path: '/listings', icon: <ShoppingBag size={iconSize} aria-hidden="true" /> },
      { label: 'Orders', path: '/orders', icon: <ShoppingCart size={iconSize} aria-hidden="true" /> },
      { label: 'Backtests', path: '/backtests', icon: <FlaskConical size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Cache', path: '/cache', icon: <Database size={iconSize} aria-hidden="true" /> },
      { label: 'Reports', path: '/reports', icon: <Flag size={iconSize} aria-hidden="true" /> },
      { label: 'Logs', path: '/logs', icon: <ScrollText size={iconSize} aria-hidden="true" /> },
      { label: 'Sentiment', path: '/sentiment', icon: <TrendingUp size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'Programs',
    items: [
      { label: 'Builder', path: '/builder', icon: <Hammer size={iconSize} aria-hidden="true" /> },
      { label: 'Invites', path: '/invites', icon: <Mail size={iconSize} aria-hidden="true" /> },
      { label: 'Tickets', path: '/tickets', icon: <TicketCheck size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'Access',
    superAdminOnly: true,
    items: [
      { label: 'Admins', path: '/admins', icon: <ShieldCheck size={iconSize} aria-hidden="true" /> },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function AdminSidebar({ collapsed, onToggle, onNavigate }: Props) {
  const { isSuperAdmin, admin } = useAdminAuthStore();
  const openTickets = usePollingStore((s) => s.openTickets);
  const initials = admin?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';
  const roleLabel =
    admin?.role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : admin?.role === 'ADMIN'
        ? 'Admin'
        : 'Viewer';

  return (
    <aside
      aria-label="Admin sidebar"
      className="flex flex-col h-full border-r border-pf-border bg-pf-surface"
    >
      {/* Brand */}
      <div className="flex items-center gap-2 h-14 px-3 border-b border-pf-border shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0" aria-label="Polyforge Admin home">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
            <path
              d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
              stroke="var(--color-pf-cyan-500)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.4"
            />
            <path
              d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z"
              fill="var(--color-pf-cyan-500)"
            />
          </svg>
          {!collapsed && (
            <span className="text-sm font-semibold text-pf-text whitespace-nowrap">
              Polyforge{' '}
              <span className="text-pf-cyan-500">Admin</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-pf-sm hover:bg-pf-elevated border border-pf-border text-pf-text-secondary hover:text-pf-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1" aria-label="Admin navigation">
        {navSections.map((section) => {
          if (section.superAdminOnly && !isSuperAdmin) return null;
          return (
            <div key={section.title} className="mb-2">
              {!collapsed && (
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-pf-text-tertiary">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-pf-sm text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 ${
                      isActive
                        ? 'bg-pf-cyan-500/10 text-pf-cyan-500 font-medium'
                        : 'text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text'
                    }`
                  }
                >
                  <span className="shrink-0 relative">
                    {item.icon}
                    {collapsed && item.label === 'Tickets' && openTickets > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded-full bg-pf-cyan-500 text-[8px] font-bold text-black" aria-label={`${openTickets} open tickets`}>
                        {openTickets}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.label === 'Tickets' && openTickets > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-pf-cyan-500 text-[10px] font-bold text-black" aria-label={`${openTickets} open tickets`}>
                          {openTickets}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-pf-border px-3 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-pf-elevated text-pf-cyan-500 text-[11px] font-bold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-medium text-pf-text truncate">
                {admin?.displayName}
              </div>
              <div className="text-[11px] text-pf-text-tertiary">
                {roleLabel}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
