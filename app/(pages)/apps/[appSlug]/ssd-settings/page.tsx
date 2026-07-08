"use client";

import { useEffect, useRef, useState } from "react";
import {
  Settings2, Plus, Trash2, Loader2, CheckCircle2, RefreshCw,
  Tag, Workflow, X, GripVertical, Network, UserCog, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";

type Category = { id: string; code: string; name: string; hasDraft: boolean; order: number; status: string };
type Step = { step: number; label: string; jobPositionId?: string; jobPositionName?: string; organizationId?: string; organizationName?: string; branchId?: string; branchName?: string };
type Template = { id: string; name: string; active: boolean; createdAt: string; steps: (Step & { id: string; templateId: string }) [] };

type OrgAdmin = {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  user: { id: string; name: string | null; employeeId: string; jobPositionName: string | null };
  organization: { id: string; name: string; parentOrganizationId: string | null };
};
type OrgOption = { id: string; name: string; parentOrganizationId: string | null };
type UserOption = { id: string; name: string | null; employeeId: string; jobPositionName: string | null };

type Tab = "category" | "template" | "org-admin";

export default function SsdSettingsPage() {
  const [tab, setTab] = useState<Tab>("category");
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Pengaturan SSD</h1>
          <p className="text-xs text-slate-400">Kelola kategori, template approval, dan admin organisasi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {(["category", "template", "org-admin"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "category" ? "Kategori Surat" : t === "template" ? "Template Approval" : "Admin Org"}
          </button>
        ))}
      </div>

      {tab === "category" && <CategoryTab showToast={showToast} />}
      {tab === "template" && <TemplateTab showToast={showToast} />}
      {tab === "org-admin" && <OrgAdminTab showToast={showToast} />}
    </div>
  );
}

