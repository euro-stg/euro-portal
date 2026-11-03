"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck, Search, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";

// Cek Item vs Master Item (2026-11-02, Tahap 3) — khusus superadmin & Document Approver.
// Cakupan: item di IM aktif (sama dengan Item Browser). Tiga tab:
//   Discontinued   — item yang SEMUA SKU-nya Discontinued → user pilih & konfirmasi untuk
//                    dikeluarkan (masuk Riwayat, bisa dikembalikan). Tidak ada yang otomatis.
//   Belum ber-SKU  — item lama tanpa SKU → pilih SKU dari saran nama / cari manual → simpan.
//   Riwayat        — item yang dikeluarkan + tombol Kembalikan.

type SkuInfo = { company: string; itemCode: string; itemName: string | null; status: string | null };
type FileRef = { id: string; title: string; documentNumber: string | null; businessUnitCodes: string[]; endDate: string | null };
type CheckRow = { id: string; itemName: string; promoType: string | null; promoPrice: number | null; file: FileRef; skus: SkuInfo[] };
type Summary = { total: number; active: number; discontinued: number; partial: number; unmapped: number; removed: number };
type Candidate = { itemCode: string; itemName: string; company: string | null; business: string | null; itemGroup: string; status: string; standardPrice: number | null };
type UnmappedRow = CheckRow & { excelSku: string | null; suggestions: (Candidate & { reason: "NAME" | "SIMILAR"; inScope: boolean })[]; autoPick: string | null };
type Removal = {
  id: string; itemName: string; reason: string; removedAt: string; removedBy: string | null; restoredAt: string | null; restoredBy: string | null;
  skus: { company: string; itemCode: string }[]; promoType: string | null; promoPrice: number | null;
  file: { id: string; title: string; documentNumber: string | null; deleted: boolean } | null;
};

const rupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);
const fmtDateTime = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const th = "text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50";
const candLabel = (c: Candidate) => `${c.itemCode} — ${c.itemName} (${c.company ?? "-"}${c.business ? ` · ${c.business}` : ""})${c.status !== "ACTIVE" ? " · DISCONTINUED" : ""}`;

