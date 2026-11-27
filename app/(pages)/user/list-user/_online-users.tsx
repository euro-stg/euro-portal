"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { Modal } from "@/components/ui/modal";

// User Online (2026-11-27) — khusus superadmin (server: GET /api/user/online → 403 untuk lainnya,
// tombol otomatis tersembunyi). Polling 30 dtk selama halaman terlihat.
export type OnlineUser = {
  id: string; lastSeenAt: string; path: string | null; employeeId: string; name: string | null;
  organizationName: string | null; branchName: string | null; jobPositionName: string | null;
};

const POLL_MS = 30_000;

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s} dtk lalu` : `${Math.floor(s / 60)} mnt lalu`;
}

export function OnlineUsersButton({ onChange }: { onChange: (ids: Set<string>) => void }) {
  const [allowed, setAllowed] = useState(true);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [now, setNow] = useState(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/user/online", { cache: "no-store" });
        if (res.status === 403 || res.status === 401) { if (!stop) setAllowed(false); return; }
        if (!res.ok) return;
        const j = await res.json();
        if (stop) return;
        setUsers(j.data);
        setNow(Date.now());
        onChangeRef.current(new Set((j.data as OnlineUser[]).map((u) => u.id)));
      } catch { /* abaikan — coba lagi di poll berikutnya */ }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", load); };
  }, []);

  if (!allowed) return null;

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? users.filter((u) => [u.name, u.employeeId, u.organizationName, u.branchName].some((v) => v?.toLowerCase().includes(needle)))
    : users;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
      >
        <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" /></span>
        User Online ({users.length})
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`User Online (${users.length})`} boxClassName="w-11/12 max-w-4xl">
        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5" /> Aktif membuka portal dalam 2 menit terakhir · diperbarui otomatis tiap 30 detik
        </p>
        <input
          className="w-full mb-3 px-3 py-1.5 text-sm border border-slate-200 rounded-md"
          placeholder="Cari nama / ID / departemen / cabang…" value={q} onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-[60vh] overflow-auto border border-slate-100 rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="px-3 py-2">Nama</th><th className="px-3 py-2">Departemen / Cabang</th>
                <th className="px-3 py-2">Halaman</th><th className="px-3 py-2">Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400">Tidak ada user online</td></tr>}
              {shown.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2"><div className="font-medium text-slate-800">{u.name ?? "—"}</div><div className="text-xs text-slate-400 font-mono">{u.employeeId}</div></td>
                  <td className="px-3 py-2 text-xs text-slate-600">{u.organizationName ?? "—"}<div className="text-slate-400">{u.branchName ?? ""}</div></td>
                  <td className="px-3 py-2 text-xs text-slate-500 font-mono break-all">{u.path ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{ago(u.lastSeenAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
