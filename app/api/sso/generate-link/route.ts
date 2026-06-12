import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

// Dipanggil portal saat user klik card apps eksternal.
// Memerlukan: portal session + moduleId (atau appTokenId + redirectUrl).
// Mengembalikan URL redirect lengkap dengan sso_token.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { moduleId, appTokenId: explicitAppTokenId, redirectUrl: explicitRedirectUrl } = body as {
      moduleId?: string;
      appTokenId?: string;
      redirectUrl?: string;
    };

    let appRecord: { id: string; active: boolean; deletedAt: Date | null } | null = null;
    let finalRedirectUrl = explicitRedirectUrl ?? "";

    if (moduleId) {
      // Cari AppToken berdasarkan moduleId
      const mod = await db.module.findFirst({
        where: { id: moduleId, type: "app", isExternal: true, deletedAt: null },
        include: { appToken: true },
      });
      if (!mod)
        return NextResponse.json({ message: "Aplikasi eksternal tidak ditemukan" }, { status: 404 });
      if (!mod.appToken || !mod.appToken.active || mod.appToken.deletedAt)
        return NextResponse.json({ message: "App token untuk aplikasi ini belum dikonfigurasi atau tidak aktif" }, { status: 404 });
      if (!mod.externalUrl)
        return NextResponse.json({ message: "URL aplikasi eksternal belum dikonfigurasi" }, { status: 400 });

      appRecord = mod.appToken;
      finalRedirectUrl = mod.externalUrl;
    } else if (explicitAppTokenId && explicitRedirectUrl) {
      appRecord = await db.appToken.findUnique({ where: { id: explicitAppTokenId } });
      if (!appRecord || !appRecord.active || appRecord.deletedAt)
        return NextResponse.json({ message: "App token tidak valid atau tidak aktif" }, { status: 401 });
    } else {
      return NextResponse.json({ message: "moduleId atau appTokenId + redirectUrl wajib diisi" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.status === "inactive")
      return NextResponse.json({ message: "Akun tidak aktif" }, { status: 403 });

    // Hapus redirect token lama yang belum dipakai
    await db.ssoRedirectToken.deleteMany({
      where: { userId: session.user.id, appTokenId: appRecord.id, usedAt: null },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.ssoRedirectToken.create({
      data: { userId: session.user.id, appTokenId: appRecord.id, token, expiresAt },
    });

    const url = new URL(finalRedirectUrl);
    url.searchParams.set("sso_token", token);

    return NextResponse.json({ redirectUrl: url.toString(), expiresAt });
  } catch (err) {
    console.error("[SSO GenerateLink]", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
