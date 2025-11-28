import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Menu, X, Settings as SettingsIcon } from 'lucide-react';
import clsx from 'clsx';
import Dashboard from './pages/Dashboard';
import TradingLog from './pages/TradingLog';
import { useStore } from './store/useStore';
import { SettingsModal } from './components/SettingsModal';

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
  const { settings } = useStore();

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
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-full bg-background p-4 rounded-lg border border-border hover:border-primary transition-colors text-left flex items-center justify-between group"
          >
            <div>
              <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Settings</p>
              <div className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                Configure App
              </div>
            </div>
            <SettingsIcon className="w-4 h-4 text-gray-500 group-hover:text-primary" />
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-surface border-b border-border z-20 px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-bold text-white">Sports Trader Pro</h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => setSettingsOpen(true)}>
             <SettingsIcon className="w-5 h-5 text-gray-300" />
          </button>
          <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
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

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<TradingLog />} /> {/* Default to Log */}
          <Route path="/trading-log" element={<TradingLog />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;