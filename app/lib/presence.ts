import db from "@/lib/db/db";

// Status online (2026-11-27). Heartbeat browser tiap PING_MS; user dianggap online kalau
// lastSeenAt < ONLINE_WINDOW_MS lalu.
export const PING_MS = 60_000;
export const ONLINE_WINDOW_MS = 120_000;

export async function isPortalSuperadmin(userId: string): Promise<boolean> {
  const r = await db.userRole.findFirst({
    where: { userId, appId: null, role: { name: "superadmin", appId: null, status: "active", deletedAt: null } },
    select: { userId: true },
  });
  return !!r;
}
