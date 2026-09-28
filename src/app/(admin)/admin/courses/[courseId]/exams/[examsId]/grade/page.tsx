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
import { Attempt, Exam } from "@/types";
import Link from "next/link";

interface AttemptWithUser extends Attempt {
  userName: string;
  userEmail: string;
}

export default function GradePage() {
  const { courseId, examId } = useParams() as {
    courseId: string;
    examId: string;
  };
  const { appUser } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<AttemptWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function fetchData() {
    try {
      const [examSnap, attemptsSnap] = await Promise.all([
        getDoc(doc(db, "exams", examId)),
        getDocs(
          query(
            collection(db, "attempts"),
            where("examId", "==", examId),
            where("status", "in", ["submitted", "graded"])
          )
        ),
      ]);

      if (examSnap.exists()) {
        setExam({ id: examSnap.id, ...examSnap.data() } as Exam);
      }

      const attemptData = await Promise.all(
        attemptsSnap.docs.map(async (d) => {
          const attempt = { id: d.id, ...d.data() } as Attempt;

          // Guard — skip if userId is missing
          if (!attempt.userId) {
            return {
              ...attempt,
              userName: "Unknown",
              userEmail: "—",
            } as AttemptWithUser;
          }

          try {
            const userSnap = await getDoc(doc(db, "users", attempt.userId));
            const userData = userSnap.data();
            return {
              ...attempt,
              userName: userData?.name ?? "Unknown",
              userEmail: userData?.email ?? "—",
            } as AttemptWithUser;
          } catch {
            return {
              ...attempt,
              userName: "Unknown",
              userEmail: "—",
            } as AttemptWithUser;
          }
        })
      );

      setAttempts(attemptData.filter(Boolean) as AttemptWithUser[]);
    } catch (error) {
      console.error("Grade fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [examId]);

  async function handleGrade(attempt: AttemptWithUser) {
    if (!exam || !appUser) return;
    setSaving(true);

    try {
      const subjectiveScore = scores[attempt.id] ?? 0;
      const mcqScore = attempt.score ?? 0;
      const totalScore = mcqScore + subjectiveScore;
      const percentScore = Math.round(
        (totalScore / attempt.totalMarks) * 100
      );
      const passed = percentScore >= exam.passMark;

      await updateDoc(doc(db, "attempts", attempt.id), {
        status: "graded",
        score: totalScore,
        percentScore,
        passed,
        adminFeedback: feedback[attempt.id] ?? "",
        gradedAt: serverTimestamp(),
        gradedBy: appUser.id,
      });

      setGradingId(null);
      fetchData();
    } catch (error) {
      console.error("Grading error:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-400">Loading submissions...</div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/admin/courses" className="hover:text-gray-600">
            Courses
          </Link>
          <span>/</span>
          <Link
            href={`/admin/courses/${courseId}/exams`}
            className="hover:text-gray-600"
          >
            Exams
          </Link>
          <span>/</span>
          <span className="text-gray-600">Grade</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {exam?.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {attempts.length} submission{attempts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <div
              key={attempt.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              {/* Attempt header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {attempt.userName}
                  </p>
                  <p className="text-xs text-gray-400">{attempt.userEmail}</p>
                </div>
                <div className="flex items-center gap-3">
                  {attempt.status === "graded" ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        attempt.passed
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {attempt.percentScore}% —{" "}
                      {attempt.passed ? "Passed" : "Failed"}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-full">
                      Needs grading
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setGradingId(
                        gradingId === attempt.id ? null : attempt.id
                      )
                    }
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs
                               font-medium rounded-lg hover:bg-blue-100"
                  >
                    {gradingId === attempt.id ? "Close" : "Grade"}
                  </button>
                </div>
              </div>

              {/* Grading panel */}
              {gradingId === attempt.id && exam && (
                <div className="p-6 space-y-6">
                  {/* All questions and answers */}
                  {exam.questions.map((question, index) => (
                    <div key={question.id} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-500 mt-0.5">
                          Q{index + 1}.
                        </span>
                        <p className="text-sm text-gray-900">{question.text}</p>
                      </div>

                      <div className="ml-6">
                        {question.type === "mcq_single" ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              Answer:{" "}
                              <span className="font-medium text-gray-900">
                                {attempt.answers[question.id] ?? "—"}
                              </span>
                            </span>
                            <span className="text-xs text-gray-500">
                              Correct:{" "}
                              <span className="font-medium text-green-600">
                                {question.correctAnswer}
                              </span>
                            </span>
                            <span
                              className={`text-xs font-medium ${
                                attempt.answers[question.id] ===
                                question.correctAnswer
                                  ? "text-green-600"
                                  : "text-red-500"
                              }`}
                            >
                              {attempt.answers[question.id] ===
                              question.correctAnswer
                                ? "✓ Correct"
                                : "✗ Wrong"}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">
                              Student answer:
                            </p>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                              {attempt.answers[question.id] ||
                                "No answer provided"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Subjective score input */}
                  {exam.questions.some((q) => q.type === "subjective") && (
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subjective marks (out of{" "}
                          {exam.questions
                            .filter((q) => q.type === "subjective")
                            .reduce((sum, q) => sum + q.marks, 0)}
                          )
                        </label>
                        <input
                          type="number"
                          value={scores[attempt.id] ?? ""}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [attempt.id]: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-32 px-3 py-2 border border-gray-200
                                     rounded-lg text-sm text-gray-900 bg-white
                                     focus:outline-none focus:ring-2
                                     focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                     rounded-lg text-sm text-gray-900 bg-white
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
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                               disabled:bg-blue-400 text-white text-sm font-medium
                               rounded-lg transition-colors"
                  >
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