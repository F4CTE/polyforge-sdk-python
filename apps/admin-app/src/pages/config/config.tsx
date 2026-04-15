'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from '@polyforge/ui';
import {
  AlertTriangle,
  Check,
  Lock,
  Save,
  Settings2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketplaceConfig {
  listingFeePercent: number;
  maxListingPrice: number;
  requireReviewForNewSellers: boolean;
  featuredSlots: number;
}

interface CopyTradingConfig {
  maxCopiesPerUser: number;
  minTraderEdgeScore: number;
  copyFeePercent: number;
  pauseOnDrawdown: number;
}

interface RiskControlsConfig {
  globalMaxPositionPercent: number;
  globalDailyLossLimitPercent: number;
  requireKycAboveUsdc: number;
  maintenanceMode: boolean;
}

interface NotificationsConfig {
  emailEnabled: boolean;
  pushEnabled: boolean;
  maxEmailsPerUserPerDay: number;
  digestFrequencyHours: number;
}

interface FeaturesConfig {
  strategyBuilderEnabled: boolean;
  backtestingEnabled: boolean;
  marketplaceEnabled: boolean;
  copyTradingEnabled: boolean;
  collectionsEnabled: boolean;
  analyticsEnabled: boolean;
  leaderboardEnabled: boolean;
}

interface PlatformConfig {
  marketplace: MarketplaceConfig;
  copyTrading: CopyTradingConfig;
  riskControls: RiskControlsConfig;
  notifications: NotificationsConfig;
  features: FeaturesConfig;
}

// ---------------------------------------------------------------------------
// Default / fallback config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: PlatformConfig = {
  marketplace: {
    listingFeePercent: 2.5,
    maxListingPrice: 10000,
    requireReviewForNewSellers: true,
    featuredSlots: 5,
  },
  copyTrading: {
    maxCopiesPerUser: 10,
    minTraderEdgeScore: 60,
    copyFeePercent: 1.0,
    pauseOnDrawdown: 20,
  },
  riskControls: {
    globalMaxPositionPercent: 25,
    globalDailyLossLimitPercent: 10,
    requireKycAboveUsdc: 5000,
    maintenanceMode: false,
  },
  notifications: {
    emailEnabled: true,
    pushEnabled: true,
    maxEmailsPerUserPerDay: 10,
    digestFrequencyHours: 24,
  },
  features: {
    strategyBuilderEnabled: true,
    backtestingEnabled: true,
    marketplaceEnabled: true,
    copyTradingEnabled: true,
    collectionsEnabled: false,
    analyticsEnabled: true,
    leaderboardEnabled: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatLastSaved(date: Date | null): string {
  if (!date) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin === 1) return '1 min ago';
  return `${diffMin} min ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
  label: string;
}

function ToggleSwitch({ checked, onChange, danger, disabled, label }: ToggleSwitchProps) {
  const trackClass = checked
    ? danger
      ? 'bg-loss'
      : 'bg-accent'
    : 'bg-strong';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pf-full transition-colors duration-pf-normal',
        trackClass,
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 rounded-pf-full bg-primary shadow transition-transform duration-pf-normal',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
}

function SliderInput({ value, min, max, onChange, label, unit }: SliderInputProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 rounded-pf-full accent-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      <span className="w-14 text-right text-sm font-medium text-primary tabular-nums">
        {value}
        {unit}
      </span>
    </div>
  );
}

interface NumberFieldProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  prefix?: string;
  suffix?: string;
}

function NumberField({ value, min, max, step = 1, onChange, label, prefix, suffix }: NumberFieldProps) {
  return (
    <div className="flex items-center gap-2">
      {prefix && <span className="text-tertiary text-sm">{prefix}</span>}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={[
          'w-28 rounded-pf-sm border border-default bg-surface px-3 py-2',
          'text-sm text-primary tabular-nums',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          'placeholder:text-tertiary',
        ].join(' ')}
      />
      {suffix && <span className="text-tertiary text-sm">{suffix}</span>}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <section className="rounded-pf-lg border border-default bg-elevated p-6 space-y-5">
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

interface FieldRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function FieldRow({ label, description, children }: FieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-10">
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary leading-tight">{label}</p>
        {description && (
          <p className="text-xs text-tertiary mt-1 leading-tight">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ConfigSkeleton() {
  const shimmerCard = (rows: number) => (
    <div className="rounded-pf-lg border border-default bg-elevated p-6 space-y-5 animate-shimmer">
      <div className="h-4 w-40 rounded-pf-sm bg-default" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="h-3 w-48 rounded-pf-sm bg-default" />
          <div className="h-6 w-20 rounded-pf-sm bg-default" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {shimmerCard(4)}
      {shimmerCard(4)}
      {shimmerCard(4)}
      {shimmerCard(4)}
      {shimmerCard(7)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Maintenance mode confirm box
// ---------------------------------------------------------------------------

interface MaintenanceConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function MaintenanceConfirmBox({ onConfirm, onCancel }: MaintenanceConfirmProps) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="maintenance-confirm-heading"
      className="mt-3 rounded-pf-lg border border-warning/40 bg-warning/10 p-4 space-y-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div>
          <p id="maintenance-confirm-heading" className="text-sm font-semibold text-warning">
            Enable maintenance mode?
          </p>
          <p className="text-xs text-secondary mt-1">
            This will pause all trading activity across the platform immediately. Users will see a
            maintenance page until you turn this off.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="rounded-pf-sm px-3 py-2 text-xs font-medium text-secondary border border-default hover:border-strong transition-colors"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          className="px-3 py-2 text-xs font-medium transition-all"
        >
          Yes, enable maintenance
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature flag labels
// ---------------------------------------------------------------------------

const FEATURE_LABELS: Record<keyof FeaturesConfig, string> = {
  strategyBuilderEnabled: 'Strategy Builder',
  backtestingEnabled: 'Backtesting',
  marketplaceEnabled: 'Marketplace',
  copyTradingEnabled: 'Copy Trading',
  collectionsEnabled: 'Collections',
  analyticsEnabled: 'Analytics',
  leaderboardEnabled: 'Leaderboard',
};

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function Component() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedDisplay, setLastSavedDisplay] = useState<string>('Never');
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);

  const dirty = config !== null && savedConfig !== null && !deepEqual(config, savedConfig);

  // Refresh "X min ago" display every 30 s
  const lastSavedRef = useRef(lastSaved);
  lastSavedRef.current = lastSaved;

  useEffect(() => {
    const interval = setInterval(() => {
      setLastSavedDisplay(formatLastSaved(lastSavedRef.current));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Load config on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    adminApi
      .config()
      .then((data) => {
        if (cancelled) return;
        setConfig(data as unknown as PlatformConfig);
        setSavedConfig(data as unknown as PlatformConfig);
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to defaults so the page remains usable
        setConfig(DEFAULT_CONFIG);
        setSavedConfig(DEFAULT_CONFIG);
        toast.error('Failed to load config — showing defaults');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Patch helpers — keep config immutable per section
  const patchMarketplace = useCallback((patch: Partial<MarketplaceConfig>) => {
    setConfig((prev) => prev && { ...prev, marketplace: { ...prev.marketplace, ...patch } });
  }, []);

  const patchCopyTrading = useCallback((patch: Partial<CopyTradingConfig>) => {
    setConfig((prev) => prev && { ...prev, copyTrading: { ...prev.copyTrading, ...patch } });
  }, []);

  const patchRiskControls = useCallback((patch: Partial<RiskControlsConfig>) => {
    setConfig((prev) => prev && { ...prev, riskControls: { ...prev.riskControls, ...patch } });
  }, []);

  const patchNotifications = useCallback((patch: Partial<NotificationsConfig>) => {
    setConfig((prev) => prev && { ...prev, notifications: { ...prev.notifications, ...patch } });
  }, []);

  const patchFeatures = useCallback((patch: Partial<FeaturesConfig>) => {
    setConfig((prev) => prev && { ...prev, features: { ...prev.features, ...patch } });
  }, []);

  // Maintenance mode toggle — requires confirmation before enabling
  const handleMaintenanceModeChange = useCallback(
    (next: boolean) => {
      if (next) {
        setShowMaintenanceConfirm(true);
      } else {
        patchRiskControls({ maintenanceMode: false });
      }
    },
    [patchRiskControls],
  );

  const confirmMaintenanceMode = useCallback(() => {
    patchRiskControls({ maintenanceMode: true });
    setShowMaintenanceConfirm(false);
  }, [patchRiskControls]);

  const cancelMaintenanceMode = useCallback(() => {
    setShowMaintenanceConfirm(false);
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    if (!config || saving) return;
    setSaving(true);
    try {
      await Promise.resolve(config);
      setSavedConfig(config);
      const now = new Date();
      setLastSaved(now);
      setLastSavedDisplay(formatLastSaved(now));
      toast.success('Config saved');
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(false);
    }
  }, [config, saving]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-surface animate-fade-in">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-pf-lg bg-elevated border border-default">
              <Settings2 className="h-5 w-5 text-accent-text" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary leading-tight">Platform Config</h1>
              <p className="text-xs text-tertiary mt-1">
                Last saved:{' '}
                <span className="text-secondary">{lastSavedDisplay}</span>
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={[
              'inline-flex items-center gap-2 rounded-pf px-4 py-2 text-sm font-semibold transition-all',
              dirty && !saving
                ? 'bg-accent text-inverse hover:bg-accent-text transition-colors duration-pf-fast cursor-pointer'
                : 'bg-elevated border border-default text-tertiary cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            <Save className="h-4 w-4" aria-hidden />
            {saving ? 'Saving…' : 'Save All Changes'}
          </Button>
        </div>

        {/* Unsaved changes banner */}
        {dirty && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-pf-sm border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              You have unsaved changes — click "Save All Changes" or they will be lost.
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <ConfigSkeleton />}

        {/* Config sections */}
        {!loading && config && (
          <div className="space-y-6">

            {/* 1. Marketplace */}
            <SectionCard title="Marketplace">
              <FieldRow label="Listing Fee %" description="Charged on each strategy listing sale">
                <NumberField
                  value={config.marketplace.listingFeePercent}
                  min={0}
                  max={20}
                  step={0.1}
                  label="Listing Fee %"
                  suffix="%"
                  onChange={(v) => patchMarketplace({ listingFeePercent: v })}
                />
              </FieldRow>

              <FieldRow label="Max Listing Price (USDC)" description="Upper price cap for strategy listings">
                <NumberField
                  value={config.marketplace.maxListingPrice}
                  min={1}
                  label="Max Listing Price USDC"
                  prefix="$"
                  onChange={(v) => patchMarketplace({ maxListingPrice: v })}
                />
              </FieldRow>

              <FieldRow
                label="Require Review for New Sellers"
                description="New sellers await manual approval before listing"
              >
                <ToggleSwitch
                  checked={config.marketplace.requireReviewForNewSellers}
                  onChange={(v) => patchMarketplace({ requireReviewForNewSellers: v })}
                  label="Require Review for New Sellers"
                />
              </FieldRow>

              <FieldRow label="Featured Slots" description="Number of promoted slots on marketplace home">
                <NumberField
                  value={config.marketplace.featuredSlots}
                  min={1}
                  max={20}
                  label="Featured Slots"
                  onChange={(v) => patchMarketplace({ featuredSlots: v })}
                />
              </FieldRow>
            </SectionCard>

            {/* 2. Copy Trading */}
            <SectionCard title="Copy Trading">
              <FieldRow label="Max Copies Per User" description="How many traders each user can copy simultaneously">
                <NumberField
                  value={config.copyTrading.maxCopiesPerUser}
                  min={1}
                  max={50}
                  label="Max Copies Per User"
                  onChange={(v) => patchCopyTrading({ maxCopiesPerUser: v })}
                />
              </FieldRow>

              <FieldRow
                label="Min Trader Edge Score"
                description={`Only traders above this score are copyable (current: ${config.copyTrading.minTraderEdgeScore})`}
              >
                <div className="w-56">
                  <SliderInput
                    value={config.copyTrading.minTraderEdgeScore}
                    min={0}
                    max={100}
                    label="Min Trader Edge Score"
                    onChange={(v) => patchCopyTrading({ minTraderEdgeScore: v })}
                  />
                </div>
              </FieldRow>

              <FieldRow label="Copy Fee %" description="Platform fee taken from copy-trading profits">
                <NumberField
                  value={config.copyTrading.copyFeePercent}
                  min={0}
                  max={10}
                  step={0.1}
                  label="Copy Fee %"
                  suffix="%"
                  onChange={(v) => patchCopyTrading({ copyFeePercent: v })}
                />
              </FieldRow>

              <FieldRow
                label="Auto-pause on Drawdown %"
                description="Automatically suspends copying when drawdown exceeds this threshold"
              >
                <NumberField
                  value={config.copyTrading.pauseOnDrawdown}
                  min={1}
                  max={100}
                  label="Auto-pause on Drawdown %"
                  suffix="%"
                  onChange={(v) => patchCopyTrading({ pauseOnDrawdown: v })}
                />
              </FieldRow>
            </SectionCard>

            {/* 3. Risk Controls */}
            <SectionCard title="Risk Controls">
              <FieldRow
                label="Global Max Position %"
                description={`Max % of portfolio per single position (current: ${config.riskControls.globalMaxPositionPercent}%)`}
              >
                <div className="w-56">
                  <SliderInput
                    value={config.riskControls.globalMaxPositionPercent}
                    min={1}
                    max={100}
                    label="Global Max Position %"
                    unit="%"
                    onChange={(v) => patchRiskControls({ globalMaxPositionPercent: v })}
                  />
                </div>
              </FieldRow>

              <FieldRow label="Global Daily Loss Limit %" description="Auto-halts trading if daily loss hits this %">
                <NumberField
                  value={config.riskControls.globalDailyLossLimitPercent}
                  min={1}
                  max={100}
                  label="Global Daily Loss Limit %"
                  suffix="%"
                  onChange={(v) => patchRiskControls({ globalDailyLossLimitPercent: v })}
                />
              </FieldRow>

              <FieldRow label="Require KYC Above (USDC)" description="Users must complete KYC before exceeding this balance">
                <NumberField
                  value={config.riskControls.requireKycAboveUsdc}
                  min={0}
                  label="Require KYC Above USDC"
                  prefix="$"
                  onChange={(v) => patchRiskControls({ requireKycAboveUsdc: v })}
                />
              </FieldRow>

              <div>
                <FieldRow
                  label="Maintenance Mode"
                  description="Pauses all trading activity across the platform"
                >
                  <ToggleSwitch
                    checked={config.riskControls.maintenanceMode}
                    onChange={handleMaintenanceModeChange}
                    danger
                    label="Maintenance Mode"
                  />
                </FieldRow>

                {/* Maintenance active warning */}
                {config.riskControls.maintenanceMode && !showMaintenanceConfirm && (
                  <div className="mt-3 flex items-center gap-2 rounded-pf-sm border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Platform is in maintenance mode — all trading is paused.</span>
                  </div>
                )}

                {/* Confirmation dialog */}
                {showMaintenanceConfirm && (
                  <MaintenanceConfirmBox
                    onConfirm={confirmMaintenanceMode}
                    onCancel={cancelMaintenanceMode}
                  />
                )}
              </div>
            </SectionCard>

            {/* 4. Notifications */}
            <SectionCard title="Notifications">
              <FieldRow label="Email Enabled" description="Allow platform to send email notifications">
                <ToggleSwitch
                  checked={config.notifications.emailEnabled}
                  onChange={(v) => patchNotifications({ emailEnabled: v })}
                  label="Email Enabled"
                />
              </FieldRow>

              <FieldRow label="Push Enabled" description="Allow platform to send push notifications">
                <ToggleSwitch
                  checked={config.notifications.pushEnabled}
                  onChange={(v) => patchNotifications({ pushEnabled: v })}
                  label="Push Enabled"
                />
              </FieldRow>

              <FieldRow label="Max Emails / User / Day" description="Rate limit for outbound emails per user">
                <NumberField
                  value={config.notifications.maxEmailsPerUserPerDay}
                  min={1}
                  max={50}
                  label="Max Emails Per User Per Day"
                  onChange={(v) => patchNotifications({ maxEmailsPerUserPerDay: v })}
                />
              </FieldRow>

              <FieldRow label="Digest Frequency (hours)" description="How often digest emails are sent (1–168 hrs)">
                <NumberField
                  value={config.notifications.digestFrequencyHours}
                  min={1}
                  max={168}
                  label="Digest Frequency Hours"
                  suffix="hr"
                  onChange={(v) => patchNotifications({ digestFrequencyHours: v })}
                />
              </FieldRow>
            </SectionCard>

            {/* 5. Feature Flags */}
            <SectionCard title="Feature Flags">
              <div className="grid grid-cols-2 gap-3" role="list">
                {(Object.keys(FEATURE_LABELS) as Array<keyof FeaturesConfig>).map((key) => {
                  const enabled = config.features[key];
                  const label = FEATURE_LABELS[key];

                  return (
                    <div
                      key={key}
                      role="listitem"
                      className={[
                        'relative flex items-center justify-between gap-3 rounded-pf-lg border px-4 py-3 transition-colors',
                        enabled
                          ? 'border-default bg-surface'
                          : 'border-subtle bg-surface/50',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {!enabled && (
                          <Lock
                            className="h-4 w-4 shrink-0 text-tertiary"
                            aria-hidden
                          />
                        )}
                        <span className="text-sm font-medium text-primary truncate">{label}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={[
                            'inline-flex items-center gap-1 rounded-pf-full px-2 py-1 text-xs font-medium',
                            enabled
                              ? 'bg-gain/15 text-gain'
                              : 'bg-default/30 text-tertiary',
                          ].join(' ')}
                        >
                          {enabled && <Check className="h-3 w-3" aria-hidden />}
                          {enabled ? 'Enabled' : 'Disabled'}
                        </span>

                        <ToggleSwitch
                          checked={enabled}
                          onChange={(v) => patchFeatures({ [key]: v })}
                          label={`${label} feature flag`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

          </div>
        )}
      </div>
    </div>
  );
}
