import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db/db";
import { sendPasswordResetEmail } from "@/lib/mailer";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 menit per user

export async function POST(req: NextRequest) {
  try {
    const { employeeId } = await req.json();

    if (!employeeId?.trim()) {
      return NextResponse.json({ message: "Employee ID wajib diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { employeeId: employeeId.trim() } });

    if (!user || !user.email) {
      // Generik agar tidak mengekspos apakah employeeId terdaftar
      return NextResponse.json({ message: "Jika akun ditemukan, link reset akan dikirim ke email terdaftar." });
    }

    // Cooldown per user: cegah spam email ke satu orang
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
      },
    });

    if (recentToken) {
      // Diam-diam return success — jangan ekspos bahwa email baru tidak dikirim
      return NextResponse.json({
        message: "Link reset password berhasil dikirim.",
        employeeId: user.employeeId,
        name: user.name ?? "-",
        email: user.email,
      });
    }

    // Batalkan token lama yang belum dipakai
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const origin = new URL(req.url).origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;

    await sendPasswordResetEmail(user.email, user.name ?? user.employeeId, resetUrl);

    return NextResponse.json({
      message: "Link reset password berhasil dikirim.",
      employeeId: user.employeeId,
      name: user.name ?? "-",
      email: user.email,
    });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan, coba lagi." }, { status: 500 });
  }
}
