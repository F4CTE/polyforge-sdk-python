import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  Copy,
  Percent,
  DollarSign,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

type CopyMode = 'PERCENTAGE' | 'FIXED' | 'MIRROR';

interface FollowedWhale {
  walletAddress: string;
  label?: string;
}

const STEPS = ['Target', 'Mode', 'Size', 'Risk', 'Review'] as const;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const MODE_OPTIONS: {
  value: CopyMode;
  label: string;
  description: string;
  icon: typeof Percent;
}[] = [
  {
    value: 'PERCENTAGE',
    label: 'Percentage',
    description: 'Copy a percentage of each trade size. Scales proportionally with the source trade.',
    icon: Percent,
  },
  {
    value: 'FIXED',
    label: 'Fixed Amount',
    description: 'Use a fixed dollar amount for every copied trade regardless of source size.',
    icon: DollarSign,
  },
  {
    value: 'MIRROR',
    label: 'Mirror (1:1)',
    description: 'Copy the exact trade size and parameters. Requires sufficient balance.',
    icon: RefreshCw,
  },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledWallet = searchParams.get('wallet') ?? '';

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Target
  const [targetWallet, setTargetWallet] = useState(prefilledWallet);
  const [followedWhales, setFollowedWhales] = useState<FollowedWhale[]>([]);
  const [loadingWhales, setLoadingWhales] = useState(false);

  // Step 2: Mode
  const [mode, setMode] = useState<CopyMode>('PERCENTAGE');

  // Step 3: Size
  const [sizeValue, setSizeValue] = useState<number>(10);

  // Step 4: Risk
  const [maxExposure, setMaxExposure] = useState<number>(1000);
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(200);
  const [priceOffset, setPriceOffset] = useState<number>(0);

  // Load followed whales for quick-select
  useEffect(() => {
    setLoadingWhales(true);
    fetch('/api/v1/whales/following?limit=50', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (Array.isArray(res.data)) {
          setFollowedWhales(res.data.map((w: { walletAddress: string }) => ({ walletAddress: w.walletAddress })));
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingWhales(false));
  }, []);

  function canAdvance(): boolean {
    if (step === 0) return targetWallet.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return mode === 'MIRROR' || sizeValue > 0;
    if (step === 3) return maxExposure > 0 && maxDailyLoss > 0;
    return true;
  }

  function nextStep() {
    if (!canAdvance()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function prevStep() {
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetWallet: targetWallet.trim(),
          mode,
          sizeValue: mode === 'MIRROR' ? 100 : sizeValue,
          maxExposure,
          maxDailyLoss,
          priceOffset,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Failed to create copy config');
        return;
      }
      const created = await res.json();
      toast.success('Copy config created');
      navigate(`/copy/${created.id}`);
    } catch {
      toast.error('Failed to create copy config');
    } finally {
      setSubmitting(false);
    }
  }

  function sizeLabel(): string {
    if (mode === 'PERCENTAGE') return `${sizeValue}% of trade`;
    if (mode === 'FIXED') return `$${sizeValue.toFixed(2)} fixed`;
    return 'Mirror (1:1)';
  }

  return (
    <div className="animate-fade-in p-6 max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        to="/copy"
        className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to Copy Trading
      </Link>

      {/* Title */}
      <div className="flex items-center gap-3">
        <Copy className="size-6 text-pf-cyan-400" />
        <h1 className="text-2xl font-semibold text-pf-text">New Copy Config</h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                i === step
                  ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                  : i < step
                    ? 'bg-pf-success/10 border-pf-success/30 text-pf-success cursor-pointer'
                    : 'border-pf-border text-pf-text-muted'
              }`}
            >
              <span className="size-5 rounded-full bg-pf-overlay flex items-center justify-center text-[10px] font-bold">
                {i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="size-3 text-pf-text-muted shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
        {/* Step 1: Target Wallet */}
        {step === 0 && (
          <>
            <h2 className="text-sm font-medium text-pf-text">Target Wallet Address</h2>
            <input
              type="text"
              placeholder="0x... paste wallet address"
              value={targetWallet}
              onChange={(e) => setTargetWallet(e.target.value)}
              className="w-full px-4 py-3 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border hover:border-pf-border-strong focus:border-pf-cyan-500/50 focus:outline-none transition-colors placeholder:text-pf-text-muted font-mono"
            />
            {followedWhales.length > 0 && (
              <div>
                <p className="text-xs text-pf-text-secondary mb-2">Or select from followed whales:</p>
                <div className="flex flex-wrap gap-2">
                  {loadingWhales ? (
                    <div className="h-8 w-32 bg-pf-overlay rounded-pf-sm animate-pulse" />
                  ) : (
                    followedWhales.map((w) => (
                      <button
                        key={w.walletAddress}
                        onClick={() => setTargetWallet(w.walletAddress)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-mono border transition-colors ${
                          targetWallet === w.walletAddress
                            ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                            : 'border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text'
                        }`}
                      >
                        {truncateAddress(w.walletAddress)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 2: Copy Mode */}
        {step === 1 && (
          <>
            <h2 className="text-sm font-medium text-pf-text">Copy Mode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-pf-lg border text-left transition-all duration-150 ${
                      selected
                        ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 shadow-pf-sm'
                        : 'border-pf-border hover:border-pf-border-strong'
                    }`}
                  >
                    <Icon
                      className={`size-5 ${selected ? 'text-pf-cyan-400' : 'text-pf-text-muted'}`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        selected ? 'text-pf-cyan-400' : 'text-pf-text'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-pf-text-secondary leading-snug">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 3: Size */}
        {step === 2 && (
          <>
            <h2 className="text-sm font-medium text-pf-text">
              {mode === 'MIRROR' ? 'Mirror Mode' : mode === 'PERCENTAGE' ? 'Trade Size (%)' : 'Fixed Amount ($)'}
            </h2>
            {mode === 'MIRROR' ? (
              <p className="text-sm text-pf-text-secondary">
                In mirror mode, every trade is copied at the exact same size (1:1). Make sure you have
                sufficient balance to cover the trades.
              </p>
            ) : (
              <div className="space-y-3">
                <input
                  type="range"
                  min={mode === 'PERCENTAGE' ? 1 : 1}
                  max={mode === 'PERCENTAGE' ? 100 : 10000}
                  step={mode === 'PERCENTAGE' ? 1 : 10}
                  value={sizeValue}
                  onChange={(e) => setSizeValue(Number(e.target.value))}
                  className="w-full accent-[var(--color-pf-cyan-500)]"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={sizeValue}
                    onChange={(e) => setSizeValue(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
                  />
                  <span className="text-sm text-pf-text-secondary">
                    {mode === 'PERCENTAGE' ? '%' : 'USD'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 4: Risk Controls */}
        {step === 3 && (
          <>
            <h2 className="text-sm font-medium text-pf-text">Risk Controls</h2>
            <div className="space-y-5">
              {/* Max Exposure */}
              <div className="space-y-2">
                <label className="text-xs text-pf-text-secondary">Max Exposure ($)</label>
                <input
                  type="range"
                  min={100}
                  max={50000}
                  step={100}
                  value={maxExposure}
                  onChange={(e) => setMaxExposure(Number(e.target.value))}
                  className="w-full accent-[var(--color-pf-cyan-500)]"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={maxExposure}
                    onChange={(e) => setMaxExposure(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
                  />
                  <span className="text-sm text-pf-text-secondary">USD</span>
                </div>
              </div>

              {/* Max Daily Loss */}
              <div className="space-y-2">
                <label className="text-xs text-pf-text-secondary">Max Daily Loss ($)</label>
                <input
                  type="range"
                  min={10}
                  max={10000}
                  step={10}
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                  className="w-full accent-[var(--color-pf-cyan-500)]"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
                  />
                  <span className="text-sm text-pf-text-secondary">USD</span>
                </div>
              </div>

              {/* Price Offset */}
              <div className="space-y-2">
                <label className="text-xs text-pf-text-secondary">Price Offset (%)</label>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={priceOffset}
                  onChange={(e) => setPriceOffset(Number(e.target.value))}
                  className="w-full accent-[var(--color-pf-cyan-500)]"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={-5}
                    max={5}
                    step={0.1}
                    value={priceOffset}
                    onChange={(e) => setPriceOffset(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
                  />
                  <span className="text-sm text-pf-text-secondary">%</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <>
            <h2 className="text-sm font-medium text-pf-text">Review Configuration</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-pf-border-subtle">
                <span className="text-xs text-pf-text-secondary">Target Wallet</span>
                <span className="font-mono text-sm text-pf-text">{truncateAddress(targetWallet)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pf-border-subtle">
                <span className="text-xs text-pf-text-secondary">Mode</span>
                <span className="text-sm text-pf-text">{mode}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pf-border-subtle">
                <span className="text-xs text-pf-text-secondary">Trade Size</span>
                <span className="text-sm font-mono text-pf-text">{sizeLabel()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pf-border-subtle">
                <span className="text-xs text-pf-text-secondary">Max Exposure</span>
                <span className="text-sm font-mono text-pf-text">${maxExposure.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pf-border-subtle">
                <span className="text-xs text-pf-text-secondary">Max Daily Loss</span>
                <span className="text-sm font-mono text-pf-text">${maxDailyLoss.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-pf-text-secondary">Price Offset</span>
                <span className="text-sm font-mono text-pf-text">{priceOffset > 0 ? '+' : ''}{priceOffset}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-pf text-sm text-pf-text-secondary hover:text-pf-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={nextStep}
            disabled={!canAdvance()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors"
          >
            <Rocket className="size-4" />
            {submitting ? 'Starting...' : 'Start Copying'}
          </button>
        )}
      </div>
    </div>
  );
}
