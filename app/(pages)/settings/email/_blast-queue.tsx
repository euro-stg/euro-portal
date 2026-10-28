"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Ban, ChevronDown, ChevronUp, Loader2, RefreshCw, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Antrean email blast (2026-10-28) — blast Euro Update & E Document dikirim worker satu per
// satu dengan jeda yang diatur di sini (lihat app/lib/email-queue.ts).
type QueueBatch = { batchId: string; title: string; source: string; queued: number; failed: number; createdAt: string };
type QueueInfo = {
  queued: number; failed: number; intervalSeconds: number; estimateMinutes: number;
  nextDueAt: string | null; minIntervalSeconds: number; maxIntervalSeconds: number;
  batches: QueueBatch[];
};

// Judul disimpan sudah di-escape untuk HTML email — kembalikan ke teks biasa untuk tampilan.
const decodeEntities = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&amp;/g, "&");
const fmtDate = (d: string) =>
  new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

function useQueueInfo() {
  const [info, setInfo] = useState<QueueInfo | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/system/email-queue");
    if (res.ok) setInfo((await res.json()).data);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/email-queue").then(async (res) => { if (res.ok && !cancelled) setInfo((await res.json()).data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return { info, reload };
}

const fmtDuration = (minutes: number) =>
  minutes < 60 ? `${minutes} menit` : `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;

/** Kartu di tab Konfigurasi: atur jeda antar email blast. */
export function BlastIntervalCard({ onToast }: { onToast: (variant: "success" | "error", message: string) => void }) {
  const { info } = useQueueInfo();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = value ?? (info ? String(info.intervalSeconds) : "");
  const n = Number(current);
  const perHour = n > 0 ? Math.floor(3600 / n) : 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/system/email-queue", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intervalSeconds: n }),
      });
      const json = await res.json();
      onToast(res.ok ? "success" : "error", json.message ?? (res.ok ? "Disimpan" : "Gagal menyimpan"));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><Timer className="w-4 h-4 text-slate-400" /> Kecepatan Email Blast</h2>
      <p className="text-xs text-slate-400 mb-4">
        Email blast (Euro Update &amp; E Document) dikirim satu per satu lewat antrean supaya tidak ditolak server email.
        Email approval, notifikasi biasa, dan lupa password tetap dikirim langsung.
      </p>
      {!info ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1">Jeda antar email (detik)</label>
            <input type="number" min={info.minIntervalSeconds} max={info.maxIntervalSeconds} className={inputCls}
              value={current} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button onClick={() => void save()} disabled={saving || !(n >= info.minIntervalSeconds && n <= info.maxIntervalSeconds)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
          </Button>
          <p className="text-xs text-slate-500 pb-2">
            {perHour > 0 ? <>≈ <b>{perHour.toLocaleString("id-ID")}</b> email/jam — blast ke 1.000 orang selesai ±{fmtDuration(Math.ceil(1000 * n / 60))}</> : "Isi angka yang valid"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Ringkasan antrean + daftar kelompok blast (detail & batalkan) di tab Log Keluar. */
export function BlastQueueSummary({ onToast, onRetried }: { onToast: (variant: "success" | "error", message: string) => void; onRetried?: () => void }) {
  const { info, reload } = useQueueInfo();
  const [busy, setBusy] = useState<string | null>(null);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState(0);

  // Selama masih ada yang menunggu, segarkan tiap 15 detik supaya progres terlihat.
  useEffect(() => {
    if (!info || info.queued === 0) return;
    const t = setInterval(() => { void reload(); setDetailKey((k) => k + 1); }, 15_000);
    return () => clearInterval(t);
  }, [info, reload]);

  const act = async (key: string, payload: Record<string, unknown>) => {
    setBusy(key);
    try {
      const res = await fetch("/api/system/email-queue", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      onToast(res.ok ? "success" : "error", json.message ?? "Gagal");
      await reload(); setDetailKey((k) => k + 1); onRetried?.();
    } finally { setBusy(null); }
  };

  const cancel = (b: QueueBatch) => {
    const n = b.queued + b.failed;
    if (!confirm(`Batalkan blast "${decodeEntities(b.title)}"?\n\n${n.toLocaleString("id-ID")} email yang belum terkirim akan dihapus dari antrean dan TIDAK akan dikirim. Email yang sudah terkirim tidak terpengaruh.`)) return;
    void act("cancel:" + b.batchId, { action: "cancel-batch", batchId: b.batchId });
  };

  if (!info) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-medium text-slate-700">Antrean email blast</span>
        <span className="text-slate-600">
          <b className="text-blue-700">{info.queued.toLocaleString("id-ID")}</b> menunggu
          {info.queued > 0 && <span className="text-slate-400"> · perkiraan selesai ±{fmtDuration(info.estimateMinutes)} (jeda {info.intervalSeconds} dtk)</span>}
        </span>
        <span className="text-slate-600"><b className={info.failed ? "text-red-600" : ""}>{info.failed.toLocaleString("id-ID")}</b> gagal</span>
        <div className="ml-auto flex items-center gap-2">
          {info.failed > 0 && (
            <Button variant="outline" size="sm" onClick={() => void act("retry:all", { action: "retry-failed" })} disabled={!!busy} className="flex items-center gap-1.5">
              {busy === "retry:all" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Kirim ulang semua yang gagal
            </Button>
          )}
          <button onClick={() => { void reload(); setDetailKey((k) => k + 1); }} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Muat ulang">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {info.batches.length > 0 && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-semibold">Blast</th>
                <th className="text-left px-3 py-2 font-semibold">Sumber</th>
                <th className="text-right px-3 py-2 font-semibold">Menunggu</th>
                <th className="text-right px-3 py-2 font-semibold">Gagal</th>
                <th className="text-left px-3 py-2 font-semibold">Dibuat</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {info.batches.map((b) => {
                const open = openBatch === b.batchId;
                return (
                  <Fragment key={b.batchId}>
                    <tr className={open ? "bg-blue-50/40" : "hover:bg-slate-50/60"}>
                      <td className="px-4 py-2.5 text-slate-800 max-w-[320px] truncate" title={decodeEntities(b.title)}>{decodeEntities(b.title)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{b.source}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-blue-700">{b.queued.toLocaleString("id-ID")}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${b.failed ? "text-red-600" : "text-slate-400"}`}>{b.failed.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button onClick={() => setOpenBatch(open ? null : b.batchId)} className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-slate-100">
                            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Detail
                          </button>
                          {b.failed > 0 && (
                            <button onClick={() => void act("retry:" + b.batchId, { action: "retry-failed", batchId: b.batchId })} disabled={!!busy}
                              className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-50">
                              {busy === "retry:" + b.batchId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Kirim ulang
                            </button>
                          )}
                          <button onClick={() => cancel(b)} disabled={!!busy}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                            {busy === "cancel:" + b.batchId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Batalkan
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr><td colSpan={6} className="p-0 bg-slate-50/60"><BatchDetail batchId={b.batchId} refreshKey={detailKey} /></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type QueueRow = { id: string; to: string; status: string; attempts: number; scheduledAt: string; lastError: string | null };
const STATUS_UI: Record<string, { label: string; cls: string }> = {
  queued:  { label: "Menunggu",       cls: "bg-blue-50 text-blue-700" },
  sending: { label: "Sedang dikirim", cls: "bg-amber-50 text-amber-700" },
  failed:  { label: "Gagal",          cls: "bg-red-50 text-red-700" },
};

/** Daftar penerima satu blast (yang belum terkirim), dengan filter status, cari, & halaman. */
function BatchDetail({ batchId, refreshKey }: { batchId: string; refreshKey: number }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; rows: QueueRow[]; total: number; totalPages: number } | null>(null);

  const params = new URLSearchParams({ batchId, page: String(page) });
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  const key = params.toString();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/system/email-queue?${key}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((j) => { if (!cancelled) setResult({ key, rows: j?.data ?? [], total: j?.total ?? 0, totalPages: j?.totalPages ?? 1 }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key, refreshKey]);

  const loading = result?.key !== key;
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua status</option>
          <option value="queued">Menunggu</option>
          <option value="sending">Sedang dikirim</option>
          <option value="failed">Gagal</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} className="flex-1 min-w-[180px] max-w-xs">
          <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" placeholder="Cari alamat email, tekan Enter" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <span className="text-xs text-slate-400 ml-auto">{result ? `${result.total.toLocaleString("id-ID")} email` : ""}</span>
      </div>
      {loading && !result ? (
        <p className="text-xs text-slate-400 flex items-center gap-2 py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat...</p>
      ) : result && result.rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-3">Tidak ada email untuk filter ini.</p>
      ) : result && (
        <table className={`w-full text-xs bg-white rounded-lg border border-slate-200 ${loading ? "opacity-60" : ""}`}>
          <thead>
            <tr className="text-slate-500 border-b border-slate-100">
              <th className="text-left px-3 py-2 font-medium">Penerima</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Percobaan</th>
              <th className="text-left px-3 py-2 font-medium">Jadwal kirim</th>
              <th className="text-left px-3 py-2 font-medium">Error terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {result.rows.map((r) => {
              const ui = STATUS_UI[r.status] ?? STATUS_UI.queued;
              return (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 text-slate-700">{r.to}</td>
                  <td className="px-3 py-1.5"><span className={`px-2 py-0.5 rounded-full font-medium ${ui.cls}`}>{ui.label}</span></td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{r.attempts}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{r.status === "failed" ? "—" : fmtDate(r.scheduledAt)}</td>
                  <td className="px-3 py-1.5 text-red-600 max-w-[260px] truncate" title={r.lastError ?? ""}>{r.lastError ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-30">‹ Sebelumnya</button>
          <span>Halaman {page} / {result.totalPages}</span>
          <button disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-30">Berikutnya ›</button>
        </div>
      )}
    </div>
  );
}
