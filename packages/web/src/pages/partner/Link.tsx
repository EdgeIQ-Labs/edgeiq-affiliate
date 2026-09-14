import { useEffect, useState } from 'react';
import { partnerFetch } from '../../lib/partner-api.js';

interface LinkData {
  referral_link: string;
  referral_code: string;
}

interface ProfileData {
  status: string;
}

export default function Link() {
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      partnerFetch<LinkData>('/api/partner/link'),
      partnerFetch<ProfileData>('/api/partner/me'),
    ])
      .then(([link, prof]) => {
        setLinkData(link);
        setProfile(prof);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!linkData?.referral_link) return;
    await navigator.clipboard.writeText(linkData.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="text-text/60">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Referral Link</h2>

      {profile?.status === 'pending' && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          Your account is pending approval. Your referral link will not track conversions until an admin approves your account.
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-6 max-w-2xl">
        <label className="block text-sm font-medium text-text/70 mb-2">Your Referral URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={linkData?.referral_link || ''}
            className="flex-1 rounded border border-border bg-bg px-3 py-2 text-text font-mono text-sm focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="rounded bg-accent px-4 py-2 font-semibold text-bg hover:opacity-90 transition whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
        <p className="mt-3 text-xs text-text/50">
          Share this link to earn commissions on referred signups.
        </p>
      </div>
    </div>
  );
}
