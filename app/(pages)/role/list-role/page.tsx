"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, Plus, RefreshCw, Lock } from "lucide-react";

import { Table } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { ModalDelete } from "@/components/ui/modalDelete";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  appId: string | null;
  isLocked: boolean;
  status: string;
  createdAt: string;
  _count: { modules: number };
};

type ModuleItem = {
  id: string;
  name: string;
  path: string;
  group: string | null;
  icon: string | null;
};

type AppOption = {
  id: string;
  name: string;
  path: string;
};

const inputCls  = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const selectCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const inputSmCls = "w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white transition-colors";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const emptyForm = { id: "", name: "", description: "", status: "active" };
const PAGE_SIZE = 10;

export default function ListRolePage() {
  const [data, setData]           = useState<RoleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [filters, setFilters] = useState({ name: "", status: "" });

  // Scope: null = Portal, string = app module id
  const [scopeAppId, setScopeAppId] = useState<null | string>(null);
  const [apps, setApps] = useState<AppOption[]>([]);

  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastRef = useRef<NodeJS.Timeout | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm);

  // Atur Modul modal
  const [modulesOpen, setModulesOpen]           = useState(false);
  const [selectedRole, setSelectedRole]         = useState<RoleRow | null>(null);
  const [allModules, setAllModules]             = useState<ModuleItem[]>([]);
  const [assignedModuleIds, setAssignedModuleIds] = useState<string[]>([]);
  const [modulesLoading, setModulesLoading]     = useState(false);
  const [modulesSaving, setModulesSaving]       = useState(false);
  const [modulesError, setModulesError]         = useState<string | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ variant, message });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const refreshList = async (page = currentPage, f = filters, sid = scopeAppId) => {
    setLoading(true);
    setListError(null);
    try {
      const p = new URLSearchParams({ page: String(page) });
      if (f.name.trim())   p.set("name",   f.name.trim());
      if (f.status.trim()) p.set("status", f.status.trim());
      // Pass appId: null → portal, string → app-specific
      p.set("appId", sid ?? "null");
      const res  = await fetch(`/api/role/list?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setData([]); setListError(json?.message ?? "Gagal memuat"); return; }
      const rows: RoleRow[] = json?.data ?? [];
      setData(rows);
      setTotalPages(Math.ceil(rows.length / PAGE_SIZE) || 1);
      setCurrentPage(page);
    } catch (err) {
      console.error(err); setData([]); setListError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const changeScope = (appId: null | string) => {
    setScopeAppId(appId);
    setFilters({ name: "", status: "" });
    void refreshList(1, { name: "", status: "" }, appId);
  };

  useEffect(() => {
    // Load app list for scope selector
    fetch("/api/module/list?type=app", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setApps(j?.data ?? []))
      .catch(() => {});

    void refreshList(1, filters, null);
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refreshList(1, filters, scopeAppId), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name, filters.status]);

  const closeCreate = () => { setCreateOpen(false); setSaving(false); setFormError(null); setForm(emptyForm); };
  const closeEdit   = () => { setEditOpen(false);   setSaving(false); setFormError(null); setForm(emptyForm); };

  const openEdit = async (row: RoleRow) => {
    setForm({ id: row.id, name: row.name, description: row.description ?? "", status: row.status });
    setFormError(null);
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (saving) return;
    if (!form.name.trim()) { setFormError("Name wajib diisi"); return; }
    setSaving(true); setFormError(null);
    try {
      const res  = await fetch("/api/role/create", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
          appId: scopeAppId,
        }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setFormError(json?.message ?? "Gagal"); return; }
      showToast("success", json?.message ?? "Role dibuat");
      closeCreate(); void refreshList(1, filters, scopeAppId);
    } catch (err) { console.error(err); setFormError("Network error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (saving) return;
    if (!form.name.trim()) { setFormError("Name wajib diisi"); return; }
    setSaving(true); setFormError(null);
    try {
      const res  = await fetch(`/api/role/update/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, status: form.status }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setFormError(json?.message ?? "Gagal"); return; }
      showToast("success", json?.message ?? "Role diperbarui");
      closeEdit(); void refreshList(currentPage, filters, scopeAppId);
    } catch (err) { console.error(err); setFormError("Network error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/role/delete/${deleteId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { showToast("error", json?.message ?? "Gagal"); return; }
      showToast("success", json?.message ?? "Role dihapus");
      void refreshList(currentPage, filters, scopeAppId);
    } catch (err) { console.error(err); showToast("error", "Network error"); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const openModules = async (row: RoleRow) => {
    setSelectedRole(row);
    setModulesError(null);
    setModulesOpen(true);
    setModulesLoading(true);
    try {
      // Filter modules to the same scope as the role
      const modAppId = row.appId ?? "null";
      const [modRes, assignRes] = await Promise.all([
        fetch(`/api/module/list?appId=${modAppId}`, { cache: "no-store" }),
        fetch(`/api/role/${row.id}/modules`, { cache: "no-store" }),
      ]);
      const modJson    = await modRes.json().catch(() => null);
      const assignJson = await assignRes.json().catch(() => null);
      setAllModules(modJson?.data ?? []);
      setAssignedModuleIds(assignJson?.assignedModuleIds ?? []);
    } catch (err) { console.error(err); setModulesError("Gagal memuat modul"); }
    finally { setModulesLoading(false); }
  };

  const toggleModule = (id: string) => {
    setAssignedModuleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveModules = async () => {
    if (!selectedRole || modulesSaving) return;
    setModulesSaving(true);
    try {
      const res  = await fetch(`/api/role/${selectedRole.id}/modules`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleIds: assignedModuleIds }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setModulesError(json?.message ?? "Gagal"); return; }
      showToast("success", "Modul berhasil disimpan");
      setModulesOpen(false);
      void refreshList(currentPage, filters, scopeAppId);
    } catch (err) { console.error(err); setModulesError("Network error"); }
    finally { setModulesSaving(false); }
  };

  const modulesByGroup = allModules.reduce<Record<string, ModuleItem[]>>((acc, m) => {
    const g = m.group ?? "Umum";
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {});

  const currentScopeName = scopeAppId === null
    ? "Portal"
    : (apps.find((a) => a.id === scopeAppId)?.name ?? "App");

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Master Role</h1>
            <p className="text-slate-400 text-xs">Manajemen role dan hak akses modul</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshList(currentPage, filters, scopeAppId)} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setForm(emptyForm); setFormError(null); setCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> Tambah Role
          </Button>
        </div>
      </div>

      {/* Scope selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => changeScope(null)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            scopeAppId === null
              ? "bg-violet-600 text-white border-violet-600"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Portal
        </button>
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => changeScope(app.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              scopeAppId === app.id
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {app.name}
          </button>
        ))}
      </div>

      {listError && <div className="mb-4"><Alert variant="error" message={listError} /></div>}

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <input className={`${inputSmCls} max-w-xs`} placeholder={`Cari nama role ${currentScopeName}...`}
          value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))} />
        <select className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">Semua Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["No", "Name", "Deskripsi", "Scope", "Modul", "Status", "Dibuat", ""].map((h, i) => (
                <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                <div className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Memuat...</div>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Tidak ada data</td></tr>
            ) : (
              data.map((row, i) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-3 text-xs text-slate-400 w-10">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 capitalize">{row.name}</span>
                      {row.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500" aria-label="Terkunci" />}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{row.description ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      row.appId === null
                        ? "bg-violet-50 text-violet-700 border-violet-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {row.appId === null ? "Portal" : (apps.find((a) => a.id === row.appId)?.name ?? "App")}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {row._count.modules} modul
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      row.status === "active" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
                    }`}>{row.status}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => void openModules(row)}>Atur Modul</Button>
                      {!row.isLocked && (
                        <>
                          <Button variant="primary" size="sm" onClick={() => void openEdit(row)}>Edit</Button>
                          <Button variant="danger"  size="sm" onClick={() => setDeleteId(row.id)}>Hapus</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages}
        onPageChange={(p) => { setCurrentPage(p); void refreshList(p, filters, scopeAppId); }} />

      {/* Modal Tambah */}
      <Modal open={createOpen} title={`Tambah Role — ${currentScopeName}`} onClose={closeCreate} boxClassName="w-full max-w-md">
        <div className="space-y-4">
          {formError && <Alert variant="error" message={formError} />}
          <div className="px-3 py-2 rounded-lg bg-violet-50 border border-violet-100 text-xs text-violet-700">
            Role ini akan dibuat untuk scope: <strong>{currentScopeName}</strong>
          </div>
          <FormField label="Nama Role">
            <input className={inputCls} placeholder="e.g. manager" value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Deskripsi">
            <input className={inputCls} placeholder="Opsional" value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </FormField>
          <FormField label="Status">
            <select className={selectCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={closeCreate}>Batal</Button>
            <Button variant="primary" type="button" onClick={handleCreate} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Edit */}
      <Modal open={editOpen} title="Edit Role" onClose={closeEdit} boxClassName="w-full max-w-md">
        <div className="space-y-4">
          {formError && <Alert variant="error" message={formError} />}
          <FormField label="Nama Role">
            <input className={inputCls} value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Deskripsi">
            <input className={inputCls} value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </FormField>
          <FormField label="Status">
            <select className={selectCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={closeEdit}>Batal</Button>
            <Button variant="primary" type="button" onClick={handleUpdate} disabled={saving}>
              {saving ? "Menyimpan..." : "Update"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Atur Modul */}
      <Modal
        open={modulesOpen}
        title={`Atur Modul — ${selectedRole?.name ?? ""}`}
        onClose={() => setModulesOpen(false)}
        boxClassName="w-full max-w-lg"
      >
        {modulesLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Memuat modul...
          </div>
        ) : (
          <div className="space-y-4">
            {modulesError && <Alert variant="error" message={modulesError} />}

            {selectedRole?.isLocked && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                Role ini terkunci — superadmin selalu memiliki akses ke semua modul.
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {Object.entries(modulesByGroup).map(([groupName, items]) => (
                <div key={groupName}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{groupName}</p>
                  <div className="space-y-1">
                    {items.map((m) => {
                      const checked  = assignedModuleIds.includes(m.id);
                      const disabled = selectedRole?.isLocked ?? false;
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                          } ${checked ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => !disabled && toggleModule(m.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{m.name}</p>
                            <p className="text-xs text-slate-400">{m.path}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {allModules.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">Belum ada modul untuk scope ini</p>
              )}
            </div>

            {!selectedRole?.isLocked && (
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">{assignedModuleIds.length} modul dipilih</p>
                <div className="flex gap-2">
                  <Button variant="ghost" type="button" onClick={() => setModulesOpen(false)}>Batal</Button>
                  <Button variant="primary" type="button" onClick={handleSaveModules} disabled={modulesSaving}>
                    {modulesSaving ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ModalDelete open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
