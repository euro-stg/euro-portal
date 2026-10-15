import db from "@/lib/db/db";
import { sendNotificationEmail } from "@/lib/mailer";
import { sseEmit } from "@/lib/sse-emitter";
import { matchCriteriaUsers } from "@/lib/edoc";
import { getNotifConfig } from "@/lib/system-config";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Blast notifikasi untuk satu post Euro Update (2026-10-15). Dikirim hanya kalau post sudah
 * publish, punya minimal satu kanal (notifyInApp / notifyEmail) & kriteria, dan BELUM pernah
 * dikirim (notifiedAt null) — jadi aman dipanggil setiap kali post dibuat/diubah. Penerima =
 * user aktif yang cocok salah satu kriteria (OR), sama dengan Kriteria Email Blast E Document;
 * penulis post sendiri tidak ikut. Tidak pernah throw: gagal kirim tidak boleh menggagalkan
 * penyimpanan post. `origin` = base URL portal untuk link di email.
 */
export async function sendEuPostNotification(postId: string, origin: string): Promise<void> {
  try {
    const post = await db.euPost.findFirst({
      where: { id: postId, deletedAt: null },
      include: { category: { select: { name: true } } },
    });
    if (!post || !post.publishedAt || post.notifiedAt) return;
    if (!post.notifyInApp && !post.notifyEmail) return;

    const criteria = {
      branchIds: post.notifyBranchIds, orgIds: post.notifyOrgIds,
      positionIds: post.notifyPositionIds, businessUnitCodes: post.notifyBusinessUnitCodes,
    };
    // Kanal efektif = pilihan penulis post DAN saklar global notifikasi (menu Pengaturan
    // Notifikasi) — sama seperti notifikasi portal lainnya.
    const config = await getNotifConfig();
    const sendInApp = post.notifyInApp && config.inapp;
    const sendEmail = post.notifyEmail && config.email;
    const recipients = sendInApp || sendEmail
      ? (await matchCriteriaUsers(criteria, { requireEmail: false })).filter((u) => u.id !== post.authorId)
      : [];

    // Tandai terkirim DULU (klaim atomik) supaya dua request bersamaan tidak mengirim dobel.
    // Tetap ditandai walau 0 penerima (mis. kanal dimatikan global) supaya tidak terkirim
    // belakangan secara tak terduga saat saklar global dinyalakan lagi.
    const claimed = await db.euPost.updateMany({
      where: { id: postId, notifiedAt: null },
      data: { notifiedAt: new Date(), notifiedCount: recipients.length },
    });
    if (claimed.count === 0 || recipients.length === 0) return;

    const title = `${post.category?.name ?? "Euro Update"}: ${post.title}`;
    const excerpt = post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    const refUrl = `/apps/euro-update?post=${post.id}`;

    if (sendInApp) {
      await db.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id, title, body: excerpt, type: "GENERAL", refId: post.id, appType: "EU", refUrl,
        })),
      });
      recipients.forEach((u) => sseEmit(u.id, { type: "notification" }));
    }

    if (sendEmail) {
      const body = `${escapeHtml(excerpt)}${excerpt.length >= 160 ? "…" : ""}<br/><br/>` +
        `<a href="${origin}${refUrl}" style="color:#2563eb;">Buka di EuroPortal</a>`;
      for (const u of recipients) {
        if (u.email) sendNotificationEmail(u.email, escapeHtml(title), body, "Euro Update").catch(() => null);
      }
    }
  } catch (e) {
    console.error("[eu] gagal mengirim notifikasi post", e);
  }
}

/** Ambil & validasi field notifikasi dari body request (POST/PATCH /api/eu/post). */
export function parseEuNotifyInput(body: Record<string, unknown>) {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : undefined);
  const data = {
    ...(body.notifyInApp !== undefined && { notifyInApp: Boolean(body.notifyInApp) }),
    ...(body.notifyEmail !== undefined && { notifyEmail: Boolean(body.notifyEmail) }),
    ...(list(body.notifyBranchIds) && { notifyBranchIds: list(body.notifyBranchIds) }),
    ...(list(body.notifyOrgIds) && { notifyOrgIds: list(body.notifyOrgIds) }),
    ...(list(body.notifyPositionIds) && { notifyPositionIds: list(body.notifyPositionIds) }),
    ...(list(body.notifyBusinessUnitCodes) && { notifyBusinessUnitCodes: list(body.notifyBusinessUnitCodes) }),
  };
  const wantsNotify = Boolean(body.notifyInApp) || Boolean(body.notifyEmail);
  const hasCriteria = [body.notifyBranchIds, body.notifyOrgIds, body.notifyPositionIds, body.notifyBusinessUnitCodes]
    .some((v) => Array.isArray(v) && v.length > 0);
  const error = wantsNotify && !hasCriteria ? "Pilih minimal satu kriteria penerima notifikasi" : null;
  return { data, error };
}
