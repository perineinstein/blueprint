import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { CREDENTIALING_PHASES } from "@/types";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`webhook:${ip}`, {
    windowMs: 60 * 1000,
    max: 100,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  // ── 1. Verify Paystack HMAC signature ─────────────────────
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");

  const validSignature =
    !!signature &&
    signature.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));

  if (!validSignature) {
    console.error("Invalid Paystack signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);

  // ── 2. Only handle successful charges ─────────────────────
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  try {
    const reference = event.data?.reference;

    if (!reference) {
      return NextResponse.json({ received: true });
    }

    // ── 3. Idempotency + load recorded payment ─────────────
    const paymentDoc = await adminDb
      .collection("payments")
      .doc(reference)
      .get();

    if (!paymentDoc.exists) {
      console.error("Unknown payment reference:", reference);
      return NextResponse.json({ received: true });
    }

    const recorded = paymentDoc.data()!;

    if (recorded.status === "success") {
      return NextResponse.json({ received: true }); // Already processed
    }

    // ── 4. Verify with Paystack API ────────────────────────
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      console.error("Payment verification failed:", verifyData);
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // ── 5. Verify amount + currency match recorded values ──
    if (
      verifyData.data.amount !== recorded.amount ||
      verifyData.data.currency !== recorded.currency
    ) {
      console.error(
        "Amount/currency mismatch — recorded:",
        recorded.amount,
        recorded.currency,
        "received:",
        verifyData.data.amount,
        verifyData.data.currency
      );
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    // ── 6. Verify userId matches ───────────────────────────
    const userId = recorded.userId;
    if (!userId) {
      console.error("No userId on payment record:", reference);
      return NextResponse.json({ received: true });
    }

    // ── 7. Mark payment successful ─────────────────────────
    await adminDb.collection("payments").doc(reference).update({
      status: "success",
      verifiedAt: FieldValue.serverTimestamp(),
    });

    // ── 8. Route to correct enrollment type ───────────────
    const paymentType = recorded.type;

    if (paymentType === "credentialing") {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const phases = CREDENTIALING_PHASES.map((p) => ({
        index: p.index,
        name: p.name,
        status: "not_started",
        startedAt: null,
        completedAt: null,
        notes: "",
        updatedAt: null,
        updatedBy: null,
      }));

      await adminDb
        .collection("credentialingEnrollments")
        .doc(userId)
        .set({
          userId,
          status: "active",
          paymentReference: reference,
          enrolledAt: FieldValue.serverTimestamp(),
          expiryDate,
          currentPhaseIndex: 0,
          phases,
        });

      console.log(`✅ Credentialing enrollment created for ${userId}`);
      return NextResponse.json({ received: true });
    }

    // ── 9. Regular course enrollment ──────────────────────
    const courseId = recorded.courseId;
    if (!courseId) {
      console.error("No courseId on payment record:", reference);
      return NextResponse.json({ received: true });
    }

    const enrollmentId = `${userId}_${courseId}`;

    // Check not already enrolled
    const existingEnrollment = await adminDb
      .collection("enrollments")
      .doc(enrollmentId)
      .get();

    if (
      existingEnrollment.exists &&
      existingEnrollment.data()?.status === "active"
    ) {
      return NextResponse.json({ received: true }); // Idempotent
    }

    // Get course access duration
    const courseDoc = await adminDb
      .collection("courses")
      .doc(courseId)
      .get();
    const accessDays = courseDoc.data()?.accessDurationDays ?? 365;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + accessDays);

    await adminDb.collection("enrollments").doc(enrollmentId).set({
      userId,
      courseId,
      status: "active",
      paymentReference: reference,
      enrolledAt: FieldValue.serverTimestamp(),
      expiryDate,
      progressPercent: 0,
      completedMaterials: [],
      completedTopics: [],
      topicMaterialsCompleted: {},
      topicQuizzesPassed: {},
    });

    console.log(`✅ Course enrollment created: ${enrollmentId}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ received: true });
  }
}