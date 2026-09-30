"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Course } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);


  async function fetchCourses() {
    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course)));
    setLoading(false);
  }

  useEffect(() => {
    fetchCourses();
  }, []);

  async function togglePublish(course: Course) {
    await updateDoc(doc(db, "courses", course.id), {
      published: !course.published,
    });
    fetchCourses();
  }

  async function deleteCourse(course: Course) {
    setDeleteTarget(course);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "courses", deleteTarget.id));
      setDeleteTarget(null);
      fetchCourses();
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your course catalogue
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="px-4 py-2.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white
                     text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          + New course
        </Link>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading courses...</div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No courses yet.</p>
          <Link
            href="/admin/courses/new"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Create your first course →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] lg:min-w-0">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  COURSE
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  PRICE
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  STATUS
                </th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 md:px-6 py-4">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 md:px-6 py-4">
                    <Link href={`/admin/courses/${course.id}`}>
                      <p className="text-sm font-medium text-gray-900 hover:text-blue-600
                                    transition-colors cursor-pointer">
                        {course.title}
                      </p>
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {course.description}
                    </p>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <span className="text-sm text-gray-700">
                      {formatPrice(course.price)}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        course.published
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {course.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => togglePublish(course)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border
                                  transition-colors ${
                                    course.published
                                      ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                      : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                  }`}
                      >
                        {course.published ? "Unpublish" : "Publish"}
                      </button>

                      <Link
                        href={`/admin/courses/${course.id}/edit`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border
                                  border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100
                                  transition-colors"
                      >
                        Edit
                      </Link>

                      <Link
                        href={`/admin/courses/${course.id}/materials`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border
                                  border-purple-200 bg-purple-50 text-purple-700
                                  hover:bg-purple-100 transition-colors"
                      >
                        Materials
                      </Link>

                      <Link
                        href={`/admin/courses/${course.id}/exams`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border
                                  border-amber-200 bg-amber-50 text-amber-700
                                  hover:bg-amber-100 transition-colors"
                      >
                        Exams
                      </Link>

                      <button
                        onClick={() => deleteCourse(course)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border
                                  border-red-200 bg-red-50 text-red-600 hover:bg-red-100
                                  transition-colors"
                      >
                        Delete
                      </button>
                    </div>
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