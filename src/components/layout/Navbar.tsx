import { Link, useLocation } from 'react-router-dom';
import { Radar, LogOut, LayoutDashboard, BarChart2, User, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/analytics', label: 'Analytics', icon: BarChart2 },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <header className="border-b bg-card/80 backdrop-blur-md shadow-sm sticky top-0 z-50 pt-[max(env(safe-area-inset-top),_0px)] md:pt-0">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-2 sm:py-3 mt-1 md:mt-0">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
            <Radar className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            InternRadar
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-4 py-2 rounded-lg transition-colors ${
                pathname === to
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border-2 border-primary/20" />
              <span className="text-sm font-medium hidden md:inline">{user.displayName?.split(' ')[0]}</span>
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/dashboard"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
        )}
      </div>

      {/* Mobile Nav — no side padding, stretches full width */}
      <nav className="flex sm:hidden items-center justify-around py-2 border-t border-border text-sm font-medium">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 ${
              pathname === to ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