// ===== Category Tab =====
function CategoryTab({ showToast }: { showToast: (v: "success" | "error", m: string) => void }) {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", hasDraft: false, order: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/ssd/category");
    const json = await res.json();
    setData(json.data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim()) { showToast("error", "Kode dan nama wajib diisi"); return; }
    setSaving(true);
    const res = await fetch("/api/ssd/category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { showToast("error", json.message || "Gagal"); } else {
      showToast("success", "Kategori ditambahkan");
      setModal(false);
      setForm({ code: "", name: "", hasDraft: false, order: 0 });
      void load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/ssd/category/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) showToast("error", json.message || "Gagal"); else { showToast("success", "Dihapus"); void load(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{data.length} kategori</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Tambah
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-12"><Tag className="w-8 h-8 text-slate-200 mx-auto mb-2" /><p className="text-sm text-slate-400">Belum ada kategori</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">File Draft</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3"><span className="font-mono text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">{row.code}</span></td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.hasDraft ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Ya</span> : <span className="text-xs text-slate-400">Tidak</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{row.order}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} title="Tambah Kategori" onClose={() => setModal(false)} boxClassName="max-w-sm">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Kode <span className="text-red-500">*</span></label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 uppercase"
              placeholder="HO" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nama <span className="text-red-500">*</span></label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              placeholder="Head Office" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Order</label>
            <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hasDraft} onChange={(e) => setForm((f) => ({ ...f, hasDraft: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Wajib upload file draft</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => void handleCreate()} disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
            </Button>
            <Button variant="outline" onClick={() => setModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== Template Tab =====
function TemplateTab({ showToast }: { showToast: (v: "success" | "error", m: string) => void }) {
  const [data, setData] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ step: 1, label: "", jobPositionId: "", organizationId: "", branchId: "" }]);

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      fetch("/api/ssd/approval-template"),
      fetch("/api/user/positions"),
    ]);
    const [tJson, pJson] = await Promise.all([tRes.json(), pRes.json()]);
    setData(tJson.data ?? []);
    setOrgs(pJson.organizations ?? []);
    setPositions(pJson.positions ?? []);
    setBranches(pJson.branches ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const addStep = () => setSteps((s) => [...s, { step: s.length + 1, label: "", jobPositionId: "", organizationId: "", branchId: "" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, step: idx + 1 })));
  const updateStep = (i: number, field: keyof Step, val: string) =>
    setSteps((s) =>
      s.map((st, idx) => {
        if (idx !== i) return st;
        const updated = { ...st, [field]: val };
        if (field === "jobPositionId") updated.jobPositionName = positions.find((p) => p.id === val)?.name ?? "";
        if (field === "organizationId") updated.organizationName = orgs.find((o) => o.id === val)?.name ?? "";
        if (field === "branchId") updated.branchName = branches.find((b) => b.id === val)?.name ?? "";
        return updated;
      })
    );

  const handleCreate = async () => {
    if (!name.trim()) { showToast("error", "Nama template wajib diisi"); return; }
    if (steps.some((s) => !s.label.trim())) { showToast("error", "Label setiap step wajib diisi"); return; }
    setSaving(true);
    const res = await fetch("/api/ssd/approval-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, steps }),
    });
    const json = await res.json();
    if (!res.ok) showToast("error", json.message || "Gagal"); else {
      showToast("success", "Template disimpan"); setModal(false);
      setName(""); setSteps([{ step: 1, label: "", jobPositionId: "", organizationId: "", branchId: "" }]); void load();
    }
    setSaving(false);
  };

  const handleActivate = async (id: string) => {
    await fetch(`/api/ssd/approval-template/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    void load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/ssd/approval-template/${id}`, { method: "DELETE" });
    void load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{data.length} template</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Template Baru
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-12"><Workflow className="w-8 h-8 text-slate-200 mx-auto mb-2" /><p className="text-sm text-slate-400">Belum ada template</p></div>
      ) : (
        <div className="space-y-4">
          {data.map((tmpl) => (
            <div key={tmpl.id} className={`bg-white rounded-xl border p-5 ${tmpl.active ? "border-violet-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{tmpl.name}</h3>
                  {tmpl.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Aktif
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!tmpl.active && (
                    <button onClick={() => handleActivate(tmpl.id)}
                      className="text-xs px-2 py-1 rounded bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors">
                      Aktifkan
                    </button>
                  )}
                  <button onClick={() => handleDelete(tmpl.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {tmpl.steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-5 h-5 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-xs font-bold shrink-0">{step.step}</span>
                    <span>{step.label}</span>
                    {step.jobPositionName && <span className="text-xs text-slate-400">({step.jobPositionName})</span>}
                    {step.organizationName && <span className="text-xs text-slate-400">· {step.organizationName}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} title="Template Approval Baru" onClose={() => { setModal(false); setName(""); setSteps([{ step: 1, label: "", jobPositionId: "", organizationId: "", branchId: "" }]); }} boxClassName="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Template <span className="text-red-500">*</span></label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              placeholder="Misal: Approval Surat HO 1 Step" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Steps Approval</label>
              <button onClick={addStep} className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 font-medium">
                <Plus className="w-3.5 h-3.5" /> Tambah Step
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <GripVertical className="w-4 h-4 text-slate-300 mt-2 shrink-0" />
                  <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0 mt-1.5">{step.step}</span>
                  <div className="flex-1 space-y-2">
                    <input className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                      placeholder="Label step..." value={step.label} onChange={(e) => updateStep(i, "label", e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
                        value={step.jobPositionId ?? ""}
                        onChange={(e) => updateStep(i, "jobPositionId", e.target.value)}
                      >
                        <option value="">Semua jabatan</option>
                        {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select
                        className="border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
                        value={step.organizationId ?? ""}
                        onChange={(e) => updateStep(i, "organizationId", e.target.value)}
                      >
                        <option value="">Semua departemen</option>
                        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <select
                      className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
                      value={step.branchId ?? ""}
                      onChange={(e) => updateStep(i, "branchId", e.target.value)}
                    >
                      <option value="">Semua cabang</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="p-1 text-slate-400 hover:text-red-500 mt-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={() => void handleCreate()} disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Template"}
            </Button>
            <Button variant="outline" onClick={() => { setModal(false); setName(""); setSteps([{ step: 1, label: "", jobPositionId: "", organizationId: "", branchId: "" }]); }}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== Org Admin Tab =====
function OrgAdminTab({ showToast }: { showToast: (v: "success" | "error", m: string) => void }) {
  const [data, setData]       = useState<OrgAdmin[]>([]);
  const [orgs, setOrgs]       = useState<OrgOption[]>([]);
  const [users, setUsers]     = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({ userId: "", organizationId: "" });
  const [userSearch, setUserSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [adminsRes, orgsRes, usersRes] = await Promise.all([
      fetch("/api/ssd/org-admin"),
      fetch("/api/organization"),
      fetch("/api/user/list?all=true&status=active"),
    ]);
    const [adminsJson, orgsJson, usersJson] = await Promise.all([
      adminsRes.json(), orgsRes.json(), usersRes.json(),
    ]);
    setData(adminsJson.data ?? []);
    setOrgs(orgsJson.data ?? []);
    setUsers(usersJson.data ?? usersJson.users ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleAssign = async () => {
    if (!form.userId) { showToast("error", "User wajib dipilih"); return; }
    if (!form.organizationId) { showToast("error", "Organization wajib dipilih"); return; }
    setSaving(true);
    const res = await fetch("/api/ssd/org-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) showToast("error", json.message || "Gagal");
    else { showToast("success", "Admin berhasil di-assign"); setModal(false); setForm({ userId: "", organizationId: "" }); void load(); }
    setSaving(false);
  };

  const handleRemove = async (id: string) => {
    const res = await fetch(`/api/ssd/org-admin/${id}`, { method: "DELETE" });
    if (res.ok) { showToast("success", "Assignment dihapus"); void load(); }
    else { const j = await res.json(); showToast("error", j.message || "Gagal"); }
  };

  const orgLabel = (org: OrgOption) => org.parentOrganizationId ? `↳ ${org.name}` : org.name;

  const filteredUsers = users.filter((u) =>
    !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.employeeId.includes(userSearch)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{data.length} admin ter-assign</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Assign Admin
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Belum ada admin yang di-assign</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipe</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.user.name ?? "-"}</p>
                    <p className="text-xs text-slate-400">{row.user.employeeId} · {row.user.jobPositionName ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span className="text-slate-700">{row.organization.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.organization.parentOrganizationId
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Sub-org</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Org</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRemove(row.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} title="Assign Admin SSD" onClose={() => { setModal(false); setForm({ userId: "", organizationId: "" }); }} boxClassName="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cari User <span className="text-red-500">*</span></label>
            <div className="relative mb-1.5">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                placeholder="Nama atau ID karyawan..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              size={5}
            >
              <option value="">— Pilih user —</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Organization / Sub-org <span className="text-red-500">*</span></label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
              value={form.organizationId}
              onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
            >
              <option value="">— Pilih organization —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{orgLabel(o)}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400">Jika user sudah punya assignment sebelumnya, akan otomatis diganti.</p>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => void handleAssign()} disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
            </Button>
            <Button variant="outline" onClick={() => { setModal(false); setForm({ userId: "", organizationId: "" }); }}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
