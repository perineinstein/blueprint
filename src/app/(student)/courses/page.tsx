"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import Link from "next/link";
import CourseThumbnail from "@/components/student/CourseThumbnail";

export default function CourseCataloguePage() {
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Wait for Firebase Auth to restore the session, otherwise the read goes
    // out unauthenticated.
    if (authLoading || !user) return;
    async function fetchCourses() {
      try {
        // The published filter must stay in the query: security rules do not
        // filter results, they reject queries that could return unpublished docs.
        // Sorted client-side to avoid needing a composite index.
        const snap = await getDocs(
          query(collection(db, "courses"), where("published", "==", true))
        );
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
        list.sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
        setCourses(list);
      } catch (err) {
        console.error("Courses fetch error:", err);
        setError("Couldn't load courses. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, [authLoading, user]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">All Courses</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse and enroll in courses
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading courses...</div>
      ) : error ? (
        <div className="bg-red-50 rounded-2xl p-6 text-sm text-red-600">
          {error}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            No courses available yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="bg-white rounded-2xl border border-gray-100 p-5
                         hover:border-gray-200 hover:shadow-sm transition-all
                         group"
            >
              <CourseThumbnail
                courseId={course.id}
                title={course.title}
                thumbnailUrl={course.thumbnail}
                size="md"
                className="mb-4 group-hover:opacity-90 transition-opacity"
              />

              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {course.title}
              </h3>
              <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                {course.description}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-700">
                  {formatPrice(course.price)}
                </span>
                {course.totalDuration && (
                  <span className="text-xs text-gray-400">
                    {course.totalDuration}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}