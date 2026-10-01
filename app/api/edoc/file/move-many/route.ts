import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, moveEDocFile } from "@/lib/edoc";

// "Pindahkan N File" (2026-09-30) — versi massal dari POST /api/edoc/file/[id]/move, untuk
// kasus banyak file sekaligus salah folder (effort besar kalau harus buka satu-satu).
// Sengaja 1 endpoint (bukan client loop N request) — satu kali validasi folder tujuan,
// satu kali pengecekan izin per file, dan hasilnya dilaporkan per-file (bukan transaksi
// all-or-nothing, karena moveEDocFile sendiri juga bukan operasi atomik lintas file —
// tiap file punya fisik Nextcloud sendiri yang dipindah satu per satu). Izin per file SAMA
// PERSIS seperti /move: uploader file itu sendiri, atau superadmin — file yang bukan
// uploader-nya dan bukan superadmin dilaporkan gagal, tidak diam-diam dilewati.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;
    const superadmin = await isSuperadmin(userId);

    const body = await request.json().catch(() => ({}));
    const fileIds = Array.isArray((body as { fileIds?: unknown })?.fileIds)
      ? (body as { fileIds: unknown[] }).fileIds.filter((v): v is string => typeof v === "string")
      : [];
    const folderId = typeof (body as { folderId?: unknown })?.folderId === "string" ? (body as { folderId: string }).folderId : null;
    if (fileIds.length === 0) return NextResponse.json({ message: "fileIds wajib diisi" }, { status: 400 });
    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });

    const dest = await db.eDocFolder.findFirst({ where: { id: folderId, deletedAt: null }, select: { type: true } });
    if (!dest) return NextResponse.json({ message: "Folder tujuan tidak ditemukan" }, { status: 404 });
    if (dest.type === "OBSOLETE") return NextResponse.json({ message: "Tidak bisa pindah ke folder Obsolete" }, { status: 400 });

    const uniqueIds = Array.from(new Set(fileIds));
    const files = await db.eDocFile.findMany({ where: { id: { in: uniqueIds }, deletedAt: null }, select: { id: true, title: true, uploadedBy: true } });

    const moved: string[] = [];
    const failed: { id: string; title: string; message: string }[] = [];

    for (const fid of uniqueIds) {
      const file = files.find((f) => f.id === fid);
      if (!file) { failed.push({ id: fid, title: "-", message: "File tidak ditemukan" }); continue; }
      if (!superadmin && file.uploadedBy !== userId) {
        failed.push({ id: fid, title: file.title, message: "Bukan pembuat file ini" });
        continue;
      }
      try {
        await moveEDocFile(fid, folderId);
        moved.push(fid);
      } catch (e) {
        failed.push({ id: fid, title: file.title, message: e instanceof Error ? e.message : "Gagal memindahkan" });
      }
    }

    return NextResponse.json({ movedCount: moved.length, failed });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
