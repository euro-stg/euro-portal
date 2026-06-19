"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2, Copy, Check, Eye, EyeOff, Loader2, ToggleLeft, ToggleRight, Activity, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

type ExternalApp = { id: string; name: string; externalUrl: string | null };

type AppTokenRow = {
  id: string;
  name: string;
  description: string | null;
  token: string;
  active: boolean;
  moduleId: string | null;
  createdAt: string;
  updatedAt: string | null;
  creator: { id: string; name: string | null };
  module: { id: string; name: string; externalUrl: string | null } | null;
};

const inputCls  = "w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";
const selectCls = "w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";

export default function AppTokenPage() {
  const [rows, setRows]         = useState<AppTokenRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [alert, setAlert]       = useState<{ variant: "success" | "error"; message: string } | null>(null);

  const [externalApps, setExternalApps]   = useState<ExternalApp[]>([]);
  const [createOpen, setCreateOpen]       = useState(false);
  const [createModuleId, setCreateModuleId] = useState("");
  const [createDesc, setCreateDesc]       = useState("");
  const [creating, setCreating]           = useState(false);
  const [newToken, setNewToken]           = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget]   = useState<AppTokenRow | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const [regenTarget, setRegenTarget]     = useState<AppTokenRow | null>(null);
  const [regening, setRegening]           = useState(false);
  const [regenToken, setRegenToken]       = useState<string | null>(null);

  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [copied, setCopied]               = useState<string | null>(null);

  const alertTimer = useRef<NodeJS.Timeout | null>(null);

  const showAlert = (variant: "success" | "error", message: string) => {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setAlert({ variant, message });
    alertTimer.current = setTimeout(() => setAlert(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/app-token");
      if (r.ok) { const j = await r.json(); setRows(j.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  const loadExternalApps = useCallback(async () => {
    const r = await fetch("/api/module/list?type=app&isExternal=true&status=active");
    if (r.ok) {
      const j = await r.json();
      setExternalApps((j.data ?? []).map((m: { id: string; name: string; externalUrl: string | null }) => ({
        id: m.id, name: m.name, externalUrl: m.externalUrl,
      })));
    }
  }, []);

  useEffect(() => { load(); loadExternalApps(); }, [load, loadExternalApps]);

  // Apps yang belum punya token (atau yang sudah di-delete)
  const usedModuleIds = new Set(rows.filter((r) => r.moduleId).map((r) => r.moduleId!));
  const availableApps = externalApps.filter((a) => !usedModuleIds.has(a.id));

  const handleCreate = async () => {
    if (!createModuleId) return;
    setCreating(true);
    try {
      const r = await fetch("/api/app-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: createModuleId, description: createDesc.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal membuat token"); return; }
      setNewToken(j.data.token);
      setCreateModuleId(""); setCreateDesc("");
      load();
    } finally { setCreating(false); }
  };

  const handleToggleActive = async (row: AppTokenRow) => {
    await fetch(`/api/app-token/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/app-token/${deleteTarget.id}`, { method: "DELETE" });
      if (r.ok) { showAlert("success", "App token dihapus"); setDeleteTarget(null); load(); loadExternalApps(); }
      else { const j = await r.json(); showAlert("error", j.message ?? "Gagal menghapus"); }
    } finally { setDeleting(false); }
  };

  const handleRegen = async () => {
    if (!regenTarget) return;
    setRegening(true);
    try {
      const r = await fetch(`/api/app-token/${regenTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const j = await r.json();
      if (!r.ok) { showAlert("error", j.message ?? "Gagal regenerate"); return; }
      setRegenToken(j.data.token);
      load();
    } finally { setRegening(false); }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleVisibility = (id: string) => {
    setVisibleTokens((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const maskToken = (token: string) => token.slice(0, 8) + "••••••••••••••••••••••••" + token.slice(-4);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Key className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">App Token</h1>
            <p className="text-xs text-slate-400 mt-0.5">Token autentikasi untuk aplikasi eksternal yang menggunakan SSO API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/api-logs" className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Activity className="w-3.5 h-3.5" /> API Logs
          </Link>
          <Button onClick={() => { setCreateOpen(true); setNewToken(null); setCreateModuleId(""); setCreateDesc(""); }}
            className="flex items-center gap-2" disabled={availableApps.length === 0}>
            <Plus className="w-4 h-4" /> Buat Token
          </Button>
        </div>
      </div>

      {alert && <div className="mb-4"><Alert variant={alert.variant} message={alert.message} /></div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">Belum ada app token</p>
            {externalApps.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">Tambahkan dulu aplikasi eksternal di <span className="font-medium">Master Module</span></p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aplikasi</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Token</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dibuat</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const visible = visibleTokens.has(row.id);
                return (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{row.module?.name ?? row.name}</p>
                      {row.module?.externalUrl && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-48">{row.module.externalUrl}</p>
                      )}
                      {row.description && <p className="text-xs text-slate-400 mt-0.5">{row.description}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">oleh {row.creator.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                          {visible ? row.token : maskToken(row.token)}
                        </code>
                        <button onClick={() => toggleVisibility(row.id)} className="text-slate-400 hover:text-slate-600">
                          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => copyToken(row.token)} className="text-slate-400 hover:text-blue-600">
                          {copied === row.token ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleToggleActive(row)} className="flex items-center gap-1.5">
                        {row.active
                          ? <><ToggleRight className="w-5 h-5 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Aktif</span></>
                          : <><ToggleLeft className="w-5 h-5 text-slate-400" /><span className="text-xs text-slate-400">Nonaktif</span></>
                        }
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(row.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setRegenTarget(row); setRegenToken(null); }}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Regenerate token">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(row)}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Buat Token */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setNewToken(null); }} title="Buat App Token">
        {newToken ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Simpan token ini sekarang!</p>
              <p className="text-xs text-amber-700">Token hanya ditampilkan sekali. Setelah ditutup, tidak bisa dilihat lagi.</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-slate-700 flex-1 break-all">{newToken}</code>
              <button onClick={() => copyToken(newToken)} className="shrink-0 text-slate-500 hover:text-blue-600">
                {copied === newToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setCreateOpen(false); setNewToken(null); }}>Sudah Disimpan, Tutup</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Aplikasi Eksternal</label>
              {availableApps.length === 0 ? (
                <p className="text-sm text-slate-400 bg-slate-50 rounded-md px-3 py-2.5">
                  Semua aplikasi eksternal sudah memiliki token. Tambah aplikasi baru di <span className="font-medium">Master Module</span>.
                </p>
              ) : (
                <select className={selectCls} value={createModuleId} onChange={(e) => setCreateModuleId(e.target.value)} disabled={creating}>
                  <option value="">— Pilih aplikasi —</option>
                  {availableApps.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.externalUrl ? ` (${a.externalUrl})` : ""}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Deskripsi <span className="font-normal text-slate-400">(opsional)</span>
              </label>
              <input className={inputCls} placeholder="Catatan tambahan..." value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} disabled={creating} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Batal</Button>
              <Button onClick={handleCreate} disabled={creating || !createModuleId} className="flex items-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Generate Token
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Regenerate */}
      <Modal open={!!regenTarget} onClose={() => { setRegenTarget(null); setRegenToken(null); }} title="Regenerate Token">
        {regenToken ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Token baru — simpan sekarang!</p>
              <p className="text-xs text-amber-700">Token lama sudah tidak berlaku. Semua session lama sudah dihapus.</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-slate-700 flex-1 break-all">{regenToken}</code>
              <button onClick={() => copyToken(regenToken)} className="shrink-0 text-slate-500 hover:text-blue-600">
                {copied === regenToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setRegenTarget(null); setRegenToken(null); }}>Sudah Disimpan, Tutup</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Regenerate token untuk <strong>{regenTarget?.module?.name ?? regenTarget?.name}</strong>?</p>
            <p className="text-xs text-red-500">Token lama akan langsung tidak berlaku dan semua session aktif akan dihapus.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setRegenTarget(null)} disabled={regening}>Batal</Button>
              <Button onClick={handleRegen} disabled={regening} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600">
                {regening && <Loader2 className="w-4 h-4 animate-spin" />} Regenerate
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Delete */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus App Token">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Hapus token untuk <strong>{deleteTarget?.module?.name ?? deleteTarget?.name}</strong>?</p>
          <p className="text-xs text-red-500">Semua session aktif akan dihapus dan aplikasi tidak bisa lagi menggunakan SSO API.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</Button>
            <Button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
