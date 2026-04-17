import { NavLink, Link } from 'react-router';
import { PolyforgeLogomark } from '@polyforge/ui';
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
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  DollarSign,
  UserCheck,
  BarChart2,
  Activity,
  Megaphone,
  PieChart,
  Settings2,
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
      { label: 'Retention', path: '/retention', icon: <UserCheck size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Users', path: '/users', icon: <Users size={iconSize} aria-hidden="true" /> },
      { label: 'Segmentation', path: '/users/segmentation', icon: <PieChart size={iconSize} aria-hidden="true" /> },
      { label: 'Approvals', path: '/approvals', icon: <UserCheck size={iconSize} aria-hidden="true" /> },
      { label: 'Strategies', path: '/strategies', icon: <Blocks size={iconSize} aria-hidden="true" /> },
      { label: 'Listings', path: '/listings', icon: <ShoppingBag size={iconSize} aria-hidden="true" /> },
      { label: 'Orders', path: '/orders', icon: <ShoppingCart size={iconSize} aria-hidden="true" /> },
      { label: 'Markets', path: '/markets', icon: <BarChart2 size={iconSize} aria-hidden="true" /> },
      { label: 'Backtests', path: '/backtests', icon: <FlaskConical size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Cache', path: '/cache', icon: <Database size={iconSize} aria-hidden="true" /> },
      { label: 'Reports', path: '/reports', icon: <Flag size={iconSize} aria-hidden="true" /> },
      { label: 'Abuse Detection', path: '/abuse', icon: <ShieldAlert size={iconSize} aria-hidden="true" /> },
      { label: 'Logs', path: '/logs', icon: <ScrollText size={iconSize} aria-hidden="true" /> },
      { label: 'Health', path: '/health', icon: <Activity size={iconSize} aria-hidden="true" /> },
      { label: 'Sentiment', path: '/sentiment', icon: <TrendingUp size={iconSize} aria-hidden="true" /> },
      { label: 'Platform Config', path: '/config', icon: <Settings2 size={iconSize} aria-hidden="true" /> },
    ],
  },
  {
    title: 'Programs',
    items: [
      { label: 'Builder', path: '/builder', icon: <Hammer size={iconSize} aria-hidden="true" /> },
      { label: 'Invites', path: '/invites', icon: <Mail size={iconSize} aria-hidden="true" /> },
      { label: 'Tickets', path: '/tickets', icon: <TicketCheck size={iconSize} aria-hidden="true" /> },
      { label: 'Broadcasts', path: '/broadcasts', icon: <Megaphone size={iconSize} aria-hidden="true" /> },
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
      className="flex flex-col h-full border-r border-default bg-admin-sidebar border-t-4 border-t-loss"
    >
      {/* Brand */}
      <div className="flex items-center gap-2 h-14 px-3 border-b border-default shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0" aria-label="Polyforge Admin home">
          <PolyforgeLogomark size={28} className="shrink-0 text-accent" />
          {!collapsed && (
            <span className="text-body-sm font-semibold text-primary whitespace-nowrap">
              Polyforge{' '}
              <span className="text-accent">Admin</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto p-2 rounded-sm hover:bg-elevated border border-default text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                <div className="px-2 py-2 text-caption font-semibold uppercase tracking-wider text-tertiary">
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
                    `flex items-center gap-3 px-3 py-2 rounded-sm text-body-sm transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isActive
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-secondary hover:bg-elevated hover:text-primary'
                    }`
                  }
                >
                  <span className="shrink-0 relative">
                    {item.icon}
                    {collapsed && item.label === 'Tickets' && openTickets > 0 && (
                      <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent text-caption font-semibold text-inverse" aria-label={`${openTickets} open tickets`}>
                        {openTickets}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.label === 'Tickets' && openTickets > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-2 rounded-full bg-accent text-caption font-semibold text-inverse" aria-label={`${openTickets} open tickets`}>
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
      <div className="border-t border-default px-3 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-elevated text-accent text-label font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-body-sm font-medium text-primary truncate">
                {admin?.displayName}
              </div>
              <div className="flex items-center gap-2 text-label text-tertiary">
                {roleLabel}
                <span className="px-2 py-1 rounded-sm bg-loss/[0.12] text-loss text-caption font-semibold uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
