import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

// Account self-deletion.
//
// Security rules note: every read/write here goes through the Firebase Admin
// SDK, which bypasses Firestore security rules, so NO rule changes are needed
// for this endpoint. The safety boundary is this route itself:
//   - the caller must present a valid Firebase ID token (verifyAuthToken)
//   - the uid to delete comes ONLY from that verified token, never from the
//     request body or query string, so a user can only delete themselves.

// Root collections that hold a `userId` field pointing at the student.
const USER_OWNED_COLLECTIONS = [
  "enrollments",
  "topicAttempts",
  "attempts",
  "reviews",
] as const;

// Firestore batches are limited to 500 writes.
const BATCH_SIZE = 500;

async function deleteWhereUserId(collectionName: string, uid: string) {
  for (;;) {
    const snap = await adminDb
      .collection(collectionName)
      .where("userId", "==", uid)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) return;

    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    if (snap.size < BATCH_SIZE) return;
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`delete-account:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // a + b. Authenticate; uid comes from the verified token only.
  const verified = await verifyAuthToken(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = verified.uid;

  try {
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // Prevent accidentally locking everyone out of administration.
    if (userSnap.exists && userSnap.data()?.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted from here." },
        { status: 403 }
      );
    }

    // c. Delete Firestore data. Payment records in `payments` are deliberately
    // kept for legal/accounting retention (see the Privacy Policy).
    for (const name of USER_OWNED_COLLECTIONS) {
      await deleteWhereUserId(name, uid);
    }
    await adminDb.collection("credentialingEnrollments").doc(uid).delete();

    // The user doc goes last: if an earlier step throws, the account is still
    // intact and the user can simply retry.
    await userRef.delete();

    // d. Delete the Firebase Auth account.
    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/user-not-found") throw err;
    }

    // e.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Could not delete your account. Please try again." },
      { status: 500 }
    );
  }
}
