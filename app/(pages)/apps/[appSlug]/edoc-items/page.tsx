"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, X, Loader2, Package, ChevronRight, Hash } from "lucide-react";

type Product = {
  id: string; itemName: string; sku: string | null; category: string | null; discountClass: string | null;
  normalPrice: number | null; promoType: string | null; promoDetail: string | null;
  promoPrice: number | null; discountPercent: number | null; qty: number | null;
  validity: string | null; eligibleClient: string | null; keyConditions: string | null;
  file: { id: string; title: string; documentNumber: string | null; startDate: string | null; endDate: string | null };
};

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const fmtRupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("id-ID") : "-");

// Item/Promo Browser (2026-09-25) — cari & lihat promo lintas SEMUA file Category IM
// sekaligus, tanpa perlu buka file satu-satu. Goals dari user: bisa cek "item A lagi ada
// promo apa" dan langsung lompat ke file IM-nya. Filter tanggal pakai startDate/endDate
// file (terstruktur), BUKAN teks validity per item (bebas format dari Excel, tidak bisa
// dipakai filter rentang tanggal akurat — dikonfirmasi ke user sebelum dibangun).
export default function EDocItemsPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [discountClass, setDiscountClass] = useState("");
  const [promoType, setPromoType] = useState("");
  const [eligibleClient, setEligibleClient] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const unmountedRef = useRef(false);
  useEffect(() => () => { unmountedRef.current = true; }, []);

  const buildParams = useCallback((withCursor?: string) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (category.trim()) p.set("category", category.trim());
    if (discountClass.trim()) p.set("discountClass", discountClass.trim());
    if (promoType.trim()) p.set("promoType", promoType.trim());
    if (eligibleClient.trim()) p.set("eligibleClient", eligibleClient.trim());
    if (validFrom) p.set("validFrom", validFrom);
    if (validTo) p.set("validTo", validTo);
    if (withCursor) p.set("cursor", withCursor);
    return p.toString();
  }, [q, category, discountClass, promoType, eligibleClient, validFrom, validTo]);

  // Debounce ringan — tiap kali filter berubah, mulai lagi dari halaman pertama.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/edoc/im-product?${buildParams()}`);
        const json = await res.json();
        setProducts(json.data ?? []);
        setHasMore(!!json.hasMore);
        setCursor(json.nextCursor ?? null);
      } catch { /* diamkan, list tetap seperti sebelumnya */ }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/edoc/im-product?${buildParams(cursor)}`);
      const json = await res.json();
      setProducts((prev) => [...prev, ...(json.data ?? [])]);
      setHasMore(!!json.hasMore);
      setCursor(json.nextCursor ?? null);
    } finally {
      loadingMoreRef.current = false;
      if (!unmountedRef.current) setLoadingMore(false);
    }
  }, [hasMore, cursor, buildParams]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMore(); }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/apps/${appSlug}`)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 truncate">Item / Promo Browser</h1>
            <p className="text-xs text-slate-400">Cari promo item lintas semua file IM, klik untuk buka file-nya</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputCls} pl-9 pr-9`}
            placeholder="Cari nama item, SKU, atau diskon % (mis. 20%)..."
            value={q} onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white w-32" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white w-32" placeholder="Discount Class" value={discountClass} onChange={(e) => setDiscountClass(e.target.value)} />
          <input className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white w-32" placeholder="Promo Type" value={promoType} onChange={(e) => setPromoType(e.target.value)} />
          <input className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white w-36" placeholder="Eligible Client" value={eligibleClient} onChange={(e) => setEligibleClient(e.target.value)} />
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            Masih berlaku:
            <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            s/d
            <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </span>
        </div>
        <p className="text-xs text-slate-400">Filter tanggal berdasarkan Start/End Date file IM-nya (bukan teks &ldquo;Berlaku&rdquo; per item).</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">Tidak ada promo ditemukan</p>
          <p className="text-slate-400 text-sm mt-1">Coba kata kunci atau filter lain.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/apps/${appSlug}/edoc-file/${p.file.id}`)}
              className="w-full bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all p-4 text-left group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-medium text-slate-800">{p.itemName}</p>
                    {p.sku && <span className="text-xs font-mono text-slate-400">SKU: {p.sku}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs flex-wrap mb-1.5">
                    {p.category && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.category}</span>}
                    {p.discountClass && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{p.discountClass}</span>}
                    {p.promoType && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{p.promoType}</span>}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                    <span>Normal: {fmtRupiah(p.normalPrice)}</span>
                    {p.promoPrice != null && <span className="text-emerald-600 font-medium">Promo: {fmtRupiah(p.promoPrice)}</span>}
                    {p.discountPercent != null && <span className="text-emerald-600 font-medium">Diskon {p.discountPercent}%</span>}
                  </div>
                  {p.eligibleClient && <p className="text-xs text-slate-400 mt-1">Client: {p.eligibleClient}</p>}
                  {p.validity && <p className="text-xs text-slate-400">Berlaku (teks Excel): {p.validity}</p>}
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 mt-2 pt-2 border-t border-slate-100">
                    <Hash className="w-3 h-3" />
                    <span className="font-medium">{p.file.documentNumber ?? p.file.title}</span>
                    <span className="text-slate-400">· {fmtDate(p.file.startDate)} s/d {fmtDate(p.file.endDate)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 shrink-0 transition-colors" />
              </div>
            </button>
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4 text-slate-400 text-sm gap-2 h-10">
              {loadingMore && <><Loader2 className="w-4 h-4 animate-spin" /> Memuat lagi...</>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
