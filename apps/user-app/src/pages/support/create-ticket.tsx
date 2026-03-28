import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';

/* ─── Constants ──────────────────────────────────────────────────────── */

const CATEGORIES = [
  { label: 'General', value: 'GENERAL' },
  { label: 'Billing', value: 'BILLING' },
  { label: 'Technical', value: 'TECHNICAL' },
  { label: 'Account', value: 'ACCOUNT' },
  { label: 'Bug Report', value: 'BUG' },
  { label: 'Feature Request', value: 'FEATURE_REQUEST' },
];

const PRIORITIES = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const subjectError = touched.subject && !subject.trim() ? 'Subject is required' : '';
  const bodyError = touched.body && !body.trim() ? 'Description is required' : '';

  const canSubmit = subject.trim() && body.trim() && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ subject: true, body: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/v1/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject: subject.trim(), category, priority, body: body.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/support/${data.id}`);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.message ?? 'Failed to create ticket.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  }

  return (
    <div className="animate-fade-in p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/support')}
          className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
          aria-label="Back to support"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-semibold text-pf-text">New Support Ticket</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
        <div>
          <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, subject: true }))}
            placeholder="Brief description of your issue"
            className={`w-full h-10 px-3 rounded-pf bg-pf-surface border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors ${subjectError ? 'border-pf-danger/50' : 'border-pf-border'}`}
          />
          {subjectError && <p className="mt-1 text-xs text-pf-danger">{subjectError}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            >
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Description</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, body: true }))}
            placeholder="Describe your issue in detail..."
            rows={6}
            className={`w-full px-3 py-2.5 rounded-pf bg-pf-surface border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors resize-y ${bodyError ? 'border-pf-danger/50' : 'border-pf-border'}`}
          />
          {bodyError && <p className="mt-1 text-xs text-pf-danger">{bodyError}</p>}
        </div>

        {error && (
          <div className="text-sm text-pf-danger bg-pf-danger/10 px-3 py-2 rounded-pf">{error}</div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Submit Ticket
          </button>
        </div>
      </form>
    </div>
  );
}
