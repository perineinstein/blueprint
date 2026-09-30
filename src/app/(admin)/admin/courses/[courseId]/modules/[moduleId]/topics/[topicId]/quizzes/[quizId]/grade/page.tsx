"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { TopicAttempt, TopicQuiz, AppUser } from "@/types";
import Link from "next/link";
import {
  ChevronRight,
  CheckCircle,
  XCircle,
  ClipboardList,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AttemptWithUser extends TopicAttempt {
  userName: string;
  userEmail: string;
}

export default function QuizGradePage() {
  const { courseId, moduleId, topicId, quizId } = useParams() as {
    courseId: string;
    moduleId: string;
    topicId: string;
    quizId: string;
  };
  const { appUser } = useAuth();

  const [quiz, setQuiz] = useState<TopicQuiz | null>(null);
  const [attempts, setAttempts] = useState<AttemptWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [subjectiveScores, setSubjectiveScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function fetchData() {
    try {
      const quizSnap = await getDoc(
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
      );
      if (quizSnap.exists())
        setQuiz({ id: quizSnap.id, ...quizSnap.data() } as TopicQuiz);

      const attemptsSnap = await getDocs(
        query(
          collection(db, "topicAttempts"),
          where("quizId", "==", quizId),
          where("status", "in", ["submitted", "graded"])
        )
      );

      const enriched = await Promise.all(
        attemptsSnap.docs.map(async (d) => {
          const attempt = { id: d.id, ...d.data() } as TopicAttempt;
          if (!attempt.userId) {
            return { ...attempt, userName: "Unknown", userEmail: "—" };
          }
          try {
            const userSnap = await getDoc(doc(db, "users", attempt.userId));
            const u = userSnap.data() as AppUser | undefined;
            return {
              ...attempt,
              userName: u?.name ?? "Unknown",
              userEmail: u?.email ?? "—",
            };
          } catch {
            return { ...attempt, userName: "Unknown", userEmail: "—" };
          }
        })
      );

      setAttempts(enriched as AttemptWithUser[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [quizId]);

  async function handleGrade(attempt: AttemptWithUser) {
    if (!quiz || !appUser) return;
    setSaving(true);

    try {
      const subScore = subjectiveScores[attempt.id] ?? 0;
      const mcqScore = attempt.score ?? 0;
      const totalScore = mcqScore + subScore;
      const percentScore = Math.round(
        (totalScore / attempt.totalMarks) * 100
      );
      const passed = percentScore >= quiz.passMark;

      await updateDoc(doc(db, "topicAttempts", attempt.id), {
        status: "graded",
        score: totalScore,
        percentScore,
        passed,
        adminFeedback: feedback[attempt.id] ?? "",
        gradedAt: serverTimestamp(),
        gradedBy: appUser.id,
      });

      // If passed — update enrollment
      if (passed) {
        const enrollmentId = `${attempt.userId}_${courseId}`;
        const enrollSnap = await getDoc(doc(db, "enrollments", enrollmentId));
        if (enrollSnap.exists()) {
          const e = enrollSnap.data();
          const current: string[] = e.topicQuizzesPassed?.[topicId] ?? [];
          if (!current.includes(quizId)) {
            await updateDoc(doc(db, "enrollments", enrollmentId), {
              [`topicQuizzesPassed.${topicId}`]: [...current, quizId],
            });
          }
        }
      }

      setGradingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6
                      flex-wrap">
        <Link href="/admin/courses" className="hover:text-gray-600">
          Courses
        </Link>
        <ChevronRight size={13} />
        <Link
          href={`/admin/courses/${courseId}/modules/${moduleId}/topics/${topicId}/quizzes`}
          className="hover:text-gray-600"
        >
          Quizzes
        </Link>
        <ChevronRight size={13} />
        <span className="text-gray-600">Grade: {quiz?.title}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {quiz?.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {attempts.length} submission{attempts.length !== 1 ? "s" : ""} ·
          Pass mark: {quiz?.passMark}%
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <div
              key={attempt.id}
              className="bg-white rounded-2xl border border-gray-100
                         overflow-hidden"
            >
              {/* Attempt header */}
              <div className="flex items-center justify-between px-4 md:px-6 py-4
                              border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br
                                  from-blue-400 to-violet-500 flex items-center
                                  justify-center flex-shrink-0">
                    <span className="text-white text-xs font-semibold">
                      {attempt.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {attempt.userName}
                    </p>
                    <p className="text-xs text-gray-400">{attempt.userEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {attempt.status === "graded" ? (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full",
                        "text-xs font-medium",
                        attempt.passed
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      )}
                    >
                      {attempt.passed ? (
                        <CheckCircle size={12} />
                      ) : (
                        <XCircle size={12} />
                      )}
                      {attempt.percentScore}%
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-50 text-amber-700
                                     text-xs font-medium rounded-full">
                      Needs grading
                    </span>
                  )}

                  <button
                    onClick={() =>
                      setGradingId(
                        gradingId === attempt.id ? null : attempt.id
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium
                               border border-blue-200 bg-blue-50 text-blue-700
                               hover:bg-blue-100 transition-colors"
                  >
                    {gradingId === attempt.id ? "Close" : "View / Grade"}
                  </button>
                </div>
              </div>

              {/* Grading panel */}
              {gradingId === attempt.id && quiz && (
                <div className="p-6 space-y-5">
                  {/* Case scenario */}
                  {quiz.type === "case_study" && quiz.caseScenario && (
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-xs font-semibold text-blue-800 mb-2">
                        Case Scenario
                      </p>
                      <div
                        className="rich-content text-sm"
                        dangerouslySetInnerHTML={{
                          __html: quiz.caseScenario,
                        }}
                      />
                    </div>
                  )}

                  {/* Questions + answers */}
                  {quiz.questions.map((question, index) => {
                    const studentAnswer = attempt.answers[question.id];
                    const correct = question.correctAnswers ?? [];

                    return (
                      <div key={question.id} className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-gray-400 mt-0.5">
                            Q{index + 1}.
                          </span>
                          <p className="text-sm text-gray-900">
                            {question.text}
                          </p>
                        </div>

                        {question.imageUrl && (
                          <img
                            src={question.imageUrl}
                            alt="Question"
                            className="max-h-32 rounded-xl border border-gray-100
                                       ml-6"
                          />
                        )}

                        <div className="ml-6">
                          {question.type !== "subjective" ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-gray-500">
                                Student:{" "}
                                <span className="font-medium text-gray-900">
                                  {Array.isArray(studentAnswer)
                                    ? studentAnswer.join(", ")
                                    : (studentAnswer as string) || "—"}
                                </span>
                              </span>
                              <span className="text-xs text-gray-500">
                                Correct:{" "}
                                <span className="font-medium text-green-600">
                                  {correct.join(", ")}
                                </span>
                              </span>
                              {(() => {
                                let correct_ = false;
                                if (question.type === "mcq_single") {
                                  correct_ = studentAnswer === correct[0];
                                } else {
                                  const sa = Array.isArray(studentAnswer)
                                    ? studentAnswer
                                    : [];
                                  correct_ =
                                    [...correct].sort().join(",") ===
                                    [...sa].sort().join(",");
                                }
                                return (
                                  <span
                                    className={cn(
                                      "text-xs font-medium",
                                      correct_
                                        ? "text-green-600"
                                        : "text-red-500"
                                    )}
                                  >
                                    {correct_ ? "✓ Correct" : "✗ Wrong"}
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                Student answer:
                              </p>
                              <div className="p-3 bg-gray-50 rounded-xl
                                              text-sm text-gray-700">
                                {(studentAnswer as string) ||
                                  "No answer provided"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Subjective marks input */}
                  {quiz.questions.some((q) => q.type === "subjective") && (
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium
                                          text-gray-700 mb-1">
                          Subjective marks (out of{" "}
                          {quiz.questions
                            .filter((q) => q.type === "subjective")
                            .reduce((s, q) => s + q.marks, 0)}
                          )
                        </label>
                        <input
                          type="number"
                          value={subjectiveScores[attempt.id] ?? ""}
                          onChange={(e) =>
                            setSubjectiveScores((prev: Record<string, number>) => ({
                              ...prev,
                              [attempt.id]: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-24 px-3 py-2 border border-gray-200
                                     rounded-xl text-sm text-gray-900 bg-white
                                     focus:outline-none focus:ring-2
                                     focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium
                                          text-gray-700 mb-1">
                          Feedback (optional)
                        </label>
                        <textarea
                          value={feedback[attempt.id] ?? ""}
                          onChange={(e) =>
                            setFeedback((prev) => ({
                              ...prev,
                              [attempt.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200
                                     rounded-xl text-sm text-gray-900 bg-white
                                     focus:outline-none focus:ring-2
                                     focus:ring-blue-500 resize-none"
                          placeholder="Optional feedback for the student..."
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleGrade(attempt)}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                               hover:bg-blue-700 disabled:bg-blue-400 text-white
                               text-sm font-medium rounded-xl transition-colors"
                  >
                    <Check size={15} />
                    {saving ? "Saving..." : "Save grade"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}