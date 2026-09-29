"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, X, Loader2, Package, ChevronRight } from "lucide-react";

type Product = {
  id: string; itemName: string; sku: string | null; category: string | null; discountClass: string | null;
  normalPrice: number | null; promoType: string | null; promoDetail: string | null;
  promoPrice: number | null; discountPercent: number | null; qty: number | null;
  imSubject: string | null; validity: string | null; eligibleClient: string | null; keyConditions: string | null;
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
  const [imNumber, setImNumber] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
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
    if (imNumber.trim()) p.set("imNumber", imNumber.trim());
    if (validFrom) p.set("validFrom", validFrom);
    if (validTo) p.set("validTo", validTo);
    if (withCursor) p.set("cursor", withCursor);
    return p.toString();
  }, [q, category, discountClass, promoType, eligibleClient, imNumber, validFrom, validTo]);

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
        setTotalCount(typeof json.totalCount === "number" ? json.totalCount : null);
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

  // Sentinel infinite-scroll (2026-09-29): root diarahkan ke kotak tabel yang sekarang
  // scroll sendiri (lihat scrollContainerRef di bawah), bukan lagi viewport halaman — kalau
  // tidak, sentinel yang ada DI DALAM kotak scroll tidak akan pernah terdeteksi "mendekati
  // viewport" karena viewport bukan lagi konteks scroll yang relevan untuknya.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMore(); }, { root: scrollContainerRef.current, rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // Tinggi kotak tabel dibatasi (dihitung dari sisa layar setelah navbar + kotak judul/
  // filter di atasnya, yang tingginya sendiri berubah-ubah tergantung wrap di layar sempit,
  // makanya diukur via ref bukan di-hardcode) supaya kotak tabel scroll SENDIRI secara
  // internal dengan header yang sungguhan menempel (sticky top-0 di dalam kotaknya sendiri).
  // Dicoba dulu pakai sticky thead langsung di halaman (tanpa kotak scroll terbatas) tapi
  // itu bug — tabrakan/overlap dengan isi tabel, karena wrapper overflow-x-auto (buat
  // scroll horizontal) ikut jadi "parent scroll" untuk sticky tanpa punya batas tinggi
  // sendiri, jadi posisi sticky-nya salah hitung. Kotak dengan tinggi terbatas + satu
  // wrapper overflow-auto (bukan dua wrapper bersarang) adalah pola yang teruji beres.
  const NAVBAR_H = 56;
  const filterBoxRef = useRef<HTMLDivElement | null>(null);
  const [spaceAboveTable, setSpaceAboveTable] = useState(NAVBAR_H);
  useEffect(() => {
    const el = filterBoxRef.current;
    if (!el) return;
    const update = () => setSpaceAboveTable(NAVBAR_H + el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  return (
    <div>
      {/* Sticky header (2026-09-25) — sama seperti daftar file utama: judul + filter tetap
          kelihatan selagi daftar item di bawahnya di-scroll. top-14 = tinggi navbar. */}
      <div ref={filterBoxRef} className="sticky top-14 z-20 bg-white pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1">
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
            placeholder="Cari nama item, SKU, Eligible Client, atau diskon % (mis. 20%)..."
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
          <input className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white w-36" placeholder="IM Number" value={imNumber} onChange={(e) => setImNumber(e.target.value)} />
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            Masih berlaku:
            <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            s/d
            <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </span>
        </div>
        <p className="text-xs text-slate-400">Filter tanggal berdasarkan Start/End Date file IM-nya (bukan teks &ldquo;Berlaku&rdquo; per item).</p>
      </div>
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
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {totalCount !== null ? `${totalCount} Item` : "Item"}
          </p>
          {/* Satu wrapper overflow-auto (horizontal DAN vertical sekaligus) supaya thead
              sticky top-0 di dalamnya beres tanpa ambigu — lihat catatan di atas kenapa
              nested-wrapper (Table biasa) tidak dipakai di sini. */}
          <div
            ref={scrollContainerRef}
            className="bg-white rounded-xl border border-slate-200 overflow-auto"
            style={{ maxHeight: `calc(100vh - ${spaceAboveTable + 64}px)` }}
          >
            {/* Semua kolom tampil langsung (2026-09-25 — sempat dibuat popup detail per item,
                tapi user minta semua info langsung terlihat di list). Klik baris di mana
                saja tetap langsung buka file IM-nya (tidak ada lagi aksi yang bersaing). */}
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["Item", "Subject", "Category", "Discount Class", "Promo Type", "Qty", "Normal", "Promo", "Diskon %", "Berlaku", "Eligible Client", "Ketentuan", "Dokumen IM", ""].map((h, i) => (
                    <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/apps/${appSlug}/edoc-file/${p.file.id}`)}
                    className="hover:bg-amber-50/50 transition-colors cursor-pointer group align-top"
                  >
                    <td className="px-3 py-3 min-w-32">
                      <p className="text-sm font-medium text-slate-800">{p.itemName}</p>
                      {p.sku && <p className="text-xs font-mono text-slate-400">SKU: {p.sku}</p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-48">{p.imSubject ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{p.category ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{p.discountClass ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-600 max-w-48">
                      {p.promoType ? <><b>{p.promoType}</b>{p.promoDetail ? ` — ${p.promoDetail}` : ""}</> : "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{p.qty ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtRupiah(p.normalPrice)}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {p.promoPrice != null ? <span className="text-emerald-600 font-medium">{fmtRupiah(p.promoPrice)}</span> : "-"}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {p.discountPercent != null ? <span className="text-emerald-600 font-medium">{p.discountPercent}%</span> : "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-40">{p.validity ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-36">{p.eligibleClient ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-40">{p.keyConditions ?? "-"}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <p className="font-medium text-amber-700">{p.file.documentNumber ?? p.file.title}</p>
                      <p className="text-slate-400">{fmtDate(p.file.startDate)} s/d {fmtDate(p.file.endDate)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4 text-slate-400 text-sm gap-2 h-10 border-t border-slate-100">
                {loadingMore && <><Loader2 className="w-4 h-4 animate-spin" /> Memuat lagi...</>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
