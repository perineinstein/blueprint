"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Course,
  Module,
  Topic,
  Enrollment,
  TrackId,
  TOPIC_COLORS,
  TopicQuiz,
  TopicAttempt,
  getMasteryStars,
  MASTERY_THRESHOLDS,
} from "@/types";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Lock,
  Star,
  ClipboardList,
  LayoutDashboard,
  Trophy,
  ArrowRight,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { sanitizeHtml } from "@/lib/sanitize";

type Tab = "overview" | "topics" | "assessment" | "mastery";

interface TopicWithStatus extends Topic {
  isComplete: boolean;
  isAvailable: boolean;
  isLocked: boolean;
  materialsCompleted: number;
  materialsTotal: number;
  quizzesPassed: number;
  quizzesTotal: number;
}

interface AssessmentItem {
  quizId: string;
  quizTitle: string;
  quizType: string;
  topicId: string;
  topicTitle: string;
  topicColor: string;
  attempt: TopicAttempt | null;
  passMark: number;
}

export default function ModulePage() {
  const { trackId, courseId, moduleId } = useParams() as {
    trackId: TrackId;
    courseId: string;
    moduleId: string;
  };
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) ?? "overview";
  const { appUser } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [topics, setTopics] = useState<TopicWithStatus[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([]);
  const [masteryScore, setMasteryScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!appUser) return;

    try {
      // Fire every top-level read in parallel: enrollment, course, module,
      // topics, and ALL of this user's attempts for this module (one query
      // instead of one per quiz).
      const enrollPromise = getDoc(
        doc(db, "enrollments", `${appUser.id}_${courseId}`)
      );
      const restPromise = Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDoc(doc(db, "courses", courseId, "modules", moduleId)),
        getDocs(
          query(
            collection(
              db,
              "courses",
              courseId,
              "modules",
              moduleId,
              "topics"
            ),
            orderBy("order", "asc")
          )
        ),
        getDocs(
          query(
            collection(db, "topicAttempts"),
            where("userId", "==", appUser.id),
            where("moduleId", "==", moduleId)
          )
        ),
      ]);
      // If the user is not enrolled we redirect without awaiting these, so
      // make sure a rejected read can't surface as an unhandled rejection.
      restPromise.catch(() => {});

      const enrollSnap = await enrollPromise;
      if (!enrollSnap.exists()) {
        router.push(`/courses/${courseId}`);
        return;
      }
      const e = { id: enrollSnap.id, ...enrollSnap.data() } as Enrollment;
      setEnrollment(e);

      const [courseSnap, moduleSnap, topicsSnap, attemptsSnap] =
        await restPromise;

      if (courseSnap.exists())
        setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
      if (moduleSnap.exists())
        setModule({ id: moduleSnap.id, ...moduleSnap.data() } as Module);

      const rawTopics = topicsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Topic)
      );

      // Latest attempt (highest attemptNumber) per quiz
      const latestAttemptByQuiz = new Map<string, TopicAttempt>();
      for (const a of attemptsSnap.docs) {
        const attempt = { id: a.id, ...a.data() } as TopicAttempt;
        const current = latestAttemptByQuiz.get(attempt.quizId);
        if (
          !current ||
          (attempt.attemptNumber ?? 0) > (current.attemptNumber ?? 0)
        ) {
          latestAttemptByQuiz.set(attempt.quizId, attempt);
        }
      }

      const completedTopics: string[] = e.completedTopics ?? [];
      const topicProgress: Record<string, string[]> =
        e.topicMaterialsCompleted ?? {};
      const quizProgress: Record<string, string[]> =
        e.topicQuizzesPassed ?? {};

      // Fetch materials + quizzes for every topic in parallel
      const topicContents = await Promise.all(
        rawTopics.map((topic) => {
          const basePath = `courses/${courseId}/modules/${moduleId}/topics/${topic.id}`;
          return Promise.all([
            getDocs(collection(db, basePath, "materials")),
            getDocs(collection(db, basePath, "quizzes")),
          ]);
        })
      );

      // Build topic statuses + assessment data (no further reads)
      const allAssessments: AssessmentItem[] = [];
      let totalScore = 0;
      let totalPossible = 0;

      const topicsWithStatus: TopicWithStatus[] = rawTopics.map(
        (topic, index) => {
          const [matsSnap, quizzesSnap] = topicContents[index];

          const materialsTotal = matsSnap.size;
          const materialsCompleted = (topicProgress[topic.id] ?? []).length;
          const quizzesTotal = quizzesSnap.size;
          const quizzesPassed = (quizProgress[topic.id] ?? []).length;
          const isComplete = completedTopics.includes(topic.id);

          // Sequential unlock: topic 0 always available
          // topic N available if topic N-1 is complete
          const isAvailable =
            index === 0 || completedTopics.includes(rawTopics[index - 1].id);
          const isLocked = !isAvailable;

          // Build assessment items for this topic
          const color =
            TOPIC_COLORS.find((c) => c.id === topic.colorId)?.hex ?? "#3B5BDB";

          for (const quizDoc of quizzesSnap.docs) {
            const quiz = {
              id: quizDoc.id,
              ...quizDoc.data(),
            } as TopicQuiz;

            const latestAttempt = latestAttemptByQuiz.get(quizDoc.id) ?? null;

            if (
              latestAttempt?.status === "graded" &&
              latestAttempt.percentScore !== null
            ) {
              totalScore += latestAttempt.percentScore;
              totalPossible += 100;
            }

            allAssessments.push({
              quizId: quizDoc.id,
              quizTitle: quiz.title,
              quizType: quiz.type ?? "quiz",
              topicId: topic.id,
              topicTitle: topic.title,
              topicColor: color,
              attempt: latestAttempt,
              passMark: quiz.passMark,
            });
          }

          return {
            ...topic,
            isComplete,
            isAvailable,
            isLocked,
            materialsCompleted,
            materialsTotal,
            quizzesPassed,
            quizzesTotal,
          };
        }
      );

      setTopics(topicsWithStatus);
      setAssessmentItems(allAssessments);

      // Calculate mastery
      if (totalPossible > 0) {
        setMasteryScore(Math.round((totalScore / totalPossible) * 100));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [appUser, courseId, moduleId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard size={15} />,
    },
    {
      id: "topics",
      label: "Topics",
      icon: <BookOpen size={15} />,
    },
    {
      id: "assessment",
      label: "Assessment",
      icon: <ClipboardList size={15} />,
    },
    {
      id: "mastery",
      label: "Mastery",
      icon: <Trophy size={15} />,
    },
  ];

  function setTab(tab: Tab) {
    router.push(`?tab=${tab}`, { scroll: false });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading module...</p>
      </div>
    );
  }

  const stars = masteryScore !== null ? getMasteryStars(masteryScore) : 0;

  return (
    <div>
      {/* Back */}
      <Link
        href={`/tracks/${trackId}/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400
                   hover:text-gray-600 mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        Back to modules
      </Link>

      {/* Module header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">
          {module?.title}
        </h1>
        <p className="text-sm text-gray-500">{course?.title}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 md:py-2.5 px-3 whitespace-nowrap",
              "rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 overflow-x-auto">
          {module?.overview ? (
            <div
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(module.overview) }}
            />
          ) : (
            <p className="text-sm text-gray-400">
              No overview added for this module yet.
            </p>
          )}
        </div>
      )}

      {/* ── Topics Tab ───────────────────────────────────── */}
      {activeTab === "topics" && (
        <div className="space-y-3">
          {topics.map((topic, index) => {
            const color =
              TOPIC_COLORS.find((c) => c.id === topic.colorId) ??
              TOPIC_COLORS[0];

            return (
              <div key={topic.id}>
                {topic.isLocked ? (
                  // Locked topic — not clickable
                  <div
                    className="bg-white rounded-2xl border border-gray-100 p-4
                               opacity-60"
                  >
                    <div className="flex items-center gap-4">
                      {/* Image or color block */}
                      <div className="relative flex-shrink-0">
                        {topic.imageUrl ? (
                          <img
                            src={topic.imageUrl}
                            alt={topic.title}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover
                                       grayscale"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center
                                       justify-center bg-gray-200"
                          >
                            <span className="text-gray-400 font-bold text-sm">
                              {index + 1}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-white/60 rounded-xl
                                        flex items-center justify-center">
                          <Lock size={16} className="text-gray-400" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-500">
                          {topic.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Complete previous topic to unlock
                        </p>
                      </div>

                      <Lock size={16} className="text-gray-300 flex-shrink-0" />
                    </div>
                  </div>
                ) : (
                  // Available or completed topic
                  <Link
                    href={`/tracks/${trackId}/${courseId}/${moduleId}/${topic.id}`}
                    className={cn(
                      "block bg-white rounded-2xl border transition-all p-4",
                      topic.isComplete
                        ? "border-green-200 hover:border-green-300"
                        : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Image or colored block */}
                      <div className="relative flex-shrink-0">
                        {topic.imageUrl ? (
                          <img
                            src={topic.imageUrl}
                            alt={topic.title}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center
                                       justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: color.hex }}
                          >
                            {index + 1}
                          </div>
                        )}
                        {topic.isComplete && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5
                                          bg-green-500 rounded-full flex items-center
                                          justify-center">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                          <p className="text-sm font-semibold text-gray-900">
                            {topic.title}
                          </p>
                        </div>

                        {/* Mini progress */}
                        <div className="flex items-center gap-3 text-xs
                                        text-gray-400">
                          {topic.materialsTotal > 0 && (
                            <span>
                              {topic.materialsCompleted}/{topic.materialsTotal}{" "}
                              materials
                            </span>
                          )}
                          {topic.quizzesTotal > 0 && (
                            <span>
                              {topic.quizzesPassed}/{topic.quizzesTotal} quizzes
                            </span>
                          )}
                        </div>
                      </div>

                      {topic.isComplete ? (
                        <CheckCircle
                          size={18}
                          className="text-green-500 flex-shrink-0"
                        />
                      ) : (
                        <ChevronRight
                          size={18}
                          className="text-gray-300 flex-shrink-0"
                        />
                      )}
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Assessment Tab ───────────────────────────────── */}
      {activeTab === "assessment" && (
        <div className="space-y-6">
          {topics.map((topic) => {
            const topicAssessments = assessmentItems.filter(
              (a) => a.topicId === topic.id
            );
            if (topicAssessments.length === 0) return null;

            const color =
              TOPIC_COLORS.find((c) => c.id === topic.colorId) ??
              TOPIC_COLORS[0];

            return (
              <div
                key={topic.id}
                className="bg-white rounded-2xl border border-gray-100
                           overflow-hidden"
              >
                {/* Topic header */}
                <div
                  className="flex items-center gap-3 px-5 py-3 border-b
                             border-gray-100"
                  style={{ borderLeftColor: color.hex, borderLeftWidth: 3 }}
                >
                  {topic.imageUrl ? (
                    <img
                      src={topic.imageUrl}
                      alt={topic.title}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                  )}
                  <p className="text-sm font-semibold text-gray-900">
                    {topic.title}
                  </p>
                </div>

                {/* Assessment items */}
                <div className="divide-y divide-gray-50">
                  {topicAssessments.map((item) => {
                    const attempt = item.attempt;
                    const isGraded = attempt?.status === "graded";
                    const isSubmitted = attempt?.status === "submitted";
                    const notAttempted = !attempt;

                    return (
                      <Link
                        key={item.quizId}
                        href={`/tracks/${trackId}/${courseId}/${moduleId}/${item.topicId}/quiz/${item.quizId}`}
                        className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5
                                   hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ClipboardList
                            size={15}
                            className="text-gray-400 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {item.quizTitle}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">
                              {item.quizType === "case_study"
                                ? "Case Study"
                                : "Quiz"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                          {isGraded && attempt.score !== null ? (
                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-semibold",
                                attempt.passed
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-600"
                              )}
                            >
                              {attempt.score}/{attempt.totalMarks}
                            </span>
                          ) : isSubmitted ? (
                            <span className="px-2.5 py-1 rounded-full text-xs
                                             font-medium bg-amber-50 text-amber-700">
                              Awaiting grade
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs
                                             font-medium bg-gray-100 text-gray-500">
                              Not attempted
                            </span>
                          )}
                          <ChevronRight size={15} className="text-gray-300" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {assessmentItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12
                            text-center">
              <ClipboardList
                size={32}
                className="text-gray-300 mx-auto mb-3"
              />
              <p className="text-sm text-gray-400">
                No assessments in this module yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Mastery Tab ──────────────────────────────────── */}
      {activeTab === "mastery" && (
        <div className="space-y-6">
          {/* Star display */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-8
                          text-center">
            <Trophy
              size={36}
              className="text-amber-400 mx-auto mb-4"
            />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Module Mastery
            </h2>

            {masteryScore === null ? (
              <p className="text-sm text-gray-400 mb-4">
                Complete assessments to see your mastery level.
              </p>
            ) : (
              <>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {masteryScore}%
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Combined assessment performance
                </p>
              </>
            )}

            {/* Stars */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={36}
                  className={cn(
                    "transition-colors",
                    s <= stars
                      ? "text-amber-400 fill-amber-400"
                      : "text-gray-200 fill-gray-200"
                  )}
                />
              ))}
            </div>

            {masteryScore !== null && (
              <p className="text-sm font-medium text-gray-700">
                {
                  MASTERY_THRESHOLDS.find((t) => masteryScore >= t.minPercent)
                    ?.label
                }
              </p>
            )}
          </div>

          {/* Thresholds legend */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase
                           tracking-wide mb-4">
              Mastery levels
            </h3>
            <div className="space-y-3">
              {MASTERY_THRESHOLDS.map((threshold) => (
                <div
                  key={threshold.stars}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl",
                    masteryScore !== null &&
                      masteryScore >= threshold.minPercent &&
                      (threshold.stars === getMasteryStars(masteryScore))
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[...Array(threshold.stars)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className="text-amber-400 fill-amber-400"
                        />
                      ))}
                      {[...Array(5 - threshold.stars)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className="text-gray-200 fill-gray-200"
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-700 font-medium">
                      {threshold.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {threshold.minPercent}%+
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}