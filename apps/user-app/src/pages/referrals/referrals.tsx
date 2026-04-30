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
import { Button, StatusBadge } from '@polyforge/ui';

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
    <div className="bg-elevated border border-default rounded-pf p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-secondary text-body-sm">
        <Icon size={15} className="shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold font-mono ${valueClass ?? 'text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

const REFERRAL_STATUS: Record<ReferralEntry['status'], { variant: 'secondary' | 'info' | 'success'; label: string }> = {
  PENDING: { variant: 'secondary', label: 'Pending' },
  SIGNED_UP: { variant: 'info', label: 'Signed Up' },
  ACTIVE: { variant: 'success', label: 'Active' },
};

function ReferralStatusBadge({ status }: { status: ReferralEntry['status'] }) {
  const { variant, label } = REFERRAL_STATUS[status];
  return <StatusBadge variant={variant} label={label} />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-default rounded flex-1" />
          <div className="h-4 bg-default rounded w-20" />
          <div className="h-4 bg-default rounded w-24" />
          <div className="h-4 bg-default rounded w-16" />
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
        <Gift size={22} className="text-accent-text shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold text-primary">Referrals</h1>
          <p className="text-body-sm text-secondary">
            Invite friends and earn credits together
          </p>
        </div>
      </div>

      {/* Section 1: Referral Link card */}
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-accent-text shrink-0" aria-hidden="true" />
          <h2 className="text-body-md font-semibold text-primary">Your Referral Link</h2>
        </div>

        {/* Monospace link display */}
        <div className="bg-surface border border-default rounded-sm px-4 py-3 font-mono text-body-md text-primary break-all select-all">
          {loading ? (
            <span className="animate-pulse text-secondary">Loading...</span>
          ) : (
            data?.referralLink ?? '—'
          )}
        </div>

        {/* Copy buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleCopyLink}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-accent/10 text-accent-text border border-accent/20 rounded-sm text-body-md font-medium hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copiedLink ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={handleCopyCode}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-default rounded-sm text-body-sm font-medium text-secondary hover:text-primary hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copiedCode ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copiedCode ? 'Copied!' : 'Copy Code'}
            {data && (
              <span className="font-mono text-accent-text">{data.referralCode}</span>
            )}
          </Button>
        </div>

        {/* Share buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="secondary"
            type="button"
            onClick={handleShareTwitter}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-default rounded-sm text-body-sm font-medium text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Share on X
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={handleShare}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-default rounded-sm text-body-sm font-medium text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Share2 size={14} aria-hidden="true" />
            Share
          </Button>
        </div>

        {/* How it works */}
        <p className="text-label text-secondary pt-1">
          Invite friends → they sign up → you both earn credits
        </p>
      </div>

      {/* Section 2: Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Invited"
          value={loading ? '—' : (data?.stats?.invited ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Signed Up"
          value={loading ? '—' : (data?.stats?.signedUp ?? 0)}
          icon={Users}
          valueClass="text-info"
        />
        <StatCard
          label="Active Traders"
          value={loading ? '—' : (data?.stats?.active ?? 0)}
          icon={TrendingUp}
          valueClass="text-gain"
        />
        <StatCard
          label="Credits Earned"
          value={loading ? '—' : `$${(data?.stats?.creditsEarned ?? 0).toFixed(2)}`}
          icon={DollarSign}
          valueClass="text-accent-text"
        />
      </div>

      {/* Section 3: Referrals table */}
      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        <div className="px-4 py-3 border-b border-default flex items-center gap-2">
          <Users size={15} className="text-secondary shrink-0" aria-hidden="true" />
          <h2 className="text-body-md font-semibold text-primary">Your Referrals</h2>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : !data || data.referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-secondary">
            <Gift size={28} className="opacity-30" aria-hidden="true" />
            <p className="text-body-sm">No referrals yet — share your link to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm" aria-label="Referral entries">
              <caption className="sr-only">Referral entries</caption>
              <thead>
                <tr className="border-b border-default text-left text-secondary text-label">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Joined</th>
                  <th className="px-4 py-2 font-medium text-right">Credits Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {data.referrals.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{entry.displayName}</div>
                      <div className="text-label text-secondary">@{entry.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ReferralStatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {formatDate(entry.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-accent-text">
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
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-4">
        <h2 className="text-body-md font-semibold text-primary">How Referrals Work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-text text-label font-semibold">
              1
            </div>
            <div>
              <p className="text-body-md font-medium text-primary">Share your unique referral link</p>
              <p className="text-label text-secondary mt-1">
                Send it to friends via social, email, or direct message
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-text text-label font-semibold">
              2
            </div>
            <div>
              <p className="text-body-md font-medium text-primary">Friend signs up and connects Polymarket</p>
              <p className="text-label text-secondary mt-1">
                They create an account using your link
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-text text-label font-semibold">
              3
            </div>
            <div>
              <p className="text-body-md font-medium text-primary">You earn $5 USDC when they trade</p>
              <p className="text-label text-secondary mt-1">
                Credits are awarded when they place their first trade
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
