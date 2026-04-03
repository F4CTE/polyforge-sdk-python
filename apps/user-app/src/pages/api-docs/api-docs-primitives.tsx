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
  GET:    'bg-pf-success/10 text-pf-success',
  POST:   'bg-pf-info/10 text-pf-info',
  PATCH:  'bg-pf-warning/10 text-pf-warning',
  DELETE: 'bg-pf-danger/10 text-pf-danger',
};

export const METHOD_BORDER: Record<string, string> = {
  GET:    'border-l-pf-success/50',
  POST:   'border-l-pf-info/50',
  PATCH:  'border-l-pf-warning/50',
  DELETE: 'border-l-pf-danger/50',
};

export const SCOPE_CLS: Record<string, string> = {
  READ:  'bg-pf-success/10 text-pf-success',
  WRITE: 'bg-pf-info/10 text-pf-info',
  TRADE: 'bg-pf-warning/10 text-pf-warning',
  None:  'bg-pf-overlay text-pf-text-muted',
};

/* ─── Badge ──────────────────────────────────────────────────────── */

export function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-pf-full ${cls}`}>
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
    <div className="rounded-pf-lg overflow-hidden border border-pf-border">
      {lang && (
        <div className="flex items-center justify-between px-4 py-2 bg-pf-surface border-b border-pf-border">
          <span className="text-[11px] font-mono text-pf-text-muted">
            {LANG_LABELS[lang as Lang] ?? lang}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy code"
            className="flex items-center gap-1 text-[11px] text-pf-text-muted hover:text-pf-text transition-colors cursor-pointer"
          >
            {copied
              ? <><Check size={12} className="text-pf-success" /><span className="text-pf-success">Copied</span></>
              : <><Copy size={12} /><span>Copy</span></>
            }
          </Button>
        </div>
      )}
      <pre className="bg-pf-base px-4 py-3.5 text-[11.5px] font-mono text-pf-text overflow-x-auto whitespace-pre leading-relaxed">
        {code.trim()}
      </pre>
    </div>
  );
}

/* ─── InlineCode ─────────────────────────────────────────────────── */

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="bg-pf-overlay px-1.5 py-0.5 rounded text-[11px] font-mono text-pf-cyan-400">
      {children}
    </code>
  );
}

/* ─── FieldTable ─────────────────────────────────────────────────── */

export function FieldTable({ fields }: { fields: EndpointField[] }) {
  return (
    <div className="border border-pf-border rounded-pf-lg overflow-hidden">
      <table className="w-full text-sm" aria-label="Field definitions">
        <thead>
          <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border">
            <th scope="col" className="px-4 py-3 font-medium">Field</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
            <th scope="col" className="px-4 py-3 font-medium">Req.</th>
            <th scope="col" className="px-4 py-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pf-border-subtle">
          {fields.map(f => (
            <tr key={f.name} className="group hover:bg-pf-elevated/50 transition-colors">
              <td className="px-4 py-3 font-mono text-pf-cyan-400 text-xs">{f.name}</td>
              <td className="px-4 py-3 text-pf-text-secondary text-xs">{f.type}</td>
              <td className="px-4 py-3 text-xs">
                {f.required
                  ? <span className="text-pf-success">✓</span>
                  : <span className="text-pf-text-muted">—</span>}
              </td>
              <td className="px-4 py-3 text-pf-text-secondary text-xs leading-relaxed">{f.description}</td>
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
      <h3 className="text-xs font-medium text-pf-text-muted uppercase tracking-wider">{title}</h3>
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
    <div className="flex flex-wrap gap-1.5 mb-3">
      {available.map(l => (
        <Button
          type="button"
          variant="ghost"
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors cursor-pointer ${
            lang === l
              ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
              : 'border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text'
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
    <div className="pb-5 mb-6 border-b border-pf-border-subtle">
      <div className="flex items-center gap-3 mb-1.5">
        <h1 className="text-2xl font-semibold text-pf-text">{title}</h1>
        {count !== undefined && (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-pf-full bg-pf-overlay text-pf-text-muted">
            {count} endpoint{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-pf-text-secondary leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
