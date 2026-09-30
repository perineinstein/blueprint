"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase/client";
import { Course, Enrollment, AppUser, Exam, Attempt } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import CourseThumbnail from "@/components/student/CourseThumbnail";

interface StudentEnrollment {
  student: AppUser;
  enrollment: Enrollment;
  latestAttempt: Attempt | null;
}

export default function AdminCourseDetailPage() {
  const { courseId } = useParams() as { courseId: string };
  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [courseSnap, enrollmentsSnap, examsSnap] = await Promise.all([
          getDoc(doc(db, "courses", courseId)),
          getDocs(
            query(
              collection(db, "enrollments"),
              where("courseId", "==", courseId)
            )
          ),
          getDocs(
            query(
              collection(db, "exams"),
              where("courseId", "==", courseId)
            )
          ),
        ]);

        if (courseSnap.exists()) {
          setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
        }

        setExams(
          examsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam))
        );

        const enrollmentData = await Promise.all(
          enrollmentsSnap.docs.map(async (d) => {
            const enrollment = { id: d.id, ...d.data() } as Enrollment;

            const userSnap = await getDoc(
              doc(db, "users", enrollment.userId)
            );
            const student = {
              id: userSnap.id,
              ...userSnap.data(),
            } as AppUser;

            const attemptsSnap = await getDocs(
              query(
                collection(db, "attempts"),
                where("userId", "==", enrollment.userId),
                where("courseId", "==", courseId)
              )
            );

            const attempts = attemptsSnap.docs
              .map((a) => ({ id: a.id, ...a.data() } as Attempt))
              .sort(
                (a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0)
              );

            return {
              student,
              enrollment,
              latestAttempt: attempts[0] ?? null,
            } as StudentEnrollment;
          })
        );

        setStudentEnrollments(enrollmentData);
      } catch (error) {
        console.error("Course detail error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-red-400">Course not found.</p>
      </div>
    );
  }

  const activeEnrollments = studentEnrollments.filter(
    (e) => e.enrollment.status === "active"
  );

  const avgProgress =
    activeEnrollments.length > 0
      ? Math.round(
          activeEnrollments.reduce(
            (sum: number, e: StudentEnrollment) =>
              sum + (e.enrollment.progressPercent ?? 0),
            0
          ) / activeEnrollments.length
        )
      : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href="/admin/courses" className="hover:text-gray-600">
              Courses
            </Link>
            <span>/</span>
            <span className="text-gray-600">{course.title}</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {course.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{course.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/admin/courses/${courseId}/edit`}
            className="px-4 py-2 rounded-xl text-sm font-medium border
                       border-blue-200 bg-blue-50 text-blue-700
                       hover:bg-blue-100 transition-colors"
          >
            Edit course
          </Link>
          <Link
            href={`/admin/courses/${courseId}/materials`}
            className="px-4 py-2 rounded-xl text-sm font-medium border
                       border-purple-200 bg-purple-50 text-purple-700
                       hover:bg-purple-100 transition-colors"
          >
            Materials
          </Link>
          <Link
            href={`/admin/courses/${courseId}/exams`}
            className="px-4 py-2 rounded-xl text-sm font-medium border
                       border-amber-200 bg-amber-50 text-amber-700
                       hover:bg-amber-100 transition-colors"
          >
            Exams
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          {
            label: "Price",
            value: formatPrice(course.price),
            color: "text-blue-600",
          },
          {
            label: "Students",
            value: activeEnrollments.length,
            color: "text-green-600",
          },
          {
            label: "Avg progress",
            value: `${avgProgress}%`,
            color: "text-purple-600",
          },
          {
            label: "Exams",
            value: exams.length,
            color: "text-amber-600",
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Students list */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100
                        overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Enrolled students ({activeEnrollments.length})
            </h2>
          </div>

          {activeEnrollments.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              No students enrolled yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeEnrollments.map((item: StudentEnrollment) => {
                const { student, enrollment, latestAttempt } = item;
                return (
                  <div key={enrollment.id} className="px-4 md:px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-gradient-to-br
                                     from-blue-400 to-violet-500 flex items-center
                                     justify-center flex-shrink-0"
                        >
                          <span className="text-white text-xs font-semibold">
                            {student.name?.charAt(0).toUpperCase() ?? "?"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {student.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {student.email}
                          </p>
                        </div>
                      </div>

                      {latestAttempt ? (
                        latestAttempt.status === "graded" ? (
                          <span
                            className={`px-3 py-1 rounded-full text-xs
                                       font-medium ${
                                         latestAttempt.passed
                                           ? "bg-green-50 text-green-700"
                                           : "bg-red-50 text-red-600"
                                       }`}
                          >
                            {latestAttempt.percentScore}%
                          </span>
                        ) : (
                          <Link
                            href={`/admin/courses/${courseId}/exams/${latestAttempt.examId}/grade`}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium
                                       border border-amber-200 bg-amber-50
                                       text-amber-700 hover:bg-amber-100
                                       transition-colors"
                          >
                            Grade exam
                          </Link>
                        )
                      ) : null}
                    </div>

                    <div className="mt-3 ml-11">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{enrollment.progressPercent ?? 0}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{
                            width: `${enrollment.progressPercent ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <CourseThumbnail
            courseId={courseId}
            title={course.title}
            thumbnailUrl={course.thumbnail}
            size="md"
          />

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase
                           tracking-wide mb-3">
              Course info
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: "Status",
                  value: course.published ? "Published" : "Draft",
                },
                { label: "Price", value: formatPrice(course.price) },
                { label: "Duration", value: course.totalDuration || "—" },
                {
                  label: "Access",
                  value: `${course.accessDurationDays ?? 365} days`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-gray-400">{item.label}</span>
                  <span className="text-xs font-medium text-gray-900">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {exams.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase
                             tracking-wide mb-3">
                Exams
              </h3>
              <div className="space-y-2">
                {exams.map((exam) => (
                  <Link
                    key={exam.id}
                    href={`/admin/courses/${courseId}/exams/${exam.id}/grade`}
                    className="flex items-center justify-between p-2 rounded-lg
                               hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xs text-gray-700">{exam.title}</span>
                    <span className="text-xs text-amber-600 font-medium">
                      Grade →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}