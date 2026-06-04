import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  HomeIcon, PencilSquareIcon, CircleStackIcon,
  ChartBarIcon, CreditCardIcon, Cog6ToothIcon, Bars3Icon,
  XMarkIcon, ArrowRightOnRectangleIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { ProBadge } from '../UI/ProGate';

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',     icon: HomeIcon },
  { to: '/exams/new',   label: 'New Exam',       icon: PencilSquareIcon },
  { to: '/questions',   label: 'Question Bank',  icon: CircleStackIcon },
  { to: '/results',     label: 'Results',        icon: ChartBarIcon },
];

const bottomNav = [
  { to: '/billing',  label: 'Billing & Plan', icon: CreditCardIcon },
  { to: '/settings', label: 'Settings',       icon: Cog6ToothIcon },
];

const planColours = {
  free:   'bg-slate-700 text-slate-300',
  pro:    'bg-primary-600 text-white',
  school: 'bg-purple-600 text-white',
};

function NavItem({ to, label, icon: Icon, pro }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
         ${isActive
           ? 'bg-primary-600 text-white'
           : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {pro && <ProBadge />}
    </NavLink>
  );
}

export default function AppShell() {
  const { teacher, logout, isPro } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const Sidebar = () => (
    <aside className="w-64 bg-slate-900 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800 flex items-center justify-between">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Gradispace</span>
        </NavLink>
        {/* Mobile close button */}
        <button
          className="lg:hidden text-slate-400 hover:text-white"
          onClick={() => setSidebarOpen(false)}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Bottom nav + user */}
      <div className="px-3 pb-4 space-y-1 border-t border-slate-800 pt-3">
        {bottomNav.map(item => (
          <NavItem key={item.to} {...item} />
        ))}

        {/* Free plan upgrade nudge */}
        {!isPro && (
          <div className="mt-3 mx-1 bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400 mb-2">
              Unlock analytics, branding &amp; more
            </p>
            <button
              onClick={() => navigate('/billing')}
              className="w-full text-center text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white py-1.5 rounded-md transition-colors"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        {/* Teacher profile row */}
        <div className="mt-3 flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {teacher?.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{teacher?.name}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${planColours[teacher?.plan] || planColours.free}`}>
              {teacher?.plan || 'free'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-64 flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — mobile only */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-900"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Gradispace</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
