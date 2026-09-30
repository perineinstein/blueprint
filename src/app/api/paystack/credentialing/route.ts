import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

const DEFAULT_CREDENTIALING_PRICE = 50000; // GHS 500 in pesewas

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = rateLimit(`credentialing-payment:${ip}`, {
      windowMs: 60 * 1000,  // 1 minute
      max: 5,               // 5 payment attempts per minute per IP
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // ── Verify caller — never trust client userId ────────
    const verifiedUser = await verifyAuthToken(request);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = verifiedUser.uid;
    const userEmail = verifiedUser.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "Account email required" },
        { status: 400 }
      );
    }

    // ── Check not already enrolled ───────────────────────
    const existing = await adminDb
      .collection("credentialingEnrollments")
      .doc(userId)
      .get();

    if (existing.exists && existing.data()?.status === "active") {
      return NextResponse.json(
        { error: "Already enrolled in credentialing." },
        { status: 400 }
      );
    }

    const settingsSnap = await adminDb
      .collection("settings")
      .doc("credentialing")
      .get();
    const storedPrice = settingsSnap.data()?.price;
    const price =
      typeof storedPrice === "number" && storedPrice > 0
        ? storedPrice
        : DEFAULT_CREDENTIALING_PRICE;

    const reference = `CRED-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    await adminDb.collection("payments").doc(reference).set({
      userId,
      courseId: "credentialing",
      amount: price,
      currency: "GHS",
      status: "pending",
      paystackRef: reference,
      type: "credentialing",
      createdAt: FieldValue.serverTimestamp(),
    });

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
          amount: price,
          currency: "GHS",
          reference,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/credentialing?payment=success`,
          metadata: {
            userId,
            type: "credentialing",
            cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/credentialing`,
          },
        }),
      }
    );

    const data = await response.json();
    if (!data.status) {
      return NextResponse.json(
        { error: "Failed to initialize payment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error("Credentialing payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}