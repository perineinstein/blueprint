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
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Enrollment, Course } from "@/types";
import Link from "next/link";
import { getCourseLearnLink } from "@/lib/utils/courseLink";
import { formatPrice } from "@/lib/utils/formatting";
import CourseThumbnail from "@/components/student/CourseThumbnail";
import { getCourseColor } from "@/lib/utils/courseColors";

interface EnrolledCourse extends Course {
  enrollment: Enrollment;
}

export default function MyCoursesPage() {
  const { appUser } = useAuth();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in-progress" | "completed">("all");

  useEffect(() => {
    async function fetchMyCourses() {
      if (!appUser) return;

      const q = query(
        collection(db, "enrollments"),
        where("userId", "==", appUser.id),
        where("status", "==", "active")
      );
      const snap = await getDocs(q);

      const enrolled = await Promise.all(
        snap.docs.map(async (d) => {
          const enrollment = { id: d.id, ...d.data() } as Enrollment;
          const courseSnap = await getDoc(doc(db, "courses", enrollment.courseId));
          if (!courseSnap.exists()) return null;
          return {
            id: courseSnap.id,
            ...courseSnap.data(),
            enrollment,
          } as EnrolledCourse;
        })
      );

      setCourses(enrolled.filter(Boolean) as EnrolledCourse[]);
      setLoading(false);
    }

    fetchMyCourses();
  }, [appUser]);

  const filtered = courses.filter((c) => {
    const progress = c.enrollment.progressPercent ?? 0;
    if (filter === "completed") return progress === 100;
    if (filter === "in-progress") return progress > 0 && progress < 100;
    return true;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">My Courses</h1>
        <p className="text-sm text-gray-500 mt-1">
          Courses you're currently enrolled in
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {(["all", "in-progress", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors
                       capitalize ${
                         filter === f
                           ? "bg-blue-600 text-white"
                           : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                       }`}
          >
            {f === "all" ? "All" : f === "in-progress" ? "In progress" : "Completed"}
            {f !== "all" && (
              <span className="ml-1.5 opacity-70">
                (
                {
                  courses.filter((c) => {
                    const p = c.enrollment.progressPercent ?? 0;
                    return f === "completed" ? p === 100 : p > 0 && p < 100;
                  }).length
                }
                )
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading your courses...</div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-gray-900 text-sm font-medium mb-1">
            No courses yet
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Browse our catalogue and enroll in your first course
          </p>
          <Link
            href="/courses"
            className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            Browse courses
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            No courses match this filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {filtered.map((course) => {
            const color = getCourseColor(course.id);
            const progress = course.enrollment.progressPercent ?? 0;
            const isCompleted = progress === 100;

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-gray-100 p-5
                           hover:border-gray-200 transition-colors"
              >
                <div className="relative">
                  <CourseThumbnail
                    courseId={course.id}
                    title={course.title}
                    thumbnailUrl={course.thumbnail}
                    size="md"
                    className="mb-4"
                  />
                  {isCompleted && (
                    <span className="absolute top-2 right-2 px-2 py-1 bg-white
                                     text-green-700 text-xs font-medium rounded-full
                                     shadow-sm">
                      ✓ Completed
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {course.title}
                </h3>
                <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                  {course.description}
                </p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full bg-gradient-to-r ${color.bg} transition-all`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <Link
                  href={getCourseLearnLink(course.id, course.trackId)}
                  className={`block w-full text-center px-4 py-2 ${color.light}
                             ${color.text} text-sm font-medium rounded-lg
                             hover:opacity-80 transition-opacity`}
                >
                  {isCompleted ? "Review course" : "Continue learning"} →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}