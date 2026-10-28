import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/api/system/smtp/route";
import db from "@/lib/db/db";

async function getTransporter() {
  const cfg = await getSmtpConfig();
  if (!cfg) throw new Error("Konfigurasi SMTP belum diset. Atur di Pengaturan → Email.");
  return {
    transport: nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    }),
    from: `"EuroPortal" <${cfg.from}>`,
  };
}

/** true kalau SMTP sudah dikonfigurasi di Pengaturan Email (host, user, password terisi). */
export async function isSmtpConfigured(): Promise<boolean> {
  return !!(await getSmtpConfig().catch(() => null));
}

export async function logEmail(to: string, subject: string, source: string, status: "sent" | "failed", error?: string) {
  await db.emailLog.create({ data: { to, subject, source, status, error: error ?? null } }).catch(() => null);
}

export const notificationSubject = (title: string) => `[EuroPortal] ${title}`;

/**
 * Kirim satu email notifikasi TANPA mencatat log & tanpa menelan error — hasilnya
 * dikembalikan supaya pemanggil bisa memutuskan (dipakai worker antrean blast untuk retry,
 * app/lib/email-queue.ts). Pemanggil realtime cukup pakai sendNotificationEmail.
 */
export async function deliverNotificationEmail(to: string, title: string, body: string, source = "portal"): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { transport, from } = await getTransporter();
    await transport.sendMail({
      from, to,
      subject: notificationSubject(title),
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="margin:0 0 16px;">
            <span style="display:inline-block;background:#eff6ff;color:#2563eb;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;border:1px solid #bfdbfe;letter-spacing:0.04em;">
              ${source}
            </span>
          </div>
          <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">${title}</h2>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">${body}</p>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;"/>
          <p style="color:#cbd5e1;font-size:11px;margin:0;">© ${new Date().getFullYear()} Euromedica Group — EuroPortal</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Kirim langsung (realtime) + catat ke EmailLog. Tidak pernah throw. */
export async function sendNotificationEmail(to: string, title: string, body: string, source = "portal") {
  const result = await deliverNotificationEmail(to, title, body, source);
  await logEmail(to, notificationSubject(title), source, result.ok ? "sent" : "failed", result.ok ? undefined : result.error);
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const subject = "Reset Password - EuroPortal";
  try {
    const { transport, from } = await getTransporter();
    await transport.sendMail({
      from, to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Reset Password</h2>
          <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Halo ${name},</p>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Kami menerima permintaan untuk mereset password akun EuroPortal kamu.
            Klik tombol di bawah untuk membuat password baru.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;line-height:1.6;">
            Link ini berlaku selama <strong>1 jam</strong>. Jika kamu tidak merasa meminta reset password, abaikan email ini.<br/>
            Atau salin URL berikut ke browser:<br/>
            <span style="word-break:break-all;color:#2563eb;">${resetUrl}</span>
          </p>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;"/>
          <p style="color:#cbd5e1;font-size:11px;margin:0;">© ${new Date().getFullYear()} Euromedica Group — EuroPortal</p>
        </div>
      `,
    });
    await logEmail(to, subject, "system", "sent");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logEmail(to, subject, "system", "failed", msg);
  }
}
