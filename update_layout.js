import fs from 'fs';
const content = `import { useState, useEffect } from 'react';
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
    { to: '/', label: 'LOG' },
    { to: '/history', label: 'HISTORY' },
    { to: '/analytics', label: 'ANALYTICS' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0a] text-gray-300 font-sans">
      <header className="flex-shrink-0 h-16 border-b border-gray-800 flex items-center justify-between px-6">
        <div className="font-serif text-2xl tracking-[0.2em] text-gray-100">LOG STATS</div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex text-[10px] tracking-widest text-[#4ade80] font-mono">
            live · {format(now, 'HH:mm:ss')}
          </div>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#111] border border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-[#0a0a0a]">
        <Outlet />
      </main>
      
      <nav className="flex-shrink-0 h-16 border-t border-gray-800 flex items-center bg-[#0a0a0a] justify-center gap-8 px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              \`flex flex-col items-center justify-center gap-1.5 transition-colors \${
                isActive ? 'text-[#fcd34d]' : 'text-gray-600 hover:text-gray-400'
              }\`
            }
          >
            {({ isActive }) => (
              <>
                <div className={\`w-2 h-2 rotate-45 transition-colors \${isActive ? 'bg-[#fcd34d]' : 'bg-transparent border border-gray-600'}\`} />
                <span className="text-[9px] tracking-[0.2em] uppercase font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
`

fs.writeFileSync('src/components/Layout.tsx', content);

let analyticsContent = fs.readFileSync('src/pages/Analytics.tsx', 'utf8');
// Remove the header from Analytics.tsx
analyticsContent = analyticsContent.replace(
  /\{\/\* HEADER \*\/\}\s*<div className="px-6 py-4 flex justify-between items-center border-b border-gray-800">[\s\S]*?<\/div>/,
  ''
);
// Also remove the "min-h-screen pb-24" since Layout handles scroll now, just need "pb-8"
analyticsContent = analyticsContent.replace(
  /className="min-h-screen bg-\[#0a0a0a\] text-gray-300 pb-24 font-sans"/,
  'className="pb-8"'
);
fs.writeFileSync('src/pages/Analytics.tsx', analyticsContent);
