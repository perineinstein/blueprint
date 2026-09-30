"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  CredentialingEnrollment,
  CredentialingResource,
  CREDENTIALING_PHASES,
} from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  Circle,
  Clock,
  ChevronRight,
  ShieldCheck,
  FileText,
  Link as LinkIcon,
  Download,
  Lock,
  ArrowRight,
  BookOpen,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tab = "journey" | "resources";

const DEFAULT_CREDENTIALING_PRICE = 50000; // GHS 500 in pesewas

export default function CredentialingPage() {
  const { appUser } = useAuth();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [enrollment, setEnrollment] =
    useState<CredentialingEnrollment | null>(null);
  const [resources, setResources] = useState<CredentialingResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState(DEFAULT_CREDENTIALING_PRICE);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("journey");
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!appUser) return;
    try {
      const [enrollSnap, resourcesSnap, settingsSnap] = await Promise.all([
        getDoc(doc(db, "credentialingEnrollments", appUser.id)),
        getDocs(
          query(
            collection(db, "credentialingResources"),
            orderBy("order", "asc")
          )
        ),
        getDoc(doc(db, "settings", "credentialing")),
      ]);

      const storedPrice = settingsSnap.data()?.price;
      setPrice(
        typeof storedPrice === "number" && storedPrice > 0
          ? storedPrice
          : DEFAULT_CREDENTIALING_PRICE
      );

      if (enrollSnap.exists()) {
        setEnrollment({
          id: enrollSnap.id,
          ...enrollSnap.data(),
        } as CredentialingEnrollment);
      }

      setResources(
        resourcesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as CredentialingResource)
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (paymentStatus === "success") {
      setPaymentSuccess(true);
      setTimeout(() => fetchData(), 3000);
    }
  }, [paymentStatus, fetchData]);

  async function handleEnroll() {
    if (!appUser) return;
    setPaying(true);
    setPayError("");
    try {
      const { auth } = await import("@/lib/firebase/client");
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/paystack/credentialing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: appUser.id,
          userEmail: appUser.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.error ?? "Payment failed.");
        return;
      }
      window.location.href = data.authorization_url;
    } catch {
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent
                        rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not enrolled — Paywall ────────────────────────────────
  if (!enrollment) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={22} className="text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">
              Credentialing Assistance
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Guided support through your NCLEX credentialing journey
          </p>
        </div>

        {paymentSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100
                          rounded-2xl flex items-center gap-3">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">
              Payment received. Your journey is being activated — refresh in
              a moment.
            </p>
          </div>
        )}

        {/* Hero card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800
                        rounded-2xl p-8 mb-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center
                            justify-center mb-5">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Your NCLEX Credentialing Journey
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed mb-6 max-w-md">
              We guide you through all 11 official credentialing stages — from
              candidate assessment to your NCLEX-RN examination. No guesswork,
              no confusion.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-blue-200" />
                <span className="text-blue-100">11 guided stages</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-blue-200" />
                <span className="text-blue-100">Admin-tracked progress</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-blue-200" />
                <span className="text-blue-100">1-year support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Your 11-Stage Journey
          </h3>
          <div className="space-y-0">
            {CREDENTIALING_PHASES.map((phase, index) => (
              <div key={phase.index} className="flex items-start gap-3 py-2.5
                                                border-b border-gray-50 last:border-0">
                <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                  <div className="w-6 h-6 rounded-full bg-blue-50 border-2
                                  border-blue-200 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">
                      {phase.index + 1}
                    </span>
                  </div>
                  {index < CREDENTIALING_PHASES.length - 1 && (
                    <div className="w-0.5 h-4 bg-gray-100 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-sm text-gray-700 leading-snug">
                    {phase.name}
                  </p>
                </div>
                <Lock size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Enroll CTA */}
        {payError && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">
            {payError}
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex
                        items-center justify-between">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {formatPrice(price)}
            </p>
            <p className="text-xs text-gray-400">One-time · 1 year access</p>
          </div>
          <button
            onClick={handleEnroll}
            disabled={paying}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600
                       hover:bg-blue-700 disabled:bg-blue-400 text-white
                       font-semibold rounded-xl transition-colors text-sm"
          >
            <ShieldCheck size={16} />
            {paying ? "Redirecting..." : "Begin your journey"}
          </button>
        </div>
      </div>
    );
  }

  // ── Enrolled — Journey Dashboard ──────────────────────────
  const completedCount = enrollment.phases.filter(
    (p) => p.status === "completed"
  ).length;
  const currentPhase = enrollment.phases[enrollment.currentPhaseIndex];
  const progressPercent = Math.round(
    (completedCount / CREDENTIALING_PHASES.length) * 100
  );
  const isComplete = completedCount === CREDENTIALING_PHASES.length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">
            Credentialing Assistance
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          NCLEX Credentialing Journey
        </p>
      </div>

      {/* Payment success */}
      {paymentSuccess && (
        <div className="mb-5 p-4 bg-green-50 border border-green-100
                        rounded-2xl flex items-center gap-3">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">
            Welcome! Your credentialing journey has begun.
          </p>
        </div>
      )}

      {/* ── Progress Overview Card ─────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl
                      p-6 mb-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10">
          {isComplete ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center
                              justify-center">
                <Star size={24} className="text-yellow-300 fill-yellow-300" />
              </div>
              <div>
                <p className="text-lg font-bold">Journey Complete!</p>
                <p className="text-blue-100 text-sm">
                  All 11 stages completed
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-blue-200 text-xs font-semibold uppercase
                            tracking-wide mb-1">
                Current Stage
              </p>
              <p className="text-lg font-bold leading-snug">
                {String(enrollment.currentPhaseIndex + 1).padStart(2, "0")} —{" "}
                {currentPhase?.name ?? "In Progress"}
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-blue-200">Overall Progress</span>
              <span className="text-white font-semibold">
                {completedCount} of {CREDENTIALING_PHASES.length} stages
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5">
              <div
                className="bg-white h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Next stage */}
          {!isComplete && enrollment.currentPhaseIndex < CREDENTIALING_PHASES.length - 1 && (
            <div className="flex items-center gap-1.5 text-xs text-blue-200">
              <ArrowRight size={12} />
              <span>
                Next:{" "}
                {
                  CREDENTIALING_PHASES[enrollment.currentPhaseIndex + 1]
                    ?.name
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stage stats row ───────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: "Completed",
            value: completedCount,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Current",
            value: isComplete ? 0 : 1,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Remaining",
            value: isComplete
              ? 0
              : CREDENTIALING_PHASES.length - completedCount - 1,
            color: "text-gray-500",
            bg: "bg-gray-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} rounded-xl p-3 text-center`}
          >
            <p className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {(
          [
            { id: "journey", label: "My Journey" },
            { id: "resources", label: "Cookies" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Journey Tab ──────────────────────────────────── */}
      {activeTab === "journey" && (
        <div className="space-y-0">
          {enrollment.phases.map((phase, index) => {
            const isCompleted = phase.status === "completed";
            const isCurrent =
              !isComplete && index === enrollment.currentPhaseIndex;
            const isUpcoming =
              !isCompleted && !isCurrent;
            const isExpanded = expandedPhase === phase.index;
            const isLast = index === enrollment.phases.length - 1;

            return (
              <div key={phase.index} className="flex gap-4">
                {/* Timeline spine */}
                <div className="flex flex-col items-center flex-shrink-0">
                  {/* Node */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      "border-2 flex-shrink-0 transition-all duration-300",
                      isCompleted
                        ? "bg-green-500 border-green-500"
                        : isCurrent
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-200"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle size={18} className="text-white" />
                    ) : isCurrent ? (
                      <Clock size={16} className="text-white" />
                    ) : (
                      <span className="text-xs font-bold text-gray-400">
                        {phase.index + 1}
                      </span>
                    )}
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-[2rem] mt-1 mb-1",
                        isCompleted ? "bg-green-300" : "bg-gray-100"
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={cn("flex-1 pb-5", isLast && "pb-2")}>
                  <button
                    onClick={() =>
                      setExpandedPhase(
                        isExpanded ? null : phase.index
                      )
                    }
                    className="w-full text-left"
                  >
                    <div
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        isCompleted
                          ? "bg-green-50 border-green-100"
                          : isCurrent
                          ? "bg-blue-50 border-blue-200 shadow-sm"
                          : "bg-white border-gray-100"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Stage badge */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={cn(
                                "text-xs font-semibold px-2 py-0.5 rounded-full",
                                isCompleted
                                  ? "bg-green-100 text-green-700"
                                  : isCurrent
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-500"
                              )}
                            >
                              Stage{" "}
                              {String(phase.index + 1).padStart(2, "0")}
                            </span>

                            {isCompleted && (
                              <span className="text-xs text-green-600
                                               font-medium flex items-center gap-1">
                                <CheckCircle size={11} />
                                Completed
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-xs text-blue-600
                                               font-semibold flex items-center gap-1">
                                <Clock size={11} />
                                You are here
                              </span>
                            )}
                          </div>

                          {/* Stage name */}
                          <p
                            className={cn(
                              "text-sm font-semibold leading-snug",
                              isCompleted
                                ? "text-green-800"
                                : isCurrent
                                ? "text-blue-900"
                                : "text-gray-500"
                            )}
                          >
                            {phase.name}
                          </p>

                          {/* Completion date */}
                          {isCompleted && phase.completedAt && (
                            <p className="text-xs text-green-500 mt-1">
                              Completed{" "}
                              {phase.completedAt
                                .toDate()
                                .toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                            </p>
                          )}

                          {/* Start date */}
                          {isCurrent && phase.startedAt && (
                            <p className="text-xs text-blue-400 mt-1">
                              Started{" "}
                              {phase.startedAt
                                .toDate()
                                .toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })}
                            </p>
                          )}
                        </div>

                        {/* Expand chevron */}
                        {(isCurrent || isCompleted) && phase.notes && (
                          <ChevronRight
                            size={16}
                            className={cn(
                              "flex-shrink-0 text-gray-400 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        )}
                      </div>

                      {/* Expanded notes */}
                      {isExpanded && phase.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-500
                                        mb-1.5 uppercase tracking-wide">
                            Notes from your advisor
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {phase.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Resources Tab ────────────────────────────────── */}
      {activeTab === "resources" && (
        <div>
          {resources.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12
                            text-center">
              <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                No cookies added yet.
                <br />
                Check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center
                                    justify-center flex-shrink-0">
                      {resource.type === "pdf" ? (
                        <FileText size={18} className="text-blue-600" />
                      ) : resource.type === "link" ? (
                        <LinkIcon size={18} className="text-blue-600" />
                      ) : (
                        <FileText size={18} className="text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {resource.title}
                      </p>
                      <p className="text-xs text-gray-400 capitalize mt-0.5">
                        {resource.type}
                      </p>
                    </div>
                    {resource.type === "pdf" && resource.fileUrl && (
                      
                       <a  href={resource.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                   text-xs font-medium border border-blue-200 bg-blue-50
                                   text-blue-700 hover:bg-blue-100 transition-colors
                                   flex-shrink-0"
                      >
                        <Download size={12} />
                        Download
                      </a>
                    )}
                    {resource.type === "link" && resource.linkUrl && (
                      
                       <a href={resource.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                   text-xs font-medium border border-blue-200 bg-blue-50
                                   text-blue-700 hover:bg-blue-100 transition-colors
                                   flex-shrink-0"
                      >
                        <ChevronRight size={12} />
                        Open
                      </a>
                    )}
                  </div>
                  {resource.content && (
                    <div
                      className="mt-3 pt-3 border-t border-gray-100 rich-content
                                 text-sm"
                      dangerouslySetInnerHTML={{ __html: resource.content }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}