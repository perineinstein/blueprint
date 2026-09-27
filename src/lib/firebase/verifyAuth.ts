import { adminAuth } from "@/lib/firebase/admin";
import { NextRequest } from "next/server";

export interface VerifiedUser {
  uid: string;
  email: string | undefined;
  role?: string;
}

export async function verifyAuthToken(
  request: NextRequest
): Promise<VerifiedUser | null> {
  try {
    // Get token from Authorization header or session cookie
    const authHeader = request.headers.get("Authorization");
    const sessionCookie = request.cookies.get("session")?.value;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : sessionCookie;

    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

export async function verifyAdminToken(
  request: NextRequest
): Promise<VerifiedUser | null> {
  const { adminDb } = await import("@/lib/firebase/admin");

  const user = await verifyAuthToken(request);
  if (!user) return null;

  const userDoc = await adminDb.collection("users").doc(user.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== "admin") return null;

  return { ...user, role: "admin" };
}