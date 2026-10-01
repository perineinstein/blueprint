"use client";

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Announcement, getAdminTrack } from "@/types";

export default function AnnouncementsPage() {
  const { appUser } = useAuth();
  const adminTrack = appUser ? getAdminTrack(appUser.role) : null;
  const trackOptions: { value: "all" | "nclex" | "ielts"; label: string }[] =
    adminTrack === "nclex"
      ? [
          { value: "all", label: "All students" },
          { value: "nclex", label: "NCLEX only" },
        ]
      : adminTrack === "ielts"
      ? [
          { value: "all", label: "All students" },
          { value: "ielts", label: "IELTS only" },
        ]
      : [
          { value: "all", label: "All students" },
          { value: "nclex", label: "NCLEX only" },
          { value: "ielts", label: "IELTS only" },
        ];
  const [targetTrack, setTargetTrack] = useState<"all" | "nclex" | "ielts">(
    "all"
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function fetchAnnouncements() {
    const snap = await getDocs(
      query(collection(db, "announcements"), orderBy("createdAt", "desc"))
    );
    const all = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Announcement)
    );
    // Track admins only see (and manage) announcements for their own track,
    // plus platform-wide ones they posted themselves.
    setAnnouncements(
      adminTrack
        ? all.filter(
            (a) =>
              a.targetTrack === adminTrack ||
              ((a.targetTrack ?? "all") === "all" && a.authorId === appUser?.id)
          )
        : all
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Please fill in both title and message.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "announcements"), {
        title,
        body,
        targetTrack,
        courseId: null,
        authorId: appUser?.id,
        published: true,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setBody("");
      setSuccess("Announcement posted successfully.");
      setTimeout(() => setSuccess(""), 3000);
      fetchAnnouncements();
    } catch (err) {
      setError("Failed to post announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, "announcements", id));
    fetchAnnouncements();
  }

  async function togglePublish(announcement: Announcement) {
    await updateDoc(doc(db, "announcements", announcement.id), {
      published: !announcement.published,
    });
    fetchAnnouncements();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Announcements</h1>
        <p className="text-sm text-gray-500 mt-1">
          Post platform-wide announcements to all students
        </p>
      </div>

      {/* Post form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          New announcement
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 rounded-xl text-sm text-green-600">
            {success}
          </div>
        )}

        <form onSubmit={handlePost} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl
                         text-sm text-gray-900 bg-white focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. System maintenance on Friday"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl
                         text-sm text-gray-900 bg-white focus:outline-none
                         focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Write your announcement here..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Audience
            </label>
            <div className="flex flex-wrap gap-2">
              {trackOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetTrack(opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border
                             transition-colors ${
                               targetTrack === opt.value
                                 ? "border-blue-500 bg-blue-50 text-blue-700"
                                 : "border-gray-200 text-gray-500 hover:bg-gray-50"
                             }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white text-sm font-medium rounded-xl transition-colors"
          >
            {saving ? "Posting..." : "Post announcement"}
          </button>
        </form>
      </div>

      {/* Announcements list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Posted announcements ({announcements.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No announcements yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {announcements.map((a) => (
              <div key={a.id} className="px-4 md:px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {a.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.published
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {a.published ? "Published" : "Hidden"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {(a.targetTrack ?? "all") === "all"
                          ? "All"
                          : a.targetTrack.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {a.createdAt
                        ? new Date(a.createdAt.toDate()).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => togglePublish(a)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium
                                 border transition-colors ${
                                   a.published
                                     ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                     : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                 }`}
                    >
                      {a.published ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border
                                 border-red-200 bg-red-50 text-red-600
                                 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}