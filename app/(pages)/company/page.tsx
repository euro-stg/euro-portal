"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

type CompanyRow = {
  id: string;
  code: string;
  name: string;
  order: number;
  status: string;
  createdAt: string;
};

const inputCls = "w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";
const selectCls = "w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";

export default function CompanyPage() {
  const [rows, setRows]       = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState<{ variant: "success" | "error"; message: string } | null>(null);

  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyRow | null>(null);
  const [formCode, setFormCode]     = useState("");
  const [formName, setFormName]     = useState("");
  const [formOrder, setFormOrder]   = useState("0");
  const [formStatus, setFormStatus] = useState("active");
  const [saving, setSaving]         = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CompanyRow | null>(null);
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
      const r = await fetch("/api/company");
      if (r.ok) { const j = await r.json(); setRows(j.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setFormCode(""); setFormName(""); setFormOrder("0"); setFormStatus("active");
    setModalOpen(true);
  };

  const openEdit = (row: CompanyRow) => {
    setEditTarget(row);
    setFormCode(row.code);
    setFormName(row.name);
    setFormOrder(String(row.order));
    setFormStatus(row.status);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim()) return;
    setSaving(true);
    try {
      const url    = editTarget ? `/api/company/${editTarget.id}` : "/api/company";
      const method = editTarget ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          order: parseInt(formOrder) || 0,
          status: formStatus,
        }),
      });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal menyimpan"); return; }
      showAlert("success", editTarget ? "Perusahaan diperbarui" : "Perusahaan ditambahkan");
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/company/${deleteTarget.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal menghapus"); return; }
      showAlert("success", "Perusahaan dihapus");
      setDeleteTarget(null);
      load();
    } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Master Perusahaan</h1>
            <p className="text-xs text-slate-400 mt-0.5">Kelola daftar perusahaan dalam jaringan Euromedica</p>
          </div>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Perusahaan
        </Button>
      </div>

      {alert && <div className="mb-4"><Alert variant={alert.variant} message={alert.message} /></div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Belum ada data perusahaan.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">No</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kode</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Perusahaan</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Urutan</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{row.code}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{row.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{row.order}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {row.status === "active" ? "Aktif" : "Nonaktif"}
                    </span>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Perusahaan" : "Tambah Perusahaan"}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Kode Perusahaan
            </label>
            <input
              className={inputCls}
              placeholder="contoh: EUROMEDICA, RSPI..."
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              disabled={saving}
              maxLength={20}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Nama Perusahaan
            </label>
            <input
              className={inputCls}
              placeholder="Nama lengkap perusahaan..."
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Urutan
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="0"
                value={formOrder}
                onChange={(e) => setFormOrder(e.target.value)}
                disabled={saving}
                min={0}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Status
              </label>
              <select
                className={selectCls}
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                disabled={saving}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || !formCode.trim() || !formName.trim()} className="flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editTarget ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Perusahaan">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Hapus perusahaan <strong>{deleteTarget?.name}</strong> (<span className="font-mono">{deleteTarget?.code}</span>)?
          </p>
          <p className="text-xs text-slate-400">Data perusahaan tidak dapat dipulihkan setelah dihapus.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
