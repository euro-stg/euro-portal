import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { isSuperadmin, isEDocFolderCreator, isEDocDocumentApprover, getUserBusinessUnits } from "@/lib/edoc";

// Profil ringkas user untuk kebutuhan UI E Document: business unit hasil hitung dari
// branchName, dan role flags (Folder Creator / Document Approver / superadmin).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, folderCreator, documentApprover, businessUnits] = await Promise.all([
      isSuperadmin(userId),
      isEDocFolderCreator(userId),
      isEDocDocumentApprover(userId),
      getUserBusinessUnits(userId),
    ]);

    return NextResponse.json({
      userId,
      isSuperadmin: superadmin,
      isFolderCreator: superadmin || folderCreator,
      isDocumentApprover: superadmin || documentApprover,
      businessUnits,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
