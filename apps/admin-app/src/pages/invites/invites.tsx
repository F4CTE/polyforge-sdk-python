import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Mail, Plus, Trash2, Copy, KeyRound } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Invite {
  code: string;
  remainingUses: number;
  ttl: number;
}

export function Component() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [ttlDays, setTtlDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      const res = await adminApi.listInvites();
      setInvites(res);
    } catch {
      toast.error('Failed to load invites');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await adminApi.generateInvites(count, maxUses, ttlDays || undefined);
      setGeneratedCodes(res.codes);
      toast.success(`Generated ${res.codes.length} invite code(s)`);
      loadInvites();
    } catch {
      toast.error('Failed to generate invites');
    } finally {
      setGenerating(false);
    }
  }

  const [confirmRevokeCode, setConfirmRevokeCode] = useState<string | null>(null);

  async function handleDelete(code: string) {
    setConfirmRevokeCode(null);
    try {
      await adminApi.revokeInvite(code);
      setInvites((inv) => inv.filter((i) => i.code !== code));
      toast.success('Invite revoked');
    } catch {
      toast.error('Failed to revoke invite');
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">Invites</h2>

      {/* Generate Form */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-[var(--color-pf-cyan-500)]" />
          <h3 className="text-sm font-semibold text-[var(--color-pf-text)]">Generate Invite Codes</h3>
        </div>
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-[var(--color-pf-text-tertiary)] mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-pf-text-tertiary)] mb-1">Max Uses</label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-pf-text-tertiary)] mb-1">TTL (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={ttlDays}
              onChange={(e) => setTtlDays(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="px-4 py-2 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {/* Generated Codes */}
        {generatedCodes.length > 0 && (
          <div className="mt-4 p-3 rounded-pf-sm bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]">
            <div className="text-xs text-[var(--color-pf-text-tertiary)] mb-2">Generated codes:</div>
            <div className="space-y-1">
              {generatedCodes.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <code className="text-sm font-mono text-[var(--color-pf-cyan-500)]">{code}</code>
                  <button
                    onClick={() => copyCode(code)}
                    className="p-1 rounded hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text)] transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Invites Table */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={16} className="text-[var(--color-pf-cyan-500)]" />
          <h3 className="text-sm font-semibold text-[var(--color-pf-text)]">
            Active Invites ({invites.length})
          </h3>
        </div>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-12">
            <KeyRound className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
            <p className="text-[var(--color-pf-text-secondary)] font-medium">No active invites</p>
            <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Generate invite codes above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-pf-border)]">
                  <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Code</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Remaining Uses</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">TTL</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.code} className="border-b border-[var(--color-pf-border)] last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-[var(--color-pf-text)]">{inv.code}</code>
                        <button
                          onClick={() => copyCode(inv.code)}
                          className="p-1 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text)] transition-colors"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]">
                      {inv.remainingUses}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--color-pf-text-tertiary)]">
                      {inv.ttl > 0 ? `${Math.ceil(inv.ttl / 86400)}d` : 'No expiry'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {confirmRevokeCode === inv.code ? (
                        <div className="flex items-center justify-end gap-1.5 text-xs">
                          <button onClick={() => handleDelete(inv.code)} className="px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors">Revoke</button>
                          <button onClick={() => setConfirmRevokeCode(null)} className="px-2 py-0.5 rounded bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRevokeCode(inv.code)}
                          className="p-1 rounded hover:bg-pf-danger/10 text-[var(--color-pf-text-tertiary)] hover:text-pf-danger transition-colors"
                          aria-label="Revoke invite"
                          title="Revoke invite"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
