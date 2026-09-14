import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface Conversion {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  planId: string;
  amountCents: number;
  commissionCents: number;
  status: string;
  createdAt: string;
}

export default function Conversions() {
  const [rows, setRows] = useState<Conversion[]>([]);
  const [filter, setFilter] = useState('');

  const load = () => {
    const qs = filter ? `?partner_id=${filter}` : '';
    apiFetch<Conversion[]>(`/api/admin/conversions${qs}`).then(setRows).catch(() => {});
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Conversions</h2>

      <div className="mb-4">
        <input
          placeholder="Filter by partner ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent w-64"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-text/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Partner</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Commission</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface/50">
                <td className="px-4 py-3">{r.partnerName || r.partnerEmail || r.partnerId}</td>
                <td className="px-4 py-3 font-mono text-accent">{r.planId}</td>
                <td className="px-4 py-3">${(r.amountCents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">${(r.commissionCents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.status === 'paid' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-text/60">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text/40">No conversions</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
