import { useEffect, useState } from 'react';
import { partnerFetch } from '../../lib/partner-api.js';

interface PartnerStats {
  totalClicks: number;
  totalConversions: number;
  totalRevenueCents: number;
  totalCommissionsCents: number;
  pendingCommissionsCents: number;
  paidCommissionsCents: number;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partnerFetch<PartnerStats>('/api/partner/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-text/60">Loading dashboard...</div>;
  }

  const cards = [
    { label: 'Total Clicks', value: String(stats?.totalClicks ?? 0) },
    { label: 'Conversions', value: String(stats?.totalConversions ?? 0) },
    { label: 'Revenue Generated', value: fmt(stats?.totalRevenueCents ?? 0) },
    { label: 'Commissions Earned', value: fmt(stats?.totalCommissionsCents ?? 0) },
    { label: 'Pending Payouts', value: fmt(stats?.pendingCommissionsCents ?? 0) },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Partner Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface p-5">
            <p className="text-sm text-text/60 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-accent">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
