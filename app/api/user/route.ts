import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db/db";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.user]))) return forbidden();

    const body = await request.json().catch(() => ({}));
    const { employeeId, name, email, password } = body as {
      employeeId?: string; name?: string; email?: string; password?: string;
    };

    if (!employeeId?.trim()) return NextResponse.json({ message: "Employee ID wajib diisi" }, { status: 400 });
    if (!name?.trim())       return NextResponse.json({ message: "Nama wajib diisi" }, { status: 400 });
    if (!password?.trim())   return NextResponse.json({ message: "Password wajib diisi" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ message: "Password minimal 8 karakter" }, { status: 400 });

    const existing = await db.user.findUnique({ where: { employeeId: employeeId.trim() } });
    if (existing) return NextResponse.json({ message: "Employee ID sudah digunakan" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        employeeId: employeeId.trim(),
        name: name.trim(),
        email: email?.trim() || null,
        password: hashed,
        source: "manual",
        status: "active",
      },
      select: { id: true, employeeId: true, name: true, email: true, source: true, status: true, createdAt: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
