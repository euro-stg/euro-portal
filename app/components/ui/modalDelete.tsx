"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function ModalDelete({ open, onClose, onConfirm, loading }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-base">Hapus Data</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Apakah Anda yakin?</p>
              <p className="text-sm text-slate-500 mt-0.5">Data yang dihapus tidak dapat dikembalikan.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" type="button" onClick={onClose}>Batal</Button>
            <Button variant="danger" type="button" onClick={onConfirm} disabled={loading}>
              {loading ? "Menghapus..." : "Hapus"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
