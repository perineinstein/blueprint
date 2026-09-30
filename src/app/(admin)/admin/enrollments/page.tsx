"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Enrollment, Course, AppUser, Attempt } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import Link from "next/link";

interface EnrollmentWithDetails extends Enrollment {
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  coursePrice: number;
  examAttempt?: {
    attemptId: string;
    examId: string;
    status: string;
    percentScore: number | null;
  } | null;
}

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  useEffect(() => {
    async function fetchEnrollments() {
      try {
        const enrollmentsSnap = await getDocs(
          collection(db, "enrollments")
        );

        const rawEnrollments = enrollmentsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Enrollment)
        );

        // Fetch each unique user / course once, then look up from maps
        const userIds = [...new Set(rawEnrollments.map((e) => e.userId))];
        const courseIds = [...new Set(rawEnrollments.map((e) => e.courseId))];

        const [userSnaps, courseSnaps] = await Promise.all([
          Promise.all(userIds.map((id) => getDoc(doc(db, "users", id)))),
          Promise.all(courseIds.map((id) => getDoc(doc(db, "courses", id)))),
        ]);

        const usersById = new Map<string, AppUser | undefined>(
          userSnaps.map((s, i) => [userIds[i], s.data() as AppUser | undefined])
        );
        const coursesById = new Map<string, Course | undefined>(
          courseSnaps.map((s, i) => [
            courseIds[i],
            s.data() as Course | undefined,
          ])
        );

        const enriched = await Promise.all(
          rawEnrollments.map(async (enrollment) => {
            const user = usersById.get(enrollment.userId);
            const course = coursesById.get(enrollment.courseId);

            // Check for exam attempts for this student + course
            let examAttempt: EnrollmentWithDetails["examAttempt"] = null;
            try {
              const attemptsSnap = await getDocs(
                query(
                  collection(db, "attempts"),
                  where("userId", "==", enrollment.userId),
                  where("courseId", "==", enrollment.courseId)
                )
              );

              if (!attemptsSnap.empty) {
                const latestAttempt = attemptsSnap.docs
                  .map((a) => ({ id: a.id, ...a.data() } as Attempt))
                  .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0))[0];
                
                examAttempt = {
                  attemptId: latestAttempt.id,
                  examId: latestAttempt.examId,
                  status: latestAttempt.status,
                  percentScore: latestAttempt.percentScore,
                };
              }
            } catch (error) {
              // attempts query might fail if no index — ignore or log
              console.warn("Could not fetch attempts", error);
            }

            return {
              ...enrollment,
              studentName: user?.name ?? "Unknown",
              studentEmail: user?.email ?? "—",
              courseTitle: course?.title ?? "Unknown course",
              coursePrice: course?.price ?? 0,
              examAttempt,
            } as EnrollmentWithDetails;
          })
        );

        // Sort by most recent
        enriched.sort((a, b) => {
          const aTime = a.enrolledAt?.toDate?.()?.getTime() ?? 0;
          const bTime = b.enrolledAt?.toDate?.()?.getTime() ?? 0;
          return bTime - aTime;
        });

        setEnrollments(enriched);
      } catch (error) {
        console.error("Error fetching enrollments:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEnrollments();
  }, []);

  // Filter + search
  const filtered = enrollments.filter((e) => {
    const matchesSearch =
      e.studentName.toLowerCase().includes(search.toLowerCase()) ||
      e.studentEmail.toLowerCase().includes(search.toLowerCase()) ||
      e.courseTitle.toLowerCase().includes(search.toLowerCase());

    const matchesFilter = filter === "all" ? true : e.status === filter;

    return matchesSearch && matchesFilter;
  });

  // Stats
  const totalRevenue = enrollments
    .filter((e) => e.status === "active")
    .reduce((sum: number, e) => sum + e.coursePrice, 0);

  const activeCount = enrollments.filter(
    (e) => e.status === "active"
  ).length;

  const expiredCount = enrollments.filter(
    (e) => e.status === "expired"
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Enrollments</h1>
        <p className="text-sm text-gray-500 mt-1">
          All course enrollments across the platform
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total Enrollments",
            value: enrollments.length,
            color: "text-blue-600",
          },
          {
            label: "Active",
            value: activeCount,
            color: "text-green-600",
          },
          {
            label: "Expired",
            value: expiredCount,
            color: "text-red-500",
          },
          {
            label: "Total Revenue",
            value: formatPrice(totalRevenue),
            color: "text-purple-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or course..."
          className="flex-1 max-w-sm px-4 py-2 border border-gray-200
                     rounded-xl text-sm text-gray-900 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1">
          {(["all", "active", "expired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-medium
                          transition-colors capitalize ${
                            filter === f
                              ? "bg-blue-600 text-white"
                              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading enrollments...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {search || filter !== "all"
              ? "No enrollments match your filters."
              : "No enrollments yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  STUDENT
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  COURSE
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  STATUS
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  PROGRESS
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  EXAM
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  ENROLLED
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">
                  EXPIRES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((enrollment) => {
                const enrolledDate = enrollment.enrolledAt?.toDate?.();
                const expiryDate = enrollment.expiryDate?.toDate?.();
                const isExpiringSoon =
                  expiryDate &&
                  expiryDate > new Date() &&
                  expiryDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                return (
                  <tr
                    key={enrollment.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Student */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-blue-100
                                     flex items-center justify-center flex-shrink-0"
                        >
                          <span className="text-xs font-semibold text-blue-700">
                            {enrollment.studentName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {enrollment.studentName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {enrollment.studentEmail}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Course */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 font-medium">
                        {enrollment.courseTitle}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatPrice(enrollment.coursePrice)}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5
                                   rounded-full text-xs font-medium ${
                                     enrollment.status === "active"
                                       ? "bg-green-50 text-green-700"
                                       : enrollment.status === "expired"
                                       ? "bg-red-50 text-red-600"
                                       : "bg-gray-100 text-gray-500"
                                   }`}
                      >
                        {enrollment.status}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{
                              width: `${enrollment.progressPercent ?? 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {enrollment.progressPercent ?? 0}%
                        </span>
                      </div>
                    </td>

                    {/* Exam / Grade */}
                    <td className="px-6 py-4">
                      {enrollment.examAttempt ? (
                        enrollment.examAttempt.status === "graded" ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              (enrollment.examAttempt.percentScore ?? 0) >= 50
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {enrollment.examAttempt.percentScore}%
                          </span>
                        ) : (
                          <Link
                            href={`/admin/courses/${enrollment.courseId}/exams/${enrollment.examAttempt.examId}/grade`}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            Grade
                          </Link>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">
                          No attempt
                        </span>
                      )}
                    </td>

                    {/* Enrolled date */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {enrolledDate
                          ? enrolledDate.toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </td>

                    {/* Expiry date */}
                    <td className="px-6 py-4">
                      <span
                        className={`text-sm ${
                          isExpiringSoon
                            ? "text-orange-500 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        {expiryDate
                          ? expiryDate.toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                        {isExpiringSoon && (
                          <span className="ml-1 text-xs">⚠</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              Showing {filtered.length} of {enrollments.length} enrollments
            </p>
          </div>
        </div>
      )}
    </div>
  );
}