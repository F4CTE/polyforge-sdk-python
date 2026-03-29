/* EndpointCard — accordion with Try It Out panel. */

import { useState } from 'react';
import { ChevronRight, ChevronDown, Play } from 'lucide-react';
import type { EndpointDef } from './api-docs-endpoints';
import {
  Badge,
  Code,
  FieldTable,
  LangTabs,
  Sub,
  METHOD_CLS,
  METHOD_BORDER,
  SCOPE_CLS,
  type Lang,
} from './api-docs-primitives';

/* ─── Try It Out panel ───────────────────────────────────────────── */

function TryItPanel({ ep }: { ep: EndpointDef }) {
  const [apiKey, setApiKey] = useState('');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState(() => {
    if (!ep.requestFields || ep.requestFields.length === 0) return '';
    const obj: Record<string, string> = {};
    ep.requestFields.forEach(f => { obj[f.name] = ''; });
    return JSON.stringify(obj, null, 2);
  });
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Parse :param segments from path
  const paramNames = (ep.path.match(/:([a-zA-Z_]+)/g) ?? []).map(p => p.slice(1));

  function resolvedPath() {
    let p = ep.path;
    paramNames.forEach(name => {
      p = p.replace(`:${name}`, pathParams[name] ?? `:${name}`);
    });
    return p;
  }

  async function handleSend() {
    setLoading(true);
    setError('');
    setResponseText('');
    setResponseStatus(null);
    try {
      const url = `https://api.polyforge.app${resolvedPath()}`;
      const isBodyMethod = ['POST', 'PATCH'].includes(ep.method);
      const res = await fetch(url, {
        method: ep.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        ...(isBodyMethod && body ? { body } : {}),
      });
      setResponseStatus(res.status);
      const text = await res.text();
      try {
        setResponseText(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponseText(text);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const statusCls =
    responseStatus != null
      ? responseStatus < 300
        ? 'bg-pf-success/10 text-pf-success'
        : responseStatus < 500
        ? 'bg-pf-warning/10 text-pf-warning'
        : 'bg-pf-danger/10 text-pf-danger'
      : '';

  return (
    <div className="border border-pf-border rounded-pf-lg p-4 space-y-3 bg-pf-elevated">
      <p className="text-xs font-medium text-pf-text-muted uppercase tracking-wider">Try it out</p>

      {/* API key */}
      <div className="space-y-1">
        <label className="text-xs text-pf-text-muted">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="pf_live_your_key..."
          className="w-full bg-pf-base border border-pf-border rounded-pf-sm px-3 py-1.5 text-xs text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500 focus:ring-1 focus:ring-pf-cyan-500/50 font-mono"
        />
      </div>

      {/* Path params */}
      {paramNames.map(name => (
        <div key={name} className="space-y-1">
          <label className="text-xs text-pf-text-muted font-mono">:{name}</label>
          <input
            type="text"
            value={pathParams[name] ?? ''}
            onChange={e => setPathParams(prev => ({ ...prev, [name]: e.target.value }))}
            placeholder={name}
            className="w-full bg-pf-base border border-pf-border rounded-pf-sm px-3 py-1.5 text-xs text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500 focus:ring-1 focus:ring-pf-cyan-500/50 font-mono"
          />
        </div>
      ))}

      {/* Request body */}
      {['POST', 'PATCH'].includes(ep.method) && (
        <div className="space-y-1">
          <label className="text-xs text-pf-text-muted">Request Body (JSON)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            className="w-full bg-pf-base border border-pf-border rounded-pf-sm px-3 py-1.5 text-xs text-pf-text font-mono focus:outline-none focus:border-pf-cyan-500 focus:ring-1 focus:ring-pf-cyan-500/50 resize-y"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-pf-sm bg-pf-cyan-500 text-black text-xs font-semibold hover:bg-pf-cyan-400 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <Play size={11} /> {loading ? 'Sending…' : 'Send'}
      </button>

      {error && (
        <p className="text-xs text-pf-danger bg-pf-danger/10 border border-pf-danger/20 rounded-pf px-3 py-2">
          {error}
        </p>
      )}

      {responseStatus != null && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-pf-text-muted">Status</span>
            <Badge text={String(responseStatus)} cls={statusCls} />
          </div>
          <Code code={responseText || '(empty response)'} lang="ts" />
        </div>
      )}

      <p className="text-[10px] text-pf-text-muted">
        Requests go directly to api.polyforge.app from your browser.
      </p>
    </div>
  );
}

/* ─── EndpointCard ───────────────────────────────────────────────── */

interface EndpointCardProps {
  ep: EndpointDef;
  lang: Lang;
  setLang: (l: Lang) => void;
  forceOpen?: boolean;
}

export function EndpointCard({ ep, lang, setLang, forceOpen }: EndpointCardProps) {
  const [open, setOpen] = useState(false);
  const [tryItOpen, setTryItOpen] = useState(false);

  const isOpen = forceOpen !== undefined ? forceOpen : open;
  const available = (Object.keys(ep.examples) as Lang[]).filter(k => ep.examples[k]);
  const code = ep.examples[lang] ?? ep.examples[available[0] ?? 'curl'] ?? '';

  return (
    <div
      className={`border border-pf-border border-l-[3px] ${METHOD_BORDER[ep.method]} rounded-pf-lg overflow-hidden transition-all duration-200 ${isOpen ? '' : 'hover:border-pf-border-strong'}`}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-pf-elevated hover:bg-pf-elevated/80 text-left transition-colors duration-200 cursor-pointer"
        aria-expanded={isOpen}
      >
        <Badge text={ep.method} cls={METHOD_CLS[ep.method]} />
        <code className="flex-1 text-xs font-mono text-pf-text">{ep.path}</code>
        <span className="hidden sm:block text-xs text-pf-text-muted mr-2 truncate max-w-48">
          {ep.summary}
        </span>
        {ep.status === 'beta' && (
          <Badge text="beta" cls="bg-pf-warning/10 text-pf-warning" />
        )}
        {ep.status === 'deprecated' && (
          <Badge text="deprecated" cls="bg-pf-danger/10 text-pf-danger" />
        )}
        <Badge text={ep.scope} cls={`${SCOPE_CLS[ep.scope]} hidden sm:inline-flex`} />
        {isOpen
          ? <ChevronDown className="size-4 text-pf-text-muted shrink-0" />
          : <ChevronRight className="size-4 text-pf-text-muted shrink-0" />
        }
      </button>

      {isOpen && (
        <div className="border-t border-pf-border bg-pf-base px-4 py-5 space-y-5">
          <p className="text-sm text-pf-text-secondary leading-relaxed">
            {ep.description ?? ep.summary}
          </p>

          {ep.queryParams && ep.queryParams.length > 0 && (
            <Sub title="Query Parameters">
              <FieldTable fields={ep.queryParams} />
            </Sub>
          )}

          {ep.requestFields && ep.requestFields.length > 0 && (
            <Sub title="Request Body">
              <FieldTable fields={ep.requestFields} />
            </Sub>
          )}

          {ep.responseNote && (
            <p className="text-xs text-pf-text-muted bg-pf-elevated border border-pf-border rounded-pf px-3 py-2.5">
              {ep.responseNote}
            </p>
          )}

          {available.length > 0 && (
            <>
              <LangTabs lang={lang} setLang={setLang} available={available} />
              <Code code={code} lang={lang} />
            </>
          )}

          {ep.response && (
            <Sub title="Response">
              <Code code={ep.response} lang="ts" />
            </Sub>
          )}

          {/* Try it out */}
          <button
            type="button"
            onClick={() => setTryItOpen(v => !v)}
            className="text-xs text-pf-cyan-400 hover:text-pf-cyan-300 flex items-center gap-1.5"
          >
            <Play size={12} /> {tryItOpen ? 'Close' : 'Try it out'}
          </button>

          {tryItOpen && <TryItPanel ep={ep} />}
        </div>
      )}
    </div>
  );
}
