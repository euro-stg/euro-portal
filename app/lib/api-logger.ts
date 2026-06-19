import db from "@/lib/db/db";

type ApiLogData = {
  appTokenId?: string | null;
  appName?: string | null;
  userId?: string | null;
  method: string;
  endpoint: string;
  status: "SUCCESS" | "FAILED";
  statusCode?: number;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
  duration?: number;
};

export function writeApiLog(data: ApiLogData) {
  db.apiLog.create({ data }).catch(() => {}); // fire-and-forget
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent") ?? null;
}
