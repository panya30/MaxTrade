/**
 * Layout Component
 * Main application layout with navigation
 */

import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/screener', label: 'Screener', icon: '🔍' },
  { path: '/strategies', label: 'Strategies', icon: '📈' },
  { path: '/portfolio', label: 'Portfolio', icon: '💼' },
  { path: '/ai', label: 'AI Assistant', icon: '🤖' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-text">
            <span className="text-primary">Max</span>Trade
          </h1>
          <p className="text-xs text-text-muted mt-1">AI-Powered Trading</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-bg-hover hover:text-text'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">User</p>
              <p className="text-xs text-text-muted">Paper Trading</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-text">
            {navItems.find((item) => item.path === location.pathname)?.label ?? 'MaxTrade'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <div className="w-2 h-2 rounded-full bg-success" title="API Connected" />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
