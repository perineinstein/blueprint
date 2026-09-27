"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Exam, Enrollment } from "@/types";
import { cn } from "@/lib/utils/cn";

interface ExamEvent {
  examId: string;
  title: string;
  courseTitle: string;
  durationMinutes: number;
  date: Date;
  courseId: string;
}

export default function ActivityCalendar() {
  const { appUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ExamEvent[]>([]);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExamEvents() {
      if (!appUser) return;

      try {
        // Get student enrollments
        const enrollmentsSnap = await getDocs(
          query(
            collection(db, "enrollments"),
            where("userId", "==", appUser.id),
            where("status", "==", "active")
          )
        );

        const enrollments = enrollmentsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Enrollment)
        );

        if (enrollments.length === 0) {
          setLoading(false);
          return;
        }

        // Get exams for enrolled courses
        const courseIds = enrollments.map((e) => e.courseId);
        const examEvents: ExamEvent[] = [];

        for (const courseId of courseIds) {
          const examsSnap = await getDocs(
            query(
              collection(db, "exams"),
              where("courseId", "==", courseId),
              where("published", "==", true)
            )
          );

          const courseSnap = await getDoc(doc(db, "courses", courseId));
          const courseTitle = courseSnap.data()?.title ?? "Unknown Course";

          examsSnap.docs.forEach((d, index) => {
            const exam = { id: d.id, ...d.data() } as Exam;

            // Distribute exams across the current month for demo
            // In production you'd store an actual exam date field
            const examDate = new Date(currentDate);
            examDate.setDate((index + 1) * 7);

            examEvents.push({
              examId: exam.id,
              title: exam.title,
              courseTitle,
              durationMinutes: exam.durationMinutes,
              date: examDate,
              courseId,
            });
          });
        }

        setEvents(examEvents);
      } catch (error) {
        console.error("Calendar error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchExamEvents();
  }, [appUser, currentDate]);

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  function getEventsForDay(day: number): ExamEvent[] {
    return events.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    });
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Activity Calendar
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       hover:bg-gray-100 text-gray-500 transition-colors text-sm"
          >
            ‹
          </button>
          <span className="text-xs font-medium text-gray-700 min-w-[100px] text-center">
            {monthName}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       hover:bg-gray-100 text-gray-500 transition-colors text-sm"
          >
            ›
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {days.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {/* Empty cells for first week */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDay(day);
          const hasEvents = dayEvents.length > 0;
          const todayDay = isToday(day);
          const isHovered = hoveredDay === day;

          return (
            <div
              key={day}
              className="relative flex flex-col items-center"
              onMouseEnter={() => hasEvents && setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Day number */}
              <div
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full",
                  "text-xs transition-colors cursor-default",
                  todayDay
                    ? "bg-blue-600 text-white font-semibold"
                    : hasEvents
                    ? "bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 cursor-pointer"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {day}
              </div>

              {/* Event dot */}
              {hasEvents && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((_, idx) => (
                    <div
                      key={idx}
                      className="w-1 h-1 rounded-full bg-orange-400"
                    />
                  ))}
                </div>
              )}

              {/* Hover popover */}
              {isHovered && hasEvents && (
                <div
                  className="absolute top-10 left-1/2 -translate-x-1/2 z-50
                              bg-gray-900 text-white rounded-xl p-3 w-52
                              shadow-xl text-left"
                >
                  {/* Arrow */}
                  <div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2
                                w-3 h-3 bg-gray-900 rotate-45 rounded-sm"
                  />

                  {dayEvents.map((event) => (
                    <div key={event.examId} className="mb-2 last:mb-0">
                      <p className="text-xs font-semibold text-white">
                        📝 {event.title}
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {event.courseTitle}
                      </p>
                      <p className="text-xs text-gray-400">
                        {event.durationMinutes} min
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {events.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-xs text-gray-500">
              {events.length} exam{events.length !== 1 ? "s" : ""} scheduled
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs">•</span>
            </div>
            <span className="text-xs text-gray-500">Today</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-xs text-gray-400 text-center mt-2">
          Loading events...
        </div>
      )}
    </div>
  );
}