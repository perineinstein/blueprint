"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course, Enrollment, TrackId, TRACKS } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import CourseThumbnail from "@/components/student/CourseThumbnail";
import Link from "next/link";
import {
  BookOpen,
  Lock,
  CheckCircle,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";

const TRACK_GRADIENTS: Record<TrackId, string> = {
  nclex: "from-blue-600 to-blue-800",
  ielts: "from-emerald-600 to-emerald-800",
};

export default function TrackCoursesPage() {
  const { trackId } = useParams() as { trackId: TrackId };
  const { appUser } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  const track = TRACKS.find((t) => t.id === trackId);

  useEffect(() => {
    async function fetchData() {
      if (!appUser) return;

      try {
        // Fetch courses for this track
        const coursesSnap = await getDocs(
          query(
            collection(db, "courses"),
            where("trackId", "==", trackId),
            where("published", "==", true)
          )
        );
        const courseList = coursesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Course)
        );
        setCourses(courseList);

        // Fetch enrollments for this user
        const enrollSnap = await getDocs(
          query(
            collection(db, "enrollments"),
            where("userId", "==", appUser.id)
          )
        );
        const enrollMap: Record<string, Enrollment> = {};
        enrollSnap.docs.forEach((d) => {
          const e = { id: d.id, ...d.data() } as Enrollment;
          enrollMap[e.courseId] = e;
        });
        setEnrollments(enrollMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [trackId, appUser]);

  if (!track) {
    return (
      <div className="text-sm text-red-400">Track not found.</div>
    );
  }

  return (
    <div>
      {/* Back */}
      <Link
        href="/tracks"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400
                   hover:text-gray-600 mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        All tracks
      </Link>

      {/* Track header */}
      <div
        className={`bg-gradient-to-br ${TRACK_GRADIENTS[trackId]}
                    rounded-2xl p-8 mb-8 relative overflow-hidden`}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={20} className="text-white/80" />
            <span className="text-white/80 text-sm font-medium uppercase
                             tracking-wider">
              {track.name}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {track.name} Courses
          </h1>
          <p className="text-white/70 text-sm">
            {courses.length} course{courses.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading courses...</div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            No courses available for this track yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {courses.map((course) => {
            const enrollment = enrollments[course.id];
            const isEnrolled =
              enrollment?.status === "active" &&
              enrollment.expiryDate?.toDate() > new Date();
            const progress = enrollment?.progressPercent ?? 0;

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-gray-100
                           hover:border-gray-200 hover:shadow-sm transition-all
                           overflow-hidden"
              >
                <CourseThumbnail
                  courseId={course.id}
                  title={course.title}
                  thumbnailUrl={course.thumbnail}
                  size="md"
                />

                <div className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                    {course.description}
                  </p>

                  {isEnrolled ? (
                    <>
                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs
                                        text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <Link
                        href={`/tracks/${trackId}/${course.id}`}
                        className="flex items-center justify-center gap-2 w-full
                                   py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                   text-sm font-medium rounded-xl transition-colors"
                      >
                        <BookOpen size={14} />
                        Continue learning
                      </Link>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-700">
                        {formatPrice(course.price)}
                      </span>
                      <Link
                        href={`/courses/${course.id}`}
                        className="flex items-center gap-1.5 px-4 py-2
                                   bg-blue-50 hover:bg-blue-100 text-blue-700
                                   text-xs font-medium rounded-xl transition-colors"
                      >
                        Enroll
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}