import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

// Heartbeat status online. Dibatasi per instance: tulis ke DB paling cepat tiap 45 dtk per user.
const lastWrite = new Map<string, number>();
const MIN_GAP_MS = 45_000;

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const raw = typeof body?.path === "string" ? body.path : "";
    const path = raw.startsWith("/") ? raw.slice(0, 200) : null;

    const now = Date.now();
    if (now - (lastWrite.get(userId) ?? 0) >= MIN_GAP_MS) {
      lastWrite.set(userId, now);
      if (lastWrite.size > 5000) lastWrite.clear();
      const at = new Date(now);
      await db.userPresence.upsert({
        where: { userId },
        create: { userId, lastSeenAt: at, path },
        update: { lastSeenAt: at, path },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
