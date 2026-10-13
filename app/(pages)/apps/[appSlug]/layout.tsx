import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/ui/app-shell";
import db from "@/lib/db/db";
import { isSsdApprover } from "@/lib/ssd";
import type { SidebarModule } from "@/types/sidebar";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ appSlug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userId = session.user?.id;
  if (!userId) redirect("/sign-in");

  const { appSlug } = await params;
  const appPath = `/apps/${appSlug}`;

  const appModule = await db.module.findFirst({
    where: { path: appPath, type: "app", status: "active", deletedAt: null },
  });

  if (!appModule) redirect("/");

  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      image: true,
      userRoles: {
        select: {
          appId: true,
          roleId: true,
          role: { select: { name: true } },
        },
      },
    },
  });

  if (!dbUser) redirect("/sign-in");

  const portalRole = dbUser.userRoles.find((ur) => ur.appId === null)?.role.name ?? null;
  const hasAccess =
    portalRole === "superadmin" ||
    dbUser.userRoles.some((ur) => ur.appId === appModule.id);

  if (!hasAccess) redirect("/");

  const moduleSelect = {
    id: true, name: true, path: true, icon: true,
    color: true, description: true, type: true, appId: true, group: true, order: true,
  };

  let modules: SidebarModule[] = [];

  if (portalRole === "superadmin") {
    modules = await db.module.findMany({
      where: { status: "active", deletedAt: null, type: "module", appId: appModule.id },
      orderBy: [{ group: "asc" }, { order: "asc" }],
      select: moduleSelect,
    });
  } else {
    const appUserRole = dbUser.userRoles.find((ur) => ur.appId === appModule.id);
    if (appUserRole) {
      const role = await db.role.findUnique({
        where: { id: appUserRole.roleId },
        include: {
          modules: {
            where: {
              module: { status: "active", deletedAt: null, type: "module", appId: appModule.id },
            },
            include: { module: { select: moduleSelect } },
            orderBy: { module: { order: "asc" } },
          },
        },
      });
      modules = role?.modules.map((rm) => rm.module) ?? [];
    }
  }

  // SSD: sembunyikan "Approval Masuk" untuk user yang tidak match template approval aktif
  if (appSlug === "ssd" && portalRole !== "superadmin") {
    const approver = await isSsdApprover(userId);
    if (!approver) {
      modules = modules.filter((m) => !m.path.includes("/approval"));
    }
  }

  // Halaman yang "milik" sebuah menu (cocok prefix terpanjang dengan path module app ini)
  // hanya boleh dibuka kalau menu itu ada di sidebar user — sama seperti gerbang halaman
  // portal. Halaman yang bukan milik menu mana pun (mis. detail file E Document) tetap
  // terbuka untuk semua yang punya role di app ini.
  if (portalRole !== "superadmin") {
    const pathname = (await headers()).get("x-pathname") ?? appPath;
    const appModulePaths = await db.module.findMany({
      where: { appId: appModule.id, type: "module", status: "active", deletedAt: null },
      select: { path: true },
    });
    const owner = appModulePaths
      .map((m) => m.path)
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];
    if (owner && !modules.some((m) => m.path === owner)) redirect("/");
  }

  const envMode = process.env["ENV_MODE"] ?? "PRODUCTION";

  return (
    <AppShell
      user={{ name: dbUser.name, image: dbUser.image, role: portalRole }}
      modules={modules}
      backHref="/"
      appHref={appPath}
      appName={appModule.name}
      nested
      envMode={envMode}
    >
      {children}
    </AppShell>
  );
}
