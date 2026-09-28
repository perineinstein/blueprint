"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Exam, Attempt, Question } from "@/types";
import { formatTime } from "@/lib/utils/formatting";

export default function ExamPage() {
  const { courseId, examId } = useParams() as {
    courseId: string;
    examId: string;
  };
  const { appUser } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const [examWithAnswers, setExamWithAnswers] = useState<Exam | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<Attempt[]>([]);

  // ── Load exam + create attempt ────────────────────────────
  const initialize = useCallback(async () => {
    if (!appUser) return;

    const examSnap = await getDoc(doc(db, "exams", examId));
    if (!examSnap.exists()) {
      router.push(`/courses/${courseId}`);
      return;
    }

    const examData = { id: examSnap.id, ...examSnap.data() } as Exam;
    setExamWithAnswers(examData);

    const safeQuestions = examData.questions.map(
      ({ correctAnswer, explanation, ...q }) => q
    );
    setExam({ ...examData, questions: safeQuestions as Question[] });

    // ── Check previous attempts for retry eligibility ────────
    const attemptsSnap = await getDocs(
      query(
        collection(db, "attempts"),
        where("userId", "==", appUser.id),
        where("examId", "==", examId)
      )
    );

    const allAttempts = attemptsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Attempt))
      .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0));

    setPreviousAttempts(allAttempts);

    const completedAttempts = allAttempts.filter(
      (a) => a.status === "submitted" || a.status === "graded"
    );

    // First attempt ever — always allowed
    if (completedAttempts.length === 0) {
      await createNewAttempt(examData, 1);
      return;
    }

    // Not allowed to retake at all
    if (!examData.allowRetake) {
      setBlockedMessage(
        "You have already completed this exam. Retakes are not allowed."
      );
      setLoading(false);
      return;
    }

    // Check max attempts
    if (
      examData.maxAttempts !== null &&
      completedAttempts.length >= examData.maxAttempts
    ) {
      setBlockedMessage(
        `You have reached the maximum of ${examData.maxAttempts} attempt${
          examData.maxAttempts > 1 ? "s" : ""
        } for this exam.`
      );
      setLoading(false);
      return;
    }

    // Check cooldown period
    const lastAttempt = completedAttempts[0];
    const lastSubmitTime = lastAttempt.submitTime?.toDate();

    if (lastSubmitTime && examData.retakeDelayHours > 0) {
      const cooldownEnds = new Date(
        lastSubmitTime.getTime() + examData.retakeDelayHours * 60 * 60 * 1000
      );
      const now = new Date();

      if (now < cooldownEnds) {
        const hoursLeft = Math.ceil(
          (cooldownEnds.getTime() - now.getTime()) / (1000 * 60 * 60)
        );
        setBlockedMessage(
          `You can retry this exam in ${hoursLeft} hour${
            hoursLeft !== 1 ? "s" : ""
          }.`
        );
        setLoading(false);
        return;
      }
    }

    // All checks passed — allow new attempt
    await createNewAttempt(examData, completedAttempts.length + 1);
  }, [appUser, examId, courseId, router]);

  // ── Helper: create a new attempt document ──────────────────
  async function createNewAttempt(examData: Exam, attemptNumber: number) {
    const totalMarks = examData.questions.reduce(
      (sum, q) => sum + q.marks,
      0
    );

    const attemptRef = await addDoc(collection(db, "attempts"), {
      userId: appUser!.id,
      examId,
      courseId,
      status: "in_progress",
      attemptNumber,
      startTime: serverTimestamp(),
      submitTime: null,
      answers: {},
      score: null,
      totalMarks,
      percentScore: null,
      passed: null,
      adminFeedback: null,
      gradedAt: null,
      gradedBy: null,
    });

    setAttempt({
      id: attemptRef.id,
      userId: appUser!.id,
      examId,
      courseId,
      status: "in_progress",
      attemptNumber,
      startTime: Timestamp.now(),
      submitTime: null,
      answers: {},
      score: null,
      totalMarks,
      percentScore: null,
      passed: null,
      adminFeedback: null,
      gradedAt: null,
      gradedBy: null,
    });

    setTimeLeft(examData.durationMinutes * 60);
    setLoading(false);
  }

  // ── Countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (!attempt || submitted || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [attempt, submitted]);

  // ── Autosave every 10 seconds ─────────────────────────────
  useEffect(() => {
    if (!attempt || submitted) return;

    autoSaveRef.current = setInterval(async () => {
      await updateDoc(doc(db, "attempts", attempt.id), { answers });
    }, 10000);

    return () => clearInterval(autoSaveRef.current!);
  }, [attempt, answers, submitted]);

  // ── Submit exam ───────────────────────────────────────────
  async function handleSubmit() {
    if (!attempt || !exam || submitting || submitted) return;

    setSubmitting(true);
    clearInterval(timerRef.current!);
    clearInterval(autoSaveRef.current!);

    try {
      // Auto-grade MCQ questions
      const originalExamSnap = await getDoc(doc(db, "exams", examId));
      const originalExam = originalExamSnap.data() as Exam;

      let score = 0;
      for (const question of originalExam.questions) {
        if (question.type === "mcq_single" && question.correctAnswer) {
          if (answers[question.id] === question.correctAnswer) {
            score += question.marks;
          }
        }
      }

      // Check if all questions are MCQ (auto-grade fully)
      const hasSubjective = originalExam.questions.some(
        (q) => q.type === "subjective"
      );

      const totalMcqMarks = originalExam.questions
        .filter((q) => q.type === "mcq_single")
        .reduce((sum, q) => sum + q.marks, 0);

      const percentScore = hasSubjective
        ? null // Will be graded by admin
        : Math.round((score / attempt.totalMarks) * 100);

      const passed =
        percentScore !== null ? percentScore >= exam.passMark : null;

      await updateDoc(doc(db, "attempts", attempt.id), {
        status: hasSubjective ? "submitted" : "graded",
        submitTime: serverTimestamp(),
        answers,
        score,
        percentScore,
        passed,
      });

      setSubmitted(true);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Answer handler ────────────────────────────────────────
  function handleAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading exam...</p>
      </div>
    );
  }

  if (!exam || !attempt) return null;
  if (blockedMessage) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center
                        justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          Exam unavailable
        </h1>
        <p className="text-sm text-gray-500 mb-6">{blockedMessage}</p>

        {previousAttempts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 text-left">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Previous attempts
            </p>
            {previousAttempts
              .filter((a) => a.status !== "in_progress")
              .map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2 border-b
                            border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">
                    Attempt {a.attemptNumber}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      a.passed ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    {a.percentScore !== null ? `${a.percentScore}%` : "Pending"}
                  </span>
                </div>
              ))}
          </div>
        )}

        <button
          onClick={() => router.push(`/courses/${courseId}/learn`)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                    text-sm font-medium rounded-lg transition-colors"
        >
          Back to course
        </button>
      </div>
    );
  }

  // ── Submitted view ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center
                          justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Exam Submitted
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Your answers have been recorded successfully.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/courses/${courseId}/learn`)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                        text-sm font-medium rounded-lg transition-colors"
            >
              Back to course
            </button>
            <button
              onClick={() => setShowReview(!showReview)}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700
                        text-sm font-medium rounded-lg transition-colors"
            >
              {showReview ? "Hide review" : "Review answers"}
            </button>
          </div>
        </div>

        {/* Answer review with explanations */}
        {showReview && examWithAnswers && (
          <div className="space-y-4">
            {examWithAnswers.questions.map((question, index) => {
              const studentAnswer = answers[question.id];
              const isCorrect =
                question.type === "mcq_single"
                  ? studentAnswer === question.correctAnswer
                  : null; // subjective — no auto check

              return (
                <div
                  key={question.id}
                  className="bg-white rounded-2xl border border-gray-100 p-6"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center
                                justify-center text-xs font-semibold flex-shrink-0
                                ${
                                  isCorrect === true
                                    ? "bg-green-100 text-green-700"
                                    : isCorrect === false
                                    ? "bg-red-100 text-red-600"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm font-medium text-gray-900">
                      {question.text}
                    </p>
                  </div>

                  {/* Question image if present */}
                  {question.imageUrl && (
                    <img
                      src={question.imageUrl}
                      alt="Question diagram"
                      className="max-h-48 rounded-lg border border-gray-100 mb-3 ml-10"
                    />
                  )}

                  {/* MCQ answer review */}
                  {question.type === "mcq_single" && question.options && (
                    <div className="ml-10 space-y-2 mb-3">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const isStudentAnswer = studentAnswer === opt;
                        const isCorrectAnswer = question.correctAnswer === opt;

                        return (
                          <div
                            key={opt}
                            className={`px-4 py-2.5 rounded-lg border text-sm flex
                                      items-center justify-between ${
                                        isCorrectAnswer
                                          ? "border-green-300 bg-green-50 text-green-700"
                                          : isStudentAnswer
                                          ? "border-red-300 bg-red-50 text-red-600"
                                          : "border-gray-200 text-gray-500"
                                      }`}
                          >
                            <span>
                              <span className="font-medium mr-2">{opt}.</span>
                              {question.options?.[opt]}
                            </span>
                            {isCorrectAnswer && <span>✓</span>}
                            {isStudentAnswer && !isCorrectAnswer && (
                              <span>✗ Your answer</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subjective answer review */}
                  {question.type === "subjective" && (
                    <div className="ml-10 mb-3">
                      <p className="text-xs text-gray-400 mb-1">Your answer:</p>
                      <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                        {studentAnswer || "No answer provided"}
                      </div>
                    </div>
                  )}

                  {/* Explanation box */}
                  {question.explanation && (
                    <div className="ml-10 p-4 bg-amber-50 border border-amber-100
                                    rounded-xl">
                      <p className="text-xs font-medium text-amber-800 mb-1">
                        Explanation
                      </p>
                      <p className="text-sm text-amber-700 leading-relaxed">
                        {question.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;
  const isLowTime = timeLeft < 60;

  return (
    <div className="max-w-3xl mx-auto">

      {/* Sticky header with timer */}
      <div className="sticky top-0 z-10 bg-gray-50 pb-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4
                        flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              {exam.title}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {answeredCount} of {totalQuestions} answered
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            <div
              className={`px-4 py-2 rounded-lg font-mono text-sm font-semibold ${
                isLowTime
                  ? "bg-red-50 text-red-600 animate-pulse"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {formatTime(timeLeft)}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700
                         disabled:bg-blue-400 text-white text-sm font-medium
                         rounded-lg transition-colors"
            >
              {submitting ? "Submitting..." : "Submit exam"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
          <div
            className="bg-blue-600 h-1 rounded-full transition-all"
            style={{
              width: `${(answeredCount / totalQuestions) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Questions */}
      {/* Calculate pagination */}
      {(() => {
        const perPage = exam.questionsPerPage || exam.questions.length;
        const totalPages = Math.ceil(exam.questions.length / perPage);
        const startIdx = currentPage * perPage;
        const endIdx = startIdx + perPage;
        const visibleQuestions = exam.questions.slice(startIdx, endIdx);

        return (
          <>
            {/* Page indicator — only show if paginated */}
            {exam.questionsPerPage > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                        i === currentPage
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {visibleQuestions.map((question, idx) => {
                const index = startIdx + idx; // global index for numbering
                return (
                  <div
                    key={question.id}
                    className="bg-white rounded-2xl border border-gray-100 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700
                                        flex items-center justify-center text-xs
                                        font-semibold flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <p className="text-sm font-medium text-gray-900 leading-relaxed">
                          {question.text}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                        {question.marks} mark{question.marks > 1 ? "s" : ""}
                      </span>
                    </div>

                    {question.imageUrl && (
                      <img
                        src={question.imageUrl}
                        alt="Question diagram"
                        className="max-h-56 rounded-lg border border-gray-100 mt-3 ml-10"
                      />
                    )}

                    {question.type === "mcq_single" && question.options && (
                      <div className="space-y-2 ml-10 mt-3">
                        {(["A", "B", "C", "D"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleAnswer(question.id, opt)}
                            className={`w-full text-left px-4 py-3 rounded-xl border
                                      text-sm transition-colors ${
                                        answers[question.id] === opt
                                          ? "border-blue-500 bg-blue-50 text-blue-700"
                                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                                      }`}
                          >
                            <span className="font-medium mr-3">{opt}.</span>
                            {question.options![opt]}
                          </button>
                        ))}
                      </div>
                    )}

                    {question.type === "subjective" && (
                      <div className="ml-10 mt-3">
                        <textarea
                          value={answers[question.id] ?? ""}
                          onChange={(e) => handleAnswer(question.id, e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl
                                    text-sm text-gray-900 bg-white focus:outline-none
                                    focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder="Write your answer here..."
                        />
                      </div>
                    )}

                    {answers[question.id] && (
                      <div className="ml-10 mt-2">
                        <span className="text-xs text-green-600">✓ Answered</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Page navigation buttons */}
            {exam.questionsPerPage > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous page
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage === totalPages - 1}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next page →
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* Bottom submit */}
      <div className="mt-6 mb-12 text-center">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white text-sm font-medium rounded-xl transition-colors"
        >
          {submitting ? "Submitting..." : "Submit exam"}
        </button>
        <p className="text-xs text-gray-400 mt-2">
          {totalQuestions - answeredCount} question
          {totalQuestions - answeredCount !== 1 ? "s" : ""} unanswered
        </p>
      </div>
    </div>
  );
}