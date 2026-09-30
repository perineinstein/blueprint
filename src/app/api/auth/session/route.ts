import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rateLimit";

// Verify Firebase ID token using Google's public key REST API
// This avoids firebase-admin ESM compatibility issues on Vercel/Turbopack
async function verifyFirebaseToken(idToken: string): Promise<{ uid: string } | null> {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
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

    return { uid: user.localId };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`session:${ip}`, {
    windowMs: 15 * 60 * 1000,
    max: 20,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // Verify token with Firebase REST API — no Admin SDK needed
    const verified = await verifyFirebaseToken(idToken);
    if (!verified) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return NextResponse.json({ success: true });
}