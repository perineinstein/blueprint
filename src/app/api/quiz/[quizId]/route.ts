import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";

// This route serves quiz questions WITHOUT correct answers
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const user = await verifyAuthToken(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the quiz (search across all topics)
  // In production you'd pass courseId/moduleId/topicId as params
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const moduleId = searchParams.get("moduleId");
  const topicId = searchParams.get("topicId");

  if (!courseId || !moduleId || !topicId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Verify enrollment
  const enrollmentId = `${user.uid}_${courseId}`;
  const enrollment = await adminDb
    .collection("enrollments")
    .doc(enrollmentId)
    .get();

  if (
    !enrollment.exists ||
    enrollment.data()?.status !== "active" ||
    enrollment.data()?.expiryDate?.toDate() < new Date()
  ) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
  }

  const quizDoc = await adminDb
    .collection("courses")
    .doc(courseId)
    .collection("modules")
    .doc(moduleId)
    .collection("topics")
    .doc(topicId)
    .collection("quizzes")
    .doc(params.quizId)
    .get();

  if (!quizDoc.exists) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const quiz = quizDoc.data()!;

  // Strip correct answers before sending to client
  const safeQuestions = quiz.questions.map(
    ({ correctAnswers, explanation, ...q }: any) => q
  );

  return NextResponse.json({
    ...quiz,
    id: quizDoc.id,
    questions: safeQuestions,
  });
}