export default function EDocItemCheckPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"discontinued" | "unmapped" | "history">("discontinued");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  // Discontinued
  const [discontinued, setDiscontinued] = useState<CheckRow[]>([]);
  const [partial, setPartial] = useState<CheckRow[]>([]);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadCheck = useCallback(async () => {
    setLoadingCheck(true);
    try {
      const res = await fetch("/api/edoc/im-product/check");
      if (res.status === 403) { setForbidden(true); return; }
      const json = await res.json();
      setSummary(json.summary); setDiscontinued(json.discontinued ?? []); setPartial(json.partial ?? []);
      setPicked(new Set());
    } finally { setLoadingCheck(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void loadCheck(), 0); return () => clearTimeout(t); }, [loadCheck]);

  const removeSelected = async () => {
    setRemoving(true);
    try {
      const res = await fetch("/api/edoc/im-product/removal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: [...picked] }) });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal mengeluarkan item"); return; }
      showToast("success", `${json.removed} item dikeluarkan — bisa dikembalikan dari tab Riwayat`);
      setConfirmRemove(false);
      await loadCheck();
    } finally { setRemoving(false); }
  };

  // Belum ber-SKU
  const [unmapped, setUnmapped] = useState<{ rows: UnmappedRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [uq, setUq] = useState("");
  const [upage, setUpage] = useState(1);
  const [loadingUnmapped, setLoadingUnmapped] = useState(false);
  const [choice, setChoice] = useState<Record<string, Candidate>>({});
  const [savingMap, setSavingMap] = useState(false);
  const [searchFor, setSearchFor] = useState<UnmappedRow | null>(null);

  const loadUnmapped = useCallback(async () => {
    setLoadingUnmapped(true);
    try {
      const p = new URLSearchParams({ page: String(upage) });
      if (uq.trim()) p.set("q", uq.trim());
      const res = await fetch(`/api/edoc/im-product/unmapped?${p}`);
      if (res.ok) setUnmapped(await res.json());
    } finally { setLoadingUnmapped(false); }
  }, [uq, upage]);
  useEffect(() => {
    if (tab !== "unmapped") return;
    const t = setTimeout(() => void loadUnmapped(), 300);
    return () => clearTimeout(t);
  }, [tab, loadUnmapped]);

  const applyAutoPicks = () => {
    if (!unmapped) return;
    setChoice((c) => {
      const next = { ...c };
      for (const r of unmapped.rows) {
        const s = r.autoPick && r.suggestions.find((x) => x.itemCode === r.autoPick);
        if (s && !next[r.id]) next[r.id] = s;
      }
      return next;
    });
  };
  const autoPickable = unmapped?.rows.filter((r) => r.autoPick && !choice[r.id]).length ?? 0;
  const chosenIds = Object.keys(choice);

  const saveMappings = async () => {
    setSavingMap(true);
    try {
      const res = await fetch("/api/edoc/im-product/map-sku", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: chosenIds.map((productId) => ({ productId, itemCode: choice[productId].itemCode })) }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal menyimpan pemetaan"); return; }
      showToast("success", `${json.mapped} item dipetakan ke SKU`);
      setChoice({});
      await Promise.all([loadUnmapped(), loadCheck()]);
    } finally { setSavingMap(false); }
  };

  // Riwayat
  const [history, setHistory] = useState<{ data: Removal[]; total: number; page: number; pageSize: number } | null>(null);
  const [hpage, setHpage] = useState(1);
  const [restoring, setRestoring] = useState<string | null>(null);
  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/edoc/im-product/removal?page=${hpage}`);
    if (res.ok) setHistory(await res.json());
  }, [hpage]);
  useEffect(() => {
    if (tab !== "history") return;
    const t = setTimeout(() => void loadHistory(), 0);
    return () => clearTimeout(t);
  }, [tab, loadHistory]);

  const restore = async (r: Removal) => {
    if (!window.confirm(`Kembalikan "${r.itemName}" ke ${r.file?.documentNumber ?? r.file?.title ?? "IM asalnya"}?`)) return;
    setRestoring(r.id);
    try {
      const res = await fetch(`/api/edoc/im-product/removal/${r.id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal mengembalikan item"); return; }
      showToast("success", `"${r.itemName}" dikembalikan`);
      await Promise.all([loadHistory(), loadCheck()]);
    } finally { setRestoring(null); }
  };

  if (forbidden) {
    return <div className="p-10 text-center text-slate-500">Halaman ini khusus superadmin & Document Approver.</div>;
  }

  const imCell = (f: { id: string; title: string; documentNumber: string | null } | null) => f
    ? <button onClick={() => router.push(`/apps/${appSlug}/edoc-file/${f.id}?fromItemBrowser=1`)} className="text-amber-700 hover:underline text-left">{f.documentNumber ?? f.title}</button>
    : <span className="text-slate-400">-</span>;
  const skuList = (skus: SkuInfo[]) => (
    <div className="space-y-0.5">
      {skus.map((s) => (
        <p key={s.itemCode} className="whitespace-nowrap">
          <span className="font-mono text-slate-700">{s.itemCode}</span>
          <span className="text-slate-400"> · {s.company}</span>
          {s.status === "DISCONTINUED" && <span className="ml-1 text-red-600">Discontinued</span>}
          {s.status === null && <span className="ml-1 text-slate-400">tidak di Master Item</span>}
        </p>
      ))}
    </div>
  );

  const TABS = [
    { key: "discontinued" as const, label: "Discontinued", count: summary?.discontinued },
    { key: "unmapped" as const, label: "Belum ber-SKU", count: summary?.unmapped },
    { key: "history" as const, label: "Riwayat dikeluarkan", count: summary?.removed },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/apps/${appSlug}/edoc-items`)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800">Cek Item vs Master Item</h1>
          <p className="text-xs text-slate-400">Item di IM aktif (Release, belum berakhir) dibandingkan dengan status SKU di Master Item</p>
        </div>
      </div>

      {toast && <Alert variant={toast.variant} message={toast.message} />}

      {summary && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <span><b>{summary.total}</b> item di IM aktif</span>
          <span className="text-emerald-700">{summary.active} SKU aktif</span>
          <span className="text-red-700">{summary.discontinued} discontinued</span>
          {summary.partial > 0 && <span className="text-amber-700">{summary.partial} sebagian discontinued</span>}
          <span className="text-slate-500">{summary.unmapped} belum ber-SKU</span>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? "border-amber-500 text-slate-800 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}{t.count != null && <span className="ml-1.5 text-xs text-slate-400">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "discontinued" && (
        loadingCheck ? <Loading /> : (
          <div className="space-y-4">
            {discontinued.length === 0 ? (
              <Empty text="Tidak ada item di IM aktif yang semua SKU-nya Discontinued." />
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-slate-500 flex-1 min-w-60">
                    Rekomendasi: keluarkan item berikut dari IM-nya karena semua SKU-nya sudah Discontinued di ERP.
                    Item yang dikeluarkan masuk <b>Riwayat</b> dan bisa dikembalikan.
                  </p>
                  <Button onClick={() => setConfirmRemove(true)} disabled={picked.size === 0} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Keluarkan {picked.size} item
                  </Button>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200">
                        <th className={th}>
                          <input type="checkbox" className="rounded" checked={picked.size === discontinued.length}
                            onChange={(e) => setPicked(e.target.checked ? new Set(discontinued.map((r) => r.id)) : new Set())} />
                        </th>
                        {["Item", "SKU", "Promo", "Dokumen IM"].map((h) => <th key={h} className={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {discontinued.map((r) => (
                        <tr key={r.id} className="align-top">
                          <td className="px-3 py-2.5">
                            <input type="checkbox" className="rounded" checked={picked.has(r.id)}
                              onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-800">{r.itemName}</td>
                          <td className="px-3 py-2.5">{skuList(r.skus)}</td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{[r.promoType, r.promoPrice != null ? rupiah(r.promoPrice) : null].filter(Boolean).join(" · ") || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{imCell(r.file)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {partial.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sebagian SKU discontinued (informasi)</p>
                <p className="text-xs text-slate-400 mb-2">Item ini masih punya SKU aktif di company lain, jadi tidak direkomendasikan dikeluarkan.</p>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                  {partial.map((r) => (
                    <div key={r.id} className="flex gap-4 px-3 py-2.5 items-start">
                      <p className="text-sm text-slate-800 flex-1">{r.itemName}</p>
                      {skuList(r.skus)}
                      <div className="w-40 shrink-0">{imCell(r.file)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {tab === "unmapped" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Cari nama item atau No. IM..."
                value={uq} onChange={(e) => { setUq(e.target.value); setUpage(1); }} />
            </div>
            <Button variant="outline" onClick={applyAutoPicks} disabled={autoPickable === 0} className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Pakai saran otomatis ({autoPickable})
            </Button>
            <Button onClick={() => void saveMappings()} disabled={savingMap || chosenIds.length === 0} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
              {savingMap && <Loader2 className="w-4 h-4 animate-spin" />} Simpan pemetaan ({chosenIds.length})
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            Saran berdasarkan kemiripan nama — <b>periksa dulu</b> sebelum disimpan. &ldquo;Saran otomatis&rdquo; hanya untuk nama yang persis sama dengan
            satu SKU aktif sesuai Business Unit IM. Saat disimpan, nama item disamakan dengan nama resmi Master Item.
          </p>
          {loadingUnmapped && !unmapped ? <Loading /> : !unmapped || unmapped.rows.length === 0 ? (
            <Empty text="Semua item di IM aktif sudah punya SKU." />
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200">{["Item", "Dokumen IM", "SKU Master Item"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {unmapped.rows.map((r) => {
                      const sel = choice[r.id];
                      const options = sel && !r.suggestions.some((s) => s.itemCode === sel.itemCode) ? [sel, ...r.suggestions] : r.suggestions;
                      return (
                        <tr key={r.id} className={`align-top ${sel ? "bg-emerald-50/40" : ""}`}>
                          <td className="px-3 py-2.5">
                            <p className="text-sm text-slate-800">{r.itemName}</p>
                            {r.excelSku && <p className="text-slate-400 font-mono">SKU lama: {r.excelSku}</p>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {imCell(r.file)}
                            <p className="text-slate-400">BU {r.file.businessUnitCodes.join(", ") || "-"}</p>
                          </td>
                          <td className="px-3 py-2.5 min-w-96">
                            <div className="flex items-center gap-2">
                              <select className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white max-w-xl"
                                value={sel?.itemCode ?? ""}
                                onChange={(e) => {
                                  const c = options.find((o) => o.itemCode === e.target.value);
                                  setChoice((x) => { const n = { ...x }; if (c) n[r.id] = c; else delete n[r.id]; return n; });
                                }}>
                                <option value="">{r.suggestions.length ? "— pilih SKU —" : "— tidak ada saran, cari manual —"}</option>
                                {options.map((c) => (
                                  <option key={c.itemCode} value={c.itemCode}>
                                    {"reason" in c && c.reason === "SIMILAR" ? "≈ " : ""}{candLabel(c)}{c.itemCode === r.autoPick ? " ★" : ""}
                                  </option>
                                ))}
                              </select>
                              <button onClick={() => setSearchFor(r)} className="text-blue-600 hover:underline whitespace-nowrap">Cari</button>
                            </div>
                            {sel && sel.itemName !== r.itemName && <p className="mt-1 text-blue-700">Nama akan menjadi: {sel.itemName}</p>}
                            {sel && sel.status !== "ACTIVE" && <p className="mt-1 text-red-600">SKU ini Discontinued — item akan masuk daftar Discontinued.</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{unmapped.total} item belum ber-SKU · ≈ = nama mirip · ★ = saran otomatis</span>
                <Pagination currentPage={unmapped.page} totalPages={Math.ceil(unmapped.total / unmapped.pageSize)} onPageChange={setUpage} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        !history ? <Loading /> : history.data.length === 0 ? <Empty text="Belum ada item yang dikeluarkan." /> : (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200">{["Item", "SKU", "Dokumen IM", "Dikeluarkan", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {history.data.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <p className="text-sm text-slate-800">{r.itemName}</p>
                        <p className="text-slate-400">{[r.promoType, r.promoPrice != null ? rupiah(r.promoPrice) : null].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">{r.skus.map((s) => s.itemCode).join(", ") || "-"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{imCell(r.file)}{r.file?.deleted && <p className="text-red-600">file dihapus</p>}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {fmtDateTime(r.removedAt)}<p className="text-slate-400">{r.removedBy ?? "-"} · {r.reason === "DISCONTINUED" ? "SKU Discontinued" : r.reason}</p>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.restoredAt
                          ? <span className="text-emerald-700">Dikembalikan<p className="text-slate-400">{fmtDateTime(r.restoredAt)} · {r.restoredBy ?? "-"}</p></span>
                          : <span className="text-slate-500">Dikeluarkan</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {!r.restoredAt && r.file && !r.file.deleted && (
                          <button onClick={() => void restore(r)} disabled={restoring === r.id} className="flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50 ml-auto">
                            {restoring === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Kembalikan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={history.page} totalPages={Math.ceil(history.total / history.pageSize)} onPageChange={setHpage} />
          </div>
        )
      )}

      <Modal open={confirmRemove} title="Keluarkan item discontinued?" onClose={() => { if (!removing) setConfirmRemove(false); }} boxClassName="max-w-lg">
        <p className="text-sm text-slate-600">
          <b>{picked.size} item</b> akan dihapus dari IM-nya masing-masing (tidak tampil lagi di Item Browser & halaman IM).
          Isinya disimpan di Riwayat dan bisa dikembalikan kapan saja.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => setConfirmRemove(false)} disabled={removing}>Batal</Button>
          <Button onClick={() => void removeSelected()} disabled={removing} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
            {removing && <Loader2 className="w-4 h-4 animate-spin" />} Keluarkan
          </Button>
        </div>
      </Modal>

      {searchFor && (
        <SkuSearchModal row={searchFor} onClose={() => setSearchFor(null)}
          onPick={(c) => { setChoice((x) => ({ ...x, [searchFor.id]: c })); setSearchFor(null); }} />
      )}
    </div>
  );
}

function SkuSearchModal({ row, onClose, onPick }: { row: UnmappedRow; onClose: () => void; onPick: (c: Candidate) => void }) {
  const [q, setQ] = useState(row.itemName);
  const [hits, setHits] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const json = await fetch(`/api/edoc/im-product/sku-search?q=${encodeURIComponent(term)}`).then((r) => r.json());
        if (!cancelled) setHits(json.data ?? []);
      } finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);
  return (
    <Modal open title={`Cari SKU — ${row.itemName}`} onClose={onClose} boxClassName="w-full max-w-3xl">
      <input autoFocus className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="Ketik kode SKU atau nama item (min. 2 huruf)"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[50vh] overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {loading && hits.length === 0 ? <Loading /> : q.trim().length >= 2 && hits.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Tidak ditemukan.</p>
        ) : hits.map((c) => (
          <button key={c.itemCode} onClick={() => onPick(c)} className="w-full text-left px-3 py-2 hover:bg-amber-50 text-xs flex items-center gap-3">
            <span className="font-mono text-slate-700 w-28 shrink-0">{c.itemCode}</span>
            <span className="flex-1 text-slate-800">{c.itemName}</span>
            <span className="text-slate-400 whitespace-nowrap">{c.company}{c.business ? ` · ${c.business}` : ""}</span>
            {c.status !== "ACTIVE" && <span className="text-red-600 whitespace-nowrap">Discontinued</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat...</div>;
}
function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">{text}</div>;
}
