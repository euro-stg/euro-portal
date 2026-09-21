"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, X, UserPlus, Shield, CheckSquare, Info } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { CategoryFormatManager } from "./_category-format-manager";
import { CounterManager } from "./_counter-manager";
import { ImPricelistManager } from "./_im-pricelist-manager";

type UserOption = { id: string; name: string | null; employeeId: string; jobPositionName: string | null };
type AssignedRow = { id: string; userId: string; assignedAt: string; user: UserOption };

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

// Assign/revoke Folder Creator & Document Approver — superadmin only (di-enforce API-nya).
export default function EDocSettingsPage() {
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-16 right-4 z-[90] min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pengaturan E Document</h1>
        <p className="text-sm text-slate-400 mt-0.5">Kelola role, Category, format nomor, dan watermark</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-semibold text-blue-800">Cara Pakai — Urutan Setup</p>
        </div>
        <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
          <li><b>Assign role</b> — tentukan siapa Folder Creator (boleh bikin folder) dan Document Approver (boleh approve dokumen).</li>
          <li><b>Buat Category</b> — mis. &ldquo;IM&rdquo;. Tambahkan Category Type kalau perlu (mis. Regular / Non-Regular).</li>
          <li><b>Atur Document Number</b> — <u>wajib</u> diisi dulu sebelum file di Category ini bisa di-approve. Susun segmen (teks tetap, nomor urut, kode kategori, dst) lalu set posisi X/Y di halaman PDF (mm dari pojok kiri-atas, kertas A4).</li>
          <li><b>Atur MOC Number</b> — opsional. Kalau tidak diisi, file di Category ini tidak akan punya opsi generate MOC.</li>
          <li><b>Atur Watermark</b> — opsional. Teks bebas (mis. &ldquo;APPROVED&rdquo;), warna, dan posisinya sendiri di halaman.</li>
          <li><b>Master Number</b> di bagian paling bawah — cuma untuk koreksi manual kalau nomor urut perlu disesuaikan (mis. lanjut dari nomor fisik yang sudah ada).</li>
        </ol>
        <p className="text-xs text-blue-600 mt-3">
          Contoh hasil akhir: Document Number <span className="font-mono bg-white px-1.5 py-0.5 rounded">486/Euromedica/IM/BUS/VII/2026</span>,
          {" "}MOC Number <span className="font-mono bg-white px-1.5 py-0.5 rounded">626/MOC/IM/regular/486</span>.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Role</p>
        <div className="space-y-4">
          <RoleManager
            title="Folder Creator"
            description="Bisa membuat folder di mana saja dan mengatur ACL-nya."
            icon={<Shield className="w-4 h-4 text-amber-600" />}
            endpoint="/api/edoc/folder-creator"
            onError={(m) => showToast("error", m)}
            onSuccess={(m) => showToast("success", m)}
          />
          <RoleManager
            title="Document Approver"
            description="Bisa approve dokumen (generate Document Number & MOC Number) di seluruh E Document."
            icon={<CheckSquare className="w-4 h-4 text-amber-600" />}
            endpoint="/api/edoc/document-approver"
            onError={(m) => showToast("error", m)}
            onSuccess={(m) => showToast("success", m)}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2-5. Category, Number Format &amp; Watermark</p>
        <CategoryFormatManager onError={(m) => showToast("error", m)} onSuccess={(m) => showToast("success", m)} />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">6. Master Number</p>
        <CounterManager onError={(m) => showToast("error", m)} onSuccess={(m) => showToast("success", m)} />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">7. Master Pricelist (Category IM)</p>
        <ImPricelistManager onError={(m) => showToast("error", m)} onSuccess={(m) => showToast("success", m)} />
      </div>
    </div>
  );
}

function RoleManager({
  title, description, icon, endpoint, onError, onSuccess,
}: {
  title: string; description: string; icon: React.ReactNode; endpoint: string;
  onError: (m: string) => void; onSuccess: (m: string) => void;
}) {
  const [assigned, setAssigned] = useState<AssignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      setAssigned(res.ok ? (json.data ?? []) : []);
    } finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch("/api/user/list?all=true&status=active").then((r) => r.json()).then((j) => setUsers(j.data ?? [])).catch(() => {});
  }, []);

  const assignedIds = new Set(assigned.map((a) => a.userId));
  const filteredUsers = search.trim()
    ? users.filter((u) => !assignedIds.has(u.id) && ((u.name ?? "").toLowerCase().includes(search.toLowerCase()) || u.employeeId.toLowerCase().includes(search.toLowerCase())))
    : [];

  const assign = async (userId: string) => {
    setAssigning(true);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const json = await res.json();
      if (!res.ok) { onError(json.message || "Gagal assign"); return; }
      setSearch("");
      onSuccess(`${title} berhasil di-assign`);
      void load();
    } finally { setAssigning(false); }
  };

  const revoke = async (userId: string) => {
    const res = await fetch(`${endpoint}/${userId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { onError(json.message || "Gagal revoke"); return; }
    onSuccess(`${title} dicabut`);
    void load();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">{icon}<p className="text-sm font-semibold text-slate-700">{title}</p></div>
      <p className="text-xs text-slate-400 mb-4">{description}</p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className={`${inputCls} pl-9`} placeholder="Cari nama atau NIK untuk assign..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {search.trim() && (
          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</p>
            ) : (
              filteredUsers.slice(0, 10).map((u) => (
                <button key={u.id} disabled={assigning} onClick={() => assign(u.id)} className="w-full flex items-center justify-between text-left px-3 py-2 hover:bg-amber-50 transition-colors disabled:opacity-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.name ?? "-"}</p>
                    <p className="text-xs text-slate-400">{u.employeeId}{u.jobPositionName ? ` · ${u.jobPositionName}` : ""}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-amber-500" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : assigned.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada yang di-assign.</p>
      ) : (
        <div className="space-y-1.5">
          {assigned.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">{a.user?.name ?? "-"}</p>
                <p className="text-xs text-slate-400">{a.user?.employeeId}{a.user?.jobPositionName ? ` · ${a.user.jobPositionName}` : ""}</p>
              </div>
              <button onClick={() => revoke(a.userId)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
