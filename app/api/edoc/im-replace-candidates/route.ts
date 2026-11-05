import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { searchReplaceCandidates } from "@/lib/im-replacement";

// Kandidat IM lama untuk "Menggantikan IM" (2026-11-05): IM Release yang belum digantikan &
// bisa dilihat user ini. ?q= (min. 2 huruf) &excludeFileId=
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const sp = new URL(request.url).searchParams;
    return NextResponse.json({ data: await searchReplaceCandidates(session.user.id, sp.get("q") ?? "", sp.get("excludeFileId")) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
