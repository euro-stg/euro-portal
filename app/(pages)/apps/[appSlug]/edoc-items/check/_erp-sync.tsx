"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tab "Sync dari ERP" (2026-11-03, Tahap 4) — pilih 1 item Master Item → usulan baris promo
// per IM portal dari Pricing Rule ERP → review/edit → simpan. Lihat app/lib/im-erp-sync.ts.
// Per usulan user memilih: Tambah baris baru / Perbarui baris lama ber-SKU sama / Lewati.

type Candidate = { itemCode: string; itemName: string; company: string | null; business: string | null; status: string };
type Product = {
  itemName: string; sku: string | null; normalPrice: number | null; promoType: string | null; promoDetail: string | null;
  promoPrice: number | null; discountPercent: number | null; validity: string | null; eligibleClient: string | null; keyConditions: string | null;
  [k: string]: unknown;
};
type Proposal = { key: string; source: "RULE" | "PRICE_LIST"; defaultInclude: boolean; product: Product; info: { rules: string[]; priceList: string | null; baseRate: number | null } };
type Existing = { id: string; itemName: string; promoType: string | null; promoPrice: number | null; discountPercent: number | null; validity: string | null; eligibleClient: string | null };
type Group = { file: { id: string; title: string; documentNumber: string | null; businessUnitCodes: string[]; endDate: string | null }; matchNote: string | null; erpNames: string[]; existing: Existing[]; proposals: Proposal[] };
type SyncResult = {
  item: { itemCode: string; itemName: string; company: string | null; business: string | null; standardPrice: number | null };
  groups: Group[]; unmatched: { key: string; names: string[]; validFrom: string | null; validUpto: string | null }[];
};
type Choice = { action: "SKIP" | "ADD" | "UPDATE"; productId?: string; product: Product };

const rupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "…");
const inp = "w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white";

