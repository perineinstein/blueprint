import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export interface VerifiedUser {
  uid: string;
  email?: string;
  role?: string;
  adminTrack?: "nclex" | "ielts" | null; // which track this admin manages
}

// Kept inline (not imported from @/types) so server code does not pull in a
// client-side module. Keep in sync with the helpers in src/types/index.ts.
const ADMIN_ROLES = ["super_admin", "admin_nclex", "admin_ielts", "admin"];

function getAdminTrack(role: string): "nclex" | "ielts" | null {
  if (role === "admin_nclex") return "nclex";
  if (role === "admin_ielts") return "ielts";
  return null;
}

async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return null;

    return { uid: user.localId, email: user.email };
  } catch {
    return null;
  }
}

export async function verifyAuthToken(
  request: NextRequest
): Promise<VerifiedUser | null> {
  try {
    const authHeader = request.headers.get("Authorization");
    const sessionCookie = request.cookies.get("session")?.value;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : sessionCookie;

    if (!token) return null;

    const verified = await verifyFirebaseToken(token);
    if (!verified) return null;

    return { uid: verified.uid, email: verified.email };
  } catch {
    return null;
  }
}

export async function verifyAdminToken(
  request: NextRequest
): Promise<VerifiedUser | null> {
  const user = await verifyAuthToken(request);
  if (!user) return null;

  try {
    const userDoc = await adminDb.collection("users").doc(user.uid).get();
    const role = userDoc.data()?.role;
    if (!userDoc.exists || typeof role !== "string" || !ADMIN_ROLES.includes(role)) {
      return null;
    }
    return { ...user, role, adminTrack: getAdminTrack(role) };
  } catch {
    return null;
  }
}