import { useEffect, useState } from 'react';
import { partnerFetch } from '../../lib/partner-api.js';

interface ClickRecord {
  visitor_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export default function Clicks() {
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partnerFetch<ClickRecord[]>('/api/partner/clicks')
      .then(setClicks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-text/60">Loading clicks...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Click History</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-text/60">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Visitor ID</th>
              <th className="px-4 py-3 font-medium">User Agent</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clicks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text/40">No clicks yet</td>
              </tr>
            ) : (
              clicks.map((click, i) => (
                <tr key={i} className="hover:bg-surface/50">
                  <td className="px-4 py-3 text-text/80">
                    {new Date(click.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text/70">{click.visitor_id}</td>
                  <td className="px-4 py-3 text-text/60 truncate max-w-xs">
                    {(click.metadata as any)?.userAgent || '-'}
                  </td>
                  <td className="px-4 py-3 text-text/60">
                    {(click.metadata as any)?.ip || '-'}
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
