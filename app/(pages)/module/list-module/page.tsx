"use client";

import { useEffect, useRef, useState } from "react";
import { Package, Plus, RefreshCw } from "lucide-react";

import { Table } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { ModalDelete } from "@/components/ui/modalDelete";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type ModuleRow = {
  id: string;
  name: string;
  path: string;
  type: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  group: string | null;
  order: number;
  status: string;
  isExternal: boolean;
  externalUrl: string | null;
  createdAt: string;
};

const inputCls  = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const selectCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const inputSmCls = "w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white transition-colors";

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const emptyForm = { id: "", name: "", path: "", type: "module", icon: "", color: "", group: "", order: "0", status: "active", description: "", isExternal: false, externalUrl: "" };
type FormShape = typeof emptyForm;

function FormContent({
  form,
  formError,
  setForm,
}: {
  form: FormShape;
  formError: string | null;
  setForm: React.Dispatch<React.SetStateAction<FormShape>>;
}) {
  return (
    <div className="space-y-4">
      {formError && <Alert variant="error" message={formError} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Nama Modul">
          <input className={inputCls} placeholder="e.g. Dashboard" value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </FormField>
        <FormField label="Path" hint="e.g. /apps/euro-lms atau /category/list">
          <input className={inputCls} placeholder="/path/ke/halaman" value={form.path}
            onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))} />
        </FormField>
        <FormField label="Type" hint="app = card di dashboard portal; module = menu di sidebar">
          <select className={selectCls} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <option value="module">module — menu sidebar</option>
            <option value="app">app — card dashboard</option>
          </select>
        </FormField>
        <FormField label="Icon" hint="Nama icon Lucide: LayoutDashboard, Tag, Users, dll">
          <input className={inputCls} placeholder="LayoutDashboard" value={form.icon}
            onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} />
        </FormField>
        <FormField label="Color" hint="blue, indigo, emerald, orange, rose, cyan, amber, teal, pink">
          <input className={inputCls} placeholder="blue" value={form.color}
            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
        </FormField>
        <FormField label="Deskripsi" hint="Tampil di card dashboard (khusus type app)">
          <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Penjelasan singkat aplikasi..."
            value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </FormField>
        {form.type === "app" && (
          <>
            <FormField label="Jenis Aplikasi">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isExternal}
                  onChange={(e) => setForm((p) => ({ ...p, isExternal: e.target.checked, externalUrl: e.target.checked ? p.externalUrl : "" }))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">Aplikasi Eksternal (SSO)</span>
              </label>
              <p className="text-xs text-slate-400">Centang jika aplikasi ini di luar portal dan butuh redirect SSO</p>
            </FormField>
            {form.isExternal && (
              <FormField label="URL Aplikasi Eksternal" hint="URL halaman SSO di apps eksternal, cth: https://lms.euromedica.co.id/sso">
                <input className={inputCls} placeholder="https://..." value={form.externalUrl}
                  onChange={(e) => setForm((p) => ({ ...p, externalUrl: e.target.value }))} />
              </FormField>
            )}
          </>
        )}
        <FormField label="Group" hint="e.g. Data Master, Pengaturan (kosong = standalone)">
          <input className={inputCls} placeholder="Pengaturan" value={form.group}
            onChange={(e) => setForm((p) => ({ ...p, group: e.target.value }))} />
        </FormField>
        <FormField label="Urutan">
          <input type="number" className={inputCls} value={form.order}
            onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} />
        </FormField>
        <FormField label="Status">
          <select className={selectCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
      </div>
    </div>
  );
}
const PAGE_SIZE = 10;

