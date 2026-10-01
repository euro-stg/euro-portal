"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Folder, Loader2, Search } from "lucide-react";

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

// Dipakai bersama oleh BlastFolderPicker (_edoc-app.tsx, multi-select checkbox) dan
// FolderTreeSingleSelectBody di bawah (single-select radio, dipakai Move File satu/banyak
// file) — diekstrak ke file sendiri (2026-09-30) supaya logic tree-building-nya tidak
// diduplikasi, dan supaya tidak ada circular import antara _edoc-app.tsx dan
// edoc-file/[fileId]/_move-file-modal.tsx (keduanya butuh ini, tapi tidak boleh saling impor).
export type FlatFolder = { id: string; name: string; parentFolderId: string | null };
export type FolderTreeNode = FlatFolder & { children: FolderTreeNode[] };

export function buildFolderTree(flat: FlatFolder[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const f of flat) byId.set(f.id, { ...f, children: [] });
  const roots: FolderTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentFolderId ? byId.get(node.parentFolderId) : undefined;
    if (parent) parent.children.push(node); else roots.push(node);
  }
  const sortRec = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** Tree expandable single-select (radio-style) untuk pilih 1 folder tujuan — dipakai dari
 * Move File (1 file) dan Pindahkan N File (massal). `disabledFolderId` (opsional) ditampilkan
 * abu-abu + tidak bisa dipilih, dengan label "(folder saat ini)". */
export function FolderTreeSingleSelectBody({
  disabledFolderId, selectedId, onSelect,
}: {
  disabledFolderId?: string | null; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [flatFolders, setFlatFolders] = useState<FlatFolder[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/edoc/folder/search?tree=1")
      .then((r) => r.json())
      .then((j) => setFlatFolders(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

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
    const isDisabled = node.id === disabledFolderId;
    const isSelected = node.id === selectedId;
    return (
      <div key={node.id}>
        <div className={`flex items-center gap-1 py-1 rounded ${isDisabled ? "opacity-40" : "hover:bg-amber-50/50"}`} style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} className="p-0.5 text-slate-400 hover:text-amber-600 transition-colors shrink-0">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <button
            type="button" disabled={isDisabled}
            onClick={() => onSelect(node.id)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-0.5 disabled:cursor-not-allowed"
          >
            <span className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${isSelected ? "border-amber-600" : "border-slate-300"}`}>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />}
            </span>
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-sm text-slate-700 truncate">{node.name}</span>
            {isDisabled && <span className="text-xs text-slate-400 shrink-0">(folder saat ini)</span>}
          </button>
        </div>
        {hasChildren && isExpanded && <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className={`${inputCls} pl-9`} placeholder="Cari nama folder untuk filter tree..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
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
    </div>
  );
}
