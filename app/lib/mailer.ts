import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  await transporter.sendMail({
    from: `"EuroPortal" <${process.env.SMTP_FROM}>`,
    to,
    subject: "Reset Password - EuroPortal",
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
}
