"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, Search, X } from "lucide-react";

// Penggantian IM (2026-11-05) — UI tautan "IM baru menggantikan IM lama". Dipakai form
// upload (ReplacementEditor, belum tersimpan sampai upload) & detail IM (ImReplacementSection).
// Saat IM baru di-approve, IM lama berakhir H-1 dari Start Date IM baru — lihat
// app/lib/im-replacement.ts.

export type ReplaceCandidate = {
  id: string; title: string; documentNumber: string | null; startDate: string | null; endDate: string | null;
  currentObsoleteFolderId: string | null; obsoleteFolders: { id: string; name: string }[];
};
export type ReplacementDraft = { candidate: ReplaceCandidate; obsoleteFolderId: string };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("id-ID", { timeZone: "UTC" }) : "-");
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";

/** Tanggal berakhir IM lama kalau IM baru (start date ini) di-approve — end date IM lama
 * yang sudah lebih awal tidak dimundurkan (sama dengan aturan server). */
export function endDatePreview(newStartDate: string | null, oldEndDate?: string | null) {
  const target = newStartDate ? new Date(new Date(newStartDate.slice(0, 10)).getTime() - 86_400_000) : null;
  if (oldEndDate && (!target || new Date(oldEndDate) <= target)) {
    return target ? `${fmtDate(oldEndDate)} (tetap — sudah lebih awal)` : `paling lambat ${fmtDate(oldEndDate)}, atau H-1 dari tanggal approve`;
  }
  return target ? target.toLocaleDateString("id-ID", { timeZone: "UTC" }) : "H-1 dari tanggal approve";
}

function CandidateSearch({ excludeFileId, exclude, onPick }: { excludeFileId?: string; exclude: string[]; onPick: (c: ReplaceCandidate) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ReplaceCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams({ q: term });
        if (excludeFileId) p.set("excludeFileId", excludeFileId);
        const json = await fetch(`/api/edoc/im-replace-candidates?${p}`).then((r) => r.json());
        if (!cancelled) setHits(json.data ?? []);
      } finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, excludeFileId]);
  const shown = q.trim().length >= 2 ? hits.filter((h) => !exclude.includes(h.id)) : [];
  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
      <input className={`${inputCls} pl-9`} placeholder="Cari IM lama (nomor dokumen atau judul, min. 2 huruf)..." value={q} onChange={(e) => setQ(e.target.value)} />
      {(loading || shown.length > 0 || (q.trim().length >= 2 && !loading)) && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto divide-y divide-slate-100">
          {loading && shown.length === 0 ? <p className="text-xs text-slate-400 p-3">Mencari...</p>
            : shown.length === 0 ? <p className="text-xs text-slate-400 p-3">Tidak ada IM Release yang cocok (atau sudah digantikan IM lain).</p>
            : shown.map((c) => (
              <button key={c.id} type="button" onClick={() => { onPick(c); setQ(""); setHits([]); }} className="w-full text-left px-3 py-2 hover:bg-amber-50 text-xs">
                <p className="text-slate-800"><span className="font-mono text-amber-700">{c.documentNumber ?? "-"}</span> — {c.title}</p>
                <p className="text-slate-400">Berlaku {fmtDate(c.startDate)} s/d {c.endDate ? fmtDate(c.endDate) : "Tetap"}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function ObsoleteSelect({ c, value, onChange }: { c: ReplaceCandidate; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs text-slate-500 flex items-center gap-2">
      <span className="shrink-0">Folder Obsolete IM lama</span>
      <select className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs bg-white" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— tidak dipindah —</option>
        {c.obsoleteFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </label>
  );
}

const draftFor = (c: ReplaceCandidate): ReplacementDraft => ({
  candidate: c,
  obsoleteFolderId: c.currentObsoleteFolderId && c.obsoleteFolders.some((f) => f.id === c.currentObsoleteFolderId) ? c.currentObsoleteFolderId : "",
});

/** Form upload IM baru — daftar IM lama yang digantikan (dikirim bersama upload). */
export function ReplacementEditor({ value, onChange, newStartDate }: { value: ReplacementDraft[]; onChange: (v: ReplacementDraft[]) => void; newStartDate: string | null }) {
  return (
    <div className="space-y-2">
      {value.map((d, i) => (
        <div key={d.candidate.id} className="border border-slate-200 rounded-lg p-2.5 space-y-1.5 bg-slate-50/60">
          <div className="flex items-start gap-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-800 flex-1"><span className="font-mono text-amber-700">{d.candidate.documentNumber}</span> — {d.candidate.title}</p>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-slate-500 pl-6">Saat IM ini di-approve, IM lama berakhir <b>{endDatePreview(newStartDate, d.candidate.endDate)}</b>.</p>
          <div className="pl-6"><ObsoleteSelect c={d.candidate} value={d.obsoleteFolderId} onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, obsoleteFolderId: v } : x)))} /></div>
        </div>
      ))}
      <CandidateSearch exclude={value.map((d) => d.candidate.id)} onPick={(c) => onChange([...value, draftFor(c)])} />
    </div>
  );
}

