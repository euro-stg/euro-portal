"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Product = {
  id: string; itemName: string; sku: string | null; category: string | null; discountClass: string | null;
  normalPrice: number | null; promoType: string | null; promoDetail: string | null;
  promoPrice: number | null; discountPercent: number | null; qty: number | null;
  validity: string | null; eligibleClient: string | null; keyConditions: string | null;
};

const fmtRupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);

export function ImProductSection({ fileId, uploaderId, bulkImported }: { fileId: string; uploaderId: string; bulkImported?: boolean }) {
  const [me, setMe] = useState<{ userId: string; isSuperadmin: boolean; isFolderCreator: boolean } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
      {toast && <div className="mb-3"><Alert variant={toast.variant} message={toast.message} /></div>}

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600" /> Produk / Promo Terkait
        </p>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={downloading} onClick={handleDownloadTemplate} className="flex items-center gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Template
            </Button>
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
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                <p className="text-sm font-medium text-slate-800">
                  {p.itemName}
                  {p.sku && <span className="ml-2 text-xs font-mono text-slate-400">SKU: {p.sku}</span>}
                </p>
                <div className="flex items-center gap-1.5 text-xs">
                  {p.category && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.category}</span>}
                  {p.discountClass && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{p.discountClass}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap mb-1">
                <span>Normal: {fmtRupiah(p.normalPrice)}</span>
                {p.promoPrice != null && <span className="text-emerald-600 font-medium">Promo: {fmtRupiah(p.promoPrice)}</span>}
                {p.discountPercent != null && <span className="text-emerald-600 font-medium">Diskon {p.discountPercent}%</span>}
                {p.qty != null && <span>Qty: {p.qty}</span>}
              </div>
              {p.promoType && <p className="text-xs text-slate-600"><b>{p.promoType}</b>{p.promoDetail ? ` — ${p.promoDetail}` : ""}</p>}
              {p.validity && <p className="text-xs text-slate-400 mt-1">Berlaku: {p.validity}</p>}
              {p.eligibleClient && <p className="text-xs text-slate-400">Client: {p.eligibleClient}</p>}
              {p.keyConditions && <p className="text-xs text-slate-400">Ketentuan: {p.keyConditions}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