export default function ListModulePage() {
  const [data, setData]           = useState<ModuleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [filters, setFilters] = useState({ name: "", status: "" });

  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastRef = useRef<NodeJS.Timeout | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ variant, message });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const refreshList = async (page = currentPage, f = filters) => {
    setLoading(true); setListError(null);
    try {
      const p = new URLSearchParams({ page: String(page) });
      if (f.name.trim())   p.set("name", f.name.trim());
      if (f.status.trim()) p.set("status", f.status.trim());
      const res  = await fetch(`/api/module/list?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setData([]); setListError(json?.message ?? "Gagal memuat"); return; }
      const rows: ModuleRow[] = json?.data ?? [];
      const start = (page - 1) * PAGE_SIZE;
      setData(rows.slice(start, start + PAGE_SIZE));
      setTotalPages(Math.ceil(rows.length / PAGE_SIZE) || 1);
      setCurrentPage(page);
    } catch (err) {
      console.error(err); setData([]); setListError("Network error");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refreshList(1, filters);
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refreshList(1, filters), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name, filters.status]);

  const closeCreate = () => { setCreateOpen(false); setSaving(false); setFormError(null); setForm(emptyForm); };
  const closeEdit   = () => { setEditOpen(false);   setSaving(false); setFormError(null); setForm(emptyForm); };

  const openEdit = async (row: ModuleRow) => {
    setForm({ id: row.id, name: row.name, path: row.path, type: row.type ?? "module", icon: row.icon ?? "", color: row.color ?? "", group: row.group ?? "", order: String(row.order), status: row.status, description: row.description ?? "", isExternal: row.isExternal ?? false, externalUrl: row.externalUrl ?? "" });
    setFormError(null); setEditOpen(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(), path: form.path.trim(), type: form.type || "module",
    icon: form.icon.trim() || null, color: form.color.trim() || null,
    group: form.group.trim() || null, order: Number(form.order) || 0, status: form.status,
    description: form.description.trim() || null,
    isExternal: form.type === "app" ? form.isExternal : false,
    externalUrl: (form.type === "app" && form.isExternal) ? (form.externalUrl.trim() || null) : null,
  });

  const handleCreate = async () => {
    if (saving) return;
    if (!form.name.trim()) { setFormError("Name wajib diisi"); return; }
    if (!form.path.trim()) { setFormError("Path wajib diisi");  return; }
    setSaving(true); setFormError(null);
    try {
      const res  = await fetch("/api/module/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setFormError(json?.message ?? "Gagal"); return; }
      showToast("success", json?.message ?? "Module dibuat");
      closeCreate(); void refreshList(1, filters);
    } catch (err) { console.error(err); setFormError("Network error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (saving) return;
    if (!form.name.trim()) { setFormError("Name wajib diisi"); return; }
    if (!form.path.trim()) { setFormError("Path wajib diisi");  return; }
    setSaving(true); setFormError(null);
    try {
      const res  = await fetch(`/api/module/update/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setFormError(json?.message ?? "Gagal"); return; }
      showToast("success", json?.message ?? "Module diperbarui");
      closeEdit(); void refreshList(currentPage, filters);
    } catch (err) { console.error(err); setFormError("Network error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/module/delete/${deleteId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { showToast("error", json?.message ?? "Gagal"); return; }
      showToast("success", json?.message ?? "Module dihapus");
      void refreshList(currentPage, filters);
    } catch (err) { console.error(err); showToast("error", "Network error"); }
    finally { setDeleting(false); setDeleteId(null); }
  };

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
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Master Module</h1>
            <p className="text-slate-400 text-xs">Daftar modul/halaman yang tersedia di sistem</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshList(currentPage, filters)} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setForm(emptyForm); setFormError(null); setCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> Tambah Module
          </Button>
        </div>
      </div>

      {listError && <div className="mb-4"><Alert variant="error" message={listError} /></div>}

      <div className="flex gap-3 mb-4">
        <input className={`${inputSmCls} max-w-xs`} placeholder="Cari nama modul..."
          value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))} />
        <select className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">Semua Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["No", "Nama", "Path", "Type", "Icon", "Group", "Urutan", "Status", "Dibuat", ""].map((h, i) => (
                <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                <div className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Memuat...</div>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Tidak ada data</td></tr>
            ) : (
              data.map((row, i) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-3 text-xs text-slate-400 w-10">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.path}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.type === "app" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-50 text-slate-600 border border-slate-200"
                    }`}>{row.type ?? "module"}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{row.icon ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{row.group ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 text-center">{row.order}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      row.status === "active" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
                    }`}>{row.status}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button variant="primary" size="sm" onClick={() => void openEdit(row)}>Edit</Button>
                      <Button variant="danger"  size="sm" onClick={() => setDeleteId(row.id)}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages}
        onPageChange={(p) => { setCurrentPage(p); void refreshList(p, filters); }} />

      <Modal open={createOpen} title="Tambah Module" onClose={closeCreate} boxClassName="w-full max-w-2xl">
        <FormContent form={form} formError={formError} setForm={setForm} />
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
          <Button variant="ghost" type="button" onClick={closeCreate}>Batal</Button>
          <Button variant="primary" type="button" onClick={handleCreate} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </Modal>

      <Modal open={editOpen} title="Edit Module" onClose={closeEdit} boxClassName="w-full max-w-2xl">
        <FormContent form={form} formError={formError} setForm={setForm} />
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
          <Button variant="ghost" type="button" onClick={closeEdit}>Batal</Button>
          <Button variant="primary" type="button" onClick={handleUpdate} disabled={saving}>
            {saving ? "Menyimpan..." : "Update"}
          </Button>
        </div>
      </Modal>

      <ModalDelete open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
