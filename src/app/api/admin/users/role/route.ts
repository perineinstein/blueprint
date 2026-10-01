import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAdminToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

// Super-admin-only role changes. Done server-side (Admin SDK) so the
// Firestore rules can keep users from ever writing their own `role`.
const ASSIGNABLE_ROLES = [
  "student",
  "admin_nclex",
  "admin_ielts",
  "super_admin",
] as const;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { allowed } = rateLimit(`role-change:${ip}`, {
    windowMs: 60 * 1000,
    max: 30,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await verifyAdminToken(request);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only super_admin (and legacy "admin") can manage roles.
  if (caller.adminTrack || (caller.role !== "super_admin" && caller.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { uid, role } = await request.json();

    if (
      typeof uid !== "string" ||
      !uid ||
      !ASSIGNABLE_ROLES.includes(role)
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Prevent a super admin locking themselves out of the platform.
    if (uid === caller.uid) {
      return NextResponse.json(
        { error: "You cannot change your own role." },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await ref.update({ role });
    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error("Role change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
