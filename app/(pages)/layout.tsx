import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/ui/app-shell";
import { ChatWidget } from "@/components/ui/chat-widget";
import db from "@/lib/db/db";
import type { SidebarModule } from "@/types/sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userId = session.user?.id;
  if (!userId) redirect("/sign-in");

  // Ambil user + portal role (appId = null)
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      userRoles: {
        where: { role: { appId: null, status: "active", deletedAt: null } },
        select: { role: { select: { name: true } } },
        take: 1,
      },
    },
  });

  if (!dbUser) redirect("/sign-in");

  const portalRole = dbUser.userRoles[0]?.role.name ?? null;

  const moduleSelect = {
    id: true, name: true, path: true, icon: true,
    color: true, description: true, type: true, appId: true, group: true, order: true,
  };

  let modules: SidebarModule[] = [];

  if (portalRole === "superadmin") {
    modules = await db.module.findMany({
      where: { status: "active", deletedAt: null, type: "module", appId: null },
      orderBy: [{ group: "asc" }, { order: "asc" }],
      select: moduleSelect,
    });
  } else if (portalRole) {
    const role = await db.role.findFirst({
      where: { name: portalRole, appId: null, status: "active", deletedAt: null },
      include: {
        modules: {
          where: { module: { status: "active", deletedAt: null, type: "module", appId: null } },
          include: { module: { select: moduleSelect } },
          orderBy: { module: { order: "asc" } },
        },
      },
    });
    modules = role?.modules.map((rm) => rm.module) ?? [];
  }

  return (
    <>
      <AppShell user={{ name: dbUser.name, role: portalRole }} modules={modules}>
        {children}
      </AppShell>
      <ChatWidget />
    </>
  );
}
