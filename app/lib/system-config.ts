import db from "@/lib/db/db";

type NotifConfig = { inapp: boolean; email: boolean };

let cache: { data: NotifConfig; ts: number } | null = null;
const TTL = 60_000; // 60 detik

export async function getNotifConfig(): Promise<NotifConfig> {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;

  const rows = await db.systemConfig.findMany({
    where: { key: { in: ["notifications.inapp", "notifications.email"] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const data: NotifConfig = {
    inapp: map["notifications.inapp"] !== "false",
    email: map["notifications.email"] !== "false",
  };

  cache = { data, ts: Date.now() };
  return data;
}

export function invalidateNotifCache() {
  cache = null;
}
