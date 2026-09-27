"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Attempt, Exam } from "@/types";

interface AttemptWithExam extends Attempt {
  exam: Exam;
}

export default function ResultsPage() {
  const { appUser } = useAuth();
  const [attempts, setAttempts] = useState<AttemptWithExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      if (!appUser) return;

      const q = query(
        collection(db, "attempts"),
        where("userId", "==", appUser.id),
        where("status", "in", ["submitted", "graded"])
      );

      const snap = await getDocs(q);

      const results = await Promise.all(
        snap.docs.map(async (d) => {
          const attempt = { id: d.id, ...d.data() } as Attempt;
          const examSnap = await getDoc(doc(db, "exams", attempt.examId));
          if (!examSnap.exists()) return null;
          return {
            ...attempt,
            exam: { id: examSnap.id, ...examSnap.data() } as Exam,
          } as AttemptWithExam;
        })
      );

      setAttempts(results.filter(Boolean) as AttemptWithExam[]);
      setLoading(false);
    }

    fetchResults();
  }, [appUser]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">My Results</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your exam history and scores
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading results...</div>
      ) : attempts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            No exam results yet. Complete an exam to see your score.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <div
              key={attempt.id}
              className="bg-white rounded-2xl border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {attempt.exam.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {attempt.submitTime
                      ? new Date(
                          attempt.submitTime.toDate()
                        ).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                {/* Score badge */}
                {attempt.status === "graded" && attempt.percentScore !== null ? (
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full
                                 text-sm font-semibold ${
                                   attempt.passed
                                     ? "bg-green-50 text-green-700"
                                     : "bg-red-50 text-red-600"
                                 }`}
                    >
                      {attempt.percentScore}%
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {attempt.passed ? "Passed ✓" : "Failed ✗"}
                    </p>
                  </div>
                ) : (
                  <span className="px-3 py-1 bg-yellow-50 text-yellow-700
                                   text-xs font-medium rounded-full">
                    Awaiting grade
                  </span>
                )}
              </div>

              {/* Score breakdown */}
              {attempt.status === "graded" && attempt.score !== null && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <span>
                      Score: {attempt.score}/{attempt.totalMarks}
                    </span>
                    <span>
                      Pass mark: {attempt.exam.passMark}%
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        attempt.passed ? "bg-green-500" : "bg-red-400"
                      }`}
                      style={{ width: `${attempt.percentScore ?? 0}%` }}
                    />
                  </div>

                  {/* Admin feedback */}
                  {attempt.adminFeedback && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <span className="font-medium">Feedback: </span>
                        {attempt.adminFeedback}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}