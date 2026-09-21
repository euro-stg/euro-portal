"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Building2, Plus, Pencil, Check, X, Route } from "lucide-react";
import { MultiSelect } from "../_edoc-multiselect";

type BusinessUnit = { id: string; code: string; name: string; status: string };
type PrefixMapping = { id: string; prefix: string; businessUnitCodes: string[]; isDefault: boolean };

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

// Master Business Unit — sebelumnya tabel EDocBusinessUnit tidak punya UI admin sama
// sekali (baris di dev database dulu dibuat lewat script sekali pakai), makanya dropdown
// Business Unit di form upload/edit file kosong total di production. Dibuat 2026-09-21.
export function BusinessUnitManager({ onError, onSuccess, onChanged }: { onError: (m: string) => void; onSuccess: (m: string) => void; onChanged?: () => void }) {
  const [items, setItems] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/business-unit");
      const json = await res.json();
      setItems(res.ok ? (json.data ?? []) : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!newCode.trim() || !newName.trim()) { onError("Code dan Name wajib diisi"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/edoc/business-unit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim(), name: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal membuat Business Unit"); return; }
      setNewCode(""); setNewName("");
      onSuccess("Business Unit berhasil dibuat");
      void load();
      onChanged?.();
    } finally { setCreating(false); }
  };

  const startEdit = (bu: BusinessUnit) => { setEditing(bu.id); setEditName(bu.name); };

  const saveName = async (bu: BusinessUnit) => {
    if (!editName.trim()) { onError("Name tidak boleh kosong"); return; }
    const res = await fetch(`/api/edoc/business-unit/${bu.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { onError(json.message || "Gagal update"); return; }
    onSuccess("Business Unit berhasil diperbarui");
    setEditing(null);
    void load();
    onChanged?.();
  };

  const toggleStatus = async (bu: BusinessUnit) => {
    const nextStatus = bu.status === "active" ? "inactive" : "active";
    const res = await fetch(`/api/edoc/business-unit/${bu.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json();
    if (!res.ok) { onError(json.message || "Gagal update status"); return; }
    onSuccess(nextStatus === "active" ? "Business Unit diaktifkan kembali" : "Business Unit dinonaktifkan");
    void load();
    onChanged?.();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-slate-700">Master Business Unit</p></div>
      <p className="text-xs text-slate-400 mb-4">Daftar Business Unit yang bisa dipilih saat upload/edit file. Kosong = dropdown Business Unit di form upload juga kosong.</p>

      <div className="flex items-end gap-2 mb-4">
        <div className="w-28"><label className="block text-xs text-slate-500 mb-1">Code</label><input className={inputCls} placeholder="EHL" value={newCode} onChange={(e) => setNewCode(e.target.value)} /></div>
        <div className="flex-1"><label className="block text-xs text-slate-500 mb-1">Name</label><input className={inputCls} placeholder="Euromedica Hospital..." value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
        <button onClick={create} disabled={creating} className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada Business Unit — tambah dulu di atas.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((bu) => (
            <div key={bu.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">{bu.code}</span>
                {editing === bu.id ? (
                  <input className="border border-slate-200 rounded px-2 py-1 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                ) : (
                  <span className={`text-sm ${bu.status === "active" ? "text-slate-700" : "text-slate-400 line-through"}`}>{bu.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {editing === bu.id ? (
                  <>
                    <button onClick={() => saveName(bu)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(bu)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => toggleStatus(bu)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${bu.status === "active" ? "bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600" : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
                    >
                      {bu.status === "active" ? "Active" : "Inactive"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Branch Prefix Mapping — auto-checklist Branch begitu Business Unit dipilih di form
// upload (dan sumber resolve BU seorang user dari branchName-nya untuk ACL folder). Sama
// seperti Business Unit di atas, sebelumnya cuma pernah diisi lewat script dev.
export function BranchPrefixMappingManager({ businessUnits, onError, onSuccess }: {
  businessUnits: BusinessUnit[]; onError: (m: string) => void; onSuccess: (m: string) => void;
}) {
  const [items, setItems] = useState<PrefixMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPrefix, setNewPrefix] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/branch-prefix-mapping");
      const json = await res.json();
      setItems(res.ok ? (json.data ?? []) : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!newPrefix.trim()) { onError("Prefix wajib diisi"); return; }
    if (newCodes.length === 0) { onError("Pilih minimal 1 Business Unit"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/edoc/branch-prefix-mapping", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: newPrefix.trim(), businessUnitCodes: newCodes, isDefault: newIsDefault }),
      });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal membuat mapping"); return; }
      setNewPrefix(""); setNewCodes([]); setNewIsDefault(false);
      onSuccess("Mapping berhasil dibuat");
      void load();
    } finally { setCreating(false); }
  };

  const setDefault = async (m: PrefixMapping) => {
    const res = await fetch(`/api/edoc/branch-prefix-mapping/${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }),
    });
    const json = await res.json();
    if (!res.ok) { onError(json.message || "Gagal set default"); return; }
    onSuccess(`"${m.prefix}" dijadikan fallback default`);
    void load();
  };

  const remove = async (m: PrefixMapping) => {
    if (!window.confirm(`Hapus mapping prefix "${m.prefix}"?`)) return;
    const res = await fetch(`/api/edoc/branch-prefix-mapping/${m.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { onError(json.message || "Gagal menghapus"); return; }
    onSuccess("Mapping dihapus");
    void load();
  };

  const nameOf = (code: string) => businessUnits.find((b) => b.code === code)?.name ?? code;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1"><Route className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-slate-700">Branch Prefix Mapping</p></div>
      <p className="text-xs text-slate-400 mb-4">
        Prefix nama branch (mis. &ldquo;EHL&rdquo; dari &ldquo;EHL - Jakarta&rdquo;) → Business Unit terkait. Dipakai untuk auto-centang Branch saat
        Business Unit dipilih di form upload, dan untuk resolve akses folder berbasis Business Unit seorang user. Satu row boleh ditandai
        <b> default</b> — dipakai kalau prefix branch user tidak cocok dengan mapping manapun.
      </p>

      <div className="flex items-end gap-2 mb-4 flex-wrap">
        <div className="w-32"><label className="block text-xs text-slate-500 mb-1">Prefix</label><input className={inputCls} placeholder="EHL" value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} /></div>
        <div className="flex-1 min-w-48"><MultiSelect label="Business Unit" options={businessUnits.map((b) => ({ id: b.code, name: b.name }))} selected={newCodes} onChange={setNewCodes} /></div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
          <input type="checkbox" checked={newIsDefault} onChange={(e) => setNewIsDefault(e.target.checked)} className="rounded border-slate-300" /> Default
        </label>
        <button onClick={create} disabled={creating} className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 mb-0.5">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada mapping — tambah dulu di atas.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">{m.prefix}</span>
                {m.businessUnitCodes.map((c) => (
                  <span key={c} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">{nameOf(c)}</span>
                ))}
                {m.isDefault && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Default</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {!m.isDefault && (
                  <button onClick={() => setDefault(m)} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">Jadikan default</button>
                )}
                <button onClick={() => remove(m)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
