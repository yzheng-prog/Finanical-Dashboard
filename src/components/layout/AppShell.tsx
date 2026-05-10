// ============================================================
// AppShell — Fixed left sidebar (desktop) + bottom nav (mobile)
// Per doc 04 §7 Navigation
// ============================================================

import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',         icon: '🏠', label: 'Dashboard' },
  { to: '/holdings', icon: '📊', label: 'Holdings'  },
  { to: '/goals',    icon: '🎯', label: 'Goals'     },
  { to: '/accounts', icon: '🏦', label: 'Accounts'  },
  { to: '/watchlist', icon: '👀', label: 'Watchlist' },
  { to: '/insights',  icon: '🔍', label: 'Insights' },
  { to: '/news',      icon: '📰', label: 'News'     },
  { to: '/advisor',   icon: '🤖', label: 'Advisor'  },
];

const BOTTOM_ITEMS = NAV_ITEMS.slice(0, 5); // Dashboard, Holdings, Goals, Accounts, Watchlist

function NavItem({ to, icon, label, mobile }: { to: string; icon: string; label: string; mobile?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        mobile
          ? `flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-brand' : 'text-subtext hover:text-maintext'
            }`
          : `flex items-center gap-3 px-4 py-2.5 rounded-button text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand text-white'
                : 'text-subtext hover:bg-divider hover:text-maintext'
            }`
      }
    >
      <span className={mobile ? 'text-lg' : 'text-base'} aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-border shadow-nav shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-border">
          <span className="text-brand font-bold text-lg tracking-tight">
            📈 InvestCA
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Bottom links */}
        <div className="px-3 py-4 border-t border-border space-y-1">
          <NavItem to="/settings" icon="⚙️" label="Settings" />
          <NavItem to="/profile"  icon="👤" label="Profile"  />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-center h-16 z-10"
        aria-label="Mobile navigation"
      >
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} mobile />
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-brand' : 'text-subtext hover:text-maintext'
            }`
          }
        >
          <span aria-hidden="true" className="text-lg">⚙️</span>
          <span>More</span>
        </NavLink>
      </nav>
    </div>
  );
}
