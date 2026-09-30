"use client";

import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/client";

// Renders nothing-but-a-trash-icon until clicked, then an inline confirmation.
// Must be placed inside a `relative` parent. The caller is responsible for only
// rendering it for the review's author; Firestore rules enforce that server-side.
export default function DeleteReviewButton({
  reviewId,
  onDeleted,
}: {
  reviewId: string;
  onDeleted: (reviewId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      onDeleted(reviewId);
    } catch (err) {
      console.error("Review delete error:", err);
      setError("Couldn't delete. Try again.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Delete your review"
        title="Delete your review"
        className="absolute top-2 right-2 p-2 rounded-lg text-gray-300
                   hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={15} />
      </button>
    );
  }

  return (
    <div
      className="absolute top-2 right-2 flex flex-wrap items-center justify-end
                 gap-x-2 gap-y-1 bg-white border border-gray-200 rounded-lg
                 shadow-sm px-3 py-1.5 text-xs text-gray-600 z-10"
    >
      <span>{error || "Delete your review?"}</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="font-semibold text-red-600 hover:text-red-700
                   disabled:opacity-50 py-1"
      >
        {deleting ? "Deleting..." : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError("");
        }}
        disabled={deleting}
        className="text-gray-500 hover:text-gray-700 disabled:opacity-50 py-1"
      >
        Cancel
      </button>
    </div>
  );
}
