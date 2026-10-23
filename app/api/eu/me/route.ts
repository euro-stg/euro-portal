import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { getEuPostPermission } from "@/lib/eu-permission";
import { getNotifConfig } from "@/lib/system-config";

// Returns whether the current user can create/manage EU posts (has eu-settings module access).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;
    const [{ canPost, isSuperadmin }, notifChannels] = await Promise.all([getEuPostPermission(userId), getNotifConfig()]);

    // notifChannels = saklar global notifikasi — form post memperingatkan kalau kanal yang
    // dicentang sedang dimatikan (supaya tidak dikira bug saat email tidak terkirim).
    return NextResponse.json({ canPost, isSuperadmin, userId, notifChannels });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
