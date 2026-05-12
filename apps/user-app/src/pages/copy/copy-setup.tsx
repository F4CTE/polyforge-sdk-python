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
import { Button, Input } from '@polyforge/ui';

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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Step 1: Target
  const [targetWallet, setTargetWallet] = useState(prefilledWallet);
  const [followedWhales, setFollowedWhales] = useState<FollowedWhale[]>([]);
  const [loadingWhales, setLoadingWhales] = useState(false);

  // Step 2: Mode
  const [mode, setMode] = useState<CopyMode>('PERCENTAGE');

  // Step 3: Size
  const [sizeValue, setSizeValue] = useState<number>(10);
  const [sizeMode, setSizeMode] = useState<'fixed' | 'percent'>('fixed');
  const [sizePercent, setSizePercent] = useState(10);
  const [maxPerTrade, setMaxPerTrade] = useState(500);

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
      .catch(() => toast.error('Failed to load followed whales'))
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

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetWallet.trim())) {
      errors.wallet = 'Wallet address must be a valid 0x address (42 characters)';
    }
    if (mode !== 'MIRROR' && sizeValue <= 0) {
      errors.size = 'Size value must be greater than 0';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const isFormValid =
    /^0x[a-fA-F0-9]{40}$/.test(targetWallet.trim()) &&
    (mode === 'MIRROR' || sizeValue > 0);

  async function handleSubmit() {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetWallet: targetWallet.trim(),
          mode,
          sizeValue: String(mode === 'MIRROR' ? 100 : sizeValue),
          maxExposure: String(maxExposure),
          maxDailyLoss: String(maxDailyLoss),
          priceOffset: String(priceOffset),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Failed to create copy config');
        toast.error(msg);
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
        className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to Copy Trading
      </Link>

      {/* Title */}
      <div className="flex items-center gap-3">
        <Copy className="size-6 text-accent-text" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-primary">New Copy Config</h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-label font-medium border transition-colors ${
                i === step
                  ? 'bg-accent/10 border-accent/30 text-accent-text'
                  : i < step
                    ? 'bg-gain/10 border-gain/30 text-gain cursor-pointer'
                    : 'border-default text-tertiary'
              }`}
            >
              <span className="size-5 rounded-full bg-overlay flex items-center justify-center text-caption font-semibold">
                {i + 1}
              </span>
              {label}
            </Button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="size-3 text-tertiary shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-5">
        {/* Step 1: Target Wallet */}
        {step === 0 && (
          <>
            <h2 className="text-body-md font-medium text-primary">Target Wallet Address</h2>
            <Input
              id="target-wallet"
              type="text"
              placeholder="0x... paste wallet address"
              aria-label="Target wallet address"
              value={targetWallet}
              onChange={(e) => setTargetWallet(e.target.value)}
              className="w-full px-4 py-3 rounded-sm text-body-sm bg-surface text-primary border border-default hover:border-strong focus-visible:border-accent/50 focus-visible:outline-none transition-colors placeholder:text-tertiary font-mono"
            />
            {followedWhales.length > 0 && (
              <div>
                <p className="text-label text-secondary mb-2">Or select from followed whales:</p>
                <div className="flex flex-wrap gap-2">
                  {loadingWhales ? (
                    <div className="h-8 w-32 bg-overlay rounded-sm animate-pulse" />
                  ) : (
                    followedWhales.map((w) => (
                      <Button
                        type="button"
                        variant="ghost"
                        key={w.walletAddress}
                        onClick={() => setTargetWallet(w.walletAddress)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-sm text-label font-mono border transition-colors ${
                          targetWallet.toLowerCase() === w.walletAddress.toLowerCase()
                            ? 'bg-accent/10 border-accent/30 text-accent-text'
                            : 'border-default text-secondary hover:border-strong hover:text-primary'
                        }`}
                      >
                        {truncateAddress(w.walletAddress)}
                      </Button>
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
            <h2 className="text-body-md font-medium text-primary">Copy Mode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = mode === opt.value;
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-pf border text-left transition-all duration-micro ${
                      selected
                        ? 'bg-accent/10 border-accent/30 shadow-sm'
                        : 'border-default hover:border-strong'
                    }`}
                  >
                    <Icon
                      className={`size-5 ${selected ? 'text-accent-text' : 'text-tertiary'}`}
                    />
                    <span
                      className={`text-body-md font-medium ${
                        selected ? 'text-accent-text' : 'text-primary'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-label text-secondary leading-snug">
                      {opt.description}
                    </span>
                  </Button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 3: Size */}
        {step === 2 && (
          <>
            <h2 className="text-body-md font-medium text-primary">
              {mode === 'MIRROR' ? 'Mirror Mode' : mode === 'PERCENTAGE' ? 'Trade Size (%)' : 'Fixed Amount ($)'}
            </h2>
            {mode === 'MIRROR' ? (
              <p className="text-body-sm text-secondary">
                In mirror mode, every trade is copied at the exact same size (1:1). Make sure you have
                sufficient balance to cover the trades.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Size mode toggle */}
                <div className="flex rounded-pf border border-default overflow-hidden w-fit mb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSizeMode('fixed')}
                    className={`px-3 py-2 text-label transition-colors ${sizeMode === 'fixed' ? 'bg-accent-subtle text-accent-text' : 'text-secondary hover:text-primary'}`}
                  >
                    Fixed $
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSizeMode('percent')}
                    className={`px-3 py-2 text-label border-l border-default transition-colors ${sizeMode === 'percent' ? 'bg-accent-subtle text-accent-text' : 'text-secondary hover:text-primary'}`}
                  >
                    % of Whale
                  </Button>
                </div>

                {sizeMode === 'percent' ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={sizePercent}
                        onChange={(e) => setSizePercent(parseInt(e.target.value))}
                        aria-label="Copy percentage of whale trade size"
                        className="flex-1 h-2 rounded-full bg-default accent-accent"
                      />
                      <span className="text-body-md font-mono text-accent-text w-12 text-right">{sizePercent}%</span>
                    </div>
                    <p className="text-caption text-tertiary mt-1">
                      Copy {sizePercent}% of each whale trade size
                    </p>
                  </div>
                ) : (
                  <>
                    <input
                      type="range"
                      aria-label="Trade size"
                      min={mode === 'PERCENTAGE' ? 1 : 1}
                      max={mode === 'PERCENTAGE' ? 100 : 10000}
                      step={mode === 'PERCENTAGE' ? 1 : 10}
                      value={sizeValue}
                      onChange={(e) => setSizeValue(Number(e.target.value))}
                      className="w-full accent-[var(--accent-default)]"
                    />
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        value={sizeValue}
                        onChange={(e) => setSizeValue(Number(e.target.value))}
                        className="w-32 px-3 py-2 rounded-sm text-body-md bg-surface text-primary border border-default focus-visible:border-accent/50 focus-visible:outline-none font-mono"
                      />
                      <span className="text-body-sm text-secondary">
                        {mode === 'PERCENTAGE' ? '%' : 'USD'}
                      </span>
                    </div>
                  </>
                )}

                {/* Max per trade cap — always visible */}
                <div className="mt-3">
                  <label className="block text-label font-medium text-secondary mb-1">
                    Max per Trade (USDC cap)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={maxPerTrade}
                    onChange={(e) => setMaxPerTrade(parseInt(e.target.value) || 0)}
                    placeholder="500"
                    className="w-full h-10 px-3 rounded-pf bg-surface border border-default text-body-sm font-mono text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50"
                  />
                  <p className="text-caption text-tertiary mt-1">Never copy more than this per single trade</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 4: Risk Controls */}
        {step === 3 && (
          <>
            <h2 className="text-body-md font-medium text-primary">Risk Controls</h2>
            <div className="space-y-5">
              {/* Max Exposure */}
              <div className="space-y-2">
                <label htmlFor="copy-max-exposure" className="text-label text-secondary">Max Exposure ($)</label>
                <input
                  type="range"
                  aria-label="Max exposure"
                  min={100}
                  max={50000}
                  step={100}
                  value={maxExposure}
                  onChange={(e) => setMaxExposure(Number(e.target.value))}
                  className="w-full accent-[var(--accent-default)]"
                />
                <div className="flex items-center gap-3">
                  <Input
                    id="copy-max-exposure"
                    type="number"
                    min={0}
                    value={maxExposure}
                    onChange={(e) => setMaxExposure(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-sm text-body-md bg-surface text-primary border border-default focus-visible:border-accent/50 focus-visible:outline-none font-mono"
                  />
                  <span className="text-body-sm text-secondary">USD</span>
                </div>
              </div>

              {/* Max Daily Loss */}
              <div className="space-y-2">
                <label htmlFor="copy-max-daily-loss" className="text-label text-secondary">Max Daily Loss ($)</label>
                <input
                  type="range"
                  aria-label="Max daily loss"
                  min={10}
                  max={10000}
                  step={10}
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                  className="w-full accent-[var(--accent-default)]"
                />
                <div className="flex items-center gap-3">
                  <Input
                    id="copy-max-daily-loss"
                    type="number"
                    min={0}
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-sm text-body-md bg-surface text-primary border border-default focus-visible:border-accent/50 focus-visible:outline-none font-mono"
                  />
                  <span className="text-body-sm text-secondary">USD</span>
                </div>
              </div>

              {/* Price Offset */}
              <div className="space-y-2">
                <label htmlFor="copy-price-offset" className="text-label text-secondary">Price Offset (%)</label>
                <input
                  type="range"
                  aria-label="Price offset"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={priceOffset}
                  onChange={(e) => setPriceOffset(Number(e.target.value))}
                  className="w-full accent-[var(--accent-default)]"
                />
                <div className="flex items-center gap-3">
                  <Input
                    id="copy-price-offset"
                    type="number"
                    min={-5}
                    max={5}
                    step={0.1}
                    value={priceOffset}
                    onChange={(e) => setPriceOffset(Number(e.target.value))}
                    className="w-32 px-3 py-2 rounded-sm text-body-md bg-surface text-primary border border-default focus-visible:border-accent/50 focus-visible:outline-none font-mono"
                  />
                  <span className="text-body-sm text-secondary">%</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <>
            <h2 className="text-body-md font-medium text-primary">Review Configuration</h2>
            <div className="space-y-3">
              <div className="py-2 border-b border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-label text-secondary">Target Wallet</span>
                  <span className="font-mono text-body-md text-primary">{truncateAddress(targetWallet)}</span>
                </div>
                {validationErrors.wallet && (
                  <p className="text-label text-loss mt-1">{validationErrors.wallet}</p>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-subtle">
                <span className="text-label text-secondary">Mode</span>
                <span className="text-body-md text-primary">{mode}</span>
              </div>
              <div className="py-2 border-b border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-label text-secondary">Trade Size</span>
                  <span className="text-body-md font-mono text-primary">{sizeLabel()}</span>
                </div>
                {validationErrors.size && (
                  <p className="text-label text-loss mt-1">{validationErrors.size}</p>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-subtle">
                <span className="text-label text-secondary">Max Exposure</span>
                <span className="text-body-md font-mono text-primary">${maxExposure.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-subtle">
                <span className="text-label text-secondary">Max Daily Loss</span>
                <span className="text-body-md font-mono text-primary">${maxDailyLoss.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-label text-secondary">Price Offset</span>
                <span className="text-body-md font-mono text-primary">{priceOffset > 0 ? '+' : ''}{priceOffset}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={prevStep}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-3 rounded-pf text-body-sm text-secondary hover:text-primary focus-visible:outline-none focus-visible:shadow-focus-ring disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={nextStep}
            disabled={!canAdvance()}
            className="flex items-center gap-2 px-4 py-3 rounded-pf bg-accent text-inverse text-body-md font-medium hover:bg-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !isFormValid}
            className="flex items-center gap-2 px-5 py-3 rounded-pf bg-accent text-inverse text-body-md font-medium hover:bg-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring disabled:opacity-40 transition-colors"
          >
            <Rocket className="size-4" />
            {submitting ? 'Starting...' : 'Start Copying'}
          </Button>
        )}
      </div>
    </div>
  );
}
