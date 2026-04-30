/* Primitive UI components shared across the API docs page. */

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import type { EndpointField } from './api-docs-endpoints';
import { Button } from '@polyforge/ui';

export type Lang = 'curl' | 'ts' | 'py' | 'rust';

export const LANG_LABELS: Record<Lang, string> = {
  curl: 'cURL',
  ts: 'TypeScript',
  py: 'Python',
  rust: 'Rust',
};

export const METHOD_CLS: Record<string, string> = {
  GET:    'bg-gain/10 text-gain',
  POST:   'bg-info/10 text-info',
  PATCH:  'bg-warning/10 text-warning',
  DELETE: 'bg-loss/10 text-loss',
};

export const METHOD_BORDER: Record<string, string> = {
  GET:    'border-l-gain/50',
  POST:   'border-l-info/50',
  PATCH:  'border-l-warning/50',
  DELETE: 'border-l-loss/50',
};

export const SCOPE_CLS: Record<string, string> = {
  READ:  'bg-gain/10 text-gain',
  WRITE: 'bg-info/10 text-info',
  TRADE: 'bg-warning/10 text-warning',
  None:  'bg-overlay text-tertiary',
};

/* ─── Badge ──────────────────────────────────────────────────────── */

export function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex items-center text-label font-medium px-2 py-1 rounded-full ${cls}`}>
      {text}
    </span>
  );
}

/* ─── Code (with copy button) ────────────────────────────────────── */

export function Code({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="rounded-pf overflow-hidden border border-default">
      {lang && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-default">
          <span className="text-label font-mono text-tertiary">
            {LANG_LABELS[lang as Lang] ?? lang}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy code"
            className="flex items-center gap-1 text-label text-tertiary hover:text-primary transition-colors cursor-pointer"
          >
            {copied
              ? <><Check size={12} className="text-gain" /><span className="text-gain">Copied</span></>
              : <><Copy size={12} /><span>Copy</span></>
            }
          </Button>
        </div>
      )}
      <pre className="bg-app px-4 py-4 text-label font-mono text-primary overflow-x-auto whitespace-pre leading-relaxed">
        {code.trim()}
      </pre>
    </div>
  );
}

/* ─── InlineCode ─────────────────────────────────────────────────── */

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="bg-overlay px-2 py-1 rounded text-label font-mono text-accent-text">
      {children}
    </code>
  );
}

/* ─── FieldTable ─────────────────────────────────────────────────── */

export function FieldTable({ fields }: { fields: EndpointField[] }) {
  return (
    <div className="border border-default rounded-pf overflow-hidden">
      <table className="w-full text-body-sm" aria-label="Field definitions">
        <caption className="sr-only">Field definitions</caption>
        <thead>
          <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider border-b border-default">
            <th scope="col" className="px-4 py-3 font-medium">Field</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
            <th scope="col" className="px-4 py-3 font-medium">Req.</th>
            <th scope="col" className="px-4 py-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {fields.map(f => (
            <tr key={f.name} className="group hover:bg-elevated/50 transition-colors">
              <td className="px-4 py-3 font-mono text-accent-text text-label">{f.name}</td>
              <td className="px-4 py-3 text-secondary text-label">{f.type}</td>
              <td className="px-4 py-3 text-label">
                {f.required
                  ? <span className="text-gain">✓</span>
                  : <span className="text-tertiary">—</span>}
              </td>
              <td className="px-4 py-3 text-secondary text-label leading-relaxed">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Sub ────────────────────────────────────────────────────────── */

export function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-label font-medium text-tertiary uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

/* ─── LangTabs ───────────────────────────────────────────────────── */

export function LangTabs({
  lang,
  setLang,
  available,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  available: Lang[];
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {available.map(l => (
        <Button
          type="button"
          variant="ghost"
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-full text-label font-medium border transition-colors cursor-pointer ${
            lang === l
              ? 'bg-accent-subtle text-accent-text border-accent/30'
              : 'border-default text-secondary hover:border-strong hover:text-primary'
          }`}
        >
          {LANG_LABELS[l]}
        </Button>
      ))}
    </div>
  );
}

/* ─── PageTitle ──────────────────────────────────────────────────── */

export function PageTitle({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle?: string;
  count?: number;
}) {
  return (
    <div className="pb-5 mb-6 border-b border-subtle">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-semibold text-primary">{title}</h1>
        {count !== undefined && (
          <span className="inline-flex items-center text-label font-medium px-2 py-1 rounded-full bg-overlay text-tertiary">
            {count} endpoint{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-body-sm text-secondary leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
