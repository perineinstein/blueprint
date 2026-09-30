"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  CredentialingEnrollment,
  CredentialingPhase,
  PhaseStatus,
  CREDENTIALING_PHASES,
  AppUser,
} from "@/types";
import {
  CheckCircle,
  Circle,
  Clock,
  PauseCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Save,
  Users,
  ChevronRight,
  Search,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/formatting";
import Link from "next/link";

interface EnrollmentWithUser extends CredentialingEnrollment {
  userName: string;
  userEmail: string;
}

type PhaseEditsMap = Record<string, CredentialingPhase[]>;

const STATUS_OPTIONS: { value: PhaseStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On hold" },
];

const STATUS_CONFIG: Record<PhaseStatus, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  not_started: {
    icon: <Circle size={14} />,
    label: "Not started",
    color: "text-gray-400",
    bg: "bg-gray-100",
  },
  in_progress: {
    icon: <Clock size={14} />,
    label: "In progress",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  completed: {
    icon: <CheckCircle size={14} />,
    label: "Completed",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  on_hold: {
    icon: <PauseCircle size={14} />,
    label: "On hold",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
};

export default function AdminCredentialingPage() {
  const { appUser } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [phaseEdits, setPhaseEdits] = useState<PhaseEditsMap>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bulkPhase, setBulkPhase] = useState<number>(0);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savedPrice, setSavedPrice] = useState<number | null>(null);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceMessage, setPriceMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  async function fetchPrice() {
    try {
      const snap = await getDoc(doc(db, "settings", "credentialing"));
      const stored = snap.data()?.price;
      const pesewas =
        typeof stored === "number" && stored > 0 ? stored : 50000;
      setSavedPrice(pesewas);
      setPriceInput((pesewas / 100).toString());
    } catch (err) {
      console.error(err);
      setPriceMessage({ type: "error", text: "Failed to load current price." });
    }
  }

  async function handleSavePrice(e: React.FormEvent) {
    e.preventDefault();
    setPriceMessage(null);
    const ghs = parseFloat(priceInput);
    if (!Number.isFinite(ghs) || ghs <= 0) {
      setPriceMessage({ type: "error", text: "Enter a price greater than 0." });
      return;
    }
    const pesewas = Math.round(ghs * 100);
    setPriceSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "credentialing"),
        { price: pesewas },
        { merge: true }
      );
      setSavedPrice(pesewas);
      setPriceInput((pesewas / 100).toString());
      setPriceMessage({ type: "success", text: "Price updated." });
    } catch (err) {
      console.error(err);
      setPriceMessage({ type: "error", text: "Failed to update price." });
    } finally {
      setPriceSaving(false);
    }
  }

  async function fetchData() {
    try {
      const snap = await getDocs(collection(db, "credentialingEnrollments"));
      const rawEnrollments = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CredentialingEnrollment)
      );

      // Fetch each unique user once, then look up from a map
      const userIds = [...new Set(rawEnrollments.map((e) => e.userId))];
      const usersById = new Map<string, AppUser | undefined>();
      await Promise.all(
        userIds.map(async (id) => {
          try {
            const userSnap = await getDoc(doc(db, "users", id));
            usersById.set(id, userSnap.data() as AppUser | undefined);
          } catch {
            usersById.set(id, undefined);
          }
        })
      );

      const enriched = rawEnrollments.map((enrollment) => {
        const u = usersById.get(enrollment.userId);
        return {
          ...enrollment,
          userName: u?.name ?? "Unknown",
          userEmail: u?.email ?? "—",
        } as EnrollmentWithUser;
      });
      setEnrollments(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    fetchPrice();
  }, []);

  function openEnrollment(enrollment: EnrollmentWithUser) {
    if (expandedId === enrollment.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(enrollment.id);
    setPhaseEdits((prev: PhaseEditsMap) => ({
      ...prev,
      [enrollment.id]: enrollment.phases.map(
        (p: CredentialingPhase) => ({ ...p })
      ),
    }));
  }

  function updatePhaseStatus(
    enrollmentId: string,
    phaseIndex: number,
    status: PhaseStatus
  ) {
    setPhaseEdits((prev: PhaseEditsMap) => ({
      ...prev,
      [enrollmentId]: prev[enrollmentId].map((p: CredentialingPhase) => {
        if (p.index !== phaseIndex) return p;
        const now = serverTimestamp() as any;
        return {
          ...p,
          status,
          startedAt:
            status === "in_progress" && !p.startedAt ? now : p.startedAt,
          completedAt: status === "completed" ? now : p.completedAt,
        };
      }),
    }));
  }

  function updatePhaseNotes(
    enrollmentId: string,
    phaseIndex: number,
    notes: string
  ) {
    setPhaseEdits((prev: PhaseEditsMap) => ({
      ...prev,
      [enrollmentId]: prev[enrollmentId].map((p: CredentialingPhase) =>
        p.index === phaseIndex ? { ...p, notes } : p
      ),
    }));
  }

  async function handleSave(enrollment: EnrollmentWithUser) {
    if (!appUser) return;
    setSaving(enrollment.id);
    try {
      const phases = phaseEdits[enrollment.id];
      const lastCompleted = phases.reduce(
        (max: number, p: CredentialingPhase) => {
          if (p.status === "completed") return Math.max(max, p.index);
          return max;
        },
        -1
      );
      const currentPhaseIndex = Math.min(
        lastCompleted + 1,
        CREDENTIALING_PHASES.length - 1
      );

      await updateDoc(
        doc(db, "credentialingEnrollments", enrollment.userId),
        { phases, currentPhaseIndex }
      );
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  async function bulkSetPhase(toIndex: number) {
    if (!appUser || filtered.length === 0) return;
    if (
      !confirm(
        `Set all ${filtered.length} student(s) to complete through Stage ${
          toIndex + 1
        }?`
      )
    )
      return;

    setBulkSaving(true);
    try {
      await Promise.all(
        filtered.map(async (enrollment) => {
          const phases = enrollment.phases.map(
            (p: CredentialingPhase) => ({
              ...p,
              status:
                p.index <= toIndex
                  ? ("completed" as PhaseStatus)
                  : p.status,
              completedAt:
                p.index <= toIndex
                  ? (serverTimestamp() as any)
                  : p.completedAt,
            })
          );
          await updateDoc(
            doc(db, "credentialingEnrollments", enrollment.userId),
            {
              phases,
              currentPhaseIndex: Math.min(
                toIndex + 1,
                CREDENTIALING_PHASES.length - 1
              ),
            }
          );
        })
      );
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setBulkSaving(false);
    }
  }

  const filtered = enrollments.filter(
    (e) =>
      e.userName.toLowerCase().includes(search.toLowerCase()) ||
      e.userEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={22} className="text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">
              Credentialing Management
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Manage NCLEX credentialing progress for enrolled students
          </p>
        </div>
        <Link
          href="/admin/credentialing/resources"
          className="flex items-center gap-2 px-4 py-2 border border-gray-200
                     text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50
                     transition-colors"
        >
          <ShieldCheck size={14} />
          Cookies
        </Link>
      </div>

      {/* Price management */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Banknote size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">
            Credentialing Price
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Current price:{" "}
          <span className="font-semibold text-gray-900">
            {savedPrice === null ? "Loading..." : formatPrice(savedPrice)}
          </span>
          . Applies to new enrollments.
        </p>
        {priceMessage && (
          <div
            className={cn(
              "mb-3 p-3 rounded-xl text-sm",
              priceMessage.type === "success"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            )}
          >
            {priceMessage.text}
          </div>
        )}
        <form
          onSubmit={handleSavePrice}
          className="flex items-center gap-3 flex-wrap"
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm
                             text-gray-400">
              GHS
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-40 pl-12 pr-3 py-2 border border-gray-200 rounded-xl
                         text-sm text-gray-900 bg-white focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={priceSaving || savedPrice === null}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600
                       hover:bg-blue-700 disabled:bg-blue-400 text-white
                       text-sm font-medium rounded-xl transition-colors"
          >
            <Save size={14} />
            {priceSaving ? "Saving..." : "Save price"}
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Total enrolled",
            value: enrollments.length,
            color: "text-blue-600",
          },
          {
            label: "In progress",
            value: enrollments.filter((e: EnrollmentWithUser) =>
              e.phases.some(
                (p: CredentialingPhase) => p.status === "in_progress"
              )
            ).length,
            color: "text-amber-600",
          },
          {
            label: "Journey complete",
            value: enrollments.filter(
              (e: EnrollmentWithUser) =>
                e.phases[CREDENTIALING_PHASES.length - 1]?.status ===
                "completed"
            ).length,
            color: "text-green-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Bulk action */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">
              Bulk complete all visible students through:
            </span>
          </div>
          <select
            value={bulkPhase}
            onChange={(e) => setBulkPhase(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs
                       text-gray-900 bg-white focus:outline-none focus:ring-2
                       focus:ring-blue-500"
          >
            {CREDENTIALING_PHASES.map((phase) => (
              <option key={phase.index} value={phase.index}>
                Stage {String(phase.index + 1).padStart(2, "0")} —{" "}
                {phase.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => bulkSetPhase(bulkPhase)}
            disabled={bulkSaving || filtered.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600
                       hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs
                       font-medium rounded-lg transition-colors"
          >
            {bulkSaving ? "Applying..." : `Apply to ${filtered.length} student(s)`}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-sm pl-9 pr-4 py-2 border border-gray-200
                     rounded-xl text-sm text-gray-900 bg-white focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading students...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <ShieldCheck size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {search
              ? "No students match your search."
              : "No credentialing enrollments yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((enrollment) => {
            const isExpanded = expandedId === enrollment.id;
            const completedCount = enrollment.phases.filter(
              (p: CredentialingPhase) => p.status === "completed"
            ).length;
            const phases =
              phaseEdits[enrollment.id] ?? enrollment.phases;
            const currentPhaseName =
              CREDENTIALING_PHASES[enrollment.currentPhaseIndex]?.name ??
              "Unknown";

            return (
              <div
                key={enrollment.id}
                className="bg-white rounded-2xl border border-gray-100
                           overflow-hidden"
              >
                {/* Student row */}
                <button
                  onClick={() => openEnrollment(enrollment)}
                  className="w-full flex items-center gap-4 px-6 py-4
                             hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br
                                  from-blue-400 to-violet-500 flex items-center
                                  justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {enrollment.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {enrollment.userName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {enrollment.userEmail}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5 truncate">
                      Stage {enrollment.currentPhaseIndex + 1}:{" "}
                      {currentPhaseName}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="hidden md:flex flex-col items-end gap-1
                                  flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {completedCount}/{CREDENTIALING_PHASES.length} stages
                    </span>
                    <div className="w-28 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.round(
                            (completedCount / CREDENTIALING_PHASES.length) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded management panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-6">
                    <p className="text-xs font-semibold text-gray-500 uppercase
                                  tracking-wide mb-4">
                      Stage Management — {enrollment.userName}
                    </p>

                    <div className="space-y-2 mb-5">
                      {phases.map((phase: CredentialingPhase) => {
                        const config =
                          STATUS_CONFIG[phase.status as PhaseStatus] ??
                          STATUS_CONFIG.not_started;

                        return (
                          <div
                            key={phase.index}
                            className="border border-gray-100 rounded-xl p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className={cn(
                                    "flex-shrink-0",
                                    config.color
                                  )}
                                >
                                  {config.icon}
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0 font-mono">
                                  {String(phase.index + 1).padStart(2, "0")}
                                </span>
                                <span className="text-xs font-medium text-gray-900 truncate">
                                  {phase.name}
                                </span>
                              </div>

                              <select
                                value={phase.status}
                                onChange={(e) =>
                                  updatePhaseStatus(
                                    enrollment.id,
                                    phase.index,
                                    e.target.value as PhaseStatus
                                  )
                                }
                                className="px-2 py-1 border border-gray-200 rounded-lg
                                           text-xs text-gray-900 bg-white focus:outline-none
                                           focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Notes */}
                            <div className="mt-2">
                              <input
                                type="text"
                                value={phase.notes ?? ""}
                                onChange={(e) =>
                                  updatePhaseNotes(
                                    enrollment.id,
                                    phase.index,
                                    e.target.value
                                  )
                                }
                                placeholder="Add notes or instructions for this stage..."
                                className="w-full px-3 py-1.5 border border-gray-200
                                           rounded-lg text-xs text-gray-700 bg-gray-50
                                           focus:outline-none focus:ring-2
                                           focus:ring-blue-500 focus:bg-white"
                              />
                            </div>

                            {/* Dates */}
                            {(phase.completedAt || phase.startedAt) && (
                              <div className="mt-1.5 flex items-center gap-3
                                              text-xs text-gray-400">
                                {phase.startedAt && (
                                  <span>
                                    Started:{" "}
                                    {phase.startedAt
                                      .toDate()
                                      .toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                  </span>
                                )}
                                {phase.completedAt && (
                                  <span className="text-green-500">
                                    Completed:{" "}
                                    {phase.completedAt
                                      .toDate()
                                      .toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handleSave(enrollment)}
                      disabled={saving === enrollment.id}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                                 hover:bg-blue-700 disabled:bg-blue-400 text-white
                                 text-sm font-medium rounded-xl transition-colors"
                    >
                      <Save size={14} />
                      {saving === enrollment.id
                        ? "Saving..."
                        : "Save changes"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}