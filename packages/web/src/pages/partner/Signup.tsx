import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPartnerToken } from '../../lib/partner-api.js';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/partner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      if (res.status === 409) {
        setError('An account with this email already exists.');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Registration failed');
        return;
      }

      const data = await res.json();
      setPartnerToken(data.token);
      navigate('/portal/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-text mb-1">Partner Signup</h2>
        <p className="text-sm text-text/60 mb-6">Join the Relay affiliate program</p>

        {error && (
          <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text/70 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-border bg-bg px-3 py-2 text-text focus:outline-none focus:border-accent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text/70 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border border-border bg-bg px-3 py-2 text-text focus:outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded bg-accent py-2 font-semibold text-bg hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}
