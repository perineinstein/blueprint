import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`progress:${ip}`, {
    windowMs: 60 * 1000,
    max: 60,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await verifyAuthToken(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { courseId, moduleId, topicId, materialId } = await request.json();

    if (!courseId || !moduleId || !topicId || !materialId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // Verify enrollment
    const enrollmentId = `${user.uid}_${courseId}`;
    const enrollRef = adminDb.collection("enrollments").doc(enrollmentId);
    const enrollSnap = await enrollRef.get();

    if (
      !enrollSnap.exists ||
      enrollSnap.data()?.status !== "active" ||
      enrollSnap.data()?.expiryDate?.toDate() < new Date()
    ) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    }

    // Verify material exists
    const materialSnap = await adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("topics")
      .doc(topicId)
      .collection("materials")
      .doc(materialId)
      .get();

    if (!materialSnap.exists) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    const e = enrollSnap.data()!;
    const current: string[] = e.topicMaterialsCompleted?.[topicId] ?? [];

    if (!current.includes(materialId)) {
      const updated = [...current, materialId];
      await enrollRef.update({
        [`topicMaterialsCompleted.${topicId}`]: updated,
      });

      // Check topic completion
      const [matsSnap, quizzesSnap] = await Promise.all([
        adminDb
          .collection("courses")
          .doc(courseId)
          .collection("modules")
          .doc(moduleId)
          .collection("topics")
          .doc(topicId)
          .collection("materials")
          .get(),
        adminDb
          .collection("courses")
          .doc(courseId)
          .collection("modules")
          .doc(moduleId)
          .collection("topics")
          .doc(topicId)
          .collection("quizzes")
          .get(),
      ]);

      const passedQuizzes: string[] = e.topicQuizzesPassed?.[topicId] ?? [];
      const allMatsDone = updated.length >= matsSnap.size;
      const allQuizzesDone =
        quizzesSnap.size === 0 || passedQuizzes.length >= quizzesSnap.size;

      if (allMatsDone && allQuizzesDone) {
        const completedTopics: string[] = e.completedTopics ?? [];
        if (!completedTopics.includes(topicId)) {
          await enrollRef.update({
            completedTopics: FieldValue.arrayUnion(topicId),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Material progress error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}