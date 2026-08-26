import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { getEuPostPermission } from "@/lib/eu-permission";

// Returns whether the current user can create/manage EU posts (has eu-settings module access).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const userId = session.user.id;
    const { canPost, isSuperadmin } = await getEuPostPermission(userId);

    return NextResponse.json({ canPost, isSuperadmin, userId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
