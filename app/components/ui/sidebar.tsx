"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Tag,
  Settings, Database, Shield, Package, X, Bell, Layers,
  FileText, Ticket, Workflow, BookOpen, FolderKanban, ArrowLeft,
  Settings2, Key, Link2,
  type LucideIcon,
} from "lucide-react";
import type { SidebarModule } from "@/types/sidebar";

type SidebarUser = {
  name?: string | null;
  role?: string | null;
};

const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard, Users, Tag, Shield, Package, Settings, Settings2,
  Database, Bell, Layers, FileText, Ticket, Workflow, BookOpen, FolderKanban,
  Key, Link2,
};

const iconColorRegistry: Record<string, string> = {
  LayoutDashboard: "text-blue-500",
  Users:           "text-indigo-500",
  Tag:             "text-emerald-500",
  Shield:          "text-violet-500",
  Package:         "text-orange-500",
  Database:        "text-cyan-500",
  Settings:        "text-slate-400",
  Settings2:       "text-slate-400",
  Bell:            "text-amber-500",
  Layers:          "text-blue-500",
  FileText:        "text-rose-500",
  Ticket:          "text-teal-500",
  Workflow:        "text-purple-500",
  BookOpen:        "text-sky-500",
  FolderKanban:    "text-pink-500",
  Key:             "text-amber-500",
  Link2:           "text-teal-500",
};

const groupColorRegistry: Record<string, string> = {
  "Data Master": "text-cyan-500",
  "Pengaturan":  "text-slate-400",
  "Approval":    "text-violet-500",
  "Transaksi":   "text-blue-500",
};

function getIcon(name: string | null): LucideIcon {
  return (name && iconRegistry[name]) ? iconRegistry[name] : LayoutDashboard;
}

function getIconColor(name: string | null): string {
  return (name && iconColorRegistry[name]) ? iconColorRegistry[name] : "text-slate-400";
}

const Sidebar = ({
  open,
  onClose,
  user,
  modules = [],
  backHref,
  appName,
}: {
  open: boolean;
  onClose: () => void;
  user?: SidebarUser;
  modules?: SidebarModule[];
  backHref?: string;
  appName?: string;
}) => {
  const pathname = usePathname();

  // Badge count untuk approval paths
  const [approvalBadge, setApprovalBadge] = useState<number>(0);
  useEffect(() => {
    const approvalModule = modules.find((m) => m.path.endsWith("/approval"));
    if (!approvalModule) return;
    fetch("/api/sd/approval/pending")
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
    const Icon   = getIcon(m.icon);
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

  return (
    <aside
      className="fixed top-14 left-0 flex flex-col bg-white border-r border-slate-200 shadow-sm z-[60] transition-transform duration-300"
      style={{
        width: "260px",
        height: "calc(100vh - 3.5rem)",
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
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 ring-2 ring-white/30">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-snug truncate">{appName}</p>
              <p className="text-blue-100 text-xs mt-0.5 truncate">{user?.name ?? "—"}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-white/30">
              {initials}
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all mb-3 text-sm border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Portal</span>
          </Link>
        )}

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
              <span className="flex-1">Beranda Portal</span>
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

      <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <p className="text-slate-400 text-xs text-center">
          © {new Date().getFullYear()} Euromedica Group
        </p>
      </div>
    </aside>
  );
};

export { Sidebar };
