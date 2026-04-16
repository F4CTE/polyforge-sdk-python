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
import { Button, Input, Textarea } from '@polyforge/ui';

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
        ? 'bg-gain/10 text-gain'
        : responseStatus < 500
        ? 'bg-warning/10 text-warning'
        : 'bg-loss/10 text-loss'
      : '';

  return (
    <div className="border border-default rounded-xl p-4 space-y-3 bg-elevated">
      <p className="text-label font-medium text-tertiary uppercase tracking-wider">Try it out</p>

      {/* API key */}
      <div className="space-y-1">
        <label className="text-label text-tertiary">API Key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="pf_live_your_key..."
          className="w-full bg-app border border-default rounded-sm px-3 py-2 text-label text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 font-mono"
        />
      </div>

      {/* Path params */}
      {paramNames.map(name => (
        <div key={name} className="space-y-1">
          <label className="text-label text-tertiary font-mono">:{name}</label>
          <Input
            type="text"
            value={pathParams[name] ?? ''}
            onChange={e => setPathParams(prev => ({ ...prev, [name]: e.target.value }))}
            placeholder={name}
            className="w-full bg-app border border-default rounded-sm px-3 py-2 text-label text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 font-mono"
          />
        </div>
      ))}

      {/* Request body */}
      {['POST', 'PATCH'].includes(ep.method) && (
        <div className="space-y-1">
          <label className="text-label text-tertiary">Request Body (JSON)</label>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            className="w-full bg-app border border-default rounded-sm px-3 py-2 text-label text-primary font-mono focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 resize-y"
          />
        </div>
      )}

      <Button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-sm bg-accent text-inverse text-label font-semibold hover:bg-accent-text transition-colors disabled:opacity-50 cursor-pointer"
      >
        <Play size={11} /> {loading ? 'Sending…' : 'Send'}
      </Button>

      {error && (
        <p className="text-label text-loss bg-loss/10 border border-loss/20 rounded-pf px-3 py-2">
          {error}
        </p>
      )}

      {responseStatus != null && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-label text-tertiary">Status</span>
            <Badge text={String(responseStatus)} cls={statusCls} />
          </div>
          <Code code={responseText || '(empty response)'} lang="ts" />
        </div>
      )}

      <p className="text-caption text-tertiary">
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
      className={`border border-default border-l-[3px] ${METHOD_BORDER[ep.method]} rounded-xl overflow-hidden transition-all duration-panel ${isOpen ? '' : 'hover:border-strong'}`}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-elevated hover:bg-elevated/80 text-left transition-colors duration-panel cursor-pointer"
        aria-expanded={isOpen}
      >
        <Badge text={ep.method} cls={METHOD_CLS[ep.method]} />
        <code className="flex-1 text-label font-mono text-primary">{ep.path}</code>
        <span className="hidden sm:block text-label text-tertiary mr-2 truncate max-w-48">
          {ep.summary}
        </span>
        {ep.status === 'beta' && (
          <Badge text="beta" cls="bg-warning/10 text-warning" />
        )}
        {ep.status === 'deprecated' && (
          <Badge text="deprecated" cls="bg-loss/10 text-loss" />
        )}
        <Badge text={ep.scope} cls={`${SCOPE_CLS[ep.scope]} hidden sm:inline-flex`} />
        {isOpen
          ? <ChevronDown className="size-4 text-tertiary shrink-0" />
          : <ChevronRight className="size-4 text-tertiary shrink-0" />
        }
      </Button>

      {isOpen && (
        <div className="border-t border-default bg-app px-4 py-5 space-y-5">
          <p className="text-body-sm text-secondary leading-relaxed">
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
            <p className="text-label text-tertiary bg-elevated border border-default rounded-pf px-3 py-3">
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTryItOpen(v => !v)}
            className="text-label text-accent-text hover:text-accent-text flex items-center gap-2"
          >
            <Play size={12} /> {tryItOpen ? 'Close' : 'Try it out'}
          </Button>

          {tryItOpen && <TryItPanel ep={ep} />}
        </div>
      )}
    </div>
  );
}
