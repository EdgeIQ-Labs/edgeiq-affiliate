import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface Partner {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  status: string;
  createdAt: string;
}

const badgeColors: Record<string, string> = {
  approved: 'bg-green-900/40 text-green-400',
  pending: 'bg-yellow-900/40 text-yellow-400',
  suspended: 'bg-red-900/40 text-red-400',
};

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState({ email: '', name: '', referral_code: '' });

  const load = () => {
    apiFetch<Partner[]>('/api/admin/partners').then(setPartners).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const createPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/partners', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setForm({ email: '', name: '', referral_code: '' });
    load();
  };

  const updateStatus = async (id: string, status: 'approved' | 'suspended') => {
    await apiFetch(`/api/admin/partners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Partners</h2>

      <form onSubmit={createPartner} className="flex gap-3 mb-6">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          required
        />
        <input
          placeholder="Referral Code"
          value={form.referral_code}
          onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          required
        />
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
          Add Partner
        </button>
      </form>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-text/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Referral Code</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {partners.map((p) => (
              <tr key={p.id} className="hover:bg-surface/50">
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-text/70">{p.email}</td>
                <td className="px-4 py-3 font-mono text-accent">{p.referralCode}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColors[p.status] || ''}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-text/60">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 space-x-2">
                  {p.status !== 'approved' && (
                    <button onClick={() => updateStatus(p.id, 'approved')} className="text-xs text-green-400 hover:underline">Approve</button>
                  )}
                  {p.status !== 'suspended' && (
                    <button onClick={() => updateStatus(p.id, 'suspended')} className="text-xs text-red-400 hover:underline">Suspend</button>
                  )}
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text/40">No partners yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
