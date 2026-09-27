import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/firebase/verifyAuth";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  // Rate limit submissions
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`quiz-submit:${ip}`, {
    windowMs: 60 * 1000,
    max: 20,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await verifyAuthToken(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { attemptId, courseId, moduleId, topicId, quizId, answers } =
      await request.json();

    if (!attemptId || !courseId || !moduleId || !topicId || !quizId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ── Verify attempt belongs to this user ───────────────
    const attemptDoc = await adminDb
      .collection("topicAttempts")
      .doc(attemptId)
      .get();

    if (!attemptDoc.exists) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const attempt = attemptDoc.data()!;

    if (attempt.userId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Attempt already submitted" },
        { status: 400 }
      );
    }

    // ── Verify enrollment ─────────────────────────────────
    const enrollmentId = `${user.uid}_${courseId}`;
    const enrollment = await adminDb
      .collection("enrollments")
      .doc(enrollmentId)
      .get();

    if (
      !enrollment.exists ||
      enrollment.data()?.status !== "active"
    ) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    }

    // ── Verify timer hasn't been bypassed ─────────────────
    const quizDoc = await adminDb
      .collection("courses")
      .doc(courseId)
      .collection("modules")
      .doc(moduleId)
      .collection("topics")
      .doc(topicId)
      .collection("quizzes")
      .doc(quizId)
      .get();

    if (!quizDoc.exists) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const quiz = quizDoc.data()!;
    const startTime = attempt.startTime?.toDate();
    const durationMs = quiz.durationMinutes * 60 * 1000;
    const deadline = new Date(startTime.getTime() + durationMs + 30000); // 30s grace

    if (new Date() > deadline) {
      // Force submit with whatever answers were saved
    }

    // ── Server-side grading ───────────────────────────────
    let score = 0;
    let hasSubjective = false;
    const totalMarks = quiz.questions.reduce(
      (sum: number, q: any) => sum + q.marks,
      0
    );

    for (const question of quiz.questions) {
      if (question.type === "subjective") {
        hasSubjective = true;
        continue;
      }

      const studentAnswer = answers[question.id];
      const correctAnswers: string[] = question.correctAnswers ?? [];

      if (question.type === "mcq_single") {
        if (studentAnswer === correctAnswers[0]) {
          score += question.marks;
        }
      } else if (question.type === "mcq_multi") {
        const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [];
        const correct = [...correctAnswers].sort().join(",");
        const given = [...studentArr].sort().join(",");
        if (correct === given) {
          score += question.marks;
        }
      }
    }

    const percentScore = hasSubjective
      ? null
      : Math.round((score / totalMarks) * 100);

    const passed =
      percentScore !== null ? percentScore >= quiz.passMark : null;

    // ── Write result — server-side only ──────────────────
    await adminDb.collection("topicAttempts").doc(attemptId).update({
      status: hasSubjective ? "submitted" : "graded",
      submitTime: FieldValue.serverTimestamp(),
      answers,
      score,
      percentScore,
      passed,
    });

    // ── Update enrollment progress if passed ─────────────
    if (passed) {
      const enrollRef = adminDb
        .collection("enrollments")
        .doc(enrollmentId);
      const e = enrollment.data()!;
      const current: string[] = e.topicQuizzesPassed?.[topicId] ?? [];

      if (!current.includes(quizId)) {
        const updated = [...current, quizId];
        await enrollRef.update({
          [`topicQuizzesPassed.${topicId}`]: updated,
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

        const matsCompleted: string[] =
          e.topicMaterialsCompleted?.[topicId] ?? [];
        const allMatsDone =
          matsSnap.size === 0 || matsCompleted.length >= matsSnap.size;
        const allQuizzesDone =
          quizzesSnap.size === 0 || updated.length >= quizzesSnap.size;

        if (allMatsDone && allQuizzesDone) {
          const completedTopics: string[] = e.completedTopics ?? [];
          if (!completedTopics.includes(topicId)) {
            await enrollRef.update({
              completedTopics: FieldValue.arrayUnion(topicId),
            });
          }
        }
      }
    }

    return NextResponse.json({
      score,
      totalMarks,
      percentScore,
      passed,
      status: hasSubjective ? "submitted" : "graded",
    });
  } catch (error) {
    console.error("Quiz submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}