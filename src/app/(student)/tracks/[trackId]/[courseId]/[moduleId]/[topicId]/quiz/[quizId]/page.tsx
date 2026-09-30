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
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  TopicQuiz,
  TopicQuestion,
  TopicAttempt,
  TrackId,
  TOPIC_COLORS,
  Topic,
} from "@/types";
import { formatTime } from "@/lib/utils/formatting";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Circle,
  ClipboardList,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function TopicQuizPage() {
  const { trackId, courseId, moduleId, topicId, quizId } = useParams() as {
    trackId: TrackId;
    courseId: string;
    moduleId: string;
    topicId: string;
    quizId: string;
  };
  const { appUser } = useAuth();
  const router = useRouter();

  const [quiz, setQuiz] = useState<TopicQuiz | null>(null);
  const [quizWithAnswers, setQuizWithAnswers] = useState<TopicQuiz | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [attempt, setAttempt] = useState<TopicAttempt | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<TopicAttempt[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const initialize = useCallback(async () => {
    if (!appUser) return;

    try {
      const [quizSnap, topicSnap] = await Promise.all([
        getDoc(
          doc(
            db,
            "courses",
            courseId,
            "modules",
            moduleId,
            "topics",
            topicId,
            "quizzes",
            quizId
          )
        ),
        getDoc(
          doc(db, "courses", courseId, "modules", moduleId, "topics", topicId)
        ),
      ]);

      if (!quizSnap.exists()) {
        router.push(
          `/tracks/${trackId}/${courseId}/${moduleId}/${topicId}`
        );
        return;
      }

      const quizData = { id: quizSnap.id, ...quizSnap.data() } as TopicQuiz;
      setQuizWithAnswers(quizData);
      if (topicSnap.exists())
        setTopic({ id: topicSnap.id, ...topicSnap.data() } as Topic);

      // Strip correct answers
      const safeQuestions = quizData.questions.map(
        ({ correctAnswers, explanation, ...q }) => q
      ) as TopicQuestion[];
      setQuiz({ ...quizData, questions: safeQuestions });

      // Check previous attempts
      const attemptsSnap = await getDocs(
        query(
          collection(db, "topicAttempts"),
          where("userId", "==", appUser.id),
          where("quizId", "==", quizId)
        )
      );

      const allAttempts = attemptsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TopicAttempt))
        .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0));

      setPreviousAttempts(allAttempts);

      const completedAttempts = allAttempts.filter(
        (a) => a.status === "submitted" || a.status === "graded"
      );

      if (completedAttempts.length === 0) {
        await createAttempt(quizData, 1);
        return;
      }

      if (!quizData.allowRetake) {
        setBlockedMessage(
          "You have already completed this quiz. Retakes are not allowed."
        );
        setLoading(false);
        return;
      }

      if (
        quizData.maxAttempts !== null &&
        completedAttempts.length >= quizData.maxAttempts
      ) {
        setBlockedMessage(
          `You have used all ${quizData.maxAttempts} attempt${
            quizData.maxAttempts > 1 ? "s" : ""
          }.`
        );
        setLoading(false);
        return;
      }

      if (quizData.retakeDelayHours > 0) {
        const last = completedAttempts[0];
        const lastTime = last.submitTime?.toDate();
        if (lastTime) {
          const cooldownEnd = new Date(
            lastTime.getTime() +
              quizData.retakeDelayHours * 60 * 60 * 1000
          );
          if (new Date() < cooldownEnd) {
            const hoursLeft = Math.ceil(
              (cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60)
            );
            setBlockedMessage(
              `You can retry in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}.`
            );
            setLoading(false);
            return;
          }
        }
      }

      await createAttempt(quizData, completedAttempts.length + 1);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [appUser, quizId, courseId, moduleId, topicId, trackId, router]);

  async function createAttempt(quizData: TopicQuiz, attemptNumber: number) {
    const totalMarks = quizData.questions.reduce(
      (sum, q) => sum + q.marks,
      0
    );

    const ref = await addDoc(collection(db, "topicAttempts"), {
      userId: appUser!.id,
      quizId,
      topicId,
      moduleId,
      courseId,
      attemptNumber,
      status: "in_progress",
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
      id: ref.id,
      userId: appUser!.id,
      quizId,
      topicId,
      moduleId,
      courseId,
      attemptNumber,
      status: "in_progress",
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

    setTimeLeft(quizData.durationMinutes * 60);
    setLoading(false);
  }

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Timer
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

  // Autosave
  useEffect(() => {
    if (!attempt || submitted) return;
    autoSaveRef.current = setInterval(async () => {
      await updateDoc(doc(db, "topicAttempts", attempt.id), { answers });
    }, 10000);
    return () => clearInterval(autoSaveRef.current!);
  }, [attempt, answers, submitted]);

  async function handleSubmit() {
    if (!attempt || !quiz || !quizWithAnswers || submitting || submitted)
      return;

    setSubmitting(true);
    clearInterval(timerRef.current!);
    clearInterval(autoSaveRef.current!);

    try {
      // Auto-grade objective questions
      let score = 0;
      let hasSubjective = false;

      for (const question of quizWithAnswers.questions) {
        if (question.type === "subjective") {
          hasSubjective = true;
          continue;
        }

        const studentAnswer = answers[question.id];
        const correctAnswers = question.correctAnswers ?? [];

        if (question.type === "mcq_single") {
          if (studentAnswer === correctAnswers[0]) {
            score += question.marks;
          }
        } else if (question.type === "mcq_multi") {
          // Multi-answer: all-or-nothing
          const studentArr = Array.isArray(studentAnswer)
            ? studentAnswer
            : [];
          const correct = [...correctAnswers].sort().join(",");
          const given = [...studentArr].sort().join(",");
          if (correct === given) {
            score += question.marks;
          }
        }
      }

      const percentScore = hasSubjective
        ? null
        : Math.round((score / attempt.totalMarks) * 100);

      const passed =
        percentScore !== null && quiz.passMark !== undefined
          ? percentScore >= quiz.passMark
          : null;

      await updateDoc(doc(db, "topicAttempts", attempt.id), {
        status: hasSubjective ? "submitted" : "graded",
        submitTime: serverTimestamp(),
        answers,
        score,
        percentScore,
        passed,
      });

      // If passed — update enrollment topicQuizzesPassed
      if (passed && appUser) {
        const enrollmentId = `${appUser.id}_${courseId}`;
        const enrollRef = doc(db, "enrollments", enrollmentId);
        const enrollSnap = await getDoc(enrollRef);

        if (enrollSnap.exists()) {
          const e = enrollSnap.data();
          const current: string[] =
            e.topicQuizzesPassed?.[topicId] ?? [];

          if (!current.includes(quizId)) {
            const updated = [...current, quizId];
            await updateDoc(enrollRef, {
              [`topicQuizzesPassed.${topicId}`]: updated,
            });

            // Check if topic is now fully complete
            const matsCompleted: string[] =
              e.topicMaterialsCompleted?.[topicId] ?? [];
            const allMats =
              await getDocs(
                collection(
                  db,
                  "courses",
                  courseId,
                  "modules",
                  moduleId,
                  "topics",
                  topicId,
                  "materials"
                )
              );
            const allQuizzes =
              await getDocs(
                collection(
                  db,
                  "courses",
                  courseId,
                  "modules",
                  moduleId,
                  "topics",
                  topicId,
                  "quizzes"
                )
              );

            const allMatsDone =
              allMats.size === 0 ||
              matsCompleted.length >= allMats.size;
            const allQuizzesDone =
              allQuizzes.size === 0 ||
              updated.length >= allQuizzes.size;

            if (allMatsDone && allQuizzesDone) {
              const completedTopics: string[] =
                e.completedTopics ?? [];
              if (!completedTopics.includes(topicId)) {
                await updateDoc(enrollRef, {
                  completedTopics: arrayUnion(topicId),
                });
              }
            }
          }
        }
      }

      setSubmitted(true);
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              status: hasSubjective ? "submitted" : "graded",
              score,
              percentScore,
              passed,
            }
          : prev
      );
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleAnswer(questionId: string, value: string, isMulti: boolean) {
    if (isMulti) {
      setAnswers((prev) => {
        const current = Array.isArray(prev[questionId])
          ? (prev[questionId] as string[])
          : [];
        const exists = current.includes(value);
        return {
          ...prev,
          [questionId]: exists
            ? current.filter((v) => v !== value)
            : [...current, value],
        };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading quiz...</p>
      </div>
    );
  }

  // Blocked
  if (blockedMessage) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center
                        justify-center mx-auto mb-4">
          <ClipboardList size={28} className="text-amber-600" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          Quiz unavailable
        </h1>
        <p className="text-sm text-gray-500 mb-6">{blockedMessage}</p>

        {previousAttempts.filter((a) => a.status !== "in_progress").length >
          0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6
                          text-left">
            <p className="text-xs font-semibold text-gray-500 mb-2">
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
                    className={cn(
                      "text-sm font-medium",
                      a.passed ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {a.percentScore !== null ? `${a.percentScore}%` : "Pending"}
                  </span>
                </div>
              ))}
          </div>
        )}

        <button
          onClick={() =>
            router.push(
              `/tracks/${trackId}/${courseId}/${moduleId}/${topicId}`
            )
          }
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                     text-sm font-medium rounded-xl transition-colors"
        >
          Back to topic
        </button>
      </div>
    );
  }

  if (!quiz || !attempt) return null;

  // Submitted view
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-8
                        text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center
                          justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Quiz submitted
          </h1>

          {attempt.percentScore !== null ? (
            <>
              <p
                className={cn(
                  "text-4xl font-bold mb-1",
                  attempt.passed ? "text-green-600" : "text-red-500"
                )}
              >
                {attempt.percentScore}%
              </p>
              <p
                className={cn(
                  "text-sm font-medium mb-1",
                  attempt.passed ? "text-green-600" : "text-red-500"
                )}
              >
                {attempt.passed ? "Passed ✓" : "Not passed ✗"}
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Score: {attempt.score}/{attempt.totalMarks} · Pass mark:{" "}
                {quiz.passMark}%
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 mb-6">
              Your answers have been submitted for grading.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() =>
                router.push(
                  `/tracks/${trackId}/${courseId}/${moduleId}/${topicId}`
                )
              }
              className="px-5 py-3 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-medium rounded-xl transition-colors"
            >
              Back to topic
            </button>
            <button
              onClick={() => setShowReview(!showReview)}
              className="px-5 py-3 md:py-2.5 border border-gray-200 text-gray-700
                         text-sm font-medium rounded-xl hover:bg-gray-50
                         transition-colors"
            >
              {showReview ? "Hide review" : "Review answers"}
            </button>
          </div>
        </div>

        {/* Answer review */}
        {showReview && quizWithAnswers && (
          <div className="space-y-4">
            {/* Case scenario */}
            {quiz.type === "case_study" && quiz.caseScenario && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                <p className="text-xs font-semibold text-blue-800 mb-2">
                  Case Scenario
                </p>
                <div
                  className="rich-content text-sm"
                  dangerouslySetInnerHTML={{ __html: quiz.caseScenario }}
                />
              </div>
            )}

            {quizWithAnswers.questions.map((question, index) => {
              const studentAnswer = answers[question.id];
              const correct = question.correctAnswers ?? [];

              let isCorrect: boolean | null = null;
              if (question.type === "mcq_single") {
                isCorrect = studentAnswer === correct[0];
              } else if (question.type === "mcq_multi") {
                const studentArr = Array.isArray(studentAnswer)
                  ? studentAnswer
                  : [];
                isCorrect =
                  [...correct].sort().join(",") ===
                  [...studentArr].sort().join(",");
              }

              return (
                <div
                  key={question.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center",
                        "text-xs font-semibold flex-shrink-0",
                        isCorrect === true
                          ? "bg-green-100 text-green-700"
                          : isCorrect === false
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm font-medium text-gray-900">
                      {question.text}
                    </p>
                  </div>

                  {question.imageUrl && (
                    <img
                      src={question.imageUrl}
                      alt="Question"
                      className="max-h-40 rounded-lg border border-gray-100
                                 mb-3 md:ml-10"
                    />
                  )}

                  {/* MCQ review */}
                  {question.type !== "subjective" && question.options && (
                    <div className="md:ml-10 space-y-2 mb-3">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const isOpt = question.correctAnswers?.includes(opt);
                        const studentSelected = Array.isArray(studentAnswer)
                          ? studentAnswer.includes(opt)
                          : studentAnswer === opt;

                        return (
                          <div
                            key={opt}
                            className={cn(
                              "px-4 py-2.5 rounded-xl border text-sm flex",
                              "items-center justify-between",
                              isOpt
                                ? "border-green-300 bg-green-50 text-green-700"
                                : studentSelected
                                ? "border-red-300 bg-red-50 text-red-600"
                                : "border-gray-200 text-gray-500"
                            )}
                          >
                            <span>
                              <span className="font-medium mr-2">{opt}.</span>
                              {question.options?.[opt]}
                            </span>
                            {isOpt && (
                              <CheckCircle size={15} className="text-green-500" />
                            )}
                            {studentSelected && !isOpt && (
                              <span className="text-xs">Your answer</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subjective answer */}
                  {question.type === "subjective" && (
                    <div className="md:ml-10 mb-3">
                      <p className="text-xs text-gray-400 mb-1">Your answer:</p>
                      <div className="p-3 bg-gray-50 rounded-xl text-sm
                                      text-gray-700">
                        {(studentAnswer as string) || "No answer provided"}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {question.explanation && (
                    <div className="md:ml-10 p-4 bg-amber-50 border border-amber-100
                                    rounded-xl">
                      <p className="text-xs font-semibold text-amber-800 mb-1">
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

  // ── Active quiz ──────────────────────────────────────────
  const perPage =
    quiz.questionsPerPage > 0
      ? quiz.questionsPerPage
      : quiz.questions.length;
  const totalPages = Math.ceil(quiz.questions.length / perPage);
  const startIdx = currentPage * perPage;
  const visibleQuestions = quiz.questions.slice(startIdx, startIdx + perPage);

  const answeredCount = quiz.questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : !!a;
  }).length;

  const isLowTime = timeLeft < 60;
  const color =
    TOPIC_COLORS.find((c) => c.id === topic?.colorId) ?? TOPIC_COLORS[0];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sticky header */}
      <div className="sticky top-14 md:top-0 z-10 bg-gray-50 pb-4 mb-4 md:mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 md:p-4
                        flex flex-wrap items-center justify-between gap-2 md:gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              {quiz.title}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {answeredCount}/{quiz.questions.length} answered
              {totalPages > 1 && ` · Page ${currentPage + 1}/${totalPages}`}
            </p>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Timer */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl font-mono",
                "text-sm font-semibold",
                isLowTime
                  ? "bg-red-50 text-red-600 animate-pulse"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              <Clock size={14} />
              {formatTime(timeLeft)}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-3 md:py-2 bg-blue-600 hover:bg-blue-700
                         disabled:bg-blue-400 text-white text-sm font-medium
                         rounded-xl transition-colors"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
          <div
            className="h-1 rounded-full transition-all"
            style={{
              width: `${(answeredCount / quiz.questions.length) * 100}%`,
              backgroundColor: color.hex,
            }}
          />
        </div>
      </div>

      {/* Case scenario — shown once at top */}
      {quiz.type === "case_study" && quiz.caseScenario && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 md:p-6 mb-6">
          <p className="text-xs font-semibold text-blue-800 mb-3 uppercase
                        tracking-wide">
            Case Scenario
          </p>
          <div
            className="rich-content text-sm"
            dangerouslySetInnerHTML={{ __html: quiz.caseScenario }}
          />
        </div>
      )}

      {/* Page number buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 md:gap-1 mb-4 flex-wrap">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={cn(
                "w-10 h-10 md:w-8 md:h-8 rounded-lg text-xs font-medium transition-colors",
                i === currentPage
                  ? "text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
              )}
              style={
                i === currentPage
                  ? { backgroundColor: color.hex }
                  : undefined
              }
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {visibleQuestions.map((question, idx) => {
          const globalIndex = startIdx + idx;
          const isMulti = question.type === "mcq_multi";
          const studentAnswer = answers[question.id];

          return (
            <div
              key={question.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center
                               justify-center text-xs font-semibold
                               flex-shrink-0 mt-0.5 text-white"
                    style={{ backgroundColor: color.hex }}
                  >
                    {globalIndex + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900
                                  leading-relaxed">
                      {question.text}
                    </p>
                    {isMulti && (
                      <p className="text-xs text-indigo-600 mt-1">
                        Select all that apply
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                  {question.marks} mark{question.marks > 1 ? "s" : ""}
                </span>
              </div>

              {question.imageUrl && (
                <img
                  src={question.imageUrl}
                  alt="Question diagram"
                  className="max-h-48 rounded-xl border border-gray-100
                             mb-4 md:ml-10"
                />
              )}

              {/* MCQ options */}
              {question.type !== "subjective" && question.options && (
                <div className="space-y-2 md:ml-10">
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const selected = isMulti
                      ? Array.isArray(studentAnswer) &&
                        studentAnswer.includes(opt)
                      : studentAnswer === opt;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          handleAnswer(question.id, opt, isMulti)
                        }
                        className={cn(
                          "w-full text-left px-4 py-3 min-h-[48px] md:min-h-0 rounded-xl border",
                          "text-sm transition-colors flex items-center gap-3",
                          selected
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                        )}
                      >
                        {/* Checkbox for multi, circle for single */}
                        {isMulti ? (
                          selected ? (
                            <CheckSquare
                              size={16}
                              className="flex-shrink-0 text-blue-600"
                            />
                          ) : (
                            <Square
                              size={16}
                              className="flex-shrink-0 text-gray-300"
                            />
                          )
                        ) : (
                          <span
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex-shrink-0",
                              "flex items-center justify-center",
                              selected
                                ? "border-blue-500 bg-blue-500"
                                : "border-gray-300"
                            )}
                          >
                            {selected && (
                              <span className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </span>
                        )}
                        <span>
                          <span className="font-medium mr-2">{opt}.</span>
                          {question.options![opt]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Subjective */}
              {question.type === "subjective" && (
                <div className="md:ml-10">
                  <textarea
                    value={(studentAnswer as string) ?? ""}
                    onChange={(e) =>
                      handleAnswer(question.id, e.target.value, false)
                    }
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-200
                               rounded-xl text-sm text-gray-900 bg-white
                               focus:outline-none focus:ring-2
                               focus:ring-blue-500 resize-none"
                    placeholder="Write your answer here..."
                  />
                </div>
              )}

              {/* Answered indicator */}
              {(Array.isArray(studentAnswer)
                ? studentAnswer.length > 0
                : !!studentAnswer) && (
                <div className="md:ml-10 mt-2 flex items-center gap-1 text-xs
                                text-green-600">
                  <CheckCircle size={12} />
                  Answered
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 mb-12">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-1.5 px-4 py-3 md:py-2 text-sm text-gray-600
                       hover:text-gray-900 disabled:opacity-30
                       disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
            Previous
          </button>

          {currentPage === totalPages - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 md:py-2.5 bg-blue-600 hover:bg-blue-700
                         disabled:bg-blue-400 text-white text-sm font-medium
                         rounded-xl transition-colors"
            >
              {submitting ? "Submitting..." : "Submit quiz"}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              className="flex items-center gap-1.5 px-4 py-3 md:py-2 text-sm
                         text-gray-600 hover:text-gray-900 transition-colors"
            >
              Next
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}