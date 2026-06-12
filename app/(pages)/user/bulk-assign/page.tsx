"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, RefreshCw, CheckSquare, Square, ChevronLeft, ChevronRight, UserCheck, List, Layers } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type AppOption  = { id: string; name: string };
type RoleOption = { id: string; name: string; appId: string | null };
type RoleEntry  = { name: string; appId: string | null };
type UserRow    = {
  id: string;
  employeeId: string;
  name: string | null;
  organizationName: string | null;
  jobPositionName: string | null;
  branchName: string | null;
  status: string | null;
  role: string | null;
  roles: RoleEntry[];
};

const PAGE_SIZE = 20;
const inputCls  = "border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white transition-colors";

export default function BulkAssignPage() {
  const router = useRouter();

  // ── Target selection ─────────────────────────────────────────
  const [apps, setApps]               = useState<AppOption[]>([]);
  const [roles, setRoles]             = useState<RoleOption[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("portal");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  // ── User list ─────────────────────────────────────────────────
  const [users, setUsers]             = useState<UserRow[]>([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [listError, setListError]     = useState<string | null>(null);
  const [filters, setFilters]         = useState({ name: "", branchName: "", organizationName: "" });

  // ── Show All ──────────────────────────────────────────────────
  const [showAll, setShowAll]         = useState(false);

  // ── Selection ─────────────────────────────────────────────────
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  // ── Submit ────────────────────────────────────────────────────
  const [submitting, setSubmitting]   = useState(false);
  const [toast, setToast]             = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastRef                      = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted]         = useState(false);

  const showToast = (variant: "success" | "error", message: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ variant, message });
    toastRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Mark mounted + load apps
  useEffect(() => {
    setMounted(true);
    fetch("/api/module/list?type=app&status=active", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setApps(j?.data ?? []))
      .catch(() => {});
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, []);

  // Load roles when app changes
  useEffect(() => {
    setSelectedRoleId("");
    setRoles([]);
    const appId = selectedAppId === "portal" ? null : selectedAppId;
    const q = appId === null ? "appId=null" : `appId=${appId}`;
    fetch(`/api/role/list?status=active&${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const all: RoleOption[] = j?.data ?? [];
        // filter by appId match
        const filtered = all.filter((r) =>
          appId === null ? r.appId === null : r.appId === appId
        );
        setRoles(filtered);
      })
      .catch(() => {});
  }, [selectedAppId]);

  // Load users
  const loadUsers = useCallback(async (page: number, f = filters, all = showAll) => {
    setLoadingUsers(true); setListError(null);
    try {
      const p = new URLSearchParams();
      if (all) { p.set("all", "true"); }
      else     { p.set("page", String(page)); }
      if (f.name.trim())             p.set("name", f.name.trim());
      if (f.branchName.trim())       p.set("branchName", f.branchName.trim());
      if (f.organizationName.trim()) p.set("organizationName", f.organizationName.trim());
      const res  = await fetch(`/api/user/list?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setUsers([]); setListError(json?.message ?? "Gagal memuat"); return; }
      setUsers(json?.data ?? []);
      setTotal(json?.meta?.total ?? 0);
      setTotalPages(json?.meta?.totalPages ?? 1);
      setCurrentPage(all ? 1 : page);
    } catch {
      setUsers([]); setListError("Network error");
    } finally { setLoadingUsers(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, showAll]);

  useEffect(() => {
    void loadUsers(1, filters);
    setSelected(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce filter changes
  useEffect(() => {
    const t = setTimeout(() => { void loadUsers(1, filters, showAll); setSelected(new Set()); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name, filters.branchName, filters.organizationName]);

  const toggleShowAll = () => {
    const next = !showAll;
    setShowAll(next);
    setSelected(new Set());
    void loadUsers(1, filters, next);
  };

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allIds = users.map((u) => u.id);
    const allSelected = allIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) { allIds.forEach((id) => next.delete(id)); }
      else             { allIds.forEach((id) => next.add(id)); }
      return next;
    });
  };

  const allCurrentSelected = users.length > 0 && users.every((u) => selected.has(u.id));

  const handleSubmit = async () => {
    if (submitting) return;
    if (selected.size === 0) { showToast("error", "Pilih minimal 1 user"); return; }
    if (!selectedRoleId)     { showToast("error", "Pilih role terlebih dahulu"); return; }

    setSubmitting(true);
    try {
      const appId = selectedAppId === "portal" ? null : selectedAppId;
      const res   = await fetch("/api/user/bulk-assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selected), roleId: selectedRoleId, appId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { showToast("error", json?.message ?? "Gagal assign"); return; }
      showToast("success", json?.message ?? "Berhasil");
      setSelected(new Set());
      void loadUsers(currentPage, filters);
    } catch { showToast("error", "Network error"); }
    finally { setSubmitting(false); }
  };

  const selectedAppName = selectedAppId === "portal"
    ? "Portal"
    : apps.find((a) => a.id === selectedAppId)?.name ?? selectedAppId;

  const selectedRoleName = roles.find((r) => r.id === selectedRoleId)?.name;

  return (
    <div>
      {toast && (
        <div className="fixed top-16 right-4 z-50 min-w-72">
          <Alert variant={toast.variant} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/user/list-user")}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <UserCheck className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Bulk Assign Role</h1>
          <p className="text-slate-400 text-xs">Assign role ke banyak user sekaligus</p>
        </div>
      </div>

      {/* Step 1 — Target */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
          1 — Pilih Target Role
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Aplikasi</label>
            <select
              className={inputCls + " w-full"}
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
            >
              <option value="portal">Portal (level portal)</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</label>
            <select
              className={inputCls + " w-full"}
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={mounted && roles.length === 0 ? true : undefined}
            >
              <option value="">
                {roles.length === 0 ? "— belum ada role untuk app ini —" : "-- Pilih Role --"}
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedRoleId && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            User terpilih akan mendapat role{" "}
            <span className="font-semibold text-blue-700">{selectedRoleName}</span>{" "}
            di{" "}
            <span className="font-semibold text-blue-700">{selectedAppName}</span>.
            Role lama di app yang sama akan digantikan.
          </div>
        )}
      </div>

      {/* Step 2 — Select Users */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            2 — Pilih User
            {selected.size > 0 && (
              <span className="normal-case font-medium text-blue-600 ml-2">
                {selected.size} terpilih
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleShowAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                showAll
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {showAll ? <Layers className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              {showAll ? "Per Halaman" : "Tampilkan Semua"}
            </button>
            <Button variant="outline" size="sm" onClick={() => void loadUsers(currentPage, filters, showAll)} disabled={loadingUsers}>
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
          <input
            className={inputCls + " flex-1 min-w-[160px]"}
            placeholder="Cari nama..."
            value={filters.name}
            onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className={inputCls + " flex-1 min-w-[140px]"}
            placeholder="Filter branch..."
            value={filters.branchName}
            onChange={(e) => setFilters((p) => ({ ...p, branchName: e.target.value }))}
          />
          <input
            className={inputCls + " flex-1 min-w-[140px]"}
            placeholder="Filter organisasi..."
            value={filters.organizationName}
            onChange={(e) => setFilters((p) => ({ ...p, organizationName: e.target.value }))}
          />
          <p className="text-xs text-slate-400 whitespace-nowrap ml-auto">
            {total} user ditemukan
          </p>
        </div>

        {listError && <div className="p-4"><Alert variant="error" message={listError} /></div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-3 w-10">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-blue-600 transition-colors">
                    {allCurrentSelected
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                </th>
                {["Nama", "Employee ID", "Jabatan", "Branch", "Org", "Role"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingUsers ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
                  </div>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">Tidak ada data</td></tr>
              ) : (
                users.map((u) => {
                  const isChecked = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors cursor-pointer ${isChecked ? "bg-blue-50/60" : "hover:bg-slate-50/60"}`}
                      onClick={() => toggleUser(u.id)}
                    >
                      <td className="px-3 py-3">
                        {isChecked
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4 text-slate-300" />
                        }
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-800 text-sm">{u.name ?? "—"}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{u.employeeId}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{u.jobPositionName ?? "—"}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{u.branchName ?? "—"}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{u.organizationName ?? "—"}</td>
                      <td className="px-3 py-3">
                        {(u.roles?.length ?? 0) > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(u.roles ?? []).map((r) => (
                              <span key={r.appId ?? "portal"} className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — hanya tampil jika bukan mode Show All */}
        {!showAll && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Halaman {currentPage} dari {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1 || loadingUsers}
                onClick={() => void loadUsers(currentPage - 1, filters, false)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => void loadUsers(p, filters, false)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === currentPage
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={currentPage >= totalPages || loadingUsers}
                onClick={() => void loadUsers(currentPage + 1, filters, false)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {showAll && users.length > 0 && !loadingUsers && (
          <div className="px-4 py-3 border-t border-slate-100 text-center text-xs text-slate-400">
            {users.length} user ditampilkan — centang semua dengan checkbox di header
          </div>
        )}
      </div>

      {/* Sticky submit bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {selected.size} user dipilih
                </p>
                {selectedRoleId ? (
                  <p className="text-xs text-slate-400">
                    Role: <span className="font-medium text-slate-600">{selectedRoleName}</span>{" "}
                    di <span className="font-medium text-slate-600">{selectedAppName}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-500">Pilih role di panel atas terlebih dahulu</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={submitting}>
                Batalkan Pilihan
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={submitting || !selectedRoleId}
              >
                {submitting ? "Menyimpan..." : `Assign ke ${selected.size} User`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom padding so sticky bar doesn't cover content */}
      {selected.size > 0 && <div className="h-24" />}
    </div>
  );
}
