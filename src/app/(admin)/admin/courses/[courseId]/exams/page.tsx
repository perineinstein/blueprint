"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Exam, Course, Question } from "@/types";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

export default function ExamsPage() {
  const { courseId } = useParams() as { courseId: string };

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("30");
  const [passMark, setPassMark] = useState("70");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [questionsPerPage, setQuestionsPerPage] = useState("0"); // 0 = all
  const [allowRetake, setAllowRetake] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [retakeDelayHours, setRetakeDelayHours] = useState("0");

  async function fetchData() {
    const [courseSnap, examsSnap] = await Promise.all([
      getDoc(doc(db, "courses", courseId)),
      getDocs(
        query(collection(db, "exams"), where("courseId", "==", courseId))
      ),
    ]);

    if (courseSnap.exists()) {
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
    }

    setExams(
      examsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [courseId]);

  // ── Question management ───────────────────────────────────
  function addQuestion(type: "mcq_single" | "subjective") {
    const newQuestion: Question = {
      id: uuidv4(),
      type,
      text: "",
      marks: 1,
      order: questions.length,
      ...(type === "mcq_single" && {
        options: { A: "", B: "", C: "", D: "" },
        correctAnswer: "A",
      }),
    };
    setQuestions([...questions, newQuestion]);
  }

  function updateQuestion(id: string, updates: Partial<Question>) {
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

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  // ── Save exam ─────────────────────────────────────────────
  async function handleSaveExam(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Please enter an exam title.");
      return;
    }
    if (questions.length === 0) {
      setError("Please add at least one question.");
      return;
    }

    // Validate questions
    for (const q of questions) {
      if (!q.text.trim()) {
        setError("All questions must have text.");
        return;
      }
      if (q.type === "mcq_single") {
        if (
          !q.options?.A ||
          !q.options?.B ||
          !q.options?.C ||
          !q.options?.D
        ) {
          setError("All MCQ options must be filled in.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "exams"), {
        courseId,
        title,
        durationMinutes: parseInt(duration),
        passMark: parseInt(passMark),
        published: true,
        randomizeQuestions: false,
        questionsPerPage: parseInt(questionsPerPage),
        allowRetake,
        maxAttempts: !allowRetake
          ? 1
          : maxAttempts === "unlimited"
          ? null
          : parseInt(maxAttempts),
        retakeDelayHours: parseInt(retakeDelayHours),
        questions,
        createdAt: serverTimestamp(),
      });

      setSuccess("Exam created successfully!");
      setTitle("");
      setDuration("30");
      setPassMark("70");
      setQuestionsPerPage("0");
      setAllowRetake(false);
      setMaxAttempts("1");
      setRetakeDelayHours("0");
      setQuestions([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Failed to save exam.");
    } finally {
      setSaving(false);
    }
  }
  

  async function handleQuestionImageUpload(
    questionId: string,
    file: File
  ) {
    setUploadingImage(questionId);
    try {
      const storageRef = ref(
        storage,
        `exam-images/${courseId}/${Date.now()}_${file.name}`
      );
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          null,
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            updateQuestion(questionId, { imageUrl: url });
            resolve();
          }
        );
      });
    } catch (error) {
      console.error("Image upload error:", error);
    } finally {
      setUploadingImage(null);
    }
  }

  function removeQuestionImage(questionId: string) {
    updateQuestion(questionId, { imageUrl: "" });
  }

  async function deleteExam(examId: string) {
    if (!confirm("Delete this exam?")) return;
    await deleteDoc(doc(db, "exams", examId));
    fetchData();
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/admin/courses" className="hover:text-gray-600">
            Courses
          </Link>
          <span>/</span>
          <span className="text-gray-600">{course?.title}</span>
          <span>/</span>
          <span className="text-gray-600">Exams</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Exams</h1>
      </div>

      {/* Existing exams */}
      {exams.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Existing exams ({exams.length})
            </h2>
          </div>
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between px-6 py-4
                         border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {exam.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {exam.durationMinutes} min · {exam.questions.length} questions
                  · Pass mark: {exam.passMark}%
                  {exam.allowRetake && (
                    <>
                      {" "}·{" "}
                      {exam.maxAttempts === null
                        ? "Unlimited attempts"
                        : `${exam.maxAttempts} attempts`}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/courses/${courseId}/exams/${exam.id}/grade`}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Grade
                </Link>
                <button
                  onClick={() => deleteExam(exam.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create exam form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-6">
          Create new exam
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-sm text-green-600">
            {success}
          </div>
        )}

        <form onSubmit={handleSaveExam} className="space-y-6">
          {/* Exam settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exam title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg
                         text-sm text-gray-900 bg-white focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Mid-term Assessment"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                min="5"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                min="1"
                max="100"
              />
            </div>
          </div>

          {/* Pagination + Retry settings */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Exam settings
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Questions per page
                </label>
                <select
                  value={questionsPerPage}
                  onChange={(e) => setQuestionsPerPage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                            text-gray-900 bg-white focus:outline-none focus:ring-2
                            focus:ring-blue-500"
                >
                  <option value="0">Show all questions</option>
                  <option value="1">1 per page</option>
                  <option value="5">5 per page</option>
                  <option value="10">10 per page</option>
                </select>
              </div>
            </div>

            {/* Allow retake toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Allow retakes</p>
                <p className="text-xs text-gray-400">
                  Let students attempt this exam more than once
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllowRetake(!allowRetake)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                  allowRetake ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform
                            ${allowRetake ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Retry settings — only show if allowRetake is on */}
            {allowRetake && (
              <div className="grid grid-cols-2 gap-4 pl-3 border-l-2 border-blue-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max attempts
                  </label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                              text-gray-900 bg-white focus:outline-none focus:ring-2
                              focus:ring-blue-500"
                  >
                    <option value="2">2 attempts</option>
                    <option value="3">3 attempts</option>
                    <option value="5">5 attempts</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cooldown before retry
                  </label>
                  <select
                    value={retakeDelayHours}
                    onChange={(e) => setRetakeDelayHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                              text-gray-900 bg-white focus:outline-none focus:ring-2
                              focus:ring-blue-500"
                  >
                    <option value="0">No cooldown — retry immediately</option>
                    <option value="1">1 hour</option>
                    <option value="24">24 hours</option>
                    <option value="72">3 days</option>
                    <option value="168">1 week</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Questions ({questions.length})
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addQuestion("mcq_single")}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs
                             font-medium rounded-lg hover:bg-blue-100 transition-colors"
                >
                  + MCQ
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion("subjective")}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs
                             font-medium rounded-lg hover:bg-purple-100 transition-colors"
                >
                  + Subjective
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-gray-200
                              rounded-xl text-center text-sm text-gray-400">
                No questions yet. Add MCQ or subjective questions above.
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="border border-gray-200 rounded-xl p-4"
                  >
                    {/* Question header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">
                        Question {index + 1} —{" "}
                        <span
                          className={
                            q.type === "mcq_single" || q.type === "mcq_multi"
                              ? "text-blue-600"
                              : "text-purple-600"
                          }
                        >
                          {q.type === "mcq_single" || q.type === "mcq_multi" ? "Multiple Choice" : "Subjective"}
                        </span>
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-400">
                            Marks:
                          </label>
                          <input
                            type="number"
                            value={q.marks}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                marks: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-12 px-2 py-1 border border-gray-200
                                       rounded text-xs text-gray-900 bg-white
                                       focus:outline-none focus:ring-1
                                       focus:ring-blue-500"
                            min="1"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Question text */}
                    <textarea
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(q.id, { text: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200
                                 rounded-lg text-sm text-gray-900 bg-white
                                 focus:outline-none focus:ring-2
                                 focus:ring-blue-500 resize-none mb-3"
                      placeholder="Enter question text..."
                    />

                    {/* Question image (diagram) */}
                    <div className="mb-3">
                      {q.imageUrl ? (
                        <div className="relative inline-block">
                          <img
                            src={q.imageUrl}
                            alt="Question diagram"
                            className="max-h-40 rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeQuestionImage(q.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600
                                      text-white rounded-full flex items-center justify-center
                                      text-xs transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50
                                          hover:bg-gray-100 border border-gray-200 rounded-lg
                                          text-xs text-gray-500 cursor-pointer transition-colors">
                          <span>🖼️</span>
                          {uploadingImage === q.id ? "Uploading..." : "Add diagram/image"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingImage === q.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleQuestionImageUpload(q.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* MCQ options */}
                    {q.type === "mcq_single" || q.type === "mcq_multi" ? (
                      <div className="space-y-2">
                        {(["A", "B", "C", "D"] as const).map((opt) => (
                          <div
                            key={opt}
                            className="flex items-center gap-2"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                updateQuestion(q.id, {
                                  correctAnswer: opt,
                                })
                              }
                              className={`w-7 h-7 rounded-full flex-shrink-0 text-xs
                                         font-semibold transition-colors ${
                                           q.correctAnswer === opt
                                             ? "bg-green-500 text-white"
                                             : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                         }`}
                            >
                              {opt}
                            </button>
                            <input
                              type="text"
                              value={q.options?.[opt] ?? ""}
                              onChange={(e) =>
                                updateOption(q.id, opt, e.target.value)
                              }
                              className="flex-1 px-3 py-1.5 border border-gray-200
                                         rounded-lg text-sm text-gray-900 bg-white
                                         focus:outline-none focus:ring-2
                                         focus:ring-blue-500"
                              placeholder={`Option ${opt}`}
                            />
                          </div>
                        ))}
                        <p className="text-xs text-gray-400 mt-1">
                          Click the letter to set correct answer (
                          {q.correctAnswer} is correct)
                        </p>
                      </div>
                    ) : null}

                    {/* Explanation field — NEW, add after options/subjective block */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Explanation (shown to student after they answer)
                      </label>
                      <textarea
                        value={q.explanation ?? ""}
                        onChange={(e) =>
                          updateQuestion(q.id, { explanation: e.target.value })
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                                  text-gray-900 bg-white focus:outline-none focus:ring-2
                                  focus:ring-blue-500 resize-none"
                        placeholder="Explain why this is the correct answer..."
                      />
                    </div>

                    {q.type === "subjective" && (
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs text-purple-600">
                          Student will write a text answer. You grade this
                          manually after submission.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700
                       disabled:bg-blue-400 text-white text-sm font-medium
                       rounded-lg transition-colors"
          >
            {saving ? "Saving exam..." : "Save exam"}
          </button>
        </form>
      </div>
    </div>
  );
}