export function ErpSyncTab({ onToast, onSaved }: { onToast: (v: "success" | "error", m: string) => void; onSaved: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [item, setItem] = useState<Candidate | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [saving, setSaving] = useState(false);
  const [showAllUnmatched, setShowAllUnmatched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (item || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const json = await fetch(`/api/edoc/im-product/sku-search?q=${encodeURIComponent(term)}`).then((r) => r.json());
        if (!cancelled) setHits(json.data ?? []);
      } finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, item]);

  const load = async (c: Candidate) => {
    setItem(c); setHits([]); setResult(null); setChoices({}); setShowAllUnmatched(false); setLoading(true);
    try {
      const res = await fetch(`/api/edoc/im-product/erp-sync?itemCode=${encodeURIComponent(c.itemCode)}`);
      const json = await res.json();
      if (!res.ok) { onToast("error", json.message || "Gagal mengambil data ERP"); return; }
      setResult(json);
      // Default: usulan dari Pricing Rule dicentang — perbarui baris lama ber-SKU sama kalau ada
      // (satu baris lama untuk satu usulan), selebihnya tambah baru. Usulan Price List: lewati.
      const init: Record<string, Choice> = {};
      for (const g of json.groups as Group[]) {
        const free = [...g.existing];
        for (const p of g.proposals) {
          const k = `${g.file.id}|${p.key}`;
          if (!p.defaultInclude) { init[k] = { action: "SKIP", product: p.product }; continue; }
          const ex = free.shift();
          init[k] = ex ? { action: "UPDATE", productId: ex.id, product: p.product } : { action: "ADD", product: p.product };
        }
      }
      setChoices(init);
    } catch {
      onToast("error", "Koneksi terputus — coba lagi.");
    } finally { setLoading(false); }
  };

  const reset = () => { setItem(null); setResult(null); setChoices({}); setQ(""); };
  const setField = (k: string, field: keyof Product, value: string) => setChoices((c) => {
    const num = ["normalPrice", "promoPrice", "discountPercent"].includes(field as string);
    const v = value.trim() === "" ? null : num ? Number(value) : value;
    return { ...c, [k]: { ...c[k], product: { ...c[k].product, [field]: num && Number.isNaN(v) ? c[k].product[field] : v } } };
  });

  const active = Object.entries(choices).filter(([, c]) => c.action !== "SKIP");
  const nAdd = active.filter(([, c]) => c.action === "ADD").length;
  const nUpd = active.filter(([, c]) => c.action === "UPDATE").length;
  const dupUpdate = (() => {
    const ids = active.filter(([, c]) => c.action === "UPDATE").map(([, c]) => c.productId);
    return new Set(ids).size !== ids.length;
  })();

  const save = async () => {
    if (!result || active.length === 0) return;
    if (!window.confirm(`Simpan ${nAdd} baris baru dan perbarui ${nUpd} baris untuk ${result.item.itemCode}?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/edoc/im-product/erp-sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCode: result.item.itemCode,
          entries: active.map(([k, c]) => ({ fileId: k.split("|")[0], action: c.action, productId: c.productId, product: c.product })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { onToast("error", json.message || "Gagal menyimpan"); return; }
      onToast("success", `${json.added} baris ditambahkan, ${json.updated} baris diperbarui`);
      onSaved();
      if (item) await load(item);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Pilih satu item dari Master Item — portal mencari promo yang memuat item itu di ERP (Pricing Rule bernomor IM) lalu
        mengusulkan baris untuk IM yang cocok di portal. Periksa & edit dulu sebelum disimpan.
      </p>

      {item ? (
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{item.itemName}</p>
            <p className="text-xs text-slate-500"><span className="font-mono">{item.itemCode}</span> · {item.company}{item.business ? ` · ${item.business}` : ""}</p>
          </div>
          <button onClick={reset} className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Ganti item</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Cari item Master Item (kode SKU atau nama, min. 2 huruf)..."
            value={q} onChange={(e) => setQ(e.target.value)} />
          {(hits.length > 0 || searching) && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-auto divide-y divide-slate-100">
              {searching && hits.length === 0 ? <p className="text-xs text-slate-400 p-3">Mencari...</p> : hits.map((c) => (
                <button key={c.itemCode} disabled={c.status !== "ACTIVE"} onClick={() => void load(c)}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-3 hover:bg-amber-50 disabled:opacity-50 disabled:hover:bg-white">
                  <span className="font-mono text-slate-700 w-28 shrink-0">{c.itemCode}</span>
                  <span className="flex-1 text-slate-800">{c.itemName}</span>
                  <span className="text-slate-400 whitespace-nowrap">{c.company}{c.business ? ` · ${c.business}` : ""}</span>
                  {c.status !== "ACTIVE" && <span className="text-red-600">Discontinued</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Mengambil promo dari ERP...</div>}

      {result && (
        <>
          {result.unmatched.length > 0 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {result.unmatched.length} IM di ERP memuat item ini tapi tidak ditemukan di IM aktif portal:</p>
              {(showAllUnmatched ? result.unmatched : result.unmatched.slice(0, 5)).map((u) => (
                <p key={u.key}><b>{u.key}</b> ({fmtDate(u.validFrom)} s/d {fmtDate(u.validUpto)}) — {u.names.slice(0, 2).join("; ")}{u.names.length > 2 ? ` +${u.names.length - 2}` : ""}</p>
              ))}
              {result.unmatched.length > 5 && (
                <button onClick={() => setShowAllUnmatched((v) => !v)} className="underline font-medium">
                  {showAllUnmatched ? "Ringkas" : `Lihat semua (${result.unmatched.length})`}
                </button>
              )}
              <p className="text-amber-700">Mungkin IM-nya belum diupload, belum Release, sudah berakhir di portal, atau Document Number-nya berbeda.</p>
            </div>
          )}

          {result.groups.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
              Tidak ada promo aktif di ERP untuk item ini yang cocok dengan IM aktif di portal.
            </div>
          ) : result.groups.map((g) => (
            <div key={g.file.id} className="bg-white border border-slate-200 rounded-xl">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800"><span className="text-amber-700">{g.file.documentNumber}</span> — {g.file.title}</p>
                <p className="text-xs text-slate-400">
                  BU {g.file.businessUnitCodes.join(", ") || "-"} · {g.existing.length ? `${g.existing.length} baris ber-SKU ini sudah ada di IM` : "item ini belum ada di IM"}
                </p>
                {g.matchNote && <p className="text-xs text-amber-700 mt-0.5">⚠ {g.matchNote}</p>}
              </div>
              <div className="divide-y divide-slate-100">
                {g.proposals.map((p) => {
                  const k = `${g.file.id}|${p.key}`;
                  const c = choices[k];
                  if (!c) return null;
                  const sel = c.action === "UPDATE" ? `U:${c.productId}` : c.action;
                  return (
                    <div key={k} className={`px-4 py-3 space-y-2 ${c.action === "SKIP" ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-60 text-xs">
                          <p className="text-slate-700 font-medium">{p.source === "RULE" ? "Pricing Rule" : "Price List (tanpa Pricing Rule — cek dulu)"}</p>
                          <p className="text-slate-500">{p.info.rules.length ? p.info.rules.slice(0, 2).join("; ") + (p.info.rules.length > 2 ? ` +${p.info.rules.length - 2} rule` : "") : p.info.priceList}</p>
                          {p.info.baseRate != null && <p className="text-slate-400">Harga di Price List: {rupiah(p.info.baseRate)}</p>}
                        </div>
                        <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white max-w-80" value={sel}
                          onChange={(e) => {
                            const v = e.target.value;
                            setChoices((x) => ({ ...x, [k]: v.startsWith("U:") ? { ...x[k], action: "UPDATE", productId: v.slice(2) } : { ...x[k], action: v as "ADD" | "SKIP", productId: undefined } }));
                          }}>
                          <option value="ADD">Tambah baris baru</option>
                          {g.existing.map((ex) => (
                            <option key={ex.id} value={`U:${ex.id}`}>Perbarui: {ex.promoType ?? "-"} · {rupiah(ex.promoPrice)}{ex.validity ? ` · ${ex.validity}` : ""}</option>
                          ))}
                          <option value="SKIP">Lewati</option>
                        </select>
                      </div>
                      {c.action !== "SKIP" && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {([["promoType", "Jenis Promo"], ["discountPercent", "Diskon %"], ["promoPrice", "Harga Promo"], ["normalPrice", "Harga Normal"],
                            ["validity", "Berlaku"], ["eligibleClient", "Eligible Client"], ["keyConditions", "Ketentuan"], ["promoDetail", "Detail Promo"]] as [keyof Product, string][]).map(([f, label]) => (
                            <label key={f} className="text-[11px] text-slate-500 space-y-0.5">
                              <span>{label}</span>
                              <input className={inp} value={(c.product[f] as string | number | null) ?? ""} type={["discountPercent", "promoPrice", "normalPrice"].includes(f as string) ? "number" : "text"}
                                onChange={(e) => setField(k, f, e.target.value)} />
                            </label>
                          ))}
                        </div>
                      )}
                      {c.action === "UPDATE" && (() => {
                        const ex = g.existing.find((x) => x.id === c.productId);
                        return ex ? <p className="text-[11px] text-slate-400">Isi lama: {ex.promoType ?? "-"} · {rupiah(ex.promoPrice)}{ex.discountPercent != null ? ` · ${ex.discountPercent}%` : ""} · {ex.validity ?? "-"} · {ex.eligibleClient ?? "-"}</p> : null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {result.groups.length > 0 && (
            <div className="flex items-center gap-3 sticky bottom-0 bg-white/95 py-3 border-t border-slate-100">
              <Button onClick={() => void save()} disabled={saving || active.length === 0 || dupUpdate} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan ({nAdd} baru · {nUpd} diperbarui)
              </Button>
              {dupUpdate && <p className="text-xs text-red-600">Satu baris lama dipilih untuk diperbarui lebih dari sekali.</p>}
              <p className="text-xs text-slate-400">Nama item & SKU mengikuti Master Item. Baris lain di IM tidak disentuh.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
