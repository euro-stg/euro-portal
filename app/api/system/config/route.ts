import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { invalidateNotifCache } from "@/lib/system-config";

const NOTIF_KEYS = ["notifications.inapp", "notifications.email"] as const;
type NotifKey = (typeof NOTIF_KEYS)[number];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const rows = await db.systemConfig.findMany({ where: { key: { in: [...NOTIF_KEYS] } } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const data = {
      "notifications.inapp": map["notifications.inapp"] !== "false",
      "notifications.email": map["notifications.email"] !== "false",
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    const updates: { key: NotifKey; value: string }[] = [];
    for (const key of NOTIF_KEYS) {
      if (typeof body[key] === "boolean") {
        updates.push({ key, value: body[key] ? "true" : "false" });
      }
    }

    if (updates.length === 0)
      return NextResponse.json({ message: "Tidak ada perubahan" }, { status: 400 });

    await Promise.all(
      updates.map(({ key, value }) =>
        db.systemConfig.upsert({
          where: { key },
          create: { key, value, updatedBy: session.user?.id ?? null },
          update: { value, updatedBy: session.user?.id ?? null },
        })
      )
    );

    invalidateNotifCache();

    return NextResponse.json({ message: "Konfigurasi disimpan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
