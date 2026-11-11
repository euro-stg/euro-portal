import db from "@/lib/db/db";
import { getClientIp, getUserAgent } from "@/lib/api-logger";

// Pencatatan login (2026-11-11) — lihat model LoginLog. TIDAK BOLEH menggagalkan login: semua
// error ditelan (cukup console.error).
export async function recordLogin(opts: {
  request?: Request | null; employeeId: string; userId?: string | null;
  channel: "PORTAL" | "SSO"; appName?: string | null; success: boolean; reason?: string;
}) {
  try {
    await db.loginLog.create({
      data: {
        userId: opts.userId ?? null, employeeId: opts.employeeId.slice(0, 100), channel: opts.channel,
        appName: opts.appName ?? null, success: opts.success, reason: opts.reason ?? null,
        ip: opts.request ? getClientIp(opts.request) : null,
        userAgent: opts.request ? getUserAgent(opts.request)?.slice(0, 500) ?? null : null,
      },
    });
    if (opts.success && opts.userId) {
      await db.user.update({ where: { id: opts.userId }, data: { lastLoginAt: new Date(), loginCount: { increment: 1 } } });
    }
  } catch (e) {
    console.error("[login-log] gagal mencatat login:", e);
  }
}
