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
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Enrollment, Course, Announcement, TRACKS, TrackId } from "@/types";
import Link from "next/link";
import ActivityCalendar from "@/components/student/ActivityCalendar";
import CourseThumbnail from "@/components/student/CourseThumbnail";
import { getCourseColor } from "@/lib/utils/courseColors";
import {
  BookOpen,
  ArrowRight,
  Bell,
  LayoutDashboard,
  Trophy,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface EnrolledCourse extends Course {
  enrollment: Enrollment;
}

interface TrackSummary {
  trackId: TrackId;
  courses: EnrolledCourse[];
}

type TrackStyleMap = Record<TrackId, { gradient: string; light: string; text: string }>;

const TRACK_STYLES: TrackStyleMap = {
  nclex: {
    gradient: "from-blue-600 to-blue-800",
    light: "bg-blue-50",
    text: "text-blue-700",
  },
  ielts: {
    gradient: "from-emerald-600 to-emerald-800",
    light: "bg-emerald-50",
    text: "text-emerald-700",
  },
};

export default function StudentDashboardPage() {
  const { appUser } = useAuth();
  const [trackSummaries, setTrackSummaries] = useState<TrackSummary[]>([]);
  const [untrackedCourses, setUntrackedCourses] = useState<EnrolledCourse[]>(
    []
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appUser) return;

      try {
        // Fetch enrollments
        const enrollSnap = await getDocs(
          query(
            collection(db, "enrollments"),
            where("userId", "==", appUser.id),
            where("status", "==", "active")
          )
        );

        const enrolledCourses: EnrolledCourse[] = [];
        await Promise.all(
          enrollSnap.docs.map(async (d) => {
            const enrollment = {
              id: d.id,
              ...d.data(),
            } as Enrollment;
            const expiry = enrollment.expiryDate?.toDate();
            if (!expiry || expiry < new Date()) return;

            const courseSnap = await getDoc(
              doc(db, "courses", enrollment.courseId)
            );
            if (!courseSnap.exists()) return;
            enrolledCourses.push({
              id: courseSnap.id,
              ...courseSnap.data(),
              enrollment,
            } as EnrolledCourse);
          })
        );

        // Group by track
        const byTrack: Record<TrackId, EnrolledCourse[]> = {
          nclex: [],
          ielts: [],
        };
        const untracked: EnrolledCourse[] = [];

        enrolledCourses.forEach((course) => {
          if (course.trackId && course.trackId in byTrack) {
            byTrack[course.trackId as TrackId].push(course);
          } else {
            untracked.push(course);
          }
        });

        const summaries: TrackSummary[] = TRACKS.filter(
          (t) => byTrack[t.id].length > 0
        ).map((t) => ({ trackId: t.id, courses: byTrack[t.id] }));

        setTrackSummaries(summaries);
        setUntrackedCourses(untracked);

        // Fetch announcements
        try {
          const annSnap = await getDocs(
            query(
              collection(db, "announcements"),
              where("published", "==", true),
              orderBy("createdAt", "desc"),
              limit(3)
            )
          );
          setAnnouncements(
            annSnap.docs.map(
              (d) => ({ id: d.id, ...d.data() } as Announcement)
            )
          );
        } catch {
          // Index might not exist yet — ignore
        }
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [appUser]);

  const totalEnrolled =
    trackSummaries.reduce((sum, t) => sum + t.courses.length, 0) +
    untrackedCourses.length;

  const totalCompleted = [
    ...trackSummaries.flatMap((t) => t.courses),
    ...untrackedCourses,
  ].filter((c) => (c.enrollment.progressPercent ?? 0) === 100).length;

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back, {appUser?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Continue your learning journey
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left — main content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Enrolled",
                value: totalEnrolled,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                label: "Completed",
                value: totalCompleted,
                color: "text-green-600",
                bg: "bg-green-50",
              },
              {
                label: "Tracks",
                value: trackSummaries.length,
                color: "text-purple-600",
                bg: "bg-purple-50",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl border border-gray-100 p-4"
              >
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p
                  className={`text-3xl font-semibold mt-1 ${stat.color}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : trackSummaries.length === 0 && untrackedCourses.length === 0 ? (
            // No enrollments
            <div className="bg-white rounded-2xl border border-gray-100 p-10
                            text-center">
              <BookOpen
                size={32}
                className="text-gray-300 mx-auto mb-3"
              />
              <p className="text-gray-500 text-sm font-medium mb-1">
                No courses yet
              </p>
              <p className="text-gray-400 text-xs mb-5">
                Browse our catalogue and enroll in your first course
              </p>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 px-5 py-2.5
                           bg-blue-600 hover:bg-blue-700 text-white text-sm
                           font-medium rounded-xl transition-colors"
              >
                <BookOpen size={14} />
                Browse courses
              </Link>
            </div>
          ) : (
            <>
              {/* Track sections */}
              {trackSummaries.map(({ trackId, courses }) => {
                const track = TRACKS.find((t) => t.id === trackId)!;
                const style = TRACK_STYLES[trackId];

                return (
                  <div key={trackId}>
                    {/* Track header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`px-3 py-1 rounded-lg text-xs font-semibold
                                     text-white bg-gradient-to-r ${style.gradient}`}
                        >
                          {track.name}
                        </div>
                        <span className="text-xs text-gray-400">
                          {courses.length} course
                          {courses.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Link
                        href={`/tracks/${trackId}`}
                        className="flex items-center gap-1 text-xs text-gray-400
                                   hover:text-gray-700 transition-colors"
                      >
                        View all
                        <ChevronRight size={13} />
                      </Link>
                    </div>

                    {/* Course cards */}
                    <div className="space-y-3">
                      {courses.map((course) => {
                        const color = getCourseColor(course.id);
                        const progress =
                          course.enrollment.progressPercent ?? 0;

                        return (
                          <div
                            key={course.id}
                            className="bg-white rounded-2xl border
                                       border-gray-100 p-4 flex items-center
                                       gap-4 hover:border-gray-200 transition-colors"
                          >
                            <CourseThumbnail
                              courseId={course.id}
                              title={course.title}
                              thumbnailUrl={course.thumbnail}
                              size="sm"
                              className="w-14 h-14 flex-shrink-0 rounded-xl"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900
                                           truncate">
                                {course.title}
                              </p>
                              <div className="mt-2">
                                <div className="flex justify-between text-xs
                                                text-gray-400 mb-1">
                                  <span>Progress</span>
                                  <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full
                                                h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full bg-gradient-to-r
                                               ${color.bg} transition-all`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <Link
                              href={`/tracks/${trackId}/${course.id}`}
                              className={`px-3 py-2 ${style.light} ${style.text}
                                         text-xs font-medium rounded-xl
                                         hover:opacity-80 transition-opacity
                                         whitespace-nowrap flex-shrink-0
                                         flex items-center gap-1`}
                            >
                              Continue
                              <ArrowRight size={12} />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Untracked courses */}
              {untrackedCourses.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-lg text-xs font-semibold
                                     bg-gray-100 text-gray-600">
                        Other Courses
                      </div>
                    </div>
                    <Link
                      href="/my-courses"
                      className="flex items-center gap-1 text-xs text-gray-400
                                 hover:text-gray-700 transition-colors"
                    >
                      View all
                      <ChevronRight size={13} />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {untrackedCourses.map((course) => {
                      const color = getCourseColor(course.id);
                      const progress =
                        course.enrollment.progressPercent ?? 0;

                      return (
                        <div
                          key={course.id}
                          className="bg-white rounded-2xl border border-gray-100
                                     p-4 flex items-center gap-4
                                     hover:border-gray-200 transition-colors"
                        >
                          <CourseThumbnail
                            courseId={course.id}
                            title={course.title}
                            thumbnailUrl={course.thumbnail}
                            size="sm"
                            className="w-14 h-14 flex-shrink-0 rounded-xl"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900
                                         truncate">
                              {course.title}
                            </p>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs
                                              text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full
                                              h-1.5">
                                <div
                                  className={`h-1.5 rounded-full bg-gradient-to-r
                                             ${color.bg} transition-all`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <Link
                            href={`/courses/${course.id}/learn`}
                            className="px-3 py-2 bg-gray-50 text-gray-600
                                       text-xs font-medium rounded-xl
                                       hover:bg-gray-100 transition-colors
                                       whitespace-nowrap flex-shrink-0
                                       flex items-center gap-1"
                          >
                            Continue
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-4">
                <Link
                  href="/tracks"
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl
                             border border-gray-100 hover:border-blue-200
                             hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center
                                  justify-center group-hover:bg-blue-100
                                  transition-colors">
                    <LayoutDashboard size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      My Tracks
                    </p>
                    <p className="text-xs text-gray-400">
                      NCLEX · IELTS
                    </p>
                  </div>
                </Link>

                <Link
                  href="/results"
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl
                             border border-gray-100 hover:border-purple-200
                             hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center
                                  justify-center group-hover:bg-purple-100
                                  transition-colors">
                    <Trophy size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      My Results
                    </p>
                    <p className="text-xs text-gray-400">
                      Exam scores
                    </p>
                  </div>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-blue-600" />
                <h3 className="text-xs font-semibold text-gray-900">
                  Announcements
                </h3>
              </div>
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-blue-50 rounded-xl border border-blue-100"
                  >
                    <p className="text-xs font-semibold text-blue-900 mb-0.5">
                      {a.title}
                    </p>
                    <p className="text-xs text-blue-700 leading-relaxed
                                  line-clamp-2">
                      {a.body}
                    </p>
                    <p className="text-xs text-blue-400 mt-1">
                      {a.createdAt
                        ? new Date(
                            a.createdAt.toDate()
                          ).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar */}
          <ActivityCalendar />

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase
                           tracking-wide">
              Quick Links
            </h3>
            <div className="space-y-1">
              {[
                { href: "/courses", label: "Browse courses", icon: BookOpen },
                { href: "/tracks", label: "My tracks", icon: LayoutDashboard },
                { href: "/results", label: "My results", icon: Trophy },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg
                             hover:bg-gray-50 text-sm text-gray-700
                             transition-colors"
                >
                  <Icon size={14} className="text-gray-400" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}