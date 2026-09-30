"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Topic,
  Module,
  Course,
  Material,
  Enrollment,
  TrackId,
  TOPIC_COLORS,
  TopicQuiz,
} from "@/types";
import Link from "next/link";
import VideoPlayer from "@/components/student/VideoPlayer";
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  FileText,
  Video,
  ClipboardList,
  Lock,
  ChevronRight,
  List,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function TopicPage() {
  const { trackId, courseId, moduleId, topicId } = useParams() as {
    trackId: TrackId;
    courseId: string;
    moduleId: string;
    topicId: string;
  };
  const { appUser } = useAuth();
  const router = useRouter();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizzes, setQuizzes] = useState<TopicQuiz[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [completedMaterials, setCompletedMaterials] = useState<string[]>([]);
  const [passedQuizzes, setPassedQuizzes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topicPos, setTopicPos] = useState<{ index: number; total: number } | null>(null);

  const basePath = `courses/${courseId}/modules/${moduleId}/topics/${topicId}`;

  const fetchData = useCallback(async () => {
    if (!appUser) return;

    try {
      // Check enrollment
      const enrollmentId = `${appUser.id}_${courseId}`;
      const enrollSnap = await getDoc(doc(db, "enrollments", enrollmentId));
      if (!enrollSnap.exists()) {
        router.push(`/courses/${courseId}`);
        return;
      }
      const e = { id: enrollSnap.id, ...enrollSnap.data() } as Enrollment;

      // ── SERVER-SIDE LOCK CHECK ─────────────────────────────
      // Get all topics in order
      const allTopicsSnap = await getDocs(
        query(
          collection(db, "courses", courseId, "modules", moduleId, "topics"),
          orderBy("order", "asc")
        )
      );
      const allTopics = allTopicsSnap.docs.map((d) => d.id);
      const topicIndex = allTopics.indexOf(topicId);
      const completedTopicIds: string[] = e.completedTopics ?? [];

      // Topic 0 is always available
      // Topic N requires topic N-1 to be complete
      if (topicIndex > 0) {
        const prevTopicId = allTopics[topicIndex - 1];
        if (!completedTopicIds.includes(prevTopicId)) {
          // Redirect back — topic is locked
          router.push(
            `/tracks/${trackId}/${courseId}/${moduleId}?tab=topics`
          );
          return;
        }
      }

      setTopicPos({ index: topicIndex + 1, total: allTopics.length });
      setEnrollment(e);
      setCompletedMaterials(e.topicMaterialsCompleted?.[topicId] ?? []);
      setPassedQuizzes(e.topicQuizzesPassed?.[topicId] ?? []);

      // Fetch topic data
      const [topicSnap, moduleSnap, matsSnap, quizzesSnap] =
        await Promise.all([
          getDoc(
            doc(db, "courses", courseId, "modules", moduleId, "topics", topicId)
          ),
          getDoc(doc(db, "courses", courseId, "modules", moduleId)),
          getDocs(
            query(collection(db, basePath, "materials"), orderBy("order", "asc"))
          ),
          getDocs(collection(db, basePath, "quizzes")),
        ]);

      if (topicSnap.exists())
        setTopic({ id: topicSnap.id, ...topicSnap.data() } as Topic);
      if (moduleSnap.exists())
        setModule({ id: moduleSnap.id, ...moduleSnap.data() } as Module);

      const matList = matsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Material)
      );
      setMaterials(matList);
      if (matList.length > 0 && !activeMaterial) {
        setActiveMaterial(matList[0]);
      }

      setQuizzes(
        quizzesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TopicQuiz))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [appUser, courseId, moduleId, topicId, trackId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function markMaterialDone(materialId: string) {
    if (!enrollment || completedMaterials.includes(materialId)) return;
    setMarkingDone(materialId);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/progress/material", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          moduleId,
          topicId,
          materialId,
        }),
      });

      if (res.ok) {
        const newCompleted = [...completedMaterials, materialId];
        setCompletedMaterials(newCompleted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingDone(null);
    }
  }

  async function checkAndCompleteTopicIfDone(
    matsDone: string[],
    quizsDone: string[]
  ) {
    if (!enrollment) return;

    const allMaterialsDone =
      materials.length === 0 || matsDone.length >= materials.length;
    const allQuizzesDone =
      quizzes.length === 0 || quizsDone.length >= quizzes.length;

    if (allMaterialsDone && allQuizzesDone) {
      const completedTopics: string[] = enrollment.completedTopics ?? [];
      if (!completedTopics.includes(topicId)) {
        await updateDoc(doc(db, "enrollments", enrollment.id), {
          completedTopics: arrayUnion(topicId),
        });
        setEnrollment((prev) =>
          prev
            ? {
                ...prev,
                completedTopics: [...completedTopics, topicId],
              }
            : prev
        );
      }
    }
  }

  const color =
    TOPIC_COLORS.find((c) => c.id === topic?.colorId) ?? TOPIC_COLORS[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading topic...</p>
      </div>
    );
  }

  if (!topic) return null;

  const allMaterialsDone =
    materials.length === 0 || completedMaterials.length >= materials.length;
  const allQuizzesDone =
    quizzes.length === 0 || passedQuizzes.length >= quizzes.length;
  const topicComplete = allMaterialsDone && allQuizzesDone;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-5rem)]">
      {/* ── Mobile topic bar ─────────────────────────────── */}
      <div
        className="lg:hidden flex items-center justify-between gap-3 bg-white
                   rounded-2xl border border-gray-100 p-3"
        style={{ borderTopColor: color.hex, borderTopWidth: 3 }}
      >
        <div className="min-w-0">
          <p className="text-xs text-gray-400">
            {topicPos
              ? `Topic ${topicPos.index} of ${topicPos.total}`
              : module?.title}
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate">
            {topic.title}
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl
                     bg-blue-50 text-blue-700 text-sm font-medium
                     flex-shrink-0 hover:bg-blue-100 transition-colors"
        >
          <List size={16} />
          Materials
        </button>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Left sidebar (drawer below lg) ───────────────── */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[85%] max-w-xs transition-transform duration-300",
          "lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:transition-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "flex-shrink-0 bg-white rounded-none lg:rounded-2xl border",
          "border-gray-100 flex flex-col overflow-hidden"
        )}
      >
        {/* Header */}
        <div
          className="p-4 border-b border-gray-100"
          style={{ borderTopColor: color.hex, borderTopWidth: 3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <Link
              href={`/tracks/${trackId}/${courseId}/${moduleId}?tab=topics`}
              className="flex items-center gap-1.5 text-xs text-gray-400
                         hover:text-gray-600 transition-colors py-2 lg:py-0"
            >
              <ChevronLeft size={13} />
              Back to topics
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close materials"
              className="lg:hidden w-11 h-11 -mr-2 -my-2 flex items-center
                         justify-center rounded-lg text-gray-500
                         hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {topic.imageUrl ? (
              <img
                src={topic.imageUrl}
                alt={topic.title}
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: color.hex }}
              />
            )}
            <p className="text-xs font-semibold text-gray-900 line-clamp-2">
              {topic.title}
            </p>
          </div>
        </div>

        {/* Materials list */}
        <div className="flex-1 overflow-y-auto">
          {/* Lesson content link */}
          {topic.lessonContent && (
            <button
              onClick={() => {
                setActiveMaterial(null);
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-3.5 lg:py-3 border-b border-gray-50",
                "flex items-center gap-2.5 text-xs transition-colors",
                activeMaterial === null
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <FileText size={13} className="flex-shrink-0" />
              Lesson
            </button>
          )}

          {/* Materials */}
          {materials.map((mat, index) => {
            const isDone = completedMaterials.includes(mat.id);
            const isActive = activeMaterial?.id === mat.id;
            return (
              <button
                key={mat.id}
                onClick={() => {
                  setActiveMaterial(mat);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3.5 lg:py-3 border-b border-gray-50",
                  "flex items-start gap-2.5 transition-colors",
                  isActive
                    ? "bg-blue-50"
                    : "hover:bg-gray-50"
                )}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {isDone ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <Circle size={14} className="text-gray-300" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      isActive ? "text-blue-700" : "text-gray-700"
                    )}
                  >
                    {mat.title}
                  </p>
                  <span
                    className={cn(
                      "text-xs",
                      mat.type === "video"
                        ? "text-blue-400"
                        : "text-orange-400"
                    )}
                  >
                    {mat.type === "video" ? (
                      <span className="flex items-center gap-0.5">
                        <Video size={10} /> Video
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <FileText size={10} /> PDF
                      </span>
                    )}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Quizzes */}
          {quizzes.map((quiz) => {
            const isPassed = passedQuizzes.includes(quiz.id);
            return (
              <Link
                key={quiz.id}
                href={`/tracks/${trackId}/${courseId}/${moduleId}/${topicId}/quiz/${quiz.id}`}
                className="flex items-center gap-2.5 px-4 py-3.5 lg:py-3 border-b
                           border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <span className="flex-shrink-0">
                  {isPassed ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <Circle size={14} className="text-gray-300" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {quiz.title}
                  </p>
                  <span className="text-xs text-purple-500 flex items-center gap-0.5">
                    <ClipboardList size={10} />
                    {quiz.type === "case_study" ? "Case Study" : "Quiz"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Completion status */}
        <div className="p-3 border-t border-gray-100">
          {topicComplete ? (
            <div className="flex items-center gap-2 text-xs text-green-600
                            font-medium">
              <CheckCircle size={14} />
              Topic complete
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              {completedMaterials.length}/{materials.length} done ·{" "}
              {passedQuizzes.length}/{quizzes.length} passed
            </div>
          )}
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeMaterial === null && topic.lessonContent ? (
          // Lesson content
          <div className="flex-1 bg-white rounded-2xl border border-gray-100
                          p-4 md:p-8 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b
                            border-gray-100">
              {topic.imageUrl ? (
                <img
                  src={topic.imageUrl}
                  alt={topic.title}
                  className="w-10 h-10 rounded-xl object-cover"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl"
                  style={{ backgroundColor: color.hex }}
                />
              )}
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {topic.title}
                </h1>
                <p className="text-xs text-gray-400">{module?.title}</p>
              </div>
            </div>
            <div
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: topic.lessonContent }}
            />
          </div>
        ) : activeMaterial ? (
          <>
            <div className="flex-1 bg-white rounded-2xl border border-gray-100
                            overflow-hidden mb-4">
              {/* Video */}
              {activeMaterial.type === "video" && activeMaterial.videoUrl && (
                <div className="h-full flex flex-col">
                  <VideoPlayer url={activeMaterial.videoUrl} />
                  <div className="p-5 border-t border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">
                      {activeMaterial.title}
                    </h2>
                  </div>
                </div>
              )}

              {/* PDF */}
              {activeMaterial.type === "pdf" && activeMaterial.fileUrl && (
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <iframe
                      src={activeMaterial.fileUrl}
                      className="w-full h-full min-h-[400px] md:min-h-[500px]"
                      title={activeMaterial.title}
                    />
                  </div>
                  <div className="p-4 border-t border-gray-100 flex items-center
                                  justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-900">
                      {activeMaterial.title}
                    </h2>
                    <a
                      href={activeMaterial.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Mark done bar */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4
                            flex flex-wrap items-center justify-between gap-3">
              {completedMaterials.includes(activeMaterial!.id) ? (
                <span className="flex items-center gap-2 text-sm text-green-600
                                 font-medium">
                  <CheckCircle size={16} />
                  Marked as complete
                </span>
              ) : (
                <button
                  onClick={() => markMaterialDone(activeMaterial!.id)}
                  disabled={markingDone === activeMaterial!.id}
                  className="flex items-center gap-2 px-5 py-3 md:py-2 bg-green-600
                             hover:bg-green-700 disabled:bg-green-400 text-white
                             text-sm font-medium rounded-xl transition-colors"
                >
                  <CheckCircle size={15} />
                  {markingDone === activeMaterial!.id
                    ? "Saving..."
                    : "Mark as complete"}
                </button>
              )}

              {/* Next material */}
              {activeMaterial && (() => {
                const idx = materials.findIndex(
                  (m) => m.id === activeMaterial!.id
                );
                const next = materials[idx + 1];
                if (!next) return null;
                return (
                  <button
                    onClick={() => setActiveMaterial(next)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 py-3 md:py-0
                              hover:text-gray-900 transition-colors"
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>
                );
              })()}
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100
                          flex items-center justify-center">
            <p className="text-sm text-gray-400">
              Select a lesson or material from the sidebar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}