"use client";

import { useEffect, useState } from "react";
import { FolderInput, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FolderTreeSingleSelectBody } from "../../_edoc-folder-tree-picker";

// "Move File" (2026-09-30) — untuk kasus salah upload ke folder yang salah. Folder tempat
// file ini SEKARANG disembunyikan/disabled dari pilihan (sudah di sana). Tree picker-nya
// (FolderTreeSingleSelectBody) dibagi bersama dengan "Pindahkan N File" massal di
// _edoc-app.tsx — lihat _edoc-folder-tree-picker.tsx.
export function MoveFileButton({
  fileId, currentFolderId, onMoved,
}: {
  fileId: string; currentFolderId: string; onMoved: (newFolderId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { if (open) { setSelectedId(null); setError(""); } }, [open]);

  const handleMove = async () => {
    if (!selectedId) return;
    setMoving(true);
    setError("");
    try {
      const res = await fetch(`/api/edoc/file/${fileId}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: selectedId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || "Gagal memindahkan file"); return; }
      onMoved(selectedId);
      setOpen(false);
    } finally { setMoving(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <FolderInput className="w-4 h-4" /> Pindah Folder
      </Button>

      <Modal open={open} title="Pindah File ke Folder Lain" onClose={() => setOpen(false)} boxClassName="max-w-xl">
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <p className="text-xs text-slate-400">Pilih 1 folder tujuan. Berlaku untuk file yang sudah di-approve maupun yang masih draft.</p>
          <FolderTreeSingleSelectBody disabledFolderId={currentFolderId} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button disabled={!selectedId || moving} onClick={handleMove} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
              {moving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />} Pindahkan
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
