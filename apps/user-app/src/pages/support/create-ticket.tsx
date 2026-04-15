import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Button, Input, Select, Textarea } from '@polyforge/ui';

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate('/support')}
          className="p-2 rounded-pf text-tertiary hover:text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
          aria-label="Back to support"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <h1 className="text-2xl font-semibold text-primary">New Support Ticket</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-elevated border border-default rounded-pf-lg p-6 space-y-5">
        <div>
          <label htmlFor="ticket-subject" className="text-xs text-secondary uppercase tracking-wider mb-2 block">Subject</label>
          <Input
            id="ticket-subject"
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, subject: true }))}
            placeholder="Brief description of your issue"
            aria-required="true"
            aria-describedby={subjectError ? 'ticket-subject-error' : undefined}
            className={`w-full h-10 px-3 rounded-pf bg-surface border text-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-1 focus-visible:ring-accent/20 transition-colors ${subjectError ? 'border-loss/50' : 'border-default'}`}
          />
          {subjectError && <p id="ticket-subject-error" className="mt-1 text-xs text-loss">{subjectError}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ticket-category" className="text-xs text-secondary uppercase tracking-wider mb-2 block">Category</label>
            <Select
              id="ticket-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-pf bg-surface border border-default text-sm text-primary focus-visible:outline-none focus-visible:border-accent/50"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="ticket-priority" className="text-xs text-secondary uppercase tracking-wider mb-2 block">Priority</label>
            <Select
              id="ticket-priority"
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full h-10 px-3 rounded-pf bg-surface border border-default text-sm text-primary focus-visible:outline-none focus-visible:border-accent/50"
            >
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="ticket-body" className="text-xs text-secondary uppercase tracking-wider mb-2 block">Description</label>
          <Textarea
            id="ticket-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, body: true }))}
            placeholder="Describe your issue in detail..."
            rows={6}
            aria-required="true"
            aria-describedby={bodyError ? 'ticket-body-error' : undefined}
            className={`w-full px-3 py-3 rounded-pf bg-surface border text-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-1 focus-visible:ring-accent/20 transition-colors resize-y ${bodyError ? 'border-loss/50' : 'border-default'}`}
          />
          {bodyError && <p id="ticket-body-error" className="mt-1 text-xs text-loss">{bodyError}</p>}
        </div>

        {error && (
          <div role="alert" className="text-sm text-loss bg-loss/10 px-3 py-2 rounded-pf">{error}</div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-3 rounded-pf bg-accent text-inverse text-sm font-medium hover:bg-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Submit Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
