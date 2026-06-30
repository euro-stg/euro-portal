import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { encrypt, decrypt } from "@/lib/encryption";

const SMTP_KEYS = ["smtp.host", "smtp.port", "smtp.secure", "smtp.user", "smtp.pass", "smtp.from"] as const;
type SmtpKey = (typeof SMTP_KEYS)[number];
const ENCRYPTED_KEYS: SmtpKey[] = ["smtp.pass"];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const rows = await db.systemConfig.findMany({ where: { key: { in: [...SMTP_KEYS] } } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return NextResponse.json({
      data: {
        host:   map["smtp.host"]   ?? "",
        port:   map["smtp.port"]   ?? "587",
        secure: map["smtp.secure"] ?? "false",
        user:   map["smtp.user"]   ?? "",
        // password tidak pernah dikembalikan ke UI — hanya status apakah sudah diset
        hasPass: !!map["smtp.pass"],
        from:   map["smtp.from"]   ?? "",
      },
    });
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
    const { host, port, secure, user, pass, from } = body as {
      host?: string; port?: string; secure?: boolean;
      user?: string; pass?: string; from?: string;
    };

    const updates: { key: SmtpKey; value: string }[] = [];
    if (host  !== undefined) updates.push({ key: "smtp.host",   value: host.trim() });
    if (port  !== undefined) updates.push({ key: "smtp.port",   value: String(port) });
    if (secure !== undefined) updates.push({ key: "smtp.secure", value: secure ? "true" : "false" });
    if (user  !== undefined) updates.push({ key: "smtp.user",   value: user.trim() });
    if (from  !== undefined) updates.push({ key: "smtp.from",   value: from.trim() });
    if (pass?.trim()) {
      updates.push({ key: "smtp.pass", value: encrypt(pass.trim()) });
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

    return NextResponse.json({ message: "Konfigurasi SMTP disimpan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Helper: ambil config SMTP dari DB untuk dipakai nodemailer
export async function getSmtpConfig() {
  const rows = await db.systemConfig.findMany({ where: { key: { in: [...SMTP_KEYS] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  if (!map["smtp.host"] || !map["smtp.user"] || !map["smtp.pass"]) return null;

  return {
    host:   map["smtp.host"],
    port:   Number(map["smtp.port"] ?? 587),
    secure: map["smtp.secure"] === "true",
    user:   map["smtp.user"],
    pass:   decrypt(map["smtp.pass"]),
    from:   map["smtp.from"] ?? map["smtp.user"],
  };
}
