import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface Payout {
  partner_id: string;
  partner_name: string;
  partner_email: string;
  pending_amount_cents: number;
}

export default function Payouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const load = () => {
    apiFetch<Payout[]>('/api/admin/payouts').then(setPayouts).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (partnerId: string) => {
    await apiFetch(`/api/admin/payouts/${partnerId}/mark-paid`, { method: 'POST' });
    load();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Payout Queue</h2>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-text/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Partner Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Pending Amount</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.map((p) => (
              <tr key={p.partner_id} className="hover:bg-surface/50">
                <td className="px-4 py-3">{p.partner_name}</td>
                <td className="px-4 py-3 text-text/70">{p.partner_email}</td>
                <td className="px-4 py-3 font-semibold text-accent">
                  ${(p.pending_amount_cents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => markPaid(p.partner_id)}
                    className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition"
                  >
                    Mark as Paid
                  </button>
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text/40">No pending payouts</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
