"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

const SSO_PERMISSIONS = [
  { key: "LOGIN",            label: "Login",        desc: "POST /api/sso/login — autentikasi dengan employeeId & password" },
  { key: "VALIDATE",         label: "Validate",     desc: "GET /api/sso/validate — validasi session / SSO redirect token" },
  { key: "GET_USERS",        label: "Get Users",    desc: "GET /api/sso/users — ambil daftar user aktif" },
  { key: "GET_BRANCHES",     label: "Get Branches", desc: "GET /api/sso/branches — ambil daftar master branch" },
  { key: "GET_JOB_POSITIONS",label: "Get Jabatan",  desc: "GET /api/sso/job-positions — ambil daftar master jabatan" },
  { key: "GET_COMPANIES",      label: "Get Companies",     desc: "GET /api/sso/companies — ambil daftar master perusahaan" },
  { key: "GET_ORGANIZATIONS",  label: "Get Organizations", desc: "GET /api/sso/organizations — ambil daftar master organization & sub-org" },
] as const;

type PermKey = (typeof SSO_PERMISSIONS)[number]["key"];

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: string;
  _count: { appTokens: number };
};

const inputCls = "w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";

export default function AppTokenRolePage() {
  const [rows, setRows]       = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState<{ variant: "success" | "error"; message: string } | null>(null);

  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<RoleRow | null>(null);
  const [formName, setFormName]     = useState("");
  const [formDesc, setFormDesc]     = useState("");
  const [formPerms, setFormPerms]   = useState<Set<PermKey>>(new Set());
  const [saving, setSaving]         = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const alertTimer = useRef<NodeJS.Timeout | null>(null);
  const showAlert = (variant: "success" | "error", message: string) => {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setAlert({ variant, message });
    alertTimer.current = setTimeout(() => setAlert(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/app-token-role");
      if (r.ok) { const j = await r.json(); setRows(j.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setFormName(""); setFormDesc(""); setFormPerms(new Set());
    setModalOpen(true);
  };

  const openEdit = (row: RoleRow) => {
    setEditTarget(row);
    setFormName(row.name);
    setFormDesc(row.description ?? "");
    setFormPerms(new Set(row.permissions as PermKey[]));
    setModalOpen(true);
  };

  const togglePerm = (key: PermKey) => {
    setFormPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!formName.trim() || formPerms.size === 0) return;
    setSaving(true);
    try {
      const url    = editTarget ? `/api/app-token-role/${editTarget.id}` : "/api/app-token-role";
      const method = editTarget ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || undefined, permissions: [...formPerms] }),
      });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal menyimpan"); return; }
      showAlert("success", editTarget ? "Role diperbarui" : "Role dibuat");
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/app-token-role/${deleteTarget.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal menghapus"); return; }
      showAlert("success", "Role dihapus");
      setDeleteTarget(null);
      load();
    } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Role App Token</h1>
            <p className="text-xs text-slate-400 mt-0.5">Kelola role dan permission untuk app token SSO</p>
          </div>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Buat Role
        </Button>
      </div>

      {alert && <div className="mb-4"><Alert variant={alert.variant} message={alert.message} /></div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">Belum ada role. Buat role terlebih dahulu sebelum membuat app token.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Permissions</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Token Aktif</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{row.name}</p>
                    {row.description && <p className="text-xs text-slate-400 mt-0.5">{row.description}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {SSO_PERMISSIONS.map((p) => (
                        <span key={p.key} className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          row.permissions.includes(p.key)
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-400"
                        }`}>
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    {row._count.appTokens} token
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(row)}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(row)}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Create / Edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Role" : "Buat Role"}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Nama Role</label>
            <input className={inputCls} placeholder="contoh: Full Access, Read Only..." value={formName} onChange={(e) => setFormName(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Deskripsi <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input className={inputCls} placeholder="Catatan singkat..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Permissions</label>
            <div className="space-y-2">
              {SSO_PERMISSIONS.map((p) => (
                <label key={p.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formPerms.has(p.key) ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                }`}>
                  <input
                    type="checkbox"
                    checked={formPerms.has(p.key)}
                    onChange={() => togglePerm(p.key)}
                    disabled={saving}
                    className="mt-0.5 accent-violet-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {editTarget && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">Perubahan permission hanya berlaku setelah app token di-regenerate.</p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim() || formPerms.size === 0} className="flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editTarget ? "Simpan" : "Buat Role"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Role">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Hapus role <strong>{deleteTarget?.name}</strong>?</p>
          {deleteTarget && deleteTarget._count.appTokens > 0 && (
            <p className="text-xs text-red-500">Role ini masih digunakan oleh {deleteTarget._count.appTokens} app token aktif dan tidak bisa dihapus.</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</Button>
            <Button onClick={handleDelete} disabled={deleting || (deleteTarget?._count.appTokens ?? 0) > 0}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
