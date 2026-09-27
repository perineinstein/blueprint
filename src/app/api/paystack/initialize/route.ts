import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {

    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = rateLimit(`payment-init:${ip}`, {
      windowMs: 60 * 1000,  // 1 minute
      max: 5,               // 5 payment attempts per minute per IP
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
    // ── 1. Verify the caller is authenticated ────────────
    const verifiedUser = await verifyAuthToken(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { courseId } = body;

    // ── 2. Use server-verified userId — NEVER trust client ──
    const userId = verifiedUser.uid;
    const userEmail = verifiedUser.email;

    if (!courseId) {
      return NextResponse.json(
        { error: "Missing courseId" },
        { status: 400 }
      );
    }

    // ── 3. Verify course exists and is published ─────────
    const courseDoc = await adminDb.collection("courses").doc(courseId).get();
    if (!courseDoc.exists || !courseDoc.data()?.published) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    const course = courseDoc.data()!;

    // ── 4. Check not already enrolled ───────────────────
    const enrollmentId = `${userId}_${courseId}`;
    const enrollmentDoc = await adminDb
      .collection("enrollments")
      .doc(enrollmentId)
      .get();

    if (enrollmentDoc.exists && enrollmentDoc.data()?.status === "active") {
      return NextResponse.json(
        { error: "Already enrolled" },
        { status: 400 }
      );
    }

    // ── 5. Generate reference ───────────────────────────
    const reference = `BLP-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    // ── 6. Record pending payment ────────────────────────
    await adminDb.collection("payments").doc(reference).set({
      userId,         // server-verified
      courseId,
      amount: course.price,
      currency: "GHS",
      status: "pending",
      paystackRef: reference,
      createdAt: FieldValue.serverTimestamp(),
    });

    // ── 7. Initialize Paystack ───────────────────────────
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          amount: course.price,
          currency: "GHS",
          reference,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${courseId}?payment=success`,
          metadata: {
            courseId,
            userId,   // server-derived, embedded in metadata
            courseName: course.title,
            cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${courseId}`,
          },
        }),
      }
    );

    const data = await response.json();
    if (!data.status) {
      return NextResponse.json(
        { error: "Payment initialization failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error("Payment init error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}