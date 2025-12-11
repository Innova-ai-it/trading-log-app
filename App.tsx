import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Menu, X, Settings as SettingsIcon, LogOut, FileText, BarChart3, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import Dashboard from './pages/Dashboard';
import TradingLog from './pages/TradingLog';
import MonthlyReport from './pages/MonthlyReport';
import Strategies from './pages/Strategies';
import DailyPlan from './pages/DailyPlan';
import { useSupabaseStore } from './store/useSupabaseStore';
import { SettingsModal } from './components/SettingsModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
        isActive 
          ? "bg-primary text-white shadow-lg shadow-blue-500/20" 
          : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const { settings, syncing } = useSupabaseStore();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-white flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface fixed h-full z-10">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Sports Trader Pro
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavLink to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
          <NavLink to="/trading-log" icon={<List className="w-5 h-5" />} label="Trading Log" />
          <NavLink to="/strategies" icon={<BarChart3 className="w-5 h-5" />} label="Strategies" />
          <NavLink to="/daily-plan" icon={<Sparkles className="w-5 h-5" />} label="Daily Plan" />
          <NavLink to="/monthly-report" icon={<FileText className="w-5 h-5" />} label="Monthly Report" />
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          {/* Sync Status */}
          {syncing && (
            <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-400">Syncing...</p>
            </div>
          )}
          
          {/* User Info */}
          {user && (
            <div className="px-3 py-2 bg-background rounded-lg border border-border">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm text-white truncate">{user.email}</p>
            </div>
          )}
          
          {/* Settings Button */}
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-full bg-background p-3 rounded-lg border border-border hover:border-primary transition-colors text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-gray-500 group-hover:text-primary" />
              <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                Settings
              </span>
            </div>
          </button>
          
          {/* Logout Button */}
          <button 
            onClick={() => signOut()}
            className="w-full bg-red-500/10 p-3 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-colors text-left flex items-center gap-2 group"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-surface border-b border-border z-20 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Sports Trader Pro</h1>
          {syncing && <span className="text-xs text-blue-400">Syncing...</span>}
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => setSettingsOpen(true)} className="text-gray-300 hover:text-white">
             <SettingsIcon className="w-5 h-5" />
          </button>
          <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-300 hover:text-white">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-background z-10 pt-16 px-4 md:hidden">
           <nav className="space-y-2">
            <div onClick={() => setMobileMenuOpen(false)}>
              <NavLink to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
            </div>
            <div onClick={() => setMobileMenuOpen(false)}>
              <NavLink to="/trading-log" icon={<List className="w-5 h-5" />} label="Trading Log" />
            </div>
            <div onClick={() => setMobileMenuOpen(false)}>
              <NavLink to="/strategies" icon={<BarChart3 className="w-5 h-5" />} label="Strategies" />
            </div>
            <div onClick={() => setMobileMenuOpen(false)}>
              <NavLink to="/daily-plan" icon={<Sparkles className="w-5 h-5" />} label="Daily Plan" />
            </div>
            <div onClick={() => setMobileMenuOpen(false)}>
              <NavLink to="/monthly-report" icon={<FileText className="w-5 h-5" />} label="Monthly Report" />
            </div>
            
            {/* Mobile Logout */}
            <button 
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 overflow-x-hidden">
        {children}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { fetchAll } = useSupabaseStore();

  // Fetch all data when user logs in
  useEffect(() => {
    if (user) {
      fetchAll();
    }
  }, [user, fetchAll]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login page
  if (!user) {
    return <Auth />;
  }

  // Authenticated - show main app
  return (
    <Router>
      <Layout>
            <Routes>
              <Route path="/" element={<TradingLog />} />
              <Route path="/trading-log" element={<TradingLog />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/strategies" element={<Strategies />} />
              <Route path="/daily-plan" element={<DailyPlan />} />
              <Route path="/monthly-report" element={<MonthlyReport />} />
            </Routes>
      </Layout>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;