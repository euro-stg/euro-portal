"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Plus, Trash2, Loader2, RefreshCw, Users, Pencil, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

type OrgRow = {
  id: string;
  name: string;
  code: string | null;
  parentOrganizationId: string | null;
  branchId: string | null;
  source: string;
  syncedAt: string | null;
  createdAt: string;
};

type OrgNode = OrgRow & { children: OrgNode[] };

function buildTree(orgs: OrgRow[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  for (const o of orgs) map.set(o.id, { ...o, children: [] });

  const roots: OrgNode[] = [];
  for (const node of map.values()) {
    if (node.parentOrganizationId && map.has(node.parentOrganizationId)) {
      map.get(node.parentOrganizationId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortByName = (a: OrgNode, b: OrgNode) => a.name.localeCompare(b.name);
  const sort = (nodes: OrgNode[]) => {
    nodes.sort(sortByName);
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

const SOURCE_BADGE: Record<string, string> = {
  manual:     "bg-slate-100 text-slate-500",
  user_sync:  "bg-blue-50 text-blue-600",
  talenta:    "bg-emerald-50 text-emerald-700",
};
const SOURCE_LABEL: Record<string, string> = {
  manual:    "Manual",
  user_sync: "Sync User",
  talenta:   "Talenta",
};

export default function OrganizationPage() {
  const [data, setData]       = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [addOpen, setAddOpen]   = useState(false);
  const [editRow, setEditRow]   = useState<OrgRow | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ name: "", code: "", parentOrganizationId: "" });

  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  function showToast(variant: "success" | "error", message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/organization");
    const json = await res.json();
    setData(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const syncFromUsers = async () => {
    setSyncing(true);
    const res = await fetch("/api/organization/sync-from-users", { method: "POST" });
    const json = await res.json();
    if (res.ok) { showToast("success", json.message); void load(); }
    else showToast("error", json.message || "Gagal sync");
    setSyncing(false);
  };

  const openAdd = () => {
    setForm({ name: "", code: "", parentOrganizationId: "" });
    setAddOpen(true);
  };

  const openEdit = (row: OrgRow) => {
    setForm({ name: row.name, code: row.code ?? "", parentOrganizationId: row.parentOrganizationId ?? "" });
    setEditRow(row);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast("error", "Nama wajib diisi"); return; }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      parentOrganizationId: form.parentOrganizationId || null,
    };

    const isEdit = !!editRow;
    const res = await fetch(isEdit ? `/api/organization/${editRow!.id}` : "/api/organization", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { showToast("error", json.message || "Gagal"); }
    else {
      showToast("success", isEdit ? "Berhasil diperbarui" : "Berhasil ditambahkan");
      setAddOpen(false);
      setEditRow(null);
      void load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/organization/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) showToast("error", json.message || "Gagal");
    else { showToast("success", "Dihapus"); void load(); }
  };

  const tree = buildTree(data);

  // Flat list of parent-only orgs for dropdown (exclude current edit target)
  const parentOptions = data.filter((o) => !o.parentOrganizationId && o.id !== editRow?.id);

  function OrgRows({ nodes, depth }: { nodes: OrgNode[]; depth: number }) {
    return (
      <>
        {nodes.map((node) => (
          <React.Fragment key={node.id}>
            <tr className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-slate-400 select-all">{node.id}</span>
              </td>
              <td className="px-4 py-3">
                {node.code
                  ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{node.code}</span>
                  : <span className="text-xs text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 20 }}>
                  {depth > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                  <span className="font-medium text-slate-800 text-sm">{node.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[node.source] ?? "bg-slate-100 text-slate-500"}`}>
                  {SOURCE_LABEL[node.source] ?? node.source}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">
                {node.children.length > 0 && (
                  <span className="text-slate-400">{node.children.length} sub-org</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(node)} className="p-1.5 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(node.id)}
                    disabled={node.children.length > 0}
                    className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={node.children.length > 0 ? "Hapus sub-org dulu" : "Hapus"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
            {node.children.length > 0 && <OrgRows nodes={node.children} depth={depth + 1} />}
          </React.Fragment>
        ))}
      </>
    );
  }

  const modalOpen = addOpen || !!editRow;

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Master Organization</h1>
          <p className="text-xs text-slate-400">Kelola hierarki organisasi — org & sub-org</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <span className="mt-0.5 shrink-0">ℹ️</span>
        <span>
          <strong>Sync dari User</strong> mengambil data organization dari profil user aktif sebagai sumber sementara.
          Akses ke endpoint Organization Talenta belum tersedia — namun struktur data sudah disesuaikan
          sehingga saat akses tersedia, cukup tambahkan metode sync Talenta tanpa perlu ubah skema.
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{data.length} organization</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => void syncFromUsers()} disabled={syncing}
            className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            Sync dari User
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Tambah
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Belum ada organization</p>
            <p className="text-xs text-slate-300 mt-1">Tambah manual atau sync dari data user</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sumber</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sub-org</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <OrgRows nodes={tree} depth={0} />
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editRow ? "Edit Organization" : "Tambah Organization"}
        onClose={() => { setAddOpen(false); setEditRow(null); }}
        boxClassName="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama <span className="text-red-500">*</span></label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              placeholder="Nama organization"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 uppercase"
              placeholder="Opsional"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Parent Organization</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
              value={form.parentOrganizationId}
              onChange={(e) => setForm((f) => ({ ...f, parentOrganizationId: e.target.value }))}
            >
              <option value="">— Tidak ada (org utama) —</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {form.parentOrganizationId && (
              <p className="text-xs text-blue-600 mt-1">Ini akan menjadi sub-org</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => void handleSave()} disabled={saving} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
            </Button>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditRow(null); }}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
