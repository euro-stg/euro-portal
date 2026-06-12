import { redirect } from "next/navigation";
import {
  LayoutDashboard, Users, Tag, Shield, Package, Settings, Database,
  Bell, FileText, Ticket, Workflow, BookOpen, FolderKanban, Layers,
  Lock, type LucideIcon,
} from "lucide-react";

import prisma from "@/lib/db/db";
import { auth } from "@/lib/auth";
import { ExternalAppCard } from "@/components/ui/external-app-card";
import { InternalAppCard } from "@/components/ui/internal-app-card";

export const dynamic = "force-dynamic";

const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard, Users, Tag, Shield, Package, Settings, Database,
  Bell, FileText, Ticket, Workflow, BookOpen, FolderKanban, Layers,
};

const colorMap: Record<string, { gradient: string; border: string }> = {
  blue:    { gradient: "from-blue-500 to-blue-600",      border: "border-blue-100"    },
  indigo:  { gradient: "from-indigo-500 to-indigo-600",  border: "border-indigo-100"  },
  violet:  { gradient: "from-violet-500 to-violet-600",  border: "border-violet-100"  },
  emerald: { gradient: "from-emerald-500 to-emerald-600",border: "border-emerald-100" },
  orange:  { gradient: "from-orange-500 to-orange-600",  border: "border-orange-100"  },
  rose:    { gradient: "from-rose-500 to-rose-600",      border: "border-rose-100"    },
  cyan:    { gradient: "from-cyan-500 to-cyan-600",      border: "border-cyan-100"    },
  amber:   { gradient: "from-amber-500 to-amber-600",    border: "border-amber-100"   },
  teal:    { gradient: "from-teal-500 to-teal-600",      border: "border-teal-100"    },
  pink:    { gradient: "from-pink-500 to-pink-600",      border: "border-pink-100"    },
};

function getColor(color: string | null) {
  return (color && colorMap[color]) ? colorMap[color] : colorMap.blue;
}

function getIcon(name: string | null): LucideIcon {
  return (name && iconRegistry[name]) ? iconRegistry[name] : Layers;
}

const Home = async () => {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userId = session.user?.id;
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          jobPositionName: true,
          organizationName: true,
          branchName: true,
          userRoles: {
            select: { appId: true, role: { select: { name: true } } },
          },
        },
      })
    : null;

  const portalRole    = dbUser?.userRoles.find((ur) => ur.appId === null)?.role.name ?? null;
  const appRoleAppIds = new Set(dbUser?.userRoles.filter((ur) => ur.appId !== null).map((ur) => ur.appId!) ?? []);

  const allApps = await prisma.module.findMany({
    where: { status: "active", deletedAt: null, type: "app" },
    orderBy: { order: "asc" },
    select: { id: true, name: true, path: true, icon: true, color: true, description: true, isExternal: true, externalUrl: true },
  });

  const accessibleAppIds = portalRole === "superadmin"
    ? new Set(allApps.map((a) => a.id))
    : appRoleAppIds;

  const fullName = dbUser?.name ?? "Karyawan";
  const hour     = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  const userInfo = [
    dbUser?.jobPositionName,
    dbUser?.organizationName,
    dbUser?.branchName,
  ].filter(Boolean).join(" · ");

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0 shadow-sm">
          {fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-slate-400 text-xs">{greeting},</p>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug truncate">{fullName}</h1>
          {userInfo && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{userInfo}</p>
          )}
        </div>
      </div>

      {allApps.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Aplikasi</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {allApps.map((app) => {
              const hasAccess = accessibleAppIds.has(app.id);
              const c         = getColor(app.color);
              const Icon      = getIcon(app.icon);

              if (hasAccess) {
                // Aplikasi eksternal — SSO redirect ke new tab
                if (app.isExternal) {
                  return (
                    <ExternalAppCard key={app.id} app={app} colorCls={c} iconName={app.icon} />
                  );
                }

                // Aplikasi internal — navigasi biasa
                return (
                  <InternalAppCard key={app.id} app={app} colorCls={c} iconName={app.icon} />
                );
              }

              // Locked card
              return (
                <div
                  key={app.id}
                  className="relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col items-center gap-2 sm:gap-3 shadow-sm opacity-60 cursor-not-allowed select-none text-center"
                >
                  <div className="absolute top-2.5 right-2.5">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 flex items-center justify-center">
                      <Lock className="w-3 h-3 text-slate-400" />
                    </div>
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-slate-400" />
                  </div>
                  <div className="flex-1 w-full">
                    <p className="font-semibold text-slate-500 text-sm leading-snug">{app.name}</p>
                    {app.description && (
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2 text-center hidden sm:block">{app.description}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Tidak memiliki akses</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-7 h-7 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Belum ada aplikasi</p>
          <p className="text-slate-400 text-sm">
            Tambahkan aplikasi melalui menu <span className="font-medium text-slate-600">Master Module</span> dengan type <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">app</span>.
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;
