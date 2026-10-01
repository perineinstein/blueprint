"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Course, getAdminTrack } from "@/types";

interface Stats {
  totalCourses: number;
  totalStudents: number;
  totalEnrollments: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalStudents: 0,
    totalEnrollments: 0,
  });
  const [loading, setLoading] = useState(true);
  const { appUser } = useAuth();
  const adminTrack = appUser ? getAdminTrack(appUser.role) : null;

  useEffect(() => {
    async function fetchStats() {
      try {
        const [coursesSnap, studentsSnap, enrollmentsSnap] = await Promise.all([
          getDocs(collection(db, "courses")),
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
          getDocs(collection(db, "enrollments")),
        ]);

        if (adminTrack) {
          // Track admin: only count their own track's courses, enrollments,
          // and the students enrolled in them.
          const trackCourseIds = new Set(
            coursesSnap.docs
              .filter((c) => (c.data() as Course).trackId === adminTrack)
              .map((c) => c.id)
          );
          const trackEnrollments = enrollmentsSnap.docs.filter((e) =>
            trackCourseIds.has(e.data().courseId)
          );
          setStats({
            totalCourses: trackCourseIds.size,
            totalStudents: new Set(trackEnrollments.map((e) => e.data().userId))
              .size,
            totalEnrollments: trackEnrollments.length,
          });
        } else {
          setStats({
            totalCourses: coursesSnap.size,
            totalStudents: studentsSnap.size,
            totalEnrollments: enrollmentsSnap.size,
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [adminTrack]);

  const cards = [
    {
      label: "Total Courses",
      value: stats.totalCourses,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Total Students",
      value: stats.totalStudents,
      color: "bg-green-50 text-green-700",
    },
    {
      label: "Total Enrollments",
      value: stats.totalEnrollments,
      color: "bg-purple-50 text-purple-700",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your learning platform
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading stats...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {cards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-100 p-6"
            >
              <p className="text-sm text-gray-500 mb-2">{card.label}</p>
              <p className={cn("text-4xl font-semibold", card.color)}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}