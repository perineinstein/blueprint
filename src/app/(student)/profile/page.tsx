"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AlertTriangle, X } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { authenticatedFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/hooks/useAuth";
import DeleteReviewButton from "@/components/student/DeleteReviewButton";

interface MyReview {
  id: string;
  rating: number;
  comment: string;
}

const CONFIRM_WORD = "DELETE";

export default function ProfilePage() {
  const { appUser, logout } = useAuth();
  const router = useRouter();

  const [reviews, setReviews] = useState<MyReview[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!appUser) return;
    let cancelled = false;
    async function fetchReviews() {
      try {
        const snap = await getDocs(
          query(collection(db, "reviews"), where("userId", "==", appUser!.id))
        );
        if (cancelled) return;
        setReviews(
          snap.docs.map((d) => ({
            id: d.id,
            rating: d.data().rating as number,
            comment: d.data().comment as string,
          }))
        );
      } catch (err) {
        console.error("Reviews fetch error:", err);
      }
    }
    fetchReviews();
    return () => {
      cancelled = true;
    };
  }, [appUser]);

  function openModal() {
    setConfirmText("");
    setDeleteError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (deleting) return;
    setModalOpen(false);
  }

  async function handleDeleteAccount() {
    if (confirmText !== CONFIRM_WORD || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await authenticatedFetch("/api/user/delete", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(
          data?.error ?? "Could not delete your account. Please try again."
        );
        setDeleting(false);
        return;
      }
    } catch (err) {
      console.error("Account deletion error:", err);
      setDeleteError("Network error. Check your connection and try again.");
      setDeleting(false);
      return;
    }

    // Account is gone — clear the client auth state and the session cookie.
    try {
      await logout();
    } catch (err) {
      console.error("Post-deletion logout error:", err);
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    }
    router.replace("/");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Your account details</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-8 max-w-lg">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Full name</p>
            <p className="text-sm font-medium text-gray-900">{appUser?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Email</p>
            <p className="text-sm font-medium text-gray-900">{appUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Role</p>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {appUser?.role}
            </p>
          </div>
        </div>
      </div>

      {/* Your reviews */}
      {reviews.length > 0 && (
        <div className="mt-6 max-w-lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Your reviews
          </h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="relative bg-white rounded-2xl border border-gray-100
                           p-4 md:p-5 pr-12"
              >
                <DeleteReviewButton
                  reviewId={review.id}
                  onDeleted={(id) =>
                    setReviews((prev) => prev.filter((r) => r.id !== id))
                  }
                />
                <div className="flex items-center gap-0.5 mb-2">
                  {[...Array(review.rating)].map((_, j) => (
                    <span key={j} className="text-yellow-400 text-sm">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed break-words">
                  {review.comment}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-8 max-w-lg bg-white rounded-2xl border border-red-200 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-red-700 mb-1">
          Delete Account
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          This will permanently delete your account and all your data. This
          action cannot be undone.
        </p>
        <button
          type="button"
          onClick={openModal}
          className="px-4 py-3 md:py-2.5 text-sm font-medium text-red-600
                     border border-red-300 hover:bg-red-50 rounded-xl
                     transition-colors"
        >
          Delete my account
        </button>
      </div>

      {/* Confirmation modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4
                     bg-black/50"
          onClick={closeModal}
          onKeyDown={(e) => e.key === "Escape" && closeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto
                       bg-white rounded-2xl shadow-xl p-5 md:p-6"
          >
            <button
              type="button"
              onClick={closeModal}
              disabled={deleting}
              aria-label="Close"
              className="absolute top-3 right-3 p-2 text-gray-400
                         hover:text-gray-600 disabled:opacity-50"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-3 pr-8">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center
                              justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h2
                id="delete-account-title"
                className="text-base font-semibold text-gray-900"
              >
                Are you sure? This cannot be undone.
              </h2>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              The following will be permanently deleted:
            </p>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-3">
              <li>Your account and login credentials</li>
              <li>Your enrolled courses and progress</li>
              <li>Your quiz attempts and results</li>
              <li>Your credentialing progress (if applicable)</li>
            </ul>
            <p className="text-xs text-gray-400 mb-4">
              Payment records are kept for legal and accounting purposes, as
              described in our Privacy Policy.
            </p>

            <label
              htmlFor="delete-confirm"
              className="block text-sm text-gray-700 mb-1.5"
            >
              Type <span className="font-semibold">{CONFIRM_WORD}</span> to
              confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              autoFocus
              className="w-full px-4 py-3 md:py-2.5 border border-gray-200
                         rounded-xl text-sm text-gray-900 focus:outline-none
                         focus:ring-2 focus:ring-red-500
                         focus:border-transparent disabled:bg-gray-50"
            />

            {deleteError && (
              <p className="mt-3 p-3 bg-red-50 rounded-xl text-sm text-red-600">
                {deleteError}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={closeModal}
                disabled={deleting}
                className="px-4 py-3 md:py-2.5 text-sm font-medium text-gray-700
                           bg-gray-100 hover:bg-gray-200 rounded-xl
                           transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmText !== CONFIRM_WORD || deleting}
                className="px-4 py-3 md:py-2.5 text-sm font-medium text-white
                           bg-red-600 hover:bg-red-700 rounded-xl
                           transition-colors disabled:opacity-40
                           disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting your account..." : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
