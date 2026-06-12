"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  boxClassName?: string;
};

export function Modal({ open, title, onClose, children, boxClassName = "" }: ModalProps) {
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 py-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Box */}
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${boxClassName}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          {title ? (
            <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
