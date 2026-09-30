import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { rateLimit } from "@/lib/rateLimit";

// Verify token using Firebase REST API (avoids firebase-admin/auth ESM issue)
async function verifyToken(
  request: NextRequest
): Promise<{ uid: string } | null> {
  try {
    const authHeader = request.headers.get("Authorization");
    const sessionCookie = request.cookies.get("session")?.value;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : sessionCookie;

    if (!token) return null;

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return null;

    return { uid: user.localId };
  } catch {
    return null;
  }
}

// Delete Firebase Auth account using REST API (avoids firebase-admin/auth ESM issue)
async function deleteAuthAccount(idToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Batch delete Firestore documents
async function batchDelete(docRefs: FirebaseFirestore.DocumentReference[]) {
  const BATCH_SIZE = 500;
  for (let i = 0; i < docRefs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    docRefs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`delete-account:${ip}`, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify auth
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = user;

  // Get the token for Auth deletion
  const authHeader = request.headers.get("Authorization");
  const sessionCookie = request.cookies.get("session")?.value;
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : sessionCookie ?? "";

  try {
    // 1. Delete enrollments
    const enrollmentsSnap = await adminDb
      .collection("enrollments")
      .where("userId", "==", uid)
      .get();
    await batchDelete(enrollmentsSnap.docs.map((d) => d.ref));

    // 2. Delete topic attempts
    const topicAttemptsSnap = await adminDb
      .collection("topicAttempts")
      .where("userId", "==", uid)
      .get();
    await batchDelete(topicAttemptsSnap.docs.map((d) => d.ref));

    // 3. Delete legacy attempts
    const attemptsSnap = await adminDb
      .collection("attempts")
      .where("userId", "==", uid)
      .get();
    await batchDelete(attemptsSnap.docs.map((d) => d.ref));

    // 4. Delete reviews
    const reviewsSnap = await adminDb
      .collection("reviews")
      .where("userId", "==", uid)
      .get();
    await batchDelete(reviewsSnap.docs.map((d) => d.ref));

    // 5. Delete credentialing enrollment if exists
    const credSnap = await adminDb
      .collection("credentialingEnrollments")
      .doc(uid)
      .get();
    if (credSnap.exists) {
      await adminDb.collection("credentialingEnrollments").doc(uid).delete();
    }

    // 6. Delete user document
    await adminDb.collection("users").doc(uid).delete();

    // 7. Delete Firebase Auth account via REST API
    await deleteAuthAccount(idToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}