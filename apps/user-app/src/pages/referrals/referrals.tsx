import { useState, useEffect } from 'react';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  TrendingUp,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReferralEntry {
  id: string;
  username: string;
  displayName: string;
  status: 'PENDING' | 'SIGNED_UP' | 'ACTIVE';
  joinedAt: string;
  creditsEarned: number;
}

interface ReferralStats {
  invited: number;
  signedUp: number;
  active: number;
  creditsEarned: number;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  stats: ReferralStats;
  referrals: ReferralEntry[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  valueClass?: string;
}) {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-pf-text-secondary text-sm">
        <Icon size={15} className="shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${valueClass ?? 'text-pf-text'}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReferralEntry['status'] }) {
  const map: Record<ReferralEntry['status'], { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-pf-surface text-pf-text-secondary border border-pf-border' },
    SIGNED_UP: { label: 'Signed Up', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    ACTIVE: { label: 'Active', className: 'bg-pf-success/10 text-pf-success border border-pf-success/20' },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-pf-border rounded flex-1" />
          <div className="h-4 bg-pf-border rounded w-20" />
          <div className="h-4 bg-pf-border rounded w-24" />
          <div className="h-4 bg-pf-border rounded w-16" />
        </div>
      ))}
    </div>
  );
}

export function Component() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/referrals/me', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCopyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopiedLink(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopiedCode(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleShareTwitter = () => {
    if (!data) return;
    const text = encodeURIComponent(
      `Join me on Polyforge — the smart prediction market trading platform. Sign up with my referral link and we both earn credits! ${data.referralLink}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Polyforge',
          text: 'Sign up with my referral link and we both earn credits!',
          url: data.referralLink,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Gift size={22} className="text-pf-cyan-400 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold text-pf-text">Referrals</h1>
          <p className="text-sm text-pf-text-secondary">
            Invite friends and earn credits together
          </p>
        </div>
      </div>

      {/* Section 1: Referral Link card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-pf-cyan-400 shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-pf-text">Your Referral Link</h2>
        </div>

        {/* Monospace link display */}
        <div className="bg-pf-surface border border-pf-border rounded-pf-sm px-4 py-3 font-mono text-sm text-pf-text break-all select-all">
          {loading ? (
            <span className="animate-pulse text-pf-text-secondary">Loading...</span>
          ) : (
            data?.referralLink ?? '—'
          )}
        </div>

        {/* Copy buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-pf-cyan-500/10 text-pf-cyan-400 border border-pf-cyan-500/20 rounded-pf-sm text-sm font-medium hover:bg-pf-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copiedLink ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-pf-surface border border-pf-border rounded-pf-sm text-sm font-medium text-pf-text-secondary hover:text-pf-text hover:bg-pf-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copiedCode ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copiedCode ? 'Copied!' : 'Copy Code'}
            {data && (
              <span className="font-mono text-pf-cyan-400">{data.referralCode}</span>
            )}
          </button>
        </div>

        {/* Share buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleShareTwitter}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-pf-surface border border-pf-border rounded-pf-sm text-sm font-medium text-pf-text-secondary hover:text-pf-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Share on X
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-pf-surface border border-pf-border rounded-pf-sm text-sm font-medium text-pf-text-secondary hover:text-pf-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Share2 size={14} aria-hidden="true" />
            Share
          </button>
        </div>

        {/* How it works */}
        <p className="text-xs text-pf-text-secondary pt-1">
          Invite friends → they sign up → you both earn credits
        </p>
      </div>

      {/* Section 2: Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Invited"
          value={loading ? '—' : (data?.stats.invited ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Signed Up"
          value={loading ? '—' : (data?.stats.signedUp ?? 0)}
          icon={Users}
          valueClass="text-blue-400"
        />
        <StatCard
          label="Active Traders"
          value={loading ? '—' : (data?.stats.active ?? 0)}
          icon={TrendingUp}
          valueClass="text-pf-success"
        />
        <StatCard
          label="Credits Earned"
          value={loading ? '—' : `$${(data?.stats.creditsEarned ?? 0).toFixed(2)}`}
          icon={DollarSign}
          valueClass="text-pf-cyan-400"
        />
      </div>

      {/* Section 3: Referrals table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-pf-border flex items-center gap-2">
          <Users size={15} className="text-pf-text-secondary shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-pf-text">Your Referrals</h2>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : !data || data.referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-pf-text-secondary">
            <Gift size={28} className="opacity-30" aria-hidden="true" />
            <p className="text-sm">No referrals yet — share your link to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border text-left text-pf-text-secondary text-xs">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Joined</th>
                  <th className="px-4 py-2 font-medium text-right">Credits Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border">
                {data.referrals.map((entry) => (
                  <tr key={entry.id} className="hover:bg-pf-surface transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-pf-text">{entry.displayName}</div>
                      <div className="text-xs text-pf-text-secondary">@{entry.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-pf-text-secondary">
                      {formatDate(entry.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-pf-cyan-400">
                      ${entry.creditsEarned.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: How Referrals Work */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-pf-text">How Referrals Work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-pf-cyan-500/10 border border-pf-cyan-500/20 flex items-center justify-center text-pf-cyan-400 text-xs font-bold">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-pf-text">Share your unique referral link</p>
              <p className="text-xs text-pf-text-secondary mt-0.5">
                Send it to friends via social, email, or direct message
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-pf-cyan-500/10 border border-pf-cyan-500/20 flex items-center justify-center text-pf-cyan-400 text-xs font-bold">
              2
            </div>
            <div>
              <p className="text-sm font-medium text-pf-text">Friend signs up and connects Polymarket</p>
              <p className="text-xs text-pf-text-secondary mt-0.5">
                They create an account using your link
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-pf-cyan-500/10 border border-pf-cyan-500/20 flex items-center justify-center text-pf-cyan-400 text-xs font-bold">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-pf-text">You earn $5 USDC when they trade</p>
              <p className="text-xs text-pf-text-secondary mt-0.5">
                Credits are awarded when they place their first trade
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
