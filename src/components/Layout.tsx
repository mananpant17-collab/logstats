import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../App';
import { format } from 'date-fns';

export default function Layout() {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };
  
  const navItems = [
    { to: '/', label: 'LOG', icon: '✦' },
    { to: '/history', label: 'HISTORY', icon: '≡' },
    { to: '/analytics', label: 'ANALYTICS', icon: '◈' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary text-text-primary font-sans">
      <header className="flex-shrink-0 h-[52px] border-b-[0.5px] border-border-subtle flex items-center justify-between px-5 bg-bg-primary">
        <div className="font-serif text-xl font-normal tracking-[0.3em] text-text-primary">LOG STATS</div>
        <div className="flex items-center gap-3">
          <div className="flex text-[9px] tracking-[0.05em] text-accent-green font-mono">
            live · {format(now, 'HH:mm:ss')}
          </div>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full bg-transparent border-[0.5px] border-border-strong text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-bg-primary">
        <Outlet />
      </main>
      
      <nav className="flex-shrink-0 h-14 border-t-[0.5px] border-border-subtle flex items-center bg-bg-primary justify-center gap-8 px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1.5 transition-colors ${
                isActive ? 'text-accent-amber' : 'text-text-tertiary hover:text-text-secondary'
              }`
            }
          >
            {() => (
              <>
                <span className="text-[17px] leading-none">{item.icon}</span>
                <span className="text-[9px] tracking-[0.2em] uppercase font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
