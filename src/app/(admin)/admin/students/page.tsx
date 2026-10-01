"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { AppUser, getAdminTrack } from "@/types";
import { useAuth } from "@/lib/hooks/useAuth";

interface StudentWithStats extends AppUser {
  enrollmentCount: number;
  completedCount: number;
}

export default function StudentsPage() {
  const { appUser } = useAuth();
  const adminTrack = appUser ? getAdminTrack(appUser.role) : null;
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchStudents() {
      try {
        // Get all students
        const studentsSnap = await getDocs(
          query(
            collection(db, "users"),
            where("role", "==", "student")
          )
        );

        // Track admins only see students enrolled in a course of their track
        let trackCourseIds: Set<string> | null = null;
        if (adminTrack) {
          const coursesSnap = await getDocs(
            query(collection(db, "courses"), where("trackId", "==", adminTrack))
          );
          trackCourseIds = new Set(
            coursesSnap.docs.map((c) => c.id)
          );
        }

        // Get enrollments for each student
        const studentsWithStats = await Promise.all(
          studentsSnap.docs.map(async (d) => {
            const student = { id: d.id, ...d.data() } as AppUser;

            const enrollmentsSnap = await getDocs(
              query(
                collection(db, "enrollments"),
                where("userId", "==", student.id)
              )
            );

            const enrollments = enrollmentsSnap.docs
              .map((e) => e.data())
              .filter((e) => !trackCourseIds || trackCourseIds.has(e.courseId));
            const completedCount = enrollments.filter(
              (e) => e.progressPercent === 100
            ).length;

            return {
              ...student,
              enrollmentCount: enrollments.length,
              completedCount,
            } as StudentWithStats;
          })
        );

        setStudents(
          trackCourseIds
            ? studentsWithStats.filter((s) => s.enrollmentCount > 0)
            : studentsWithStats
        );
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [adminTrack]);

  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <p className="text-sm text-gray-500 mt-1">
          All registered students on the platform
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        {[
          {
            label: "Total Students",
            value: students.length,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Total Enrollments",
            value: students.reduce((s, u) => s + u.enrollmentCount, 0),
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Courses Completed",
            value: students.reduce((s, u) => s + u.completedCount, 0),
            color: "text-green-600",
            bg: "bg-green-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-sm px-4 py-2.5 md:py-2 border border-gray-200
                     rounded-lg text-sm text-gray-900 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading students...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {search ? "No students match your search." : "No students yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] lg:min-w-0">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  STUDENT
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  EMAIL
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  ENROLLED
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  COMPLETED
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  JOINED
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar + Name */}
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full bg-blue-100 flex
                                   items-center justify-center flex-shrink-0"
                      >
                        <span className="text-xs font-semibold text-blue-700">
                          {student.name?.charAt(0).toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {student.name}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 md:px-6 py-4">
                    <span className="text-sm text-gray-500">
                      {student.email}
                    </span>
                  </td>

                  {/* Enrollments */}
                  <td className="px-4 md:px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5
                                 rounded-full text-xs font-medium ${
                                   student.enrollmentCount > 0
                                     ? "bg-blue-50 text-blue-700"
                                     : "bg-gray-100 text-gray-500"
                                 }`}
                    >
                      {student.enrollmentCount} course
                      {student.enrollmentCount !== 1 ? "s" : ""}
                    </span>
                  </td>

                  {/* Completed */}
                  <td className="px-4 md:px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5
                                 rounded-full text-xs font-medium ${
                                   student.completedCount > 0
                                     ? "bg-green-50 text-green-700"
                                     : "bg-gray-100 text-gray-500"
                                 }`}
                    >
                      {student.completedCount} completed
                    </span>
                  </td>

                  {/* Joined date */}
                  <td className="px-4 md:px-6 py-4">
                    <span className="text-sm text-gray-400">
                      {student.createdAt
                        ? new Date(
                            student.createdAt.toDate()
                          ).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}