import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Plus, Pencil, Trash2, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
import { formatDate } from '@/lib/utils';
export function Component() {
    const { isSuperAdmin, admin: currentAdmin } = useAdminAuthStore();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogMode, setDialogMode] = useState(null);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({
        email: '',
        displayName: '',
        password: '',
        role: 'ADMIN',
    });
    const [submitting, setSubmitting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    useEffect(() => {
        loadAdmins();
    }, []);
    async function loadAdmins() {
        try {
            const res = await adminApi.listAdmins();
            setAdmins(res);
        }
        catch {
            toast.error('Failed to load admins');
        }
        finally {
            setLoading(false);
        }
    }
    function openAdd() {
        setForm({ email: '', displayName: '', password: '', role: 'ADMIN' });
        setEditId(null);
        setDialogMode('add');
    }
    function openEdit(admin) {
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
    async function handleSubmit(e) {
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
            }
            else if (dialogMode === 'edit' && editId) {
                const data = {
                    displayName: form.displayName,
                    role: form.role,
                };
                if (form.password)
                    data.password = form.password;
                const updated = await adminApi.updateAdmin(editId, data);
                setAdmins((a) => a.map((ad) => (ad.id === editId ? updated : ad)));
                toast.success('Admin updated');
            }
            closeDialog();
        }
        catch (err) {
            toast.error(err?.body?.message || 'Operation failed');
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleDeactivate() {
        if (!deleteConfirmId)
            return;
        setSubmitting(true);
        try {
            await adminApi.deactivateAdmin(deleteConfirmId, deletePassword);
            setAdmins((a) => a.filter((ad) => ad.id !== deleteConfirmId));
            setDeleteConfirmId(null);
            setDeletePassword('');
            toast.success('Admin deactivated');
        }
        catch {
            toast.error('Failed to deactivate admin');
        }
        finally {
            setSubmitting(false);
        }
    }
    if (!isSuperAdmin) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx(ShieldCheck, { size: 48, className: "mx-auto text-[var(--color-pf-text-tertiary)] mb-4" }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)]", children: "Super Admin access required" })] }));
    }
    const roleLabel = (role) => role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'ADMIN' ? 'Admin' : 'Viewer';
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: "Admin Accounts" }), _jsxs("button", { onClick: openAdd, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] transition-colors", children: [_jsx(Plus, { size: 14 }), "Add Admin"] })] }), _jsx("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Role" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 5 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : admins.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 5, className: "text-center py-12", children: [_jsx(ShieldCheck, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No admins found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Add an admin account to get started" })] }) })) : (admins.map((a) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-medium text-[var(--color-pf-text)]", children: a.displayName }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: a.email }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${a.role === 'SUPER_ADMIN'
                                                    ? 'text-pf-warning bg-pf-warning/10'
                                                    : a.role === 'ADMIN'
                                                        ? 'text-blue-400 bg-blue-400/10'
                                                        : 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]'}`, children: roleLabel(a.role) }) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDate(a.createdAt) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx("button", { onClick: () => openEdit(a), className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text)] transition-colors", "aria-label": "Edit admin", title: "Edit admin", children: _jsx(Pencil, { size: 14 }) }), a.id !== currentAdmin?.id && (_jsx("button", { onClick: () => {
                                                            setDeleteConfirmId(a.id);
                                                            setDeletePassword('');
                                                        }, className: "p-1.5 rounded hover:bg-pf-danger/10 text-[var(--color-pf-text-tertiary)] hover:text-pf-danger transition-colors", "aria-label": "Deactivate admin", title: "Deactivate admin", children: _jsx(Trash2, { size: 14 }) }))] }) })] }, a.id)))) })] }) }) }), dialogMode && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-labelledby": "admin-dialog-title", children: _jsxs("div", { className: "animate-scale-in bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 w-full max-w-md mx-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { id: "admin-dialog-title", className: "text-base font-semibold text-[var(--color-pf-text)]", children: dialogMode === 'add' ? 'Add Admin' : 'Edit Admin' }), _jsx("button", { onClick: closeDialog, className: "p-1 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-tertiary)]", children: _jsx(X, { size: 18 }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [dialogMode === 'add' && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1", children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }), required: true, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1", children: "Display Name" }), _jsx("input", { type: "text", value: form.displayName, onChange: (e) => setForm({ ...form, displayName: e.target.value }), required: true, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1", children: ["Password", dialogMode === 'edit' ? ' (leave blank to keep)' : ''] }), _jsx("input", { type: "password", value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }), required: dialogMode === 'add', className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1", children: "Role" }), _jsxs("select", { value: form.role, onChange: (e) => setForm({ ...form, role: e.target.value }), className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "VIEWER", children: "Viewer" }), _jsx("option", { value: "ADMIN", children: "Admin" }), _jsx("option", { value: "SUPER_ADMIN", children: "Super Admin" })] })] }), _jsxs("div", { className: "flex gap-3 pt-2", children: [_jsx("button", { type: "submit", disabled: submitting, className: "flex-1 py-2 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] disabled:opacity-50 transition-colors", children: submitting ? 'Saving...' : dialogMode === 'add' ? 'Create Admin' : 'Save Changes' }), _jsx("button", { type: "button", onClick: closeDialog, className: "px-4 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors", children: "Cancel" })] })] })] }) })), deleteConfirmId && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-labelledby": "deactivate-dialog-title", children: _jsxs("div", { className: "animate-scale-in bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 w-full max-w-sm mx-4", children: [_jsx("h3", { id: "deactivate-dialog-title", className: "text-base font-semibold text-[var(--color-pf-text)] mb-2", children: "Deactivate Admin" }), _jsx("p", { className: "text-sm text-[var(--color-pf-text-secondary)] mb-4", children: "Enter your password to confirm this action." }), _jsx("input", { type: "password", value: deletePassword, onChange: (e) => setDeletePassword(e.target.value), placeholder: "Your password", className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-red-500 mb-4" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleDeactivate, disabled: submitting || !deletePassword, className: "flex-1 py-2 text-sm font-medium rounded-pf-sm bg-pf-danger text-white hover:bg-pf-danger/80 disabled:opacity-50 transition-colors", children: submitting ? 'Deactivating...' : 'Deactivate' }), _jsx("button", { onClick: () => setDeleteConfirmId(null), className: "px-4 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors", children: "Cancel" })] })] }) }))] }));
}
