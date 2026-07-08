"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X, ArrowLeft, LayoutDashboard, BookOpen } from "lucide-react";
import { getSidebarIcon, getIconColor } from "@/lib/icon-registry";
import type { SidebarModule } from "@/types/sidebar";

type SidebarUser = {
  name?: string | null;
  image?: string | null;
  role?: string | null;
};

const groupColorRegistry: Record<string, string> = {
  "Data Master": "text-cyan-500",
  "Pengaturan":  "text-slate-400",
  "Integrasi":   "text-violet-500",
  "Approval":    "text-amber-500",
  "Transaksi":   "text-blue-500",
};

const Sidebar = ({
  open,
  onClose,
  user,
  modules = [],
  backHref,
  appHref,
  appName,
  hasBanner = false,
}: {
  open: boolean;
  onClose: () => void;
  user?: SidebarUser;
  modules?: SidebarModule[];
  backHref?: string;
  appHref?: string;
  appName?: string;
  hasBanner?: boolean;
}) => {
  const pathname = usePathname();
  const [imgError, setImgError] = useState(false);

  // Badge count untuk approval paths
  const [approvalBadge, setApprovalBadge] = useState<number>(0);
  useEffect(() => {
    const approvalModule = modules.find((m) => m.path.endsWith("/approval"));
    if (!approvalModule) return;
    const isSsd = approvalModule.path.includes("/ssd/");
    const pendingApi = isSsd ? "/api/ssd/approval/pending" : "/api/sd/approval/pending";
    fetch(pendingApi)
      .then((r) => r.json())
      .then((j) => { if (typeof j.total === "number") setApprovalBadge(j.total); })
      .catch(() => {});
  }, [modules]);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const standalone = modules.filter((m) => !m.group);
  const groups = modules
    .filter((m) => m.group)
    .reduce<Record<string, SidebarModule[]>>((acc, m) => {
      const g = m.group!;
      if (!acc[g]) acc[g] = [];
      acc[g].push(m);
      return acc;
    }, {});

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    if (pathname !== path && !pathname.startsWith(path + "/")) return false;
    // Jika ada module lain yang lebih spesifik juga match, ini bukan yang aktif
    const hasMoreSpecific = modules.some(
      (m) => m.path !== path && m.path.startsWith(path + "/") &&
        (pathname === m.path || pathname.startsWith(m.path + "/"))
    );
    return !hasMoreSpecific;
  };

  const NavItem = ({ m }: { m: SidebarModule }) => {
    const Icon   = getSidebarIcon(m.icon);
    const active = isActive(m.path);
    const isApprovalInbox = m.path.endsWith("/approval");

    return (
      <Link
        key={m.id}
        href={m.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 ${
          active
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-600" : getIconColor(m.icon)}`} />
        <span className="flex-1">{m.name}</span>
        {isApprovalInbox && approvalBadge > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {approvalBadge > 99 ? "99+" : approvalBadge}
          </span>
        )}
        {active && !isApprovalInbox && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </Link>
    );
  };

  // Navbar h-14 (56px/3.5rem) + optional banner h-8 (32px/2rem) = 88px/5.5rem
  const sidebarTop = hasBanner ? "5.5rem" : "3.5rem";
  const sidebarHeight = hasBanner ? "calc(100vh - 5.5rem)" : "calc(100vh - 3.5rem)";

  return (
    <aside
      className="fixed left-0 flex flex-col bg-white border-r border-slate-200 shadow-sm z-[60] transition-transform duration-300"
      style={{
        top: sidebarTop,
        width: "260px",
        height: sidebarHeight,
        transform: open ? "translateX(0)" : "translateX(-100%)",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
      >
        <X className="w-4 h-4" />
      </button>

      {/* User section */}
      <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
        {appName ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/30 bg-white/20 flex items-center justify-center">
              {user?.image && !imgError ? (
                <Image src={user.image} alt={user.name ?? "avatar"} width={40} height={40} className="object-cover w-full h-full" onError={() => setImgError(true)} />
              ) : (
                <span className="text-white font-bold text-sm">{initials}</span>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-snug truncate">{user?.name ?? "—"}</p>
              <p className="text-blue-100 text-xs mt-0.5 truncate">{appName}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/30 bg-white/20 flex items-center justify-center">
              {user?.image && !imgError ? (
                <Image src={user.image} alt={user.name ?? "avatar"} width={40} height={40} className="object-cover w-full h-full" onError={() => setImgError(true)} />
              ) : (
                <span className="text-white font-bold text-sm">{initials}</span>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-snug truncate">
                {user?.name ?? "—"}
              </p>
              <p className="text-blue-100 text-xs capitalize mt-0.5">
                {user?.role ?? "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {backHref && (
          <Link
            href={backHref}
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all mb-2 text-sm border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Portal</span>
          </Link>
        )}
        {appHref && !modules.some((m) => m.path === appHref) && (() => {
          const active = pathname === appHref;
          return (
            <Link
              href={appHref}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-2 ${
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-600" : "text-blue-500"}`} />
              <span className="flex-1">Beranda</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </Link>
          );
        })()}

        {/* Dashboard Portal — selalu tampil untuk semua user */}
        {!backHref && (() => {
          const active = pathname === "/";
          return (
            <Link
              href="/"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 ${
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-600" : "text-blue-500"}`} />
              <span className="flex-1">Beranda</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </Link>
          );
        })()}

        {/* Standalone items */}
        {standalone.map((m) => <NavItem key={m.id} m={m} />)}

        {/* Grouped items — always expanded */}
        {Object.entries(groups).map(([groupName, items]) => {
          const groupColor = groupColorRegistry[groupName] ?? "text-slate-400";
          return (
            <div key={groupName} className="mt-3">
              <p className={`px-3 mb-1 text-[10px] font-bold uppercase tracking-widest ${groupColor}`}>
                {groupName}
              </p>
              <ul className="space-y-0.5">
                {items.map((m) => <li key={m.id}><NavItem m={m} /></li>)}
              </ul>
            </div>
          );
        })}

        {modules.length === 0 && (
          <p className="text-slate-400 text-xs text-center mt-6 px-4">
            Tidak ada menu tersedia
          </p>
        )}
      </nav>

      {user?.role === "superadmin" && (
        <div className="px-3 pb-2 border-t border-slate-100 flex-shrink-0">
          <div className="mt-3">
            <Link
              href="/dev-docs"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                pathname === "/dev-docs"
                  ? "bg-amber-50 text-amber-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <BookOpen className={`w-4 h-4 flex-shrink-0 ${pathname === "/dev-docs" ? "text-amber-600" : "text-amber-500"}`} />
              <span className="flex-1">Developer Docs</span>
              {pathname === "/dev-docs" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </Link>
          </div>
        </div>
      )}
      <div className="px-3 py-3 border-t border-slate-100 flex-shrink-0">
        <p className="text-slate-400 text-xs text-center">
          © {new Date().getFullYear()} Euromedica Group
        </p>
      </div>
    </aside>
  );
};

export { Sidebar };
