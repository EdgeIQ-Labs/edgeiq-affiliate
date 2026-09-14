import { useEffect, useState } from 'react';
import { partnerFetch } from '../../lib/partner-api.js';

interface ConversionRecord {
  plan_id: string;
  amount_cents: number;
  commission_cents: number;
  status: string;
  created_at: string;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  paid: 'bg-green-500/10 text-green-400 border-green-500/30',
};

export default function Conversions() {
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partnerFetch<ConversionRecord[]>('/api/partner/conversions')
      .then(setConversions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-text/60">Loading conversions...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Conversion History</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-text/60">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Commission</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {conversions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text/40">No conversions yet</td>
              </tr>
            ) : (
              conversions.map((conv, i) => (
                <tr key={i} className="hover:bg-surface/50">
                  <td className="px-4 py-3 text-text/80">
                    {new Date(conv.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-text">{conv.plan_id}</td>
                  <td className="px-4 py-3 text-text">{fmt(conv.amount_cents)}</td>
                  <td className="px-4 py-3 text-accent font-medium">{fmt(conv.commission_cents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[conv.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                      {conv.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
