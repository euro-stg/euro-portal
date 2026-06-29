import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { auth } from "@/lib/auth";
import { talentaGet } from "@/lib/talenta";

export const maxDuration = 120;

const COMPANY_ID = "33683";

type TalentaJobPosition = {
  id: number;
  name: string;
  level: number | null;
  description: string | null;
  parent_job_id: number | null;
  branch_id: number | null;
};

type JobPositionResponse = {
  data: {
    job_position: TalentaJobPosition[];
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
    data: { type: "job_position", trigger, status: "running" },
  });

  try {
    const allPositions: TalentaJobPosition[] = [];

    const first = await talentaGet<JobPositionResponse>(
      `/v2/talenta/v2/company/${COMPANY_ID}/job-position?limit=1000&page=1`,
    );
    allPositions.push(...first.data.job_position);

    const totalPage = first.data.pagination.last_page;
    console.log(`📊 Job Position pages: ${totalPage}`);

    for (let page = 2; page <= totalPage; page++) {
      const data = await talentaGet<JobPositionResponse>(
        `/v2/talenta/v2/company/${COMPANY_ID}/job-position?limit=1000&page=${page}`,
      );
      allPositions.push(...data.data.job_position);
    }

    console.log(`📊 Total job positions dari Talenta: ${allPositions.length}`);

    let created = 0;
    let updated = 0;

    for (const pos of allPositions) {
      const id = String(pos.id);
      const payload = {
        name: pos.name,
        level: pos.level ?? null,
        description: pos.description || null,
        parentJobId: pos.parent_job_id != null ? String(pos.parent_job_id) : null,
        branchId: pos.branch_id != null ? String(pos.branch_id) : null,
        syncedAt: new Date(),
      };

      const existing = await prisma.jobPosition.findUnique({ where: { id } });
      if (existing) {
        await prisma.jobPosition.update({ where: { id }, data: payload });
        updated++;
      } else {
        await prisma.jobPosition.create({ data: { id, ...payload } });
        created++;
      }
    }

    const processed = allPositions.length;

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", processed, created, updated, finishedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "✅ Sync Job Position berhasil", processed, created, updated });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "error", error: errMsg, finishedAt: new Date() },
    }).catch(() => null);
    return NextResponse.json({ success: false, message: errMsg }, { status: 500 });
  }
}
