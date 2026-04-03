import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Input, Select } from '@polyforge/ui';
import { ShieldCheck, Plus, Pencil, Trash2, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
import { formatDate } from '@/lib/utils';

interface AdminView {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active?: boolean;
  createdAt?: string;
  lastSeen?: string;
  [key: string]: unknown;
}

type DialogMode = 'add' | 'edit' | null;

export function Component() {
  const { isSuperAdmin, admin: currentAdmin } = useAdminAuthStore();
  const [admins, setAdmins] = useState<AdminView[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'ADMIN',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    try {
      const res = await adminApi.listAdmins();
      setAdmins(res);
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm({ email: '', displayName: '', password: '', role: 'ADMIN' });
    setEditId(null);
    setDialogMode('add');
  }

  function openEdit(admin: AdminView) {
    setForm({
      email: admin.email,
      displayName: admin.displayName,
      password: '',
      role: admin.role,
    });
    setEditId(admin.id);
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode(null);
    setEditId(null);
    setForm({ email: '', displayName: '', password: '', role: 'ADMIN' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (dialogMode === 'add') {
        const newAdmin = await adminApi.createAdmin({
          email: form.email,
          displayName: form.displayName,
          password: form.password,
          role: form.role,
        });
        setAdmins((a) => [...a, newAdmin]);
        toast.success('Admin created');
      } else if (dialogMode === 'edit' && editId) {
        const data: Record<string, string | number | boolean> = {
          displayName: form.displayName,
          role: form.role,
        };
        if (form.password) data.password = form.password;
        const updated = await adminApi.updateAdmin(editId, data);
        setAdmins((a) => a.map((ad) => (ad.id === editId ? updated : ad)));
        toast.success('Admin updated');
      }
      closeDialog();
    } catch (err: unknown) {
      const apiErr = err as { body?: { message?: string } };
      toast.error(apiErr?.body?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deleteConfirmId) return;
    setSubmitting(true);
    try {
      await adminApi.deactivateAdmin(deleteConfirmId, deletePassword);
      setAdmins((a) => a.filter((ad) => ad.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      setDeletePassword('');
      toast.success('Admin deactivated');
    } catch {
      toast.error('Failed to deactivate admin');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <ShieldCheck size={48} className="mx-auto text-pf-text-tertiary mb-4" aria-hidden="true" />
        <p className="text-pf-text-secondary">Super Admin access required</p>
      </div>
    );
  }

  const roleLabel = (role: string) =>
    role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'ADMIN' ? 'Admin' : 'Viewer';

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pf-text">Admin Accounts</h2>
        <Button
          type="button"
          variant="default"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-pf-sm bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add Admin
        </Button>
      </div>

      {/* Table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Admin accounts</caption>
            <thead>
              <tr className="border-b border-pf-border">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Name</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Email</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Role</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Created</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <ShieldCheck className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-pf-text-secondary font-medium">No admins found</p>
                    <p className="text-pf-text-tertiary text-xs mt-1">Add an admin account to get started</p>
                  </td>
                </tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.id} className="border-b border-pf-border last:border-0 hover:bg-pf-base transition-colors">
                    <td className="px-4 py-3 font-medium text-pf-text">{a.displayName}</td>
                    <td className="px-4 py-3 text-pf-text-secondary">{a.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.role === 'SUPER_ADMIN'
                          ? 'text-pf-warning bg-pf-warning/10'
                          : a.role === 'ADMIN'
                            ? 'text-pf-info bg-pf-info/10'
                            : 'text-pf-text-secondary bg-pf-elevated'
                      }`}>
                        {roleLabel(a.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-pf-text-tertiary">{formatDate(a.createdAt ?? "")}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(a)}
                          className="p-1.5 rounded hover:bg-pf-base text-pf-text-tertiary hover:text-pf-text cursor-pointer transition-colors"
                          aria-label="Edit admin"
                          title="Edit admin"
                        >
                          <Pencil size={14} />
                        </Button>
                        {a.id !== currentAdmin?.id && (
                          <Button
                            type="button"
                            variant="danger"
                            size="icon-sm"
                            onClick={() => {
                              setDeleteConfirmId(a.id);
                              setDeletePassword('');
                            }}
                            className="p-1.5 rounded hover:bg-pf-danger/10 text-pf-text-tertiary hover:text-pf-danger cursor-pointer transition-colors"
                            aria-label="Deactivate admin"
                            title="Deactivate admin"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pf-backdrop-light" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
          <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 id="admin-dialog-title" className="text-base font-semibold text-pf-text">
                {dialogMode === 'add' ? 'Add Admin' : 'Edit Admin'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeDialog}
                className="p-1 rounded hover:bg-pf-base text-pf-text-tertiary"
                aria-label="Close dialog"
              >
                <X size={18} />
              </Button>
            </div>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {dialogMode === 'add' && (
                <div>
                  <label htmlFor="admin-email" className="block text-xs font-medium text-pf-text-secondary mb-1">Email</label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
                  />
                </div>
              )}
              <div>
                <label htmlFor="admin-display-name" className="block text-xs font-medium text-pf-text-secondary mb-1">Display Name</label>
                <Input
                  id="admin-display-name"
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-xs font-medium text-pf-text-secondary mb-1">
                  Password{dialogMode === 'edit' ? ' (leave blank to keep)' : ''}
                </label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={dialogMode === 'add'}
                  className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
                />
              </div>
              <div>
                <label htmlFor="admin-role" className="block text-xs font-medium text-pf-text-secondary mb-1">Role</label>
                <Select
                  id="admin-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  variant="default"
                  disabled={submitting}
                  className="flex-1 py-2 text-sm font-semibold rounded-pf-sm bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving...' : dialogMode === 'add' ? 'Create Admin' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeDialog}
                  className="px-4 py-2 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-base transition-colors"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pf-backdrop-light" role="dialog" aria-modal="true" aria-labelledby="deactivate-dialog-title">
          <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg p-6 w-full max-w-sm mx-4">
            <h3 id="deactivate-dialog-title" className="text-base font-semibold text-pf-text mb-2">
              Deactivate Admin
            </h3>
            <p className="text-sm text-pf-text-secondary mb-4">
              Enter your password to confirm this action.
            </p>
            <label htmlFor="deactivate-password" className="sr-only">Your password</label>
            <Input
              id="deactivate-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-danger mb-4"
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="danger"
                onClick={handleDeactivate}
                disabled={submitting || !deletePassword}
                className="flex-1 py-2 text-sm font-medium rounded-pf-sm bg-pf-danger text-white hover:bg-pf-danger/80 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Deactivating...' : 'Deactivate'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-base transition-colors"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
