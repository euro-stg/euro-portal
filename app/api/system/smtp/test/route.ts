import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/api/system/smtp/route";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { to } = body as { to?: string };

    if (!to?.trim()) return NextResponse.json({ message: "Alamat email tujuan wajib diisi" }, { status: 400 });

    const cfg = await getSmtpConfig();
    if (!cfg) return NextResponse.json({ message: "Konfigurasi SMTP belum lengkap" }, { status: 400 });

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    await transporter.verify();
    await transporter.sendMail({
      from: `"EuroPortal Test" <${cfg.from}>`,
      to: to.trim(),
      subject: "[EuroPortal] Test Email Berhasil",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">✅ Test Email Berhasil</h2>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
            Email ini dikirim dari <strong>EuroPortal</strong> untuk memverifikasi bahwa konfigurasi SMTP berjalan dengan benar.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
            <tr><td style="padding:6px 0;color:#94a3b8;">Host</td><td style="padding:6px 0;color:#334155;font-weight:600;">${cfg.host}:${cfg.port}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">User</td><td style="padding:6px 0;color:#334155;font-weight:600;">${cfg.user}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">Secure</td><td style="padding:6px 0;color:#334155;font-weight:600;">${cfg.secure ? "TLS" : "STARTTLS"}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">Waktu</td><td style="padding:6px 0;color:#334155;font-weight:600;">${new Date().toLocaleString("id-ID")}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 16px;"/>
          <p style="color:#cbd5e1;font-size:11px;margin:0;">© ${new Date().getFullYear()} Euromedica Group — EuroPortal</p>
        </div>
      `,
    });

    return NextResponse.json({ message: `Email berhasil dikirim ke ${to.trim()}` });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Gagal mengirim email";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
