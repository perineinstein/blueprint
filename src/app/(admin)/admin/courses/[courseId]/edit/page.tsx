"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Course, TrackId } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import Link from "next/link";
import { BookOpen, Video } from "lucide-react";

export default function EditCoursePage() {
  const router = useRouter();
  const { courseId } = useParams() as { courseId: string };

  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [totalDuration, setTotalDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [accessDuration, setAccessDuration] = useState("365");
  const [trackId, setTrackId] = useState<TrackId | null>(null);

  useEffect(() => {
    async function fetchCourse() {
      const snap = await getDoc(doc(db, "courses", courseId));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Course;
        setCourse(data);
        setTitle(data.title);
        setDescription(data.description);
        setPrice((data.price / 100).toFixed(2));
        setTotalDuration(data.totalDuration);
        setAccessDuration(String(data.accessDurationDays ?? 365));
        setTrackId(data.trackId ?? null);

      }
      setFetching(false);
    }
    fetchCourse();
  }, [courseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSaved(false);

    try {
      await updateDoc(doc(db, "courses", courseId), {
        title,
        description,
        price: Math.round(parseFloat(price) * 100),
        totalDuration,
        accessDurationDays: parseInt(accessDuration),
        updatedAt: serverTimestamp(),
        trackId: trackId,
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="text-sm text-gray-400">Loading course...</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Course</h1>
        <p className="text-sm text-gray-500 mt-1 truncate">{course?.title}</p>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 mb-6">
        <Link
          href={`/admin/courses/${courseId}/materials`}
          className="px-4 py-2 bg-purple-50 text-purple-700 text-sm
                     font-medium rounded-lg hover:bg-purple-100 transition-colors"
        >
          Manage Materials
        </Link>
        <Link
          href={`/admin/courses/${courseId}/exams`}
          className="px-4 py-2 bg-orange-50 text-orange-700 text-sm
                     font-medium rounded-lg hover:bg-orange-100 transition-colors"
        >
          Manage Exams
        </Link>
        <Link
          href={`/admin/courses/${courseId}/modules`}
          className="px-4 py-2 bg-green-50 text-green-700 text-sm font-medium
                    rounded-lg hover:bg-green-100 transition-colors flex items-center gap-2"
        >
          <BookOpen size={14} />
          Modules
        </Link>
        <Link
          href={`/admin/courses/${courseId}/meetings`}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium
                    rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2"
        >
          <Video size={14} />
          Meetings
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-8">
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-6 p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-600">
            Course saved successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (GHS)
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total duration
              </label>
              <input
                type="text"
                value={totalDuration}
                onChange={(e) => setTotalDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 4h 30m"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access duration (days)
              </label>
              <input
                type="number"
                required
                min="1"
                value={accessDuration}
                onChange={(e) => setAccessDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                          text-gray-900 bg-white focus:outline-none focus:ring-2
                          focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Days of access after enrollment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                         text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/courses")}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200
                         text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Back to courses
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}