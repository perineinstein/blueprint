"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course, Material, Enrollment } from "@/types";
import VideoPlayer from "@/components/student/VideoPlayer";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export default function LearnPage() {
  const { courseId } = useParams() as { courseId: string };
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!appUser) return;

    try {
      const [courseSnap, materialsSnap] = await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDocs(
          query(
            collection(db, "courses", courseId, "materials"),
            orderBy("order", "asc")
          )
        ),
      ]);

      if (!courseSnap.exists()) {
        router.push("/courses");
        return;
      }

      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);

      const mats = materialsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Material)
      );
      setMaterials(mats);

      const enrollmentId = `${appUser.id}_${courseId}`;
      const enrollmentSnap = await getDoc(
        doc(db, "enrollments", enrollmentId)
      );

      if (!enrollmentSnap.exists()) {
        router.push(`/courses/${courseId}`);
        return;
      }

      const e = {
        id: enrollmentSnap.id,
        ...enrollmentSnap.data(),
      } as Enrollment;

      const expiry = e.expiryDate?.toDate();
      if (e.status !== "active" || !expiry || expiry < new Date()) {
        router.push(`/courses/${courseId}`);
        return;
      }

      setEnrollment(e);

      if (mats.length > 0) {
        setActiveMaterial(mats[0]);
      }
    } catch (error) {
      console.error("Error fetching course data:", error);
    } finally {
      setLoading(false);
    }
  }, [appUser, courseId, router]);

  useEffect(() => {
    if (!authLoading && appUser) {
      fetchData();
    }
    if (!authLoading && !appUser) {
      router.push("/login");
    }
  }, [authLoading, appUser, fetchData, router]);

  async function markComplete(materialId: string) {
    if (!enrollment) return;

    const enrollmentRef = doc(db, "enrollments", enrollment.id);
    const completed = enrollment.completedMaterials ?? [];

    if (completed.includes(materialId)) return;

    const newCompleted = [...completed, materialId];
    const progressPercent = Math.round(
      (newCompleted.length / materials.length) * 100
    );

    await updateDoc(enrollmentRef, {
      completedMaterials: arrayUnion(materialId),
      progressPercent,
    });

    setEnrollment((prev) =>
      prev
        ? { ...prev, completedMaterials: newCompleted, progressPercent }
        : prev
    );
  }

  function goToNext() {
    if (!activeMaterial) return;
    const currentIndex = materials.findIndex(
      (m) => m.id === activeMaterial.id
    );
    if (currentIndex < materials.length - 1) {
      setActiveMaterial(materials[currentIndex + 1]);
    }
  }

  function goToPrev() {
    if (!activeMaterial) return;
    const currentIndex = materials.findIndex(
      (m) => m.id === activeMaterial.id
    );
    if (currentIndex > 0) {
      setActiveMaterial(materials[currentIndex - 1]);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading course...</p>
      </div>
    );
  }

  if (!course || !enrollment) return null;

  const completed = enrollment.completedMaterials ?? [];
  const currentIndex = materials.findIndex(
    (m) => m.id === activeMaterial?.id
  );

  return (
    <div className="flex gap-6 h-[calc(100vh-4rem)]">

      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link
            href={`/courses/${courseId}`}
            className="text-xs text-gray-400 hover:text-gray-600 mb-1 block"
          >
            ← Back to course
          </Link>
          <h2 className="text-sm font-semibold text-gray-900 line-clamp-2">
            {course.title}
          </h2>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{enrollment.progressPercent ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${enrollment.progressPercent ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {materials.map((material, index) => {
            const isActive = activeMaterial?.id === material.id;
            const isDone = completed.includes(material.id);

            return (
              <button
                key={material.id}
                onClick={() => setActiveMaterial(material)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-gray-50",
                  "flex items-start gap-3 transition-colors",
                  isActive
                    ? "bg-blue-50 border-l-2 border-l-blue-600"
                    : "hover:bg-gray-50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center",
                    "justify-center text-xs font-medium border",
                    isDone
                      ? "bg-green-500 border-green-500 text-white"
                      : isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-gray-200 text-gray-400"
                  )}
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      isActive ? "text-blue-700" : "text-gray-700"
                    )}
                  >
                    {material.title}
                  </p>
                  <span
                    className={cn(
                      "text-xs",
                      material.type === "video"
                        ? "text-blue-400"
                        : "text-orange-400"
                    )}
                  >
                    {material.type.toUpperCase()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Exam link — add at bottom of sidebar */}
        <div className="p-4 border-t border-gray-100">
          <Link
            href={`/courses/${courseId}/exam`}
            className="block w-full text-center px-4 py-2 bg-orange-50
                      hover:bg-orange-100 text-orange-700 text-sm font-medium
                      rounded-lg transition-colors"
          >
            Take exam →
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeMaterial ? (
          <>
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">

              {/* Video */}
              {activeMaterial.type === "video" && activeMaterial.videoUrl && (
                <div className="h-full flex flex-col">
                  <VideoPlayer url={activeMaterial.videoUrl} />
                  <div className="p-6 border-t border-gray-100">
                    <h1 className="text-lg font-semibold text-gray-900">
                      {activeMaterial.title}
                    </h1>
                  </div>
                </div>
              )}

              {/* PDF */}
              {activeMaterial.type === "pdf" && activeMaterial.fileUrl && (
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <iframe
                      src={activeMaterial.fileUrl}
                      className="w-full h-full min-h-[500px]"
                      title={activeMaterial.title}
                    />
                  </div>
                  <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <h1 className="text-sm font-semibold text-gray-900">
                      {activeMaterial.title}
                    </h1>
                    <a
                      href={activeMaterial.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                </div>
              )}

              {/* Note */}
              {activeMaterial.type === "note" && (
                <div className="p-8">
                  <h1 className="text-lg font-semibold text-gray-900 mb-4">
                    {activeMaterial.title}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Note content coming soon.
                  </p>
                </div>
              )}
            </div>

            {/* Navigation bar */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
              <button
                onClick={goToPrev}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>

              {!completed.includes(activeMaterial.id) ? (
                <button
                  onClick={() => markComplete(activeMaterial.id)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700
                             text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Mark as complete ✓
                </button>
              ) : (
                <span className="px-6 py-2 bg-green-50 text-green-700
                                 text-sm font-medium rounded-lg">
                  ✓ Completed
                </span>
              )}

              <button
                onClick={goToNext}
                disabled={currentIndex === materials.length - 1}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100
                          flex items-center justify-center">
            <p className="text-sm text-gray-400">
              Select a material from the sidebar to begin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}