type FileSummary = { id: string; documentNumber: string | null; title: string | null; status: string; startDate: string | null; endDate: string | null; canOpen: boolean };
type Info = {
  replaces: { oldFileId: string; file: FileSummary; obsoleteFolderName: string | null; appliedAt: string | null; appliedEndDate: string | null; previousEndDate: string | null }[];
  replacedBy: { file: FileSummary; appliedAt: string | null; appliedEndDate: string | null } | null;
  canManage: boolean;
};

/** Detail IM — "Menggantikan" & "Digantikan oleh" + kelola tautan (sebelum Release). */
export function ImReplacementSection({ fileId, newStartDate, onError }: { fileId: string; newStartDate: string | null; onError: (m: string) => void }) {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [pending, setPending] = useState<ReplacementDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/edoc/file/${fileId}/replacement`);
    if (res.ok) setInfo(await res.json());
  }, [fileId]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const call = async (method: "POST" | "DELETE", body?: object, qs = "") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/edoc/file/${fileId}/replacement${qs}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal menyimpan"); return; }
      setPending(null); setAdding(false);
      await load();
    } finally { setBusy(false); }
  };

  // IM yang sudah digantikan tidak ditawari menggantikan IM lain (membingungkan).
  const canAdd = info?.canManage && !info.replacedBy;
  if (!info || (!canAdd && info.replaces.length === 0 && !info.replacedBy)) return null;
  const link = (f: FileSummary) => f.canOpen
    ? <button onClick={() => router.push(`/apps/${appSlug}/edoc-file/${f.id}`)} className="text-amber-700 hover:underline font-mono">{f.documentNumber ?? f.title}</button>
    : <span className="font-mono text-slate-600" title="Anda tidak punya akses ke dokumen ini">{f.documentNumber ?? "(tanpa nomor)"}</span>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3"><ArrowRightLeft className="w-4 h-4 text-amber-600" /> Penggantian IM</p>

      {info.replacedBy && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm">
          <p className="text-red-800">
            <b>Digantikan oleh</b> {link(info.replacedBy.file)}{info.replacedBy.file.title ? ` — ${info.replacedBy.file.title}` : ""}
          </p>
          <p className="text-xs text-red-700 mt-0.5">
            {info.replacedBy.appliedAt
              ? `IM ini berakhir ${fmtDate(info.replacedBy.appliedEndDate)} (diterapkan saat IM pengganti di-approve).`
              : "IM pengganti masih menunggu approval — IM ini otomatis berakhir H-1 dari Start Date-nya begitu di-approve."}
          </p>
        </div>
      )}

      {info.replaces.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Menggantikan</p>
          {info.replaces.map((r) => (
            <div key={r.oldFileId} className="flex items-start gap-3 text-sm border border-slate-100 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p>{link(r.file)}{r.file.title ? <span className="text-slate-700"> — {r.file.title}</span> : null}</p>
                <p className="text-xs text-slate-500">
                  {r.appliedAt
                    ? <>Berakhir <b>{fmtDate(r.appliedEndDate)}</b>{r.previousEndDate ? ` (sebelumnya ${fmtDate(r.previousEndDate)})` : " (sebelumnya Tetap)"}</>
                    : <>Akan berakhir <b>{endDatePreview(newStartDate, r.file.endDate)}</b> saat IM ini di-approve</>}
                  {r.obsoleteFolderName ? ` · pindah ke folder Obsolete "${r.obsoleteFolderName}"` : ""}
                </p>
              </div>
              {info.canManage && !r.appliedAt && (
                <button disabled={busy} onClick={() => void call("DELETE", undefined, `?oldFileId=${r.oldFileId}`)} className="text-xs text-slate-400 hover:text-red-600 shrink-0">Lepas</button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        pending ? (
          <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2">
            <p className="text-sm text-slate-800"><span className="font-mono text-amber-700">{pending.candidate.documentNumber}</span> — {pending.candidate.title}</p>
            <ObsoleteSelect c={pending.candidate} value={pending.obsoleteFolderId} onChange={(v) => setPending({ ...pending, obsoleteFolderId: v })} />
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => void call("POST", { oldFileId: pending.candidate.id, obsoleteFolderId: pending.obsoleteFolderId || null })}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1">
                {busy && <Loader2 className="w-3 h-3 animate-spin" />} Tautkan
              </button>
              <button onClick={() => setPending(null)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">Batal</button>
            </div>
          </div>
        ) : adding ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-500">Cari IM lama yang digantikan IM ini:</p>
              <button onClick={() => setAdding(false)} className="text-xs text-slate-400 hover:text-slate-600">Tutup</button>
            </div>
            <CandidateSearch excludeFileId={fileId} exclude={info.replaces.map((r) => r.oldFileId)} onPick={(c) => setPending(draftFor(c))} />
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="text-xs text-amber-600 hover:text-amber-700">+ Tambah IM yang digantikan</button>
        )
      )}
    </div>
  );
}
