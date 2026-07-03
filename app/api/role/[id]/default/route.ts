import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db/db";

const VALID_SCOPES = [
  "ALL",
  "ORGANIZATION", "POSITION", "BRANCH",
  "ORGANIZATION_POSITION", "ORGANIZATION_BRANCH", "POSITION_BRANCH",
  "ORGANIZATION_POSITION_BRANCH",
];

const needsOrg      = (s: string) => s.includes("ORGANIZATION");
const needsPosition = (s: string) => s.includes("POSITION");
const needsBranch   = (s: string) => s.includes("BRANCH");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { isDefault, defaultScope, defaultOrgId, defaultPositionId, defaultBranchId } = body as {
      isDefault?: boolean;
      defaultScope?: string;
      defaultOrgId?: string | null;
      defaultPositionId?: string | null;
      defaultBranchId?: string | null;
    };

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });

    if (isDefault) {
      if (!defaultScope || !VALID_SCOPES.includes(defaultScope))
        return NextResponse.json({ message: "Scope tidak valid" }, { status: 400 });
      if (needsOrg(defaultScope) && !defaultOrgId)
        return NextResponse.json({ message: "Organisasi wajib dipilih untuk scope ini" }, { status: 400 });
      if (needsPosition(defaultScope) && !defaultPositionId)
        return NextResponse.json({ message: "Jabatan wajib dipilih untuk scope ini" }, { status: 400 });
      if (needsBranch(defaultScope) && !defaultBranchId)
        return NextResponse.json({ message: "Branch wajib dipilih untuk scope ini" }, { status: 400 });
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        isDefault:          Boolean(isDefault),
        defaultScope:       isDefault ? (defaultScope ?? null) : null,
        defaultOrgId:       isDefault && needsOrg(defaultScope ?? "")      ? (defaultOrgId ?? null)      : null,
        defaultPositionId:  isDefault && needsPosition(defaultScope ?? "")  ? (defaultPositionId ?? null)  : null,
        defaultBranchId:    isDefault && needsBranch(defaultScope ?? "")    ? (defaultBranchId ?? null)    : null,
        updatedAt:          new Date(),
      },
    });

    return NextResponse.json({ message: "Default role berhasil diperbarui", data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
