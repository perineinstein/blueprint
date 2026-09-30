"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  Topic,
  Module,
  Course,
  TopicQuiz,
  TopicQuestion,
  QuizType,
  QuestionType,
  TOPIC_COLORS,
} from "@/types";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  Plus,
  Trash2,
  ChevronRight,
  ClipboardList,
  Check,
  X,
  CheckSquare,
  Square,
  AlignLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

export default function TopicQuizzesPage() {
  const { courseId, moduleId, topicId } = useParams() as {
    courseId: string;
    moduleId: string;
    topicId: string;
  };

  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [quizzes, setQuizzes] = useState<TopicQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Quiz form state
  const [quizTitle, setQuizTitle] = useState("");
  const [quizType, setQuizType] = useState<QuizType>("quiz");
  const [caseScenario, setCaseScenario] = useState("");
  const [duration, setDuration] = useState("30");
  const [passMark, setPassMark] = useState("70");
  const [allowRetake, setAllowRetake] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [retakeDelayHours, setRetakeDelayHours] = useState("0");
  const [questionsPerPage, setQuestionsPerPage] = useState("1");
  const [questions, setQuestions] = useState<TopicQuestion[]>([]);

  const basePath = `courses/${courseId}/modules/${moduleId}/topics/${topicId}`;

  async function fetchData() {
    const [courseSnap, moduleSnap, topicSnap, quizzesSnap] =
      await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDoc(doc(db, "courses", courseId, "modules", moduleId)),
        getDoc(
          doc(db, "courses", courseId, "modules", moduleId, "topics", topicId)
        ),
        getDocs(collection(db, basePath, "quizzes")),
      ]);

    if (courseSnap.exists())
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
    if (moduleSnap.exists())
      setModule({ id: moduleSnap.id, ...moduleSnap.data() } as Module);
    if (topicSnap.exists())
      setTopic({ id: topicSnap.id, ...topicSnap.data() } as Topic);

    setQuizzes(
      quizzesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TopicQuiz))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [courseId, moduleId, topicId]);

  // ── Question management ──────────────────────────────────
  function addQuestion(type: QuestionType) {
    const newQ: TopicQuestion = {
      id: uuidv4(),
      type,
      text: "",
      marks: 1,
      order: questions.length,
      correctAnswers: type === "mcq_single" ? ["A"] : [],
      ...(type !== "subjective" && {
        options: { A: "", B: "", C: "", D: "" },
      }),
    };
    setQuestions((prev) => [...prev, newQ]);
  }

  function updateQuestion(id: string, updates: Partial<TopicQuestion>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  }

  function updateOption(
    questionId: string,
    option: "A" | "B" | "C" | "D",
    value: string
  ) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: { ...q.options!, [option]: value } }
          : q
      )
    );
  }

  function toggleCorrectAnswer(questionId: string, option: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;

        if (q.type === "mcq_single") {
          // Single answer — replace
          return { ...q, correctAnswers: [option] };
        } else {
          // Multi answer — toggle
          const current = q.correctAnswers ?? [];
          const exists = current.includes(option);
          return {
            ...q,
            correctAnswers: exists
              ? current.filter((a) => a !== option)
              : [...current, option],
          };
        }
      })
    );
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleQuestionImageUpload(
    questionId: string,
    file: File
  ) {
    const storageRef = ref(
      storage,
      `quiz-images/${courseId}/${Date.now()}_${file.name}`
    );
    const task = uploadBytesResumable(storageRef, file);
    await new Promise<void>((resolve, reject) => {
      task.on("state_changed", null, reject, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        updateQuestion(questionId, { imageUrl: url });
        resolve();
      });
    });
  }

  // ── Save quiz ────────────────────────────────────────────
  async function handleSave() {
    setError("");
    setSuccess("");

    if (!quizTitle.trim()) {
      setError("Quiz title is required.");
      return;
    }
    if (questions.length === 0) {
      setError("Add at least one question.");
      return;
    }

    // Validate
    for (const q of questions) {
      if (!q.text.trim()) {
        setError("All questions must have text.");
        return;
      }
      if (q.type !== "subjective" && q.correctAnswers.length === 0) {
        setError("All objective questions must have at least one correct answer.");
        return;
      }
      if (q.type !== "subjective") {
        const opts = Object.values(q.options ?? {});
        if (opts.some((o) => !o.trim())) {
          setError("All MCQ options must be filled in.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      await addDoc(collection(db, basePath, "quizzes"), {
        topicId,
        moduleId,
        courseId,
        title: quizTitle,
        type: quizType,
        caseScenario: quizType === "case_study" ? caseScenario : "",
        durationMinutes: parseInt(duration),
        passMark: parseInt(passMark),
        published: true,
        allowRetake,
        maxAttempts:
          !allowRetake
            ? 1
            : maxAttempts === "unlimited"
            ? null
            : parseInt(maxAttempts),
        retakeDelayHours: parseInt(retakeDelayHours),
        questionsPerPage: parseInt(questionsPerPage),
        questions,
        createdAt: serverTimestamp(),
      });

      setSuccess("Quiz saved successfully.");
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Failed to save quiz.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setQuizTitle("");
    setQuizType("quiz");
    setCaseScenario("");
    setDuration("30");
    setPassMark("70");
    setAllowRetake(true);
    setMaxAttempts("3");
    setRetakeDelayHours("0");
    setQuestionsPerPage("1");
    setQuestions([]);
  }

  async function handleDelete(quizId: string) {
    if (!confirm("Delete this quiz?")) return;
    await deleteDoc(doc(db, basePath, "quizzes", quizId));
    fetchData();
  }

  const color =
    TOPIC_COLORS.find((c) => c.id === topic?.colorId) ?? TOPIC_COLORS[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2
                      flex-wrap">
        <Link href="/admin/courses" className="hover:text-gray-600">
          Courses
        </Link>
        <ChevronRight size={13} />
        <Link
          href={`/admin/courses/${courseId}/modules`}
          className="hover:text-gray-600"
        >
          Modules
        </Link>
        <ChevronRight size={13} />
        <Link
          href={`/admin/courses/${courseId}/modules/${moduleId}/topics`}
          className="hover:text-gray-600"
        >
          Topics
        </Link>
        <ChevronRight size={13} />
        <Link
          href={`/admin/courses/${courseId}/modules/${moduleId}/topics/${topicId}/content`}
          className="hover:text-gray-600"
        >
          {topic?.title}
        </Link>
        <ChevronRight size={13} />
        <span className="text-gray-600">Quizzes</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          {topic?.imageUrl ? (
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
            <h1 className="text-2xl font-semibold text-gray-900">
              Quizzes & Assessments
            </h1>
            <p className="text-sm text-gray-500">{topic?.title}</p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
            setError("");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium
                     rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add quiz
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 rounded-xl text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Existing quizzes */}
      {quizzes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100
                        overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Existing quizzes ({quizzes.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <ClipboardList size={14} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {quiz.title}
                    </p>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        quiz.type === "case_study"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      )}
                    >
                      {quiz.type === "case_study" ? "Case Study" : "Quiz"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {quiz.durationMinutes} min ·{" "}
                    {quiz.questions.length} questions · Pass:{" "}
                    {quiz.passMark}%
                    {quiz.allowRetake &&
                      ` · ${quiz.maxAttempts ?? "∞"} attempts`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/courses/${courseId}/modules/${moduleId}/topics/${topicId}/quizzes/${quiz.id}/grade`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium border border-amber-200
                               bg-amber-50 text-amber-700 hover:bg-amber-100
                               transition-colors"
                  >
                    <ClipboardList size={12} />
                    Grade
                  </Link>
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium border border-red-200
                               bg-red-50 text-red-600 hover:bg-red-100
                               transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz creation form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">
              New quiz / assessment
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Type selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assessment type
              </label>
              <div className="flex gap-3">
                {(
                  [
                    { id: "quiz", label: "Quiz", desc: "Objective questions" },
                    {
                      id: "case_study",
                      label: "Case Study",
                      desc: "Subjective scenario",
                    },
                  ] as { id: QuizType; label: string; desc: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setQuizType(t.id)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl border text-left",
                      "transition-colors",
                      quizType === t.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-medium",
                        quizType === t.id ? "text-blue-700" : "text-gray-900"
                      )}
                    >
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                placeholder={
                  quizType === "case_study"
                    ? "e.g. Case Study 1: Cardiovascular Patient"
                    : "e.g. Quiz 1: Basic Anatomy"
                }
              />
            </div>

            {/* Case scenario — only for case study */}
            {quizType === "case_study" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case scenario
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  The clinical scenario students read before answering
                  questions
                </p>
                <RichTextEditor
                  value={caseScenario}
                  onChange={setCaseScenario}
                  placeholder="Write the case study scenario here..."
                  minHeight="150px"
                />
              </div>
            )}

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pass mark (%)
                </label>
                <input
                  type="number"
                  value={passMark}
                  onChange={(e) => setPassMark(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Questions per page */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Questions per page
              </label>
              <select
                value={questionsPerPage}
                onChange={(e) => setQuestionsPerPage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1 per page</option>
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="0">Show all</option>
              </select>
            </div>

            {/* Retake settings */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Allow retakes
                  </p>
                  <p className="text-xs text-gray-400">
                    Students can attempt this more than once
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowRetake(!allowRetake)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative",
                    allowRetake ? "bg-blue-600" : "bg-gray-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full",
                      "transition-transform",
                      allowRetake ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {allowRetake && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t
                                border-gray-100">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Max attempts
                    </label>
                    <select
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200
                                 rounded-xl text-sm text-gray-900 bg-white
                                 focus:outline-none focus:ring-2
                                 focus:ring-blue-500"
                    >
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="5">5</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Cooldown before retry
                    </label>
                    <select
                      value={retakeDelayHours}
                      onChange={(e) => setRetakeDelayHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200
                                 rounded-xl text-sm text-gray-900 bg-white
                                 focus:outline-none focus:ring-2
                                 focus:ring-blue-500"
                    >
                      <option value="0">None</option>
                      <option value="1">1 hour</option>
                      <option value="24">24 hours</option>
                      <option value="72">3 days</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Questions section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Questions ({questions.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addQuestion("mcq_single")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium bg-blue-50 text-blue-700
                               hover:bg-blue-100 border border-blue-200
                               transition-colors"
                  >
                    <CheckSquare size={12} />
                    Single MCQ
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuestion("mcq_multi")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium bg-indigo-50 text-indigo-700
                               hover:bg-indigo-100 border border-indigo-200
                               transition-colors"
                  >
                    <CheckSquare size={12} />
                    Multi MCQ
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuestion("subjective")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium bg-purple-50 text-purple-700
                               hover:bg-purple-100 border border-purple-200
                               transition-colors"
                  >
                    <AlignLeft size={12} />
                    Subjective
                  </button>
                </div>
              </div>

              {questions.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200
                                rounded-xl p-8 text-center">
                  <p className="text-sm text-gray-400">
                    Add questions using the buttons above
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, index) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={index}
                      onUpdate={updateQuestion}
                      onUpdateOption={updateOption}
                      onToggleCorrect={toggleCorrectAnswer}
                      onRemove={removeQuestion}
                      onImageUpload={handleQuestionImageUpload}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600
                           hover:bg-blue-700 disabled:bg-blue-400 text-white
                           text-sm font-medium rounded-xl transition-colors"
              >
                <Check size={15} />
                {saving ? "Saving..." : "Save quiz"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-gray-200 text-gray-600
                           text-sm font-medium rounded-xl hover:bg-gray-50
                           transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Question card component ────────────────────────────────
function QuestionCard({
  question,
  index,
  onUpdate,
  onUpdateOption,
  onToggleCorrect,
  onRemove,
  onImageUpload,
}: {
  question: TopicQuestion;
  index: number;
  onUpdate: (id: string, updates: Partial<TopicQuestion>) => void;
  onUpdateOption: (id: string, opt: "A" | "B" | "C" | "D", val: string) => void;
  onToggleCorrect: (id: string, opt: string) => void;
  onRemove: (id: string) => void;
  onImageUpload: (id: string, file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onImageUpload(question.id, file);
    setUploading(false);
  }

  const typeLabel =
    question.type === "mcq_single"
      ? "Single MCQ"
      : question.type === "mcq_multi"
      ? "Multi MCQ"
      : "Subjective";

  const typeColor =
    question.type === "mcq_single"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : question.type === "mcq_multi"
      ? "text-indigo-700 bg-indigo-50 border-indigo-200"
      : "text-purple-700 bg-purple-50 border-purple-200";

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Question header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">
            Q{index + 1}
          </span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium border",
              typeColor
            )}
          >
            {typeLabel}
          </span>
          {question.text && (
            <span className="text-xs text-gray-500 truncate max-w-xs">
              {question.text.slice(0, 50)}
              {question.text.length > 50 ? "..." : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Marks:</label>
            <input
              type="number"
              value={question.marks}
              onChange={(e) =>
                onUpdate(question.id, { marks: parseInt(e.target.value) || 1 })
              }
              className="w-12 px-2 py-1 border border-gray-200 rounded-lg
                         text-xs text-gray-900 bg-white focus:outline-none
                         focus:ring-1 focus:ring-blue-500"
              min="1"
            />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600"
          >
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(question.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Question text */}
          <textarea
            value={question.text}
            onChange={(e) => onUpdate(question.id, { text: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl
                       text-sm text-gray-900 bg-white focus:outline-none
                       focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Enter question text..."
          />

          {/* Image upload */}
          <div>
            {question.imageUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={question.imageUrl}
                  alt="Question"
                  className="h-24 rounded-lg border border-gray-200
                             object-contain"
                />
                <button
                  type="button"
                  onClick={() => onUpdate(question.id, { imageUrl: "" })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3 py-1.5
                                bg-gray-50 hover:bg-gray-100 border border-gray-200
                                rounded-lg text-xs text-gray-500 cursor-pointer
                                transition-colors">
                {uploading ? "Uploading..." : "Add diagram/image (optional)"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImage}
                />
              </label>
            )}
          </div>

          {/* MCQ options */}
          {(question.type === "mcq_single" ||
            question.type === "mcq_multi") && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                {question.type === "mcq_single"
                  ? "Click a letter to set the ONE correct answer"
                  : "Click letters to toggle MULTIPLE correct answers"}
              </p>
              {(["A", "B", "C", "D"] as const).map((opt) => {
                const isCorrect = question.correctAnswers?.includes(opt);
                return (
                  <div key={opt} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleCorrect(question.id, opt)}
                      className={cn(
                        "w-7 h-7 rounded-lg flex-shrink-0 text-xs font-bold",
                        "transition-colors border",
                        isCorrect
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {isCorrect ? (
                        <Check size={13} className="mx-auto" />
                      ) : (
                        opt
                      )}
                    </button>
                    <input
                      type="text"
                      value={question.options?.[opt] ?? ""}
                      onChange={(e) =>
                        onUpdateOption(question.id, opt, e.target.value)
                      }
                      className="flex-1 px-3 py-1.5 border border-gray-200
                                 rounded-xl text-sm text-gray-900 bg-white
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${opt}`}
                    />
                  </div>
                );
              })}
              <p className="text-xs text-green-600">
                Correct:{" "}
                {question.correctAnswers?.join(", ") || "None selected"}
              </p>
            </div>
          )}

          {/* Subjective */}
          {question.type === "subjective" && (
            <div className="p-3 bg-purple-50 rounded-xl">
              <p className="text-xs text-purple-600">
                Student writes a text answer. Admin grades manually.
              </p>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Explanation (shown after submission)
            </label>
            <textarea
              value={question.explanation ?? ""}
              onChange={(e) =>
                onUpdate(question.id, { explanation: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl
                         text-sm text-gray-900 bg-white focus:outline-none
                         focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Explain why this is the correct answer..."
            />
          </div>
        </div>
      )}
    </div>
  );
}