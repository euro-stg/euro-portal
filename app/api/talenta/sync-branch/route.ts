import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { auth } from "@/lib/auth";
import { talentaGet } from "@/lib/talenta";

export const maxDuration = 120;

type TalentaBranch = {
  id: number;
  name: string;
  parent_branch_id: number | null;
  address: string | null;
  regency_name: string | null;
  province_name: string | null;
  postal_code: number | null;
  phone: string | null;
  fax_number: string | null;
  klu_code: string | null;
};

type BranchResponse = {
  data: {
    branches: TalentaBranch[];
    pagination: { current_page: number; last_page: number };
  };
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");
  const isScheduled = secret && secret === process.env.SYNC_SECRET;

  if (!isScheduled) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const trigger = isScheduled ? "scheduled" : "manual";

  const log = await prisma.syncLog.create({
    data: { type: "branch", trigger, status: "running" },
  });

  try {
    const allBranches: TalentaBranch[] = [];

    const first = await talentaGet<BranchResponse>("/v2/talenta/v3/company/branch?limit=1000&page=1");
    allBranches.push(...first.data.branches);

    const totalPage = first.data.pagination.last_page;
    for (let page = 2; page <= totalPage; page++) {
      const data = await talentaGet<BranchResponse>(`/v2/talenta/v3/company/branch?limit=1000&page=${page}`);
      allBranches.push(...data.data.branches);
    }

    console.log(`📊 Total branches dari Talenta: ${allBranches.length}`);

    let created = 0;
    let updated = 0;

    for (const b of allBranches) {
      const id = String(b.id);
      const payload = {
        name: b.name,
        parentBranchId: b.parent_branch_id != null ? String(b.parent_branch_id) : null,
        address: b.address || null,
        regencyName: b.regency_name || null,
        provinceName: b.province_name || null,
        postalCode: b.postal_code ?? null,
        phone: b.phone || null,
        faxNumber: b.fax_number || null,
        kluCode: b.klu_code || null,
        syncedAt: new Date(),
      };

      const existing = await prisma.branch.findUnique({ where: { id } });
      if (existing) {
        await prisma.branch.update({ where: { id }, data: payload });
        updated++;
      } else {
        await prisma.branch.create({ data: { id, ...payload } });
        created++;
      }
    }

    const processed = allBranches.length;

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", processed, created, updated, finishedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "✅ Sync Branch berhasil", processed, created, updated });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "error", error: errMsg, finishedAt: new Date() },
    }).catch(() => null);
    return NextResponse.json({ success: false, message: errMsg }, { status: 500 });
  }
}
