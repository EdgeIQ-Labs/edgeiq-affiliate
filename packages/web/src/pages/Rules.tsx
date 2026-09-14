import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface Rule {
  id: string;
  planId: string;
  type: string;
  value: string;
  active: boolean;
}

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState({ plan_id: '', type: 'percent' as 'percent' | 'fixed', value: '', active: true });

  const load = () => {
    apiFetch<Rule[]>('/api/admin/rules').then(setRules).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/rules', {
      method: 'POST',
      body: JSON.stringify({ ...form, value: Number(form.value) }),
    });
    setForm({ plan_id: '', type: 'percent', value: '', active: true });
    load();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Commission Rules</h2>

      <form onSubmit={save} className="flex gap-3 mb-6 flex-wrap">
        <input
          placeholder="Plan ID"
          value={form.plan_id}
          onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          required
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        >
          <option value="percent">Percent</option>
          <option value="fixed">Fixed</option>
        </select>
        <input
          placeholder="Value"
          type="number"
          step="any"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          className="rounded border border-border bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent w-32"
          required
        />
        <label className="flex items-center gap-2 text-sm text-text/70">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="accent-accent"
          />
          Active
        </label>
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
          Save Rule
        </button>
      </form>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-text/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Plan ID</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Value</th>
              <th className="px-4 py-3 text-left font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-accent">{r.planId}</td>
                <td className="px-4 py-3">{r.type}</td>
                <td className="px-4 py-3">{r.value}</td>
                <td className="px-4 py-3">
                  {r.active ? <span className="text-green-400">Yes</span> : <span className="text-text/40">No</span>}
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text/40">No rules configured</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
