import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteFromNextcloud, fetchFromNextcloud } from "@/lib/nextcloud";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ message: "Path wajib diisi" }, { status: 400 });

  // Sebelumnya bangun URL Nextcloud manual di sini — menduplikasi logic yang sudah ada di
  // app/lib/nextcloud.ts DAN sekaligus bypass auto-failover ke NEXTCLOUD_URL_ALTERNATIF
  // (ditemukan 2026-10-01: E Doc tetap bisa muat file saat domain utama down, SSD/EU tidak,
  // karena route ini & EU yang serupa tidak ikut lewat getNextcloudBaseUrl()). Diganti pakai
  // fetchFromNextcloud yang sudah failover-aware, sama persis yang dipakai E Doc.
  const res = await fetchFromNextcloud(path);

  if (!res.ok) {
    return NextResponse.json({ message: `File tidak ditemukan (${res.status})` }, { status: res.status });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const filename = path.split("/").pop() ?? "file";

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ message: "Path wajib diisi" }, { status: 400 });
  console.log("[ssd/file DELETE] path:", path);

  try {
    await deleteFromNextcloud(path);
    return NextResponse.json({ message: "File dihapus" });
  } catch (err) {
    console.error("[ssd/file DELETE] error:", err);
    return NextResponse.json({ message: err instanceof Error ? err.message : "Gagal menghapus file" }, { status: 500 });
  }
}
