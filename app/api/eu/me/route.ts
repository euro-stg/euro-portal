import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";

// Returns whether the current user can create/manage EU posts (has eu-settings module access).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;

    // Superadmin always can post
    const portalRole = await db.userRole.findFirst({
      where: { userId, appId: null, role: { appId: null, status: "active", deletedAt: null } },
      select: { role: { select: { name: true } } },
    });
    const isSuperadmin = portalRole?.role.name === "superadmin";
    if (isSuperadmin) {
      return NextResponse.json({ canPost: true, isSuperadmin: true, userId });
    }

    // Check if user has a role for the euro-update app that includes the eu-settings module
    const euApp = await db.module.findFirst({
      where: { path: "/apps/euro-update", type: "app", status: "active", deletedAt: null },
      select: { id: true },
    });
    if (!euApp) return NextResponse.json({ canPost: false, isSuperadmin: false, userId });

    const settingsModule = await db.module.findFirst({
      where: { path: "/apps/euro-update/eu-settings", type: "module", appId: euApp.id, status: "active", deletedAt: null },
      select: { id: true },
    });
    if (!settingsModule) return NextResponse.json({ canPost: false, isSuperadmin: false, userId });

    const userRole = await db.userRole.findFirst({
      where: { userId, appId: euApp.id },
      select: { roleId: true },
    });
    if (!userRole) return NextResponse.json({ canPost: false, isSuperadmin: false, userId });

    const hasSettingsAccess = await db.roleModule.findFirst({
      where: { roleId: userRole.roleId, moduleId: settingsModule.id },
    });

    return NextResponse.json({ canPost: !!hasSettingsAccess, isSuperadmin: false, userId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
