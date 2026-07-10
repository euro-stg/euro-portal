"use client";

import { useEffect, useState } from "react";
import { Settings, LayoutList, Eye, RefreshCw, Trash2, Plus, ChevronDown } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; icon: string | null; color: string | null; order: number; isActive: boolean };

type ReadLog = { id: string; readAt: string; user: { id: string; name: string | null; employeeId: string; organizationName: string | null } };

type AbsPost = { id: string; title: string; isMandatory: boolean; publishedAt: string | null; _count: { readLogs: number } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

type Tab = "categories" | "absorption";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EuSettingsPage() {
  const [tab, setTab] = useState<Tab>("categories");
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useState<NodeJS.Timeout | null>(null);

  function showToast(variant: "success" | "error", message: string) {
    if (toastTimer[0]) clearTimeout(toastTimer[0]);
    setToast({ variant, message });
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div>
      {toast && <div className="fixed top-16 right-4 z-50 min-w-72"><Alert variant={toast.variant} message={toast.message} /></div>}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Settings Euro Update</h1>
          <p className="text-slate-400 text-xs">Kelola kategori dan keterserapan informasi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([
          { key: "categories", label: "Kategori",       icon: LayoutList },
          { key: "absorption", label: "Keterserapan",   icon: Eye        },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "categories"  && <CategoriesTab showToast={showToast} />}
      {tab === "absorption"  && <AbsorptionTab />}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ showToast }: { showToast: (v: "success" | "error", m: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "", color: "#3B82F6" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/eu/category");
    const json = await res.json();
    setCategories(json.data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/eu/category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? "Gagal membuat kategori"); return; }
      showToast("success", "Kategori berhasil dibuat");
      setCreateOpen(false);
      setForm({ name: "", icon: "", color: "#3B82F6" });
      void load();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Tambah Kategori
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> Memuat...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Urutan</th>
                <th className="px-4 py-3">Icon</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Warna</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="px-4 py-3 text-slate-500">{cat.order}</td>
                  <td className="px-4 py-3 text-lg">{cat.icon ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{cat.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: cat.color ?? "#e2e8f0" }} />
                      <span className="text-xs text-slate-500 font-mono">{cat.color ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                      {cat.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} title="Tambah Kategori" onClose={() => setCreateOpen(false)} boxClassName="w-full max-w-sm">
        <div className="space-y-4">
          {error && <Alert variant="error" message={error} />}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama *</label>
            <input className={inputCls} placeholder="Cth: Medical" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Icon (emoji)</label>
            <input className={inputCls} placeholder="Cth: 🏥" value={form.icon} onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Warna (hex)</label>
            <div className="flex items-center gap-2">
              <input type="color" className="w-10 h-9 rounded border border-slate-200 cursor-pointer" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
              <input className={inputCls} value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Batal</Button>
            <Button variant="primary" onClick={() => void handleCreate()} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Slides Tab ───────────────────────────────────────────────────────────────

// ─── Absorption Tab ───────────────────────────────────────────────────────────

function AbsorptionTab() {
  const [posts, setPosts] = useState<AbsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [readers, setReaders] = useState<Record<string, ReadLog[]>>({});
  const [loadingReaders, setLoadingReaders] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/eu/post?all=true")
      .then((r) => r.json())
      .then((j) => setPosts((j.data ?? []).filter((p: AbsPost) => p.isMandatory)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadReaders = async (postId: string) => {
    if (readers[postId]) { setExpanded(expanded === postId ? null : postId); return; }
    setLoadingReaders(postId);
    const res = await fetch(`/api/eu/post/${postId}/read`);
    const json = await res.json();
    setReaders((p) => ({ ...p, [postId]: json.data ?? [] }));
    setExpanded(postId);
    setLoadingReaders(null);
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">Menampilkan post <strong>wajib dibaca</strong> beserta data keterserapan informasi.</p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> Memuat...</div>
      ) : posts.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-12">Belum ada post wajib dibaca.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => void loadReaders(p.id)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "Draft"}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-600">{p._count.readLogs}</span>
                    <span className="text-xs text-slate-400">sudah baca</span>
                  </div>
                  {loadingReaders === p.id
                    ? <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                    : <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded === p.id ? "rotate-180" : ""}`} />
                  }
                </div>
              </button>

              {expanded === p.id && readers[p.id] && (
                <div className="border-t border-slate-100">
                  {readers[p.id].length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Belum ada yang membaca.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <th className="px-4 py-2 text-left">Nama</th>
                          <th className="px-4 py-2 text-left">Employee ID</th>
                          <th className="px-4 py-2 text-left">Organisasi</th>
                          <th className="px-4 py-2 text-left">Dibaca</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {readers[p.id].map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-2 text-slate-800">{log.user.name ?? "—"}</td>
                            <td className="px-4 py-2 text-slate-500 font-mono text-xs">{log.user.employeeId}</td>
                            <td className="px-4 py-2 text-slate-500">{log.user.organizationName ?? "—"}</td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{new Date(log.readAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
