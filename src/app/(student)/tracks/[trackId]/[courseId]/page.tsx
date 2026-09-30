"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course, Module, Enrollment, TrackId } from "@/types";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Lock,
} from "lucide-react";

const TRACK_COLORS: Record<TrackId, string> = {
  nclex: "bg-blue-600",
  ielts: "bg-emerald-600",
};

type ModuleProgressMap = Record<string, { total: number; completed: number }>;
export default function CourseModulesPage() {
  const { trackId, courseId } = useParams() as {
    trackId: TrackId;
    courseId: string;
  };
  const { appUser } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment>>({});
  const [moduleProgress, setModuleProgress] = useState<ModuleProgressMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appUser) return;

      try {
        // Enrollment, course and modules are independent — fetch in parallel
        const enrollmentId = `${appUser.id}_${courseId}`;
        const enrollPromise = getDoc(doc(db, "enrollments", enrollmentId));
        const courseModulesPromise = Promise.all([
          getDoc(doc(db, "courses", courseId)),
          getDocs(
            query(
              collection(db, "courses", courseId, "modules"),
              orderBy("order", "asc")
            )
          ),
        ]);
        // If we redirect below these are never awaited; avoid unhandled rejections.
        courseModulesPromise.catch(() => {});

        const enrollSnap = await enrollPromise;

        if (!enrollSnap.exists()) {
          router.push(`/courses/${courseId}`);
          return;
        }

        const e = { id: enrollSnap.id, ...enrollSnap.data() } as Enrollment;
        const expiry = e.expiryDate?.toDate();
        if (e.status !== "active" || !expiry || expiry < new Date()) {
          router.push(`/courses/${courseId}`);
          return;
        }
        setEnrollment(e);

        const [courseSnap, modulesSnap] = await courseModulesPromise;

        if (courseSnap.exists()) {
          setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
        }

        const moduleList = modulesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Module)
        );
        setModules(moduleList);

        // Calculate progress per module
        const progress: Record<string,
          { total: number; completed: number }
        > = {};

        await Promise.all(
          moduleList.map(async (mod) => {
            const topicsSnap = await getDocs(
              collection(
                db,
                "courses",
                courseId,
                "modules",
                mod.id,
                "topics"
              )
            );
            const topicIds = topicsSnap.docs.map((d) => d.id);
            const completedTopics = e.completedTopics ?? [];
            const completed = topicIds.filter((id) =>
              completedTopics.includes(id)
            ).length;
            progress[mod.id] = {
              total: topicIds.length,
              completed,
            };
          })
        );
        setModuleProgress(progress);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [appUser, courseId, trackId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Back */}
      <Link
        href={`/tracks/${trackId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400
                   hover:text-gray-600 mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        Back to {trackId.toUpperCase()}
      </Link>

      {/* Course header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          {course?.title}
        </h1>
        <p className="text-sm text-gray-500">{course?.description}</p>
      </div>

      {/* Modules list */}
      <div className="space-y-3">
        {modules.map((module, index) => {
          const prog = moduleProgress[module.id] ?? { total: 0, completed: 0 };
          const isComplete =
            prog.total > 0 && prog.completed === prog.total;
          const percent =
            prog.total > 0
              ? Math.round((prog.completed / prog.total) * 100)
              : 0;

          return (
            <Link
              key={module.id}
              href={`/tracks/${trackId}/${courseId}/${module.id}`}
              className="block bg-white rounded-2xl border border-gray-100
                         hover:border-gray-200 hover:shadow-sm transition-all p-4 md:p-5"
            >
              <div className="flex items-center gap-4">
                {/* Module number */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center
                              justify-center flex-shrink-0 ${
                                TRACK_COLORS[trackId as TrackId]
                              }`}
                >
                  <span className="text-white font-bold text-sm">
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {module.title}
                    </p>
                    {isComplete && (
                      <CheckCircle
                        size={15}
                        className="text-green-500 flex-shrink-0"
                      />
                    )}
                  </div>

                  {/* Progress bar */}
                  {prog.total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs
                                      text-gray-400 mb-1">
                        <span>
                          {prog.completed}/{prog.total} topics
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                          className="bg-blue-600 h-1 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <ChevronRight
                  size={18}
                  className="text-gray-300 flex-shrink-0"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}