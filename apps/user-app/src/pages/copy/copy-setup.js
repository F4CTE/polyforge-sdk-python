import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Copy, Percent, DollarSign, RefreshCw, ChevronRight, ChevronLeft, Rocket, } from 'lucide-react';
import { toast } from 'sonner';
const STEPS = ['Target', 'Mode', 'Size', 'Risk', 'Review'];
/* ─── Helpers ────────────────────────────────────────────────────────── */
function truncateAddress(addr) {
    if (addr.length <= 12)
        return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
const MODE_OPTIONS = [
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
    const [validationErrors, setValidationErrors] = useState({});
    // Step 1: Target
    const [targetWallet, setTargetWallet] = useState(prefilledWallet);
    const [followedWhales, setFollowedWhales] = useState([]);
    const [loadingWhales, setLoadingWhales] = useState(false);
    // Step 2: Mode
    const [mode, setMode] = useState('PERCENTAGE');
    // Step 3: Size
    const [sizeValue, setSizeValue] = useState(10);
    // Step 4: Risk
    const [maxExposure, setMaxExposure] = useState(1000);
    const [maxDailyLoss, setMaxDailyLoss] = useState(200);
    const [priceOffset, setPriceOffset] = useState(0);
    // Load followed whales for quick-select
    useEffect(() => {
        setLoadingWhales(true);
        fetch('/api/v1/whales/following?limit=50', { credentials: 'include' })
            .then((r) => r.json())
            .then((res) => {
            if (Array.isArray(res.data)) {
                setFollowedWhales(res.data.map((w) => ({ walletAddress: w.walletAddress })));
            }
        })
            .catch(() => toast.error('Failed to load followed whales'))
            .finally(() => setLoadingWhales(false));
    }, []);
    function canAdvance() {
        if (step === 0)
            return targetWallet.trim().length > 0;
        if (step === 1)
            return true;
        if (step === 2)
            return mode === 'MIRROR' || sizeValue > 0;
        if (step === 3)
            return maxExposure > 0 && maxDailyLoss > 0;
        return true;
    }
    function nextStep() {
        if (!canAdvance())
            return;
        if (step < STEPS.length - 1)
            setStep(step + 1);
    }
    function prevStep() {
        if (step > 0)
            setStep(step - 1);
    }
    function validateForm() {
        const errors = {};
        if (!/^0x[a-fA-F0-9]{40}$/.test(targetWallet.trim())) {
            errors.wallet = 'Wallet address must be a valid 0x address (42 characters)';
        }
        if (mode !== 'MIRROR' && sizeValue <= 0) {
            errors.size = 'Size value must be greater than 0';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }
    const isFormValid = /^0x[a-fA-F0-9]{40}$/.test(targetWallet.trim()) &&
        (mode === 'MIRROR' || sizeValue > 0);
    async function handleSubmit() {
        if (!validateForm())
            return;
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
        }
        catch {
            toast.error('Failed to create copy config');
        }
        finally {
            setSubmitting(false);
        }
    }
    function sizeLabel() {
        if (mode === 'PERCENTAGE')
            return `${sizeValue}% of trade`;
        if (mode === 'FIXED')
            return `$${sizeValue.toFixed(2)} fixed`;
        return 'Mirror (1:1)';
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-2xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/copy", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to Copy Trading"] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Copy, { className: "size-6 text-pf-cyan-400" }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "New Copy Config" })] }), _jsx("div", { className: "flex items-center gap-2", children: STEPS.map((label, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => i < step && setStep(i), disabled: i > step, className: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${i === step
                                ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                                : i < step
                                    ? 'bg-pf-success/10 border-pf-success/30 text-pf-success cursor-pointer'
                                    : 'border-pf-border text-pf-text-muted'}`, children: [_jsx("span", { className: "size-5 rounded-full bg-pf-overlay flex items-center justify-center text-[10px] font-bold", children: i + 1 }), label] }), i < STEPS.length - 1 && (_jsx(ChevronRight, { className: "size-3 text-pf-text-muted shrink-0" }))] }, label))) }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5", children: [step === 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Target Wallet Address" }), _jsx("input", { type: "text", placeholder: "0x... paste wallet address", value: targetWallet, onChange: (e) => setTargetWallet(e.target.value), className: "w-full px-4 py-3 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border hover:border-pf-border-strong focus:border-pf-cyan-500/50 focus:outline-none transition-colors placeholder:text-pf-text-muted font-mono" }), followedWhales.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-pf-text-secondary mb-2", children: "Or select from followed whales:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: loadingWhales ? (_jsx("div", { className: "h-8 w-32 bg-pf-overlay rounded-pf-sm animate-pulse" })) : (followedWhales.map((w) => (_jsx("button", { onClick: () => setTargetWallet(w.walletAddress), className: `flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-mono border transition-colors ${targetWallet === w.walletAddress
                                                ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                                                : 'border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text'}`, children: truncateAddress(w.walletAddress) }, w.walletAddress)))) })] }))] })), step === 1 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Copy Mode" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: MODE_OPTIONS.map((opt) => {
                                    const Icon = opt.icon;
                                    const selected = mode === opt.value;
                                    return (_jsxs("button", { onClick: () => setMode(opt.value), className: `flex flex-col items-start gap-2 p-4 rounded-pf-lg border text-left transition-all duration-150 ${selected
                                            ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 shadow-pf-sm'
                                            : 'border-pf-border hover:border-pf-border-strong'}`, children: [_jsx(Icon, { className: `size-5 ${selected ? 'text-pf-cyan-400' : 'text-pf-text-muted'}` }), _jsx("span", { className: `text-sm font-medium ${selected ? 'text-pf-cyan-400' : 'text-pf-text'}`, children: opt.label }), _jsx("span", { className: "text-[11px] text-pf-text-secondary leading-snug", children: opt.description })] }, opt.value));
                                }) })] })), step === 2 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-pf-text", children: mode === 'MIRROR' ? 'Mirror Mode' : mode === 'PERCENTAGE' ? 'Trade Size (%)' : 'Fixed Amount ($)' }), mode === 'MIRROR' ? (_jsx("p", { className: "text-sm text-pf-text-secondary", children: "In mirror mode, every trade is copied at the exact same size (1:1). Make sure you have sufficient balance to cover the trades." })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("input", { type: "range", min: mode === 'PERCENTAGE' ? 1 : 1, max: mode === 'PERCENTAGE' ? 100 : 10000, step: mode === 'PERCENTAGE' ? 1 : 10, value: sizeValue, onChange: (e) => setSizeValue(Number(e.target.value)), className: "w-full accent-[var(--color-pf-cyan-500)]" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "number", min: 0, value: sizeValue, onChange: (e) => setSizeValue(Number(e.target.value)), className: "w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" }), _jsx("span", { className: "text-sm text-pf-text-secondary", children: mode === 'PERCENTAGE' ? '%' : 'USD' })] })] }))] })), step === 3 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Risk Controls" }), _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: "Max Exposure ($)" }), _jsx("input", { type: "range", min: 100, max: 50000, step: 100, value: maxExposure, onChange: (e) => setMaxExposure(Number(e.target.value)), className: "w-full accent-[var(--color-pf-cyan-500)]" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "number", min: 0, value: maxExposure, onChange: (e) => setMaxExposure(Number(e.target.value)), className: "w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" }), _jsx("span", { className: "text-sm text-pf-text-secondary", children: "USD" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: "Max Daily Loss ($)" }), _jsx("input", { type: "range", min: 10, max: 10000, step: 10, value: maxDailyLoss, onChange: (e) => setMaxDailyLoss(Number(e.target.value)), className: "w-full accent-[var(--color-pf-cyan-500)]" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "number", min: 0, value: maxDailyLoss, onChange: (e) => setMaxDailyLoss(Number(e.target.value)), className: "w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" }), _jsx("span", { className: "text-sm text-pf-text-secondary", children: "USD" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: "Price Offset (%)" }), _jsx("input", { type: "range", min: -5, max: 5, step: 0.1, value: priceOffset, onChange: (e) => setPriceOffset(Number(e.target.value)), className: "w-full accent-[var(--color-pf-cyan-500)]" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "number", min: -5, max: 5, step: 0.1, value: priceOffset, onChange: (e) => setPriceOffset(Number(e.target.value)), className: "w-32 px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" }), _jsx("span", { className: "text-sm text-pf-text-secondary", children: "%" })] })] })] })] })), step === 4 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Review Configuration" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "py-2 border-b border-pf-border-subtle", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Target Wallet" }), _jsx("span", { className: "font-mono text-sm text-pf-text", children: truncateAddress(targetWallet) })] }), validationErrors.wallet && (_jsx("p", { className: "text-xs text-pf-danger mt-1", children: validationErrors.wallet }))] }), _jsxs("div", { className: "flex items-center justify-between py-2 border-b border-pf-border-subtle", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Mode" }), _jsx("span", { className: "text-sm text-pf-text", children: mode })] }), _jsxs("div", { className: "py-2 border-b border-pf-border-subtle", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Trade Size" }), _jsx("span", { className: "text-sm font-mono text-pf-text", children: sizeLabel() })] }), validationErrors.size && (_jsx("p", { className: "text-xs text-pf-danger mt-1", children: validationErrors.size }))] }), _jsxs("div", { className: "flex items-center justify-between py-2 border-b border-pf-border-subtle", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Max Exposure" }), _jsxs("span", { className: "text-sm font-mono text-pf-text", children: ["$", maxExposure.toLocaleString()] })] }), _jsxs("div", { className: "flex items-center justify-between py-2 border-b border-pf-border-subtle", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Max Daily Loss" }), _jsxs("span", { className: "text-sm font-mono text-pf-text", children: ["$", maxDailyLoss.toLocaleString()] })] }), _jsxs("div", { className: "flex items-center justify-between py-2", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Price Offset" }), _jsxs("span", { className: "text-sm font-mono text-pf-text", children: [priceOffset > 0 ? '+' : '', priceOffset, "%"] })] })] })] }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("button", { onClick: prevStep, disabled: step === 0, className: "flex items-center gap-1.5 px-4 py-2.5 rounded-pf text-sm text-pf-text-secondary hover:text-pf-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: [_jsx(ChevronLeft, { className: "size-4" }), " Back"] }), step < STEPS.length - 1 ? (_jsxs("button", { onClick: nextStep, disabled: !canAdvance(), className: "flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: ["Next ", _jsx(ChevronRight, { className: "size-4" })] })) : (_jsxs("button", { onClick: handleSubmit, disabled: submitting || !isFormValid, className: "flex items-center gap-2 px-5 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors", children: [_jsx(Rocket, { className: "size-4" }), submitting ? 'Starting...' : 'Start Copying'] }))] })] }));
}
