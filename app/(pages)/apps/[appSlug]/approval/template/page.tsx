"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, Settings2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type TemplateStep = {
  id?: string;
  step: number;
  label: string;
  jobPositionId: string;
  jobPositionName: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
};

type Template = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  steps: TemplateStep[];
  _count: { requests: number };
};

type OrgOption = { id: string; name: string };
type PosOption = { id: string; name: string };
type BranchOption = { id: string; name: string };

const inputCls = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

const emptyStep = (): TemplateStep => ({
  step: 1, label: "",
  jobPositionId: "", jobPositionName: "",
  organizationId: "", organizationName: "",
  branchId: "", branchName: "",
});

export default function ApprovalTemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [positions, setPositions] = useState<PosOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSteps, setFormSteps] = useState<TemplateStep[]>([emptyStep()]);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    setToast({ variant, message });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch("/api/sd/approval/template"),
        fetch("/api/user/positions"),
      ]);
      const [tJson, pJson] = await Promise.all([tRes.json(), pRes.json()]);
      if (!tRes.ok) throw new Error(tJson.message ?? "Gagal");
      setTemplates(tJson.data ?? []);
      setOrgs(pJson.organizations ?? []);
      setPositions(pJson.positions ?? []);
      setBranches(pJson.branches ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setFormName("");
    setFormSteps([emptyStep()]);
    setModalOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditId(t.id);
    setFormName(t.name);
    setFormSteps(t.steps.map((s) => ({ ...s })));
    setModalOpen(true);
  };

  const addStep = () => {
    setFormSteps((prev) => [...prev, { ...emptyStep(), step: prev.length + 1 }]);
  };

  const removeStep = (i: number) => {
    setFormSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step: idx + 1 })));
  };

  const updateStep = (i: number, field: keyof TemplateStep, value: string) => {
    setFormSteps((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const updated = { ...s, [field]: value };
        // Auto-fill nama saat pilih ID
        if (field === "organizationId") {
          updated.organizationName = orgs.find((o) => o.id === value)?.name ?? "";
        }
        if (field === "jobPositionId") {
          updated.jobPositionName = positions.find((p) => p.id === value)?.name ?? "";
        }
        if (field === "branchId") {
          updated.branchName = branches.find((b) => b.id === value)?.name ?? "";
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) { showToast("error", "Nama template wajib diisi"); return; }
    if (formSteps.some((s) => !s.label.trim())) { showToast("error", "Label setiap step wajib diisi"); return; }

    setSaving(true);
    try {
      const url = editId ? `/api/sd/approval/template/${editId}` : "/api/sd/approval/template";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          active: true,
          steps: formSteps.map((s) => ({
            step: s.step,
            label: s.label,
            jobPositionId: s.jobPositionId || null,
            jobPositionName: s.jobPositionName || null,
            organizationId: s.organizationId || null,
            organizationName: s.organizationName || null,
            branchId: s.branchId || null,
            branchName: s.branchName || null,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", editId ? "Template diperbarui" : "Template berhasil dibuat");
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Gagal");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sd/approval/template/${deleteId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      showToast("success", "Template dihapus");
      setDeleteId(null);
      load();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Gagal");
    } finally {
      setDeleting(false);
    }
  };

  const handleSetActive = async (id: string) => {
    const res = await fetch(`/api/sd/approval/template/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    if (res.ok) { showToast("success", "Template diaktifkan"); load(); }
    else { const j = await res.json(); showToast("error", j.message ?? "Gagal"); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
  );

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-xs">
          <div className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.variant === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Master Approval</h1>
            <p className="text-xs text-slate-400">Konfigurasi template alur approval pengajuan</p>
          </div>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Buat Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Settings2 className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Belum ada template approval</p>
          <p className="text-xs text-slate-400 mt-1">Buat template untuk mengaktifkan alur persetujuan</p>
          <Button onClick={openCreate} className="mt-4 flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" /> Buat Template Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.active ? "border-emerald-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    t.active ? "bg-emerald-50" : "bg-slate-50"
                  }`}>
                    {t.active
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <Settings2 className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      {t.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                          Aktif
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{t.steps.length} step · {t._count.requests} request</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!t.active && (
                    <Button variant="outline" onClick={() => handleSetActive(t.id)} className="text-xs py-1 px-2">
                      Aktifkan
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => openEdit(t)} className="p-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteId(t.id)}
                    className="p-1.5 text-red-500 border-red-200 hover:bg-red-50"
                    disabled={t._count.requests > 0}
                    title={t._count.requests > 0 ? "Masih ada request aktif" : "Hapus template"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <button
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {expandedId === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === t.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  {t.steps.map((s) => (
                    <div key={s.id ?? s.step} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{s.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[s.jobPositionName, s.organizationName, s.branchName].filter(Boolean).join(" · ") || "Tidak ada filter posisi"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? "Edit Template" : "Buat Template Approval"}
      >
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Nama Template</label>
            <input
              className={inputCls}
              placeholder="Contoh: Approval Standard IT"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0"}>Step Approval</label>
              <button
                type="button"
                onClick={addStep}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Step
              </button>
            </div>
            <div className="space-y-3">
              {formSteps.map((s, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Step {i + 1}</span>
                    {formSteps.length > 1 && (
                      <button type="button" onClick={() => removeStep(i)} className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className={labelCls}>Label Step</label>
                      <input
                        className={inputCls}
                        placeholder="Contoh: Manager IT, Kepala Divisi..."
                        value={s.label}
                        onChange={(e) => updateStep(i, "label", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Jabatan (filter)</label>
                        <select
                          className={inputCls}
                          value={s.jobPositionId}
                          onChange={(e) => updateStep(i, "jobPositionId", e.target.value)}
                        >
                          <option value="">Semua jabatan</option>
                          {positions.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Departemen (filter)</label>
                        <select
                          className={inputCls}
                          value={s.organizationId}
                          onChange={(e) => updateStep(i, "organizationId", e.target.value)}
                        >
                          <option value="">Semua departemen</option>
                          {orgs.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Cabang (filter)</label>
                      <select
                        className={inputCls}
                        value={s.branchId}
                        onChange={(e) => updateStep(i, "branchId", e.target.value)}
                      >
                        <option value="">Semua cabang</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? "Simpan Perubahan" : "Buat Template"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Hapus Template">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Yakin ingin menghapus template ini? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Batal</Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              <Trash2 className="w-4 h-4" /> Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
