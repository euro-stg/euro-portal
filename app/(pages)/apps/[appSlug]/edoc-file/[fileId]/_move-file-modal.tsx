"use client";

import { useEffect, useState } from "react";
import { FolderInput, ChevronRight, ChevronDown, Folder, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { buildFolderTree, type FlatFolder, type FolderTreeNode } from "../../_edoc-app";

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

// "Move File" (2026-09-30) — untuk kasus salah upload ke folder yang salah. Tree expandable
// sama seperti BlastFolderPicker (fetch sekali via ?tree=1, dibangun jadi tree di client),
// tapi single-select (radio-style, bukan checkbox) — 1 file cuma punya 1 folder rumah.
// Folder tempat file ini SEKARANG disembunyikan dari pilihan (sudah di sana, tidak perlu
// dipindah ke situ lagi).
export function MoveFileButton({
  fileId, currentFolderId, onMoved,
}: {
  fileId: string; currentFolderId: string; onMoved: (newFolderId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [flatFolders, setFlatFolders] = useState<FlatFolder[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setSelectedId(null);
    fetch("/api/edoc/folder/search?tree=1")
      .then((r) => r.json())
      .then((j) => setFlatFolders(j.data ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  const byId = new Map(flatFolders.map((f) => [f.id, f]));
  const tree = buildFolderTree(flatFolders);
  const toggleExpand = (id: string) => setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const searchActive = query.trim().length > 0;
  const keepIds = (() => {
    if (!searchActive) return null;
    const q = query.trim().toLowerCase();
    const keep = new Set<string>();
    for (const f of flatFolders) {
      if (f.name.toLowerCase().includes(q)) {
        let cur: FlatFolder | undefined = f;
        while (cur) { keep.add(cur.id); cur = cur.parentFolderId ? byId.get(cur.parentFolderId) : undefined; }
      }
    }
    return keep;
  })();

  const renderNode = (node: FolderTreeNode, depth: number): React.ReactNode => {
    if (keepIds && !keepIds.has(node.id)) return null;
    const hasChildren = node.children.length > 0;
    const isExpanded = searchActive ? true : expandedIds.has(node.id);
    const isCurrent = node.id === currentFolderId;
    const isSelected = node.id === selectedId;
    return (
      <div key={node.id}>
        <div className={`flex items-center gap-1 py-1 rounded ${isCurrent ? "opacity-40" : "hover:bg-amber-50/50"}`} style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} className="p-0.5 text-slate-400 hover:text-amber-600 transition-colors shrink-0">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <button
            type="button" disabled={isCurrent}
            onClick={() => setSelectedId(node.id)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-0.5 disabled:cursor-not-allowed"
          >
            <span className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${isSelected ? "border-amber-600" : "border-slate-300"}`}>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />}
            </span>
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-sm text-slate-700 truncate">{node.name}</span>
            {isCurrent && <span className="text-xs text-slate-400 shrink-0">(folder saat ini)</span>}
          </button>
        </div>
        {hasChildren && isExpanded && <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>}
      </div>
    );
  };

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Cari nama folder untuk filter tree..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <p className="text-xs text-slate-400">Pilih 1 folder tujuan. Berlaku untuk file yang sudah di-approve maupun yang masih draft.</p>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : tree.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Belum ada folder.</p>
          ) : searchActive && keepIds?.size === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Tidak ada folder yang cocok dengan &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-lg px-2 py-1">
              {tree.map((n) => renderNode(n, 0))}
            </div>
          )}

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
