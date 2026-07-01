import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteFromNextcloud } from "@/lib/nextcloud";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ message: "Path wajib diisi" }, { status: 400 });

  const user = process.env.NEXTCLOUD_USER;
  const pass = process.env.NEXTCLOUD_PASS;
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";

  if (!user || !pass) return NextResponse.json({ message: "Nextcloud belum dikonfigurasi" }, { status: 503 });

  const url = `${base}/remote.php/dav/files/${user}/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
    },
  });

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
