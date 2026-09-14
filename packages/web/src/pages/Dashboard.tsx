import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface DashboardStats {
  totalReferredRevenueCents: number;
  totalCommissionsOwedCents: number;
  totalCommissionsPaidCents: number;
  totalPartners: number;
  totalConversions: number;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardStats>('/api/admin/dashboard')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-text/60">Loading dashboard...</div>;
  }

  const cards = [
    { label: 'Total Revenue', value: fmt(stats?.totalReferredRevenueCents ?? 0) },
    { label: 'Commissions Owed', value: fmt(stats?.totalCommissionsOwedCents ?? 0) },
    { label: 'Commissions Paid', value: fmt(stats?.totalCommissionsPaidCents ?? 0) },
    { label: 'Active Partners', value: String(stats?.totalPartners ?? 0) },
    { label: 'Total Conversions', value: String(stats?.totalConversions ?? 0) },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
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
