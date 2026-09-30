import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

// Account deletion.
//
// - Never import firebase-admin/auth here: it pulls in jwks-rsa -> jose (ESM-only),
//   which fails under Turbopack on Vercel. Token verification lives in
//   verifyAuth.ts (REST lookup) and the Auth account is deleted via the REST API.
// - The uid comes only from the verified token, never from the request body.
// - Firestore access uses the Admin SDK, which bypasses security rules, so no
//   rule changes are needed for this route.
// - `payments` are intentionally retained (7-year retention in the privacy policy).

const USER_OWNED_COLLECTIONS = [
  "enrollments",
  "topicAttempts",
  "attempts",
  "reviews",
] as const;

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return request.cookies.get("session")?.value ?? null;
}

// Deletes the caller's own Auth account using their own ID token.
async function deleteAuthAccount(
  idToken: string
): Promise<{ ok: true } | { ok: false; recentLoginRequired: boolean }> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => ({}));
    const code: string = body?.error?.message ?? "";
    console.error("Auth account delete failed:", res.status, code);
    // Already gone counts as success so a retry after a partial failure works.
    if (code === "USER_NOT_FOUND") return { ok: true };
    return {
      ok: false,
      recentLoginRequired: code.startsWith("CREDENTIAL_TOO_OLD_LOGIN_AGAIN"),
    };
  } catch (error) {
    console.error("Auth account delete request error:", error);
    return { ok: false, recentLoginRequired: false };
  }
}

async function deleteWhereUserId(collectionName: string, uid: string) {
  const BATCH_SIZE = 500;
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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { allowed } = rateLimit(`delete-account:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await verifyAuthToken(request);
  const idToken = getToken(request);
  if (!user || !idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { uid } = user;

  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted from here." },
        { status: 403 }
      );
    }

    // Auth first: if Firebase rejects the token (e.g. stale sign-in), nothing
    // has been deleted yet and the user can sign in again and retry.
    const authResult = await deleteAuthAccount(idToken);
    if (!authResult.ok) {
      if (authResult.recentLoginRequired) {
        return NextResponse.json(
          {
            error:
              "For security, please sign out, sign back in, and try deleting your account again.",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Could not delete your account. Please try again." },
        { status: 500 }
      );
    }

    for (const name of USER_OWNED_COLLECTIONS) {
      await deleteWhereUserId(name, uid);
    }
    await adminDb.collection("credentialingEnrollments").doc(uid).delete();
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Could not delete your account. Please try again." },
      { status: 500 }
    );
  }
}
