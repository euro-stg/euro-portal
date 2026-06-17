import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db/db";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password minimal 8 karakter" }, { status: 400 });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken) {
      return NextResponse.json({ message: "Link tidak valid atau sudah digunakan" }, { status: 400 });
    }

    if (resetToken.usedAt) {
      return NextResponse.json({ message: "Link sudah digunakan" }, { status: 400 });
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ message: "Link sudah kadaluarsa, minta link baru" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: "Password berhasil diubah" });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan, coba lagi." }, { status: 500 });
  }
}
