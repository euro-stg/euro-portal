"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload, Download, Package, Search, X, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Table } from "@/components/ui/table";

type Product = {
  id: string; itemName: string; sku: string | null; category: string | null; discountClass: string | null;
  normalPrice: number | null; promoType: string | null; promoDetail: string | null;
  promoPrice: number | null; discountPercent: number | null; qty: number | null;
  validity: string | null; eligibleClient: string | null; keyConditions: string | null;
};

const fmtRupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

export function ImProductSection({ fileId, uploaderId, bulkImported, businessUnitCodes }: { fileId: string; uploaderId: string; bulkImported?: boolean; businessUnitCodes?: string[] }) {
  const [me, setMe] = useState<{ userId: string; isSuperadmin: boolean; isFolderCreator: boolean } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPricelistFor, setDownloadingPricelistFor] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, prodRes] = await Promise.all([
        fetch("/api/edoc/me").then((r) => r.json()),
        fetch(`/api/edoc/im-product?fileId=${fileId}`).then((r) => r.json()),
      ]);
      setMe(meRes);
      setProducts(prodRes.data ?? []);
    } finally { setLoading(false); }
  }, [fileId]);

  useEffect(() => { void load(); }, [load]);

  // Search item DALAM file ini saja (2026-09-25) — daftar sudah termuat semua sekaligus
  // (biasanya jumlahnya wajar per file, beda dari Item Browser lintas semua file yang
  // butuh pagination), jadi cukup filter client-side, tidak perlu request baru ke server.
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const s = search.trim().toLowerCase();
    return products.filter((p) => p.itemName.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
  }, [products, search]);

  // Folder Creator manapun boleh ikut lengkapi item promo untuk file hasil Bulk Import
  // (2026-09-21) — bukan cuma uploader aslinya, sama seperti canEditFileMetadata di server.
  const canManage = !!me && (me.isSuperadmin || me.userId === uploaderId || (me.isFolderCreator && !!bulkImported));

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("fileId", fileId);
      fd.append("file", file);
      const res = await fetch("/api/edoc/im-product/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal import"); return; }
      // Konfirmasi konkret item apa yang sudah tersimpan (nama + SKU), bukan cuma jumlah —
      // biar bisa langsung dicek apakah item yang dimaksud memang masuk.
      const savedItems: { itemName: string; sku: string | null }[] = json.data ?? [];
      const preview = savedItems.slice(0, 3).map((p) => (p.sku ? `${p.sku} - ${p.itemName}` : p.itemName)).join(", ");
      const more = savedItems.length > 3 ? ` (+${savedItems.length - 3} lainnya)` : "";
      const warnMsg = json.warnings?.length ? ` — ${json.warnings.length} peringatan: ${json.warnings[0]}` : "";
      showToast(json.warnings?.length ? "error" : "success", `${json.imported} item tersimpan: ${preview}${more}${warnMsg}`);
      void load();
    } finally { setImporting(false); }
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/edoc/im-product/template");
      if (!res.ok) { showToast("error", "Gagal download template"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template Promo per Item.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  // "Download Pricelist" per Business Unit file ini (2026-09-29) — murni acuan manual untuk
  // bantu isi template item, bukan divalidasi/dicocokkan otomatis. Satu tombol per BU kalau
  // file-nya di-tag ke lebih dari satu Business Unit.
  const handleDownloadPricelist = async (code: string) => {
    setDownloadingPricelistFor(code);
    try {
      const res = await fetch(`/api/edoc/im-pricelist/download?businessUnitCode=${encodeURIComponent(code)}`);
      if (!res.ok) { const json = await res.json().catch(() => null); showToast("error", json?.message || "Gagal download pricelist"); return; }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] || `Master Pricelist ${code}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloadingPricelistFor(null); }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
      {toast && <div className="mb-3"><Alert variant={toast.variant} message={toast.message} /></div>}

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600" /> Produk / Promo Terkait
        </p>
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" disabled={downloading} onClick={handleDownloadTemplate} className="flex items-center gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Template
            </Button>
            {(businessUnitCodes ?? []).map((code) => (
              <Button
                key={code} variant="outline" size="sm" disabled={downloadingPricelistFor === code}
                onClick={() => handleDownloadPricelist(code)} className="flex items-center gap-2"
                title={`Download referensi Master Pricelist Business Unit ${code}`}
              >
                {downloadingPricelistFor === code ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Pricelist {code}
              </Button>
            ))}
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }} />
            <Button variant="outline" size="sm" disabled={importing} onClick={() => importRef.current?.click()} className="flex items-center gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import Excel
            </Button>
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada produk/promo yang di-attach ke file ini. Download template untuk mulai isi datanya.</p>
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className={`${inputCls} pl-9 pr-9`} placeholder="Cari item/SKU dalam file ini..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Tidak ada item yang cocok dengan &ldquo;{search}&rdquo;.</p>
          ) : (
            // Semua kolom tampil langsung di tabel (2026-09-25 — awalnya sempat dibuat
            // popup detail per item, tapi user minta semua info langsung terlihat di list,
            // bukan disembunyikan di balik klik). Teks panjang (Berlaku/Ketentuan/dst)
            // di-wrap rapi (bukan dipotong+tooltip) dengan max-width per kolom; Table
            // sendiri sudah scrollable horizontal (lihat components/ui/table.tsx) kalau
            // total lebar kolom melebihi lebar layar.
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {["Item", "Category", "Discount Class", "Promo Type", "Normal", "Promo", "Diskon %", "Qty", "Berlaku", "Eligible Client", "Ketentuan"].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-3 py-2.5 min-w-32">
                        <p className="text-sm font-medium text-slate-800">{p.itemName}</p>
                        {p.sku && <p className="text-xs font-mono text-slate-400">SKU: {p.sku}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{p.category ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{p.discountClass ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 max-w-48">
                        {p.promoType ? <><b>{p.promoType}</b>{p.promoDetail ? ` — ${p.promoDetail}` : ""}</> : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtRupiah(p.normalPrice)}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {p.promoPrice != null ? <span className="text-emerald-600 font-medium">{fmtRupiah(p.promoPrice)}</span> : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {p.discountPercent != null ? <span className="text-emerald-600 font-medium">{p.discountPercent}%</span> : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{p.qty ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-40">{p.validity ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-36">{p.eligibleClient ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-40">{p.keyConditions ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
