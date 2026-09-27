"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils/formatting";

interface EnrollButtonProps {
  courseId: string;
  price: number;
}

export default function EnrollButton({ courseId, price }: EnrollButtonProps) {
  const { appUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEnroll() {
    if (!appUser) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          userId: appUser.id,
          userEmail: appUser.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to initialize payment.");
        return;
      }

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url;
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                   text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading
          ? "Redirecting to payment..."
          : `Enroll for ${formatPrice(price)}`}
      </button>
    </div>
  );
}