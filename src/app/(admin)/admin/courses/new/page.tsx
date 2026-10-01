"use client";

import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { useRef } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { TrackId, getAdminTrack } from "@/types";
import TrackSelect, { TrackChoice } from "@/components/admin/TrackSelect";


export default function NewCoursePage() {
  const router = useRouter();
  const { appUser } = useAuth();
  // Track admins can only create courses in their own track.
  const lockedTrack = appUser ? getAdminTrack(appUser.role) : null;
  const [selectedTrack, setSelectedTrack] = useState<TrackChoice>(undefined);
  const trackChoice: TrackChoice = lockedTrack ?? selectedTrack;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [totalDuration, setTotalDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessDuration, setAccessDuration] = useState("365");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);



function handleThumbnailSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setThumbnailFile(file);
  setThumbnailPreview(URL.createObjectURL(file));
}


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // trackId is saved as "nclex" | "ielts" | null — never undefined.
    if (trackChoice === undefined) {
      setError("Please choose which track this course belongs to.");
      return;
    }
    const trackId: TrackId | null = trackChoice;
    setLoading(true);

    try {
      const priceInPesewas = Math.round(parseFloat(price) * 100);
      let thumbnailUrl = "";

      // Upload thumbnail if provided
      if (thumbnailFile) {
        setUploadingThumbnail(true);
        const storageRef = ref(
          storage,
          `thumbnails/${Date.now()}_${thumbnailFile.name}`
        );
        const uploadTask = uploadBytesResumable(storageRef, thumbnailFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            null,
            reject,
            async () => {
              thumbnailUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
        setUploadingThumbnail(false);
      }

      const docRef = await addDoc(collection(db, "courses"), {
        title,
        description,
        price: priceInPesewas,
        currency: "GHS",
        published: false,
        thumbnail: thumbnailUrl, // empty string if no image uploaded
        totalDuration,
        trackId,
        accessDurationDays: parseInt(accessDuration),
        instructorId: appUser?.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/admin/courses/${docRef.id}/edit`);
    } catch (err) {
      console.error(err);
      setError("Failed to create course. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">New Course</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details to create a new course
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-8">
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
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
              placeholder="e.g. Introduction to Electrical Engineering"
            />
          </div>

          <TrackSelect
            value={trackChoice}
            onChange={setSelectedTrack}
            lockedTrack={lockedTrack}
          />

          {/* Thumbnail upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course thumbnail (optional)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              If no image is uploaded, course initials will be shown instead
            </p>

            {thumbnailPreview ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden mb-2">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailFile(null);
                    setThumbnailPreview("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80
                            text-white rounded-full flex items-center justify-center
                            text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-36 border-2 border-dashed border-gray-200
                          rounded-xl flex flex-col items-center justify-center
                          cursor-pointer hover:border-gray-300 hover:bg-gray-50
                          transition-colors"
              >
                <span className="text-2xl mb-1">🖼️</span>
                <span className="text-xs text-gray-400">Click to upload image</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailSelect}
              className="hidden"
            />

            {uploadingThumbnail && (
              <p className="text-xs text-blue-500 mt-1">Uploading thumbnail...</p>
            )}
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
              placeholder="What will students learn in this course?"
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
                placeholder="e.g. 50.00"
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
              placeholder="365"
            />
            <p className="text-xs text-gray-400 mt-1">
              How many days students can access this course after enrollment
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                         text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "Creating..." : "Create course"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200
                         text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}