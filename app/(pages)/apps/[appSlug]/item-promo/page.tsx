"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, MapPin, Package, Info, RefreshCw, Search, Users, Wifi, WifiOff, X } from "lucide-react";

// Item / Promo Browser LIVE dari ERP (2026-11-17) — pilih item dari Master Item, promo aktifnya
// dibaca langsung dari ERP (tidak ada data tersimpan di portal). Lihat app/lib/im-erp-live.ts.

type Candidate = { itemCode: string; itemName: string; company: string | null; business: string | null; status: string; standardPrice: number | null };
type Promo = {
  key: string; source: "RULE" | "PRICE_LIST"; imLabel: string | null; file: { id: string; title: string; documentNumber: string | null } | null;
  title: string; mergedRules: number; promoType: string; discountPercent: number | null; promoPrice: number | null; normalPrice: number | null;
  validFrom: string | null; validUpto: string | null; priceList: string | null; clientTypes: string[]; territories: string[]; audience: string | null; minQty: number | null;
};
type ScopeInfo = { buCompanies: { bu: string; company: string | null }[]; superadmin: boolean; businessUnits: string[]; all: boolean; companies: string[]; groups: string[]; counts: { active: number; discontinued: number } };
type Result = { item: Candidate; promos: Promo[]; fetchedAt: string };

type ErpStatus = { state: "OK" | "ERROR" | "NOT_CONFIGURED"; message: string | null; latencyMs: number | null; checkedAt: string };

/** Ikon status koneksi ERP — cek saat dibuka, tiap 60 dtk, dan saat diklik. */
function ErpStatusBadge({ refreshKey }: { refreshKey: number }) {
  const [st, setSt] = useState<ErpStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async (force: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/edoc/item-browse?status=1${force ? "&force=1" : ""}`);
      setSt(res.ok ? await res.json() : { state: "ERROR", message: "Tidak dapat memeriksa status ERP", latencyMs: null, checkedAt: new Date().toISOString() });
    } catch { setSt({ state: "ERROR", message: "Koneksi ke portal terputus", latencyMs: null, checkedAt: new Date().toISOString() }); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check(refreshKey > 0);
    const t = setInterval(() => void check(false), 60_000);
    return () => clearInterval(t);
  }, [refreshKey]);
  const cfg = !st ? { dot: "bg-slate-300", text: "Memeriksa ERP…", cls: "border-slate-200 text-slate-500", Icon: Loader2 }
    : st.state === "OK" ? { dot: "bg-emerald-500", text: "ERP terhubung", cls: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: Wifi }
    : st.state === "NOT_CONFIGURED" ? { dot: "bg-amber-500", text: "ERP belum dikonfigurasi", cls: "border-amber-200 bg-amber-50 text-amber-700", Icon: WifiOff }
    : { dot: "bg-red-500", text: "ERP tidak terhubung", cls: "border-red-200 bg-red-50 text-red-700", Icon: WifiOff };
  const tip = st ? `${st.message ?? `Respons ${st.latencyMs} ms`} · dicek ${new Date(st.checkedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} — klik untuk cek ulang` : "Memeriksa koneksi ERP";
  return (
    <button onClick={() => void check(true)} title={tip} className={`ml-auto flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 shrink-0 transition-colors ${cfg.cls}`}>
      <cfg.Icon className={`w-3.5 h-3.5 ${busy || !st ? "animate-pulse" : ""}`} />
      {cfg.text}{st?.state === "OK" && st.latencyMs != null ? <span className="opacity-60"> · {st.latencyMs} ms</span> : null}
    </button>
  );
}

const rupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

/** "Gress Mall - SKIN+ DEI" → { Gress Mall: [SKIN+ DEI] } — nama klinik yang beda brand digabung per lokasi. */
function groupTerritories(list: string[]) {
  const m = new Map<string, string[]>();
  for (const t of list) {
    const i = t.lastIndexOf(" - ");
    const loc = i > 0 ? t.slice(0, i) : t, suffix = i > 0 ? t.slice(i + 3) : "";
    m.set(loc, [...(m.get(loc) ?? []), suffix].filter(Boolean));
  }
  return [...m.entries()].map(([loc, brands]) => ({ loc, brands }));
}

function Territories({ list }: { list: string[] }) {
  const [open, setOpen] = useState(false);
  const groups = groupTerritories(list);
  const shown = open ? groups : groups.slice(0, 6);
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Territory · {list.length} klinik{groups.length !== list.length ? ` di ${groups.length} lokasi` : ""}</p>
      <div className="flex flex-wrap gap-1">
        {shown.map((g) => (
          <span key={g.loc} className="text-xs px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            {g.loc}{g.brands.length ? <span className="text-slate-400"> ({g.brands.join(", ")})</span> : null}
          </span>
        ))}
      </div>
      {groups.length > 6 && (
        <button onClick={() => setOpen(!open)} className="text-xs text-blue-600 hover:underline mt-1.5">{open ? "Ringkas" : `Tampilkan semua (${groups.length} lokasi)`}</button>
      )}
    </div>
  );
}

function PromoCard({ p, onOpenFile }: { p: Promo; onOpenFile: (fileId: string) => void }) {
  const period = `${fmtDate(p.validFrom) ?? "…"} s/d ${fmtDate(p.validUpto) ?? "tetap"}`;
  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 ${p.source === "PRICE_LIST" ? "border-dashed border-slate-300" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{p.title}{p.mergedRules > 1 ? <span className="text-xs font-normal text-slate-400"> (+{p.mergedRules - 1} rule periode lain)</span> : null}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {p.imLabel ? <span className="font-medium">{p.imLabel}</span> : <span className="text-slate-400">Tanpa nomor IM</span>}
            {p.file ? (
              <button onClick={() => onOpenFile(p.file!.id)} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                <ExternalLink className="w-3 h-3" /> Buka file IM
              </button>
            ) : p.imLabel ? <span className="text-amber-600">IM tidak ditemukan di portal</span> : null}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium shrink-0">{p.promoType}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><p className="text-[11px] text-slate-400 uppercase tracking-wide">Harga Normal</p><p className="text-slate-700">{rupiah(p.normalPrice)}</p></div>
        <div><p className="text-[11px] text-slate-400 uppercase tracking-wide">Harga Promo</p><p className="font-semibold text-slate-800">{rupiah(p.promoPrice)}</p></div>
        <div><p className="text-[11px] text-slate-400 uppercase tracking-wide">Diskon</p><p className="text-slate-700">{p.discountPercent != null ? `${p.discountPercent}%` : "-"}</p></div>
        <div><p className="text-[11px] text-slate-400 uppercase tracking-wide">Berlaku</p><p className="text-slate-700">{period}</p></div>
      </div>

      <div className="space-y-2.5 pt-1">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Eligible Client (Client Type)</p>
          {p.clientTypes.length || p.audience ? (
            <div className="flex flex-wrap gap-1">
              {p.clientTypes.map((c) => <span key={c} className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{c}</span>)}
              {p.audience && <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{p.audience}</span>}
            </div>
          ) : <p className="text-xs text-slate-400">Tidak diisi di Price List ERP</p>}
        </div>
        {p.territories.length ? <Territories list={p.territories} /> : (
          <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Territory: tidak dibatasi / tidak diisi di rule ERP</p>
        )}
        {(p.minQty || p.priceList) && (
          <p className="text-xs text-slate-500">
            {p.minQty ? <>Minimal qty {p.minQty}{p.priceList ? " · " : ""}</> : null}
            {p.priceList ? <>Price List: {p.priceList}</> : null}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ItemPromoPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  // Daftar Master Item (cermin portal)
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [listLoading, setListLoading] = useState(true);
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Detail promo item terpilih (live ERP)
  const [item, setItem] = useState<Candidate | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusKey, setStatusKey] = useState(0); // naik tiap gagal ambil data → ikon status cek ulang

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setListLoading(true);
      try {
        const p = new URLSearchParams({ list: "1", page: String(page) });
        if (q.trim()) p.set("q", q.trim());
        const json = await fetch(`/api/edoc/item-browse?${p}`).then((r) => r.json());
        if (cancelled) return;
        setList(json.data ?? []); setTotal(json.total ?? 0); setPageSize(json.pageSize ?? 30); if (json.scope) setScope(json.scope);
      } finally { if (!cancelled) setListLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, page]);

  const load = async (c: Candidate, refresh = false) => {
    setItem(c); setError(null); setLoading(true); if (!refresh) setResult(null);
    try {
      const res = await fetch(`/api/edoc/item-browse?itemCode=${encodeURIComponent(c.itemCode)}${refresh ? "&refresh=1" : ""}`);
      const json = await res.json();
      if (!res.ok) { setError(json.message || "Gagal mengambil data ERP"); if (res.status === 502) setStatusKey((k) => k + 1); return; }
      setResult(json);
    } catch { setError("Koneksi terputus — coba lagi."); }
    finally { setLoading(false); }
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push(`/apps/${appSlug}`)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Package className="w-5 h-5 text-amber-600" /></div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800 truncate">Item / Promo Browser</h1>
          <p className="text-xs text-slate-400">Daftar item = Master Item portal. Klik item untuk melihat promo, harga, Client Type & Territory langsung dari ERP</p>
        </div>
        <ErpStatusBadge refreshKey={statusKey} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,400px)_1fr] gap-4 items-start">
        {/* Kiri: Master Item portal */}
        <div className="bg-white rounded-xl border border-slate-200 lg:sticky lg:top-16 flex flex-col lg:max-h-[calc(100vh-6rem)]">
          <div className="p-3 space-y-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className={`${inputCls} pl-9 pr-9`} placeholder="Cari nama atau kode item..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              {q && <button onClick={() => { setQ(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-400">{listLoading ? "Memuat…" : `${total.toLocaleString("id-ID")} item`}</p>
              <button onClick={() => setShowInfo(true)} className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline" title="Lihat pembatasan item yang tampil">
                <Info className="w-3.5 h-3.5" /> Info pembatasan
              </button>
            </div>
          </div>
          <div className="overflow-auto flex-1 min-h-[200px] max-h-[60vh] lg:max-h-none">
            {!listLoading && list.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Tidak ada item.</p>}
            {list.map((h) => (
              <button key={h.itemCode} onClick={() => load(h)} className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 transition-colors ${item?.itemCode === h.itemCode ? "bg-amber-50" : "hover:bg-slate-50"}`}>
                <p className="text-sm text-slate-800">{h.itemName}{h.status !== "ACTIVE" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">DISCONTINUED</span>}</p>
                <p className="text-xs text-slate-400">{h.itemCode} · {h.company ?? "-"}{h.business ? ` · ${h.business}` : ""}</p>
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-xs text-slate-500">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Sebelumnya</button>
              <span>{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Berikutnya</button>
            </div>
          )}
        </div>

        {/* Kanan: promo live dari ERP */}
        <div className="min-w-0">
          {!item && <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center text-sm text-slate-400">Pilih item di daftar untuk melihat promo yang sedang aktif di ERP.</div>}
          {loading && <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Mengambil data dari ERP…</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}

          {result && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{result.item.itemName}
                    {result.item.status !== "ACTIVE" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">DISCONTINUED</span>}
                  </p>
                  <p className="text-xs text-slate-400">{result.item.itemCode} · {result.item.company ?? "-"} · Harga standar {rupiah(result.item.standardPrice)}</p>
                </div>
                <button onClick={() => load(item!, true)} className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors" title="Ambil ulang dari ERP (abaikan cache 5 menit)">
                  <RefreshCw className="w-3.5 h-3.5" /> Muat ulang · data {new Date(result.fetchedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </button>
              </div>
              {result.promos.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-500">Tidak ada promo aktif untuk item ini di ERP</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{result.promos.length} promo aktif</p>
                  {result.promos.map((p) => <PromoCard key={p.key} p={p} onOpenFile={(id) => router.push(`/apps/${appSlug}/edoc-file/${id}`)} />)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <Modal open={showInfo} title="Pembatasan item yang tampil" onClose={() => setShowInfo(false)} boxClassName="max-w-xl">
        {scope ? (
          <div className="space-y-4 text-sm text-slate-600">
            <p>Daftar ini mencerminkan <b>Master Item portal</b>, dibatasi otomatis berdasarkan grup item dan business unit akun Anda.</p>
            <div>
              <p className="font-semibold text-slate-800 mb-1">1. Grup item yang ditampilkan</p>
              <div className="flex flex-wrap gap-1 mb-1.5">{scope.groups.map((g) => <span key={g} className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{g}</span>)}</div>
              <p className="text-xs text-slate-500">Treatment Product 01/02 dan item di grup &ldquo;Discontinued&rdquo; tidak ditampilkan. Item discontinued hanya muncul bila grupnya di Master Item masih salah satu grup di atas.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">2. Dibatasi berdasarkan business unit Anda</p>
              <p className="mb-2">Item yang tampil hanya milik company dari business unit (BU) akun Anda. Contoh pemetaannya:</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs mb-2">
                {scope.buCompanies.map((m) => {
                  const mine = scope.businessUnits.includes(m.bu);
                  return (
                    <div key={m.bu} className={`flex items-center justify-between gap-3 px-3 py-1.5 border-b border-slate-100 last:border-0 ${mine ? "bg-amber-50" : ""}`}>
                      <span className={`font-medium ${mine ? "text-amber-700" : "text-slate-700"}`}>BU {m.bu}{mine ? " (Anda)" : ""}</span>
                      <span className="text-slate-500 text-right">{m.company ? `hanya item company ${m.company}` : "semua company"}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                {scope.businessUnits.length ? <>BU Anda ditentukan dari prefix cabang akun (mapping di Pengaturan edoc): <b>{scope.businessUnits.join(", ")}</b>. </>
                  : scope.all ? null : <>BU akun Anda tidak dikenali dari cabangnya, sehingga tidak ada item yang tampil. </>}
                SKIN+ dan SLIM+ sama-sama memakai company SKIN+ DEI.
              </p>
              <p className="mt-1.5">Company yang terlihat oleh Anda: {scope.companies.length ? <b>{scope.companies.join(", ")}</b> : <b>tidak ada</b>}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">3. Isi cakupan Anda</p>
              <p>{(scope.counts.active + scope.counts.discontinued).toLocaleString("id-ID")} item — {scope.counts.active.toLocaleString("id-ID")} aktif, {scope.counts.discontinued.toLocaleString("id-ID")} discontinued.</p>
            </div>
            <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">Pembatasan juga dicek di server: item di luar cakupan tidak bisa dibuka walau kodenya diketahui. Promo selalu dibaca langsung dari ERP.</p>
          </div>
        ) : <p className="text-sm text-slate-400">Memuat…</p>}
      </Modal>
    </div>
  );
}
