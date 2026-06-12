import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { createNotification, notifyMany, findStepUsers } from "@/lib/notifications";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const row = await db.sdRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        requester: { select: { id: true, name: true, jobPositionName: true, organizationName: true } },
        pic: { select: { id: true, name: true } },
        refApp: { select: { id: true, name: true } },
        itDocument: {
          include: {
            creator:  { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
            attachments: true,
          },
        },
        progresses:   { orderBy: { order: "asc" } },
        environments: { orderBy: { createdAt: "asc" } },
        uat: {
          include: { approver: { select: { id: true, name: true } } },
        },
        uatRevisions: {
          include: {
            creator: { select: { id: true, name: true } },
            attachments: true,
          },
          orderBy: { iteration: "asc" },
        },
        attachments: {
          include: { uploader: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!row) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    // Sertakan SdApprovalRequest terkait jika ada
    const approvalRequest = await db.sdApprovalRequest.findUnique({
      where: { sdRequestId: id },
      include: {
        steps: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { step: "asc" },
        },
      },
    });

    return NextResponse.json({ data: { ...row, approvalRequest: approvalRequest ?? null } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, note, picId, estimatedCompletedAt, title, description } = body as {
      action?: string; note?: string; picId?: string;
      estimatedCompletedAt?: string | null; title?: string; description?: string;
    };

    const current = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    // Check portal role dari DB
    const portalRoleRow = await db.userRole.findFirst({
      where: { userId: session.user.id, role: { appId: null, status: "active", deletedAt: null } },
      select: { role: { select: { name: true } } },
    });
    const portalRole = portalRoleRow?.role.name ?? null;
    const isSuperadminUser = portalRole === "superadmin";

    // Query app role sekali, dipakai untuk picId dan estimasi
    const hasAppRole = await db.userRole.findFirst({
      where: { userId: session.user.id, role: { appId: { not: null }, status: "active", deletedAt: null } },
    });

    const isRequesterUser = session.user.id === current.requestedBy;
    const isPicUser = !!(current.picId && session.user.id === current.picId);

    const TRANSITIONS: Record<string, string[]> = {
      // CANCELLED: requester membatalkan (hanya dari DRAFT/SUBMITTED/IT_REVIEW sebelum PIC mulai kerja)
      // REJECTED: IT PIC menolak (dari SUBMITTED/IT_REVIEW/APPROVED_IT/APPROVED_USER/IN_PROGRESS/UAT)
      // UAT_REVISION: PIC kembalikan ke IN_PROGRESS untuk revisi
      // DONE: requester menyetujui di UAT (klik Finish)
      DRAFT:         ["SUBMITTED", "CANCELLED"],
      SUBMITTED:     ["IT_REVIEW", "CANCELLED", "REJECTED"],
      IT_REVIEW:     ["APPROVED_IT", "REJECTED"],
      APPROVED_IT:   ["APPROVED_USER", "REJECTED"],
      APPROVED_USER: ["IN_PROGRESS", "REJECTED"],
      IN_PROGRESS:   ["UAT", "REJECTED"],
      UAT:           ["DONE", "UAT_REVISION"],
      UAT_REVISION:  ["IN_PROGRESS"],
    };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    let activityAction = action ?? "UPDATE";

    if (action && action !== "UPDATE") {
      const allowed = TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(action)) {
        return NextResponse.json(
          { message: `Tidak bisa transisi dari ${current.status} ke ${action}` },
          { status: 400 }
        );
      }

      const userId = session.user.id;

      if (action === "SUBMITTED") {
        if (userId !== current.requestedBy) {
          return NextResponse.json({ message: "Hanya pengaju yang dapat submit pengajuan" }, { status: 403 });
        }
      } else if (action === "CANCELLED") {
        // Hanya requester yang bisa batalkan (sebelum PIC mulai kerja)
        if (userId !== current.requestedBy) {
          return NextResponse.json({ message: "Hanya pengaju yang dapat membatalkan pengajuan" }, { status: 403 });
        }
      } else if (action === "REJECTED") {
        // Hanya IT PIC atau superadmin yang bisa tolak
        const isPic = current.picId && userId === current.picId;
        if (!isPic && !isSuperadminUser) {
          return NextResponse.json({ message: "Hanya IT PIC yang dapat menolak pengajuan" }, { status: 403 });
        }
      } else if (action === "DONE") {
        // Hanya requester yang bisa klik Finish di UAT
        if (userId !== current.requestedBy) {
          return NextResponse.json({ message: "Hanya pengaju yang dapat menyelesaikan UAT" }, { status: 403 });
        }
      } else if (action === "UAT_REVISION") {
        // Requester minta revisi dari UAT
        if (userId !== current.requestedBy) {
          return NextResponse.json({ message: "Hanya pengaju yang dapat meminta revisi UAT" }, { status: 403 });
        }
      } else {
        // IT_REVIEW, APPROVED_IT, APPROVED_USER, IN_PROGRESS, UAT (back from revision) — hanya PIC atau superadmin
        const isPic = userId === current.picId;
        const isSuperadmin = isSuperadminUser;
        if (!isPic && !isSuperadmin) {
          return NextResponse.json({ message: "Hanya IT PIC yang dapat melakukan aksi ini" }, { status: 403 });
        }
      }

      updateData.status = action;
      activityAction = action;
    }

    // Assign PIC: hanya superadmin atau user dengan app role
    if (picId !== undefined) {
      if (!isSuperadminUser && !hasAppRole) {
        return NextResponse.json({ message: "Tidak memiliki izin untuk assign PIC" }, { status: 403 });
      }
      updateData.picId = picId || null;
    }

    // Estimasi selesai:
    // - Superadmin: selalu bisa
    // - Requester: hanya di DRAFT
    // - PIC: tidak pernah bisa
    // - IT staff (app role, bukan PIC): hanya di DRAFT atau SUBMITTED (sebelum approval selesai)
    // - Setelah approval selesai (IT_REVIEW ke atas): terkunci kecuali superadmin
    if (estimatedCompletedAt !== undefined) {
      const planningPhase = ["DRAFT", "SUBMITTED"].includes(current.status);
      const canEditEstimasi =
        isSuperadminUser ||
        (isRequesterUser && current.status === "DRAFT") ||
        (!isRequesterUser && !isPicUser && !!hasAppRole && planningPhase);

      if (!canEditEstimasi) {
        if (isPicUser) {
          return NextResponse.json({ message: "PIC tidak dapat mengubah estimasi selesai" }, { status: 403 });
        }
        if (isRequesterUser) {
          return NextResponse.json({ message: "Pengaju tidak dapat mengubah estimasi setelah pengajuan diproses" }, { status: 403 });
        }
        if (!planningPhase) {
          return NextResponse.json({ message: "Estimasi selesai terkunci setelah approval selesai" }, { status: 403 });
        }
        return NextResponse.json({ message: "Tidak memiliki izin untuk mengubah estimasi selesai" }, { status: 403 });
      }
      updateData.estimatedCompletedAt = estimatedCompletedAt ? new Date(estimatedCompletedAt) : null;
    }
    if (title?.trim())       updateData.title       = title.trim();
    if (description?.trim()) updateData.description = description.trim();

    const updated = await db.sdRequest.update({ where: { id }, data: updateData });

    await db.sdActivity.create({
      data: { requestId: id, userId: session.user.id, action: activityAction, note: note || null },
    });

    // Saat SUBMITTED: auto-create SdApprovalRequest jika ada template aktif
    if (action === "SUBMITTED") {
      const template = await db.sdApprovalTemplate.findFirst({
        where: { active: true, deletedAt: null },
        include: { steps: { orderBy: { step: "asc" } } },
      });

      if (template && template.steps.length > 0) {
        await db.sdApprovalRequest.create({
          data: {
            sdRequestId: id,
            title: current.title,
            submittedBy: session.user.id,
            currentStep: 1,
            status: "PENDING",
            templateId: template.id,
            steps: {
              create: template.steps.map((s) => ({
                step: s.step,
                label: s.label,
                jobPositionId: s.jobPositionId,
                jobPositionName: s.jobPositionName,
                organizationId: s.organizationId,
                organizationName: s.organizationName,
                branchId: s.branchId,
                branchName: s.branchName,
                status: "PENDING",
              })),
            },
          },
        });

        await db.sdActivity.create({
          data: {
            requestId: id,
            userId: session.user.id,
            action: "APPROVAL_CREATED",
            note: `Menunggu approval (${template.steps.length} step)`,
          },
        });

        // Notify approver step 1
        const step1 = template.steps.find((s) => s.step === 1);
        if (step1) {
          const approverIds = await findStepUsers(step1, session.user.id);
          await notifyMany(approverIds, "Pengajuan Baru Menunggu Persetujuan",
            `"${current.title}" dari ${session.user.name ?? "pengaju"} menunggu persetujuan Anda (Step 1: ${step1.label})`,
            "APPROVAL_REQUEST", id, "SD");
        }
      } else {
        // Tidak ada template — langsung notify semua IT (app role) bahwa ada pengajuan baru
        const itUsers = await db.userRole.findMany({
          where: { role: { appId: { not: null }, status: "active", deletedAt: null } },
          select: { userId: true },
        });
        const ids = [...new Set(itUsers.map((r) => r.userId))].filter((uid) => uid !== session.user?.id);
        await notifyMany(ids, "Pengajuan Baru", `"${current.title}" diajukan dan siap direview`, "APPROVAL_REQUEST", id, "SD");
      }
    }

    // Notifikasi berdasarkan perubahan status
    if (action && action !== "UPDATE") {
      const requester = current.requestedBy;
      const pic       = current.picId;
      const title     = current.title;

      if (action === "CANCELLED" && pic && pic !== session.user.id) {
        await createNotification(pic, "Pengajuan Dibatalkan",
          `"${title}" dibatalkan oleh pengaju`, "GENERAL", id, "SD");
      }
      if (action === "REJECTED" && requester !== session.user.id) {
        await createNotification(requester, "Pengajuan Ditolak",
          `"${title}" ditolak`, "APPROVAL_ACTION", id, "SD");
      }
      if (action === "IN_PROGRESS" && requester !== session.user.id) {
        await createNotification(requester, "Revisi Sedang Dikerjakan",
          `PIC mulai mengerjakan revisi untuk "${title}"`, "APPROVAL_ACTION", id, "SD");
      }
      if (action === "DONE") {
        if (requester !== session.user.id)
          await createNotification(requester, "Pengajuan Selesai", `"${title}" telah selesai`, "APPROVAL_ACTION", id, "SD");
        if (pic && pic !== session.user.id)
          await createNotification(pic, "Pengajuan Selesai", `"${title}" telah ditandai selesai`, "APPROVAL_ACTION", id, "SD");
      }
    }

    // Notifikasi saat PIC di-assign
    if (picId && picId !== current.picId) {
      await createNotification(picId, "Anda Ditunjuk sebagai PIC",
        `"${current.title}" perlu ditangani`, "GENERAL", id, "SD");
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const deleteRoleRow = await db.userRole.findFirst({
      where: { userId: session.user.id, role: { appId: null, name: "superadmin", status: "active", deletedAt: null } },
    });
    if (!deleteRoleRow) {
      return NextResponse.json({ message: "Hanya superadmin yang dapat menghapus pengajuan" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    await db.sdRequest.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });

    return NextResponse.json({ message: "Pengajuan dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
