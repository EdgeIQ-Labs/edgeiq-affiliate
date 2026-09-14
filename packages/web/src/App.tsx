import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getToken, setToken } from './lib/api.js';
import Dashboard from './pages/Dashboard.js';
import Partners from './pages/Partners.js';
import Conversions from './pages/Conversions.js';
import Rules from './pages/Rules.js';
import Payouts from './pages/Payouts.js';

function AuthModal({ onSubmit }: { onSubmit: () => void }) {
  const [token, setTokenInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      setToken(token.trim());
      onSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-8 shadow-xl w-full max-w-sm">
        <h2 className="text-xl font-bold text-text mb-4">Admin Authentication</h2>
        <p className="text-sm text-text/60 mb-4">Enter your admin API token to continue.</p>
        <input
          type="password"
          value={token}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Admin secret token"
          className="w-full rounded border border-border bg-bg px-3 py-2 text-text mb-4 focus:outline-none focus:border-accent"
          autoFocus
        />
        <button type="submit" className="w-full rounded bg-accent py-2 font-semibold text-bg hover:opacity-90 transition">
          Authenticate
        </button>
      </form>
    </div>
  );
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/partners', label: 'Partners' },
  { to: '/conversions', label: 'Conversions' },
  { to: '/rules', label: 'Rules' },
  { to: '/payouts', label: 'Payouts' },
];

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());

  useEffect(() => {
    const handler = () => setAuthed(false);
    window.addEventListener('relay:unauthorized', handler);
    return () => window.removeEventListener('relay:unauthorized', handler);
  }, []);

  if (!authed) {
    return <AuthModal onSubmit={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-bg text-text">
        <aside className="w-56 border-r border-border bg-surface flex flex-col">
          <div className="px-5 py-6 border-b border-border">
            <h1 className="text-lg font-bold tracking-tight text-accent">Relay Admin</h1>
            <p className="text-xs text-text/50 mt-1">EdgeIQ Labs</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-accent/10 text-accent' : 'text-text/70 hover:bg-surface hover:text-text'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-8 overflow-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/conversions" element={<Conversions />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/payouts" element={<Payouts />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
