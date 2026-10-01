"use client";

import { useEffect, useState } from "react";
import { useParams, } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Exam } from "@/types";
import Link from "next/link";

export default function ExamListPage() {
  const { courseId } = useParams() as { courseId: string };
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExams() {
      const q = query(
        collection(db, "exams"),
        where("courseId", "==", courseId),
        where("published", "==", true)
      );
      const snap = await getDocs(q);
      setExams(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam))
      );
      setLoading(false);
    }
    fetchExams();
  }, [courseId]);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Exams</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select an exam to begin
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading exams...</div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            No exams available for this course yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {exam.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-400">
                      {exam.durationMinutes} minutes
                    </span>
                    <span className="text-xs text-gray-400">
                      {exam.questions.length} questions
                    </span>
                    <span className="text-xs text-gray-400">
                      Pass mark: {exam.passMark}%
                    </span>
                  </div>
                </div>
                <Link
                  href={`/courses/${courseId}/exam/${exam.id}`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                             text-sm font-medium rounded-lg transition-colors"
                >
                  Start exam
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}