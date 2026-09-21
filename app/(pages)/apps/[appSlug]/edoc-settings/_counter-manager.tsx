"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Hash, Pencil, Check, X } from "lucide-react";

type Counter = { id: string; scope: string; key: string; seq: number; updatedAt: string };

export function CounterManager({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/counter");
      const json = await res.json();
      setCounters(res.ok ? (json.data ?? []) : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (c: Counter) => { setEditing(c.id); setEditValue(String(c.seq)); };

  const save = async (c: Counter) => {
    const seq = Number(editValue);
    if (!Number.isFinite(seq) || seq < 0) { onError("Nilai counter harus angka >= 0"); return; }
    const res = await fetch("/api/edoc/counter", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: c.scope, key: c.key, seq }),
    });
    const json = await res.json();
    if (!res.ok) { onError(json.message || "Gagal update counter"); return; }
    onSuccess("Counter berhasil dikoreksi");
    setEditing(null);
    void load();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1"><Hash className="w-4 h-4 text-amber-600" /><p className="text-sm font-semibold text-slate-700">Master Number</p></div>
      <p className="text-xs text-slate-400 mb-4">Nilai counter nomor urut saat ini — bisa dikoreksi langsung sesuai kondisi production.</p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : counters.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada counter yang tercatat (akan muncul setelah nomor pertama digenerate).</p>
      ) : (
        <div className="space-y-1.5">
          {counters.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-mono text-slate-700">{c.scope} / {c.key}</p>
                <p className="text-xs text-slate-400">Update terakhir: {new Date(c.updatedAt).toLocaleString("id-ID")}</p>
              </div>
              {editing === c.id ? (
                <div className="flex items-center gap-1.5">
                  <input type="number" className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <button onClick={() => save(c)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditing(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{c.seq}</span>
                  <button onClick={() => startEdit(c)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
