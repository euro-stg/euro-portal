"use client";

import { Hash } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export type ImProductDetail = {
  id: string; itemName: string; sku: string | null; category: string | null; discountClass: string | null;
  normalPrice: number | null; promoType: string | null; promoDetail: string | null;
  promoPrice: number | null; discountPercent: number | null; qty: number | null;
  validity: string | null; eligibleClient: string | null; keyConditions: string | null;
};

const fmtRupiah = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("id-ID") : "-");

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{value || "-"}</p>
    </div>
  );
}

// Popup detail 1 item promo, full informasi tanpa terpotong (2026-09-25) — dipakai di 2
// tempat: tabel "Produk/Promo Terkait" di halaman detail file (edoc-file/[fileId]) dan
// tabel Item/Promo Browser (edoc-items). Field teks yang bisa panjang (Berlaku/validity,
// Ketentuan/keyConditions) SENGAJA tidak ditaruh di kolom tabel manapun — cuma muncul di
// sini, supaya tabelnya tetap ringkas dan tidak ada info yang terpotong/butuh tooltip.
export function ImProductDetailModal({
  product, onClose, fileInfo, onOpenFile,
}: {
  product: ImProductDetail;
  onClose: () => void;
  // Item Browser butuh info file induknya + tombol buka file; halaman detail file sendiri
  // tidak perlu (sudah di halaman file itu juga).
  fileInfo?: { title: string; documentNumber: string | null; startDate: string | null; endDate: string | null };
  onOpenFile?: () => void;
}) {
  return (
    <Modal open title={product.itemName} onClose={onClose} boxClassName="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU" value={product.sku} />
          <Field label="Category" value={product.category} />
          <Field label="Discount Class" value={product.discountClass} />
          <Field label="Promo Type" value={product.promoType} />
          <Field label="Normal Price" value={fmtRupiah(product.normalPrice)} />
          <Field label="Promo Price" value={fmtRupiah(product.promoPrice)} />
          <Field label="Diskon %" value={product.discountPercent != null ? `${product.discountPercent}%` : null} />
          <Field label="Qty" value={product.qty} />
        </div>
        <Field label="Promo Detail" value={product.promoDetail} />
        <Field label="Berlaku" value={product.validity} />
        <Field label="Eligible Client" value={product.eligibleClient} />
        <Field label="Ketentuan" value={product.keyConditions} />

        {fileInfo && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              <span className="font-medium text-amber-700">{fileInfo.documentNumber ?? fileInfo.title}</span>
              <span>· {fmtDate(fileInfo.startDate)} s/d {fmtDate(fileInfo.endDate)}</span>
            </div>
            {onOpenFile && <Button size="sm" onClick={onOpenFile} className="bg-amber-600 hover:bg-amber-700 text-white">Buka File IM</Button>}
          </div>
        )}
      </div>
    </Modal>
  );
}
