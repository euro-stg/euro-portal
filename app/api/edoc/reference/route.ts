import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

// Data referensi untuk form E Document (ACL editor, create-file, dst). Branch & Position
// diambil dari nilai distinct di User (branchId/branchName, jobPositionId/jobPositionName)
// karena tabel master Branch & JobPosition kosong di environment ini — User yang jadi
// sumber kebenaran sesungguhnya (sama seperti getUserFolderAccess/getUserBusinessUnits).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const [branchUsers, positionUsers, organizations, businessUnits, categories, branchPrefixMappings] = await Promise.all([
      db.user.findMany({ where: { branchId: { not: null } }, select: { branchId: true, branchName: true }, distinct: ["branchId"] }),
      db.user.findMany({ where: { jobPositionId: { not: null } }, select: { jobPositionId: true, jobPositionName: true }, distinct: ["jobPositionId"] }),
      db.organization.findMany({ where: { deletedAt: null }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
      db.eDocBusinessUnit.findMany({ where: { status: "active" }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
      db.eDocCategory.findMany({
        where: { deletedAt: null, status: "active" },
        select: { id: true, code: true, name: true, categoryTypes: { select: { id: true, code: true, name: true } } },
        orderBy: { name: "asc" },
      }),
      // Dipakai frontend untuk auto-checklist Branch yang prefix-nya terkait begitu suatu
      // Business Unit dipilih di form upload — sama persis pemetaan yang dipakai
      // getUserBusinessUnits untuk resolve BU seorang user dari branchName-nya.
      db.eDocBranchPrefixMapping.findMany({ select: { prefix: true, businessUnitCodes: true } }),
    ]);

    return NextResponse.json({
      branches: branchUsers
        .filter((b) => b.branchId)
        .map((b) => ({ id: b.branchId as string, name: b.branchName ?? b.branchId }))
        .sort((a, b) => a.name!.localeCompare(b.name!)),
      positions: positionUsers
        .filter((p) => p.jobPositionId)
        .map((p) => ({ id: p.jobPositionId as string, name: p.jobPositionName ?? p.jobPositionId }))
        .sort((a, b) => a.name!.localeCompare(b.name!)),
      organizations,
      businessUnits,
      categories,
      branchPrefixMappings,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
