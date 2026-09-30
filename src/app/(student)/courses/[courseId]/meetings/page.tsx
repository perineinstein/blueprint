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
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course, Enrollment } from "@/types";
import Link from "next/link";
import {
  Video,
  Calendar,
  Clock,
  ExternalLink,
  ChevronLeft,
  Lock,
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  zoomLink: string;
  date: Timestamp;
  duration: number;
  description: string;
}

export default function StudentMeetingsPage() {
  const { courseId } = useParams() as { courseId: string };
  const { appUser } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!appUser) return;

      // Verify enrollment
      const enrollmentId = `${appUser.id}_${courseId}`;
      const enrollSnap = await getDoc(doc(db, "enrollments", enrollmentId));

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

      const [courseSnap, meetingsSnap] = await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDocs(
          query(
            collection(db, "courses", courseId, "meetings"),
            orderBy("date", "asc")
          )
        ),
      ]);

      if (courseSnap.exists()) {
        setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
      }

      setMeetings(
        meetingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting))
      );
      setLoading(false);
    }
    fetchData();
  }, [appUser, courseId, router]);

  function isUpcoming(ts: Timestamp) {
    return ts.toDate() > new Date();
  }

  function isHappeningNow(ts: Timestamp, duration: number) {
    const now = new Date();
    const start = ts.toDate();
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return now >= start && now <= end;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading meetings...</p>
      </div>
    );
  }

  const upcoming = meetings.filter((m) => isUpcoming(m.date));
  const past = meetings.filter((m) => !isUpcoming(m.date));

  return (
    <div className="max-w-2xl">
      <Link
        href={`/courses/${courseId}/learn`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400
                   hover:text-gray-600 mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        Back to course
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Live Meetings
        </h1>
        <p className="text-sm text-gray-500 mt-1">{course?.title}</p>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <Video size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            No meetings scheduled yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase
                             tracking-wide mb-3">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((meeting) => {
                  const live = isHappeningNow(meeting.date, meeting.duration);
                  return (
                    <div
                      key={meeting.id}
                      className={`bg-white rounded-2xl border p-5 ${
                        live
                          ? "border-green-300 shadow-sm shadow-green-100"
                          : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center
                                       justify-center flex-shrink-0 ${
                                         live
                                           ? "bg-green-100"
                                           : "bg-blue-100"
                                       }`}
                          >
                            <Video
                              size={18}
                              className={
                                live ? "text-green-600" : "text-blue-600"
                              }
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {meeting.title}
                              </p>
                              {live && (
                                <span className="flex items-center gap-1 px-2
                                                 py-0.5 bg-green-50 text-green-700
                                                 text-xs font-semibold rounded-full
                                                 animate-pulse">
                                  <span className="w-1.5 h-1.5 bg-green-500
                                                   rounded-full" />
                                  Live now
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs
                                            text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar size={11} />
                                {meeting.date
                                  .toDate()
                                  .toLocaleDateString("en-GB", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {meeting.date
                                  .toDate()
                                  .toLocaleTimeString("en-GB", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                · {meeting.duration} min
                              </span>
                            </div>
                            {meeting.description && (
                              <p className="text-xs text-gray-400 mt-1">
                                {meeting.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <a
                          href={meeting.zoomLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 px-4 py-2
                                     rounded-xl text-xs font-semibold
                                     transition-colors flex-shrink-0 ${
                                       live
                                         ? "bg-green-600 hover:bg-green-700 text-white"
                                         : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                                     }`}
                        >
                          <ExternalLink size={12} />
                          {live ? "Join now" : "Join"}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase
                             tracking-wide mb-3">
                Past meetings
              </h2>
              <div className="space-y-3">
                {past.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5
                               opacity-60"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex
                                      items-center justify-center flex-shrink-0">
                        <Video size={18} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          {meeting.title}
                        </p>
                        <div className="flex items-center gap-4 text-xs
                                        text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {meeting.date
                              .toDate()
                              .toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {meeting.duration} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}