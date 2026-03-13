import { Radar, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'dashboard' | 'profile';
  onNavigate: (page: 'dashboard' | 'profile') => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10 px-6 py-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onNavigate('dashboard')}
          >
            <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
               <Radar className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              InternRadar
            </h1>
          </div>
          
          {user && (
            <div className="flex items-center gap-6">
              <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
                <button 
                  onClick={() => onNavigate('dashboard')}
                  className={`${currentPage === 'dashboard' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => onNavigate('profile')}
                  className={`${currentPage === 'profile' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
                >
                  Profile
                </button>
              </nav>

              <div className="w-px h-6 bg-border hidden sm:block"></div>

              <div className="flex items-center gap-4">
                <div 
                  className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => onNavigate('profile')}
                >
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-border" />
                  <span className="font-medium hidden sm:inline">{user.displayName}</span>
                </div>
                <button 
                  onClick={logout}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors ml-2"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Mobile Nav */}
        {user && (
          <div className="flex sm:hidden justify-center gap-6 mt-4 pt-4 border-t border-border text-sm font-medium">
            <button 
              onClick={() => onNavigate('dashboard')}
              className={`${currentPage === 'dashboard' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'} pb-1 transition-colors`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => onNavigate('profile')}
              className={`${currentPage === 'profile' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'} pb-1 transition-colors`}
            >
              Profile
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
