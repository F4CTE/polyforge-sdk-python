import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@polyforge/ui';
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
      <h2 className="text-lg font-semibold text-primary">Invites</h2>

      {/* Generate Form */}
      <div className="bg-elevated border border-default rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-primary">Generate Invite Codes</h3>
        </div>
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="invite-count" className="block text-xs text-tertiary mb-1">Count</label>
            <Input
              id="invite-count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm rounded-pf-sm border border-default bg-app text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="invite-max-uses" className="block text-xs text-tertiary mb-1">Max Uses</label>
            <Input
              id="invite-max-uses"
              type="number"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm rounded-pf-sm border border-default bg-app text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="invite-ttl" className="block text-xs text-tertiary mb-1">TTL (days)</label>
            <Input
              id="invite-ttl"
              type="number"
              min={1}
              max={365}
              value={ttlDays}
              onChange={(e) => setTtlDays(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm rounded-pf-sm border border-default bg-app text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            />
          </div>
          <Button
            type="submit"
            variant="default"
            disabled={generating}
            className="px-4 py-2 text-sm font-semibold rounded-pf-sm bg-accent text-inverse hover:bg-accent-text disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </form>

        {/* Generated Codes */}
        {generatedCodes.length > 0 && (
          <div className="mt-4 p-3 rounded-pf-sm bg-app border border-default">
            <div className="text-xs text-tertiary mb-2">Generated codes:</div>
            <div className="space-y-1">
              {generatedCodes.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <code className="text-sm font-mono text-accent">{code}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyCode(code)}
                    className="p-1 rounded hover:bg-elevated text-tertiary hover:text-accent-text transition-colors"
                    aria-label={`Copy code ${code}`}
                  >
                    <Copy size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Invites Table */}
      <div className="bg-elevated border border-default rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-primary">
            Active Invites ({invites.length})
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading invite codes">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-app rounded animate-pulse" />
            ))}
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-12">
            <KeyRound className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
            <p className="text-secondary font-medium">No active invites</p>
            <p className="text-tertiary text-xs mt-1">Generate invite codes above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Active invite codes</caption>
              <thead>
                <tr className="border-b border-default">
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-tertiary uppercase">Code</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-tertiary uppercase">Remaining Uses</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-tertiary uppercase">TTL</th>
                  <th scope="col" className="text-right px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.code} className="border-b border-default last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-primary">{inv.code}</code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copyCode(inv.code)}
                          className="p-1 rounded hover:bg-app text-tertiary hover:text-accent-text transition-colors"
                          aria-label={`Copy code ${inv.code}`}
                        >
                          <Copy size={12} />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-secondary">
                      {inv.remainingUses}
                    </td>
                    <td className="px-3 py-3 text-right text-tertiary">
                      {inv.ttl > 0 ? `${Math.ceil(inv.ttl / 86400)}d` : 'No expiry'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {confirmRevokeCode === inv.code ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <Button type="button" variant="danger" onClick={() => handleDelete(inv.code)} className="px-2 py-1 rounded bg-loss/10 text-loss hover:bg-loss/20 transition-colors">Revoke</Button>
                          <Button type="button" variant="secondary" onClick={() => setConfirmRevokeCode(null)} className="px-2 py-1 rounded bg-elevated text-secondary hover:bg-app transition-colors">Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmRevokeCode(inv.code)}
                          className="p-1 rounded hover:bg-loss/10 text-tertiary hover:text-loss transition-colors"
                          aria-label="Revoke invite"
                          title="Revoke invite"
                        >
                          <Trash2 size={14} />
                        </Button>
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
