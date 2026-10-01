"use client";

import EnrollButton from "@/components/student/EnrollButton";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course, Material, Enrollment, TRACKS } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import Link from "next/link";
import { getCourseLearnLink } from "@/lib/utils/courseLink";
import CourseThumbnail from "@/components/student/CourseThumbnail";

export default function CourseDetailPage() {
  const { courseId } = useParams() as { courseId: string };
  const { appUser } = useAuth();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [materialsVisible, setMaterialsVisible] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!appUser) return;

    try {
      // Course info is readable by any signed-in student. Materials and the
      // enrollment check must not be able to break the page: materials are
      // enrollment-gated by the security rules, so a denied read is expected
      // for students who haven't enrolled.
      const [courseSnap, materialsSnap, enrollmentSnap] = await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDocs(
          query(
            collection(db, "courses", courseId, "materials"),
            orderBy("order", "asc")
          )
        ).catch(() => null),
        getDoc(doc(db, "enrollments", `${appUser.id}_${courseId}`)).catch(
          () => null
        ),
      ]);

      if (courseSnap.exists()) {
        setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
      }

      setMaterialsVisible(materialsSnap !== null);
      setMaterials(
        materialsSnap
          ? materialsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Material))
          : []
      );

      if (enrollmentSnap?.exists()) {
        const e = {
          id: enrollmentSnap.id,
          ...enrollmentSnap.data(),
        } as Enrollment;
        const now = new Date();
        const expiry = e.expiryDate?.toDate();
        if (e.status === "active" && expiry && expiry > now) {
          setEnrollment(e);
        }
      }
    } catch (err) {
      console.error("Course detail fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [appUser, courseId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (paymentStatus === "success") {
      setPaymentSuccess(true);
      const timer = setTimeout(() => fetchAll(), 3000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, fetchAll]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading course...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-red-400">Course not found.</p>
      </div>
    );
  }

  const isEnrolled = enrollment !== null;

  return (
    <div className="max-w-3xl">

      {/* Payment success banner */}
      {paymentSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl">
          <p className="text-sm font-medium text-green-700">
            🎉 Payment successful! Your enrollment is being activated...
          </p>
          <p className="text-xs text-green-500 mt-1">
            This may take a few seconds. Refresh if access doesn't appear.
          </p>
        </div>
      )}

      {/* Course header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-8 mb-6">
        <CourseThumbnail
          courseId={courseId}
          title={course.title}
          size="lg"
          className="mb-6"
        />

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {course.title}
        </h1>
        <p className="text-sm text-gray-500 mb-6">{course.description}</p>

        {course.trackId && (
          <p className="text-xs text-gray-500 mb-6">
            This course is part of the{" "}
            <Link
              href={`/tracks/${course.trackId}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {TRACKS.find((t) => t.id === course.trackId)?.name ??
                course.trackId.toUpperCase()}{" "}
              track
            </Link>
          </p>
        )}

        <div className="flex items-center gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-400">Price</p>
            <p className="text-xl font-semibold text-blue-700">
              {formatPrice(course.price)}
            </p>
          </div>
          {course.totalDuration && (
            <div>
              <p className="text-xs text-gray-400">Duration</p>
              <p className="text-sm font-medium text-gray-900">
                {course.totalDuration}
              </p>
            </div>
          )}
          {materialsVisible && (
            <div>
              <p className="text-xs text-gray-400">Materials</p>
              <p className="text-sm font-medium text-gray-900">
                {materials.length} items
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        {isEnrolled ? (
          <Link
            href={getCourseLearnLink(courseId, course.trackId)}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            Continue learning →
          </Link>
        ) : (
          <div className="flex items-center gap-4">
            <EnrollButton courseId={courseId} price={course.price} />
            <p className="text-xs text-gray-400">
              One-time payment ·{" "}
              {course.accessDurationDays === 365
                ? "1 year access"
                : course.accessDurationDays === 30
                ? "1 month access"
                : course.accessDurationDays === 90
                ? "3 months access"
                : course.accessDurationDays === 180
                ? "6 months access"
                : `${course.accessDurationDays} days access`}
            </p>
          </div>
        )}
      </div>

      {/* Materials section */}
      {isEnrolled ? (
        // ── Enrolled: show full materials list ───────────────
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Course content
            </h2>
            <span className="text-xs text-gray-400">
              {materials.length} items
            </span>
          </div>

          {materials.length === 0 ? (
            <div className="p-6 text-sm text-gray-400">
              No materials added yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {materials.map((material, index) => (
                <div
                  key={material.id}
                  className="flex items-center gap-4 px-4 md:px-6 py-4
                             hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-gray-300 w-5">
                    {index + 1}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      material.type === "video"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {material.type.toUpperCase()}
                  </span>
                  <span className="flex-1 text-sm text-gray-900">
                    {material.title}
                  </span>
                  <span className="text-green-500 text-xs">✓ Unlocked</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── Not enrolled: show locked paywall state ───────────
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Course content
            </h2>
          </div>

          {/* Locked preview — show count but not details */}
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center
                            justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {materialsVisible
                ? `${materials.length} lesson${materials.length !== 1 ? "s" : ""} locked`
                : "Course content locked"}
            </h3>
            <p className="text-xs text-gray-400 mb-6 max-w-xs mx-auto">
              Enroll in this course to unlock all materials, videos, PDFs,
              and exams.
            </p>
            <EnrollButton courseId={courseId} price={course.price} />
          </div>

          {/* Blurred material preview */}
          {materials.length > 0 && (
            <div className="border-t border-gray-100 relative">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent
                              to-white z-10 pointer-events-none" />

              {materials.slice(0, 3).map((material, index) => (
                <div
                  key={material.id}
                  className="flex items-center gap-4 px-4 md:px-6 py-4 border-b
                             border-gray-50 opacity-40 select-none"
                >
                  <span className="text-xs text-gray-300 w-5">
                    {index + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400">
                    {material.type.toUpperCase()}
                  </span>
                  <span className="flex-1 text-sm text-gray-400 blur-sm">
                    {material.title}
                  </span>
                  <span className="text-gray-300 text-sm">🔒</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}