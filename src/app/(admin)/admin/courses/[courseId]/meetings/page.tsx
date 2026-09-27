"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Course } from "@/types";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ChevronRight,
  Video,
  Calendar,
  Clock,
  X,
  Check,
  ExternalLink,
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  zoomLink: string;
  date: Timestamp;
  duration: number;
  description: string;
  createdAt: Timestamp;
}

export default function MeetingsPage() {
  const { courseId } = useParams() as { courseId: string };
  const [course, setCourse] = useState<Course | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");

  async function fetchData() {
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

  useEffect(() => {
    fetchData();
  }, [courseId]);

  function resetForm() {
    setTitle("");
    setZoomLink("");
    setDate("");
    setTime("");
    setDuration("60");
    setDescription("");
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) { setError("Title is required."); return; }
    if (!zoomLink.trim()) { setError("Zoom link is required."); return; }
    if (!date || !time) { setError("Date and time are required."); return; }

    setSaving(true);
    try {
      const dateTime = new Date(`${date}T${time}`);
      await addDoc(collection(db, "courses", courseId, "meetings"), {
        title,
        zoomLink,
        date: Timestamp.fromDate(dateTime),
        duration: parseInt(duration),
        description,
        createdAt: serverTimestamp(),
      });
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Failed to save meeting.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(meetingId: string) {
    if (!confirm("Delete this meeting?")) return;
    await deleteDoc(doc(db, "courses", courseId, "meetings", meetingId));
    fetchData();
  }

  function formatMeetingDate(ts: Timestamp) {
    const d = ts.toDate();
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatMeetingTime(ts: Timestamp) {
    return ts.toDate().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isUpcoming(ts: Timestamp) {
    return ts.toDate() > new Date();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
        <Link href="/admin/courses" className="hover:text-gray-600">
          Courses
        </Link>
        <ChevronRight size={14} />
        <Link
          href={`/admin/courses/${courseId}`}
          className="hover:text-gray-600"
        >
          {course?.title}
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-600">Live Meetings</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Live Meetings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Schedule Zoom sessions for enrolled students
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium
                     rounded-xl transition-colors"
        >
          <Plus size={16} />
          Schedule meeting
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              New meeting
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Module 1 Live Q&A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zoom link
              </label>
              <input
                type="url"
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                placeholder="https://zoom.us/j/..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="15"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="What will be covered in this session?"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                           hover:bg-blue-700 disabled:bg-blue-400 text-white
                           text-sm font-medium rounded-xl transition-colors"
              >
                <Check size={15} />
                {saving ? "Saving..." : "Schedule meeting"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-gray-200 text-gray-600
                           text-sm font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Meetings list */}
      {meetings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <Video size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No meetings scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const upcoming = isUpcoming(meeting.date);
            return (
              <div
                key={meeting.id}
                className="bg-white rounded-2xl border border-gray-100 p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center
                                 justify-center flex-shrink-0 ${
                                   upcoming
                                     ? "bg-blue-100"
                                     : "bg-gray-100"
                                 }`}
                    >
                      <Video
                        size={18}
                        className={
                          upcoming ? "text-blue-600" : "text-gray-400"
                        }
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {meeting.title}
                        </p>
                        {upcoming ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700
                                           text-xs font-medium rounded-full">
                            Upcoming
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500
                                           text-xs font-medium rounded-full">
                            Past
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs
                                      text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {formatMeetingDate(meeting.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatMeetingTime(meeting.date)} ·{" "}
                          {meeting.duration} min
                        </span>
                      </div>
                      {meeting.description && (
                        <p className="text-xs text-gray-400 mt-1">
                          {meeting.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    
                      href={meeting.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 text-xs font-medium border border-blue-200
                                 bg-blue-50 text-blue-700 hover:bg-blue-100
                                 transition-colors"
                    <a>
                      <ExternalLink size={12} />
                      Zoom link
                    </a>
                    <button
                      onClick={() => handleDelete(meeting.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 text-xs font-medium border border-red-200
                                 bg-red-50 text-red-600 hover:bg-red-100
                                 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}