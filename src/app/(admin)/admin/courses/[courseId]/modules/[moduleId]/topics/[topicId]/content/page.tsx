"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { Topic, Module, Course, Material } from "@/types";
import Link from "next/link";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  ChevronRight,
  Save,
  Plus,
  Trash2,
  Video,
  FileText,
  Check
} from "lucide-react";
import { TOPIC_COLORS } from "@/types";
import { ClipboardList } from "lucide-react";


export default function TopicContentPage() {
  const { courseId, moduleId, topicId } = useParams() as {
    courseId: string;
    moduleId: string;
    topicId: string;
  };

  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Lesson content
  const [lessonContent, setLessonContent] = useState("");
  const [savingContent, setSavingContent] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);

  // Material form
  const [matTitle, setMatTitle] = useState("");
  const [matType, setMatType] = useState<"video" | "pdf">("video");
  const [matVideoUrl, setMatVideoUrl] = useState("");
  const [matFile, setMatFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [addingMat, setAddingMat] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);
  const [matError, setMatError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const basePath = `courses/${courseId}/modules/${moduleId}/topics/${topicId}`;

  async function fetchData() {
    const [courseSnap, moduleSnap, topicSnap, materialsSnap] =
      await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDoc(doc(db, "courses", courseId, "modules", moduleId)),
        getDoc(doc(db, "courses", courseId, "modules", moduleId, "topics", topicId)),
        getDocs(
          query(
            collection(db, basePath, "materials"),
            orderBy("order", "asc")
          )
        ),
      ]);

    if (courseSnap.exists())
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
    if (moduleSnap.exists())
      setModule({ id: moduleSnap.id, ...moduleSnap.data() } as Module);
    if (topicSnap.exists()) {
      const t = { id: topicSnap.id, ...topicSnap.data() } as Topic;
      setTopic(t);
      setLessonContent(t.lessonContent ?? "");
    }
    setMaterials(
      materialsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Material))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [courseId, moduleId, topicId]);

  async function handleSaveContent() {
    setSavingContent(true);
    try {
      await updateDoc(
        doc(db, "courses", courseId, "modules", moduleId, "topics", topicId),
        { lessonContent }
      );
      setContentSaved(true);
      setTimeout(() => setContentSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingContent(false);
    }
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    setMatError("");
    if (!matTitle.trim()) { setMatError("Title is required."); return; }
    if (matType === "video" && !matVideoUrl.trim()) {
      setMatError("Video URL is required."); return;
    }
    if (matType === "pdf" && !matFile) {
      setMatError("PDF file is required."); return;
    }

    setAddingMat(true);
    try {
      let fileUrl = "";
      if (matType === "pdf" && matFile) {
        setUploading(true);
        const storageRef = ref(
          storage,
          `materials/${courseId}/${Date.now()}_${matFile.name}`
        );
        const task = uploadBytesResumable(storageRef, matFile);
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (s) =>
              setUploadProgress(
                Math.round((s.bytesTransferred / s.totalBytes) * 100)
              ),
            reject,
            async () => {
              fileUrl = await getDownloadURL(task.snapshot.ref);
              resolve();
            }
          );
        });
        setUploading(false);
      }

      await addDoc(collection(db, basePath, "materials"), {
        title: matTitle,
        type: matType,
        order: materials.length,
        videoUrl: matType === "video" ? matVideoUrl : "",
        fileUrl: matType === "pdf" ? fileUrl : "",
        createdAt: serverTimestamp(),
      });

      setMatTitle("");
      setMatVideoUrl("");
      setMatFile(null);
      setUploadProgress(0);
      setShowMatForm(false);
      if (fileRef.current) fileRef.current.value = "";
      fetchData();
    } catch (err) {
      console.error(err);
      setMatError("Failed to add material.");
    } finally {
      setAddingMat(false);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    await deleteDoc(doc(db, basePath, "materials", materialId));
    fetchData();
  }

  const color = TOPIC_COLORS.find((c) => c.id === topic?.colorId) ?? TOPIC_COLORS[0];

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
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2 flex-wrap">
        <Link href="/admin/courses" className="hover:text-gray-600">Courses</Link>
        <ChevronRight size={13} />
        <Link href={`/admin/courses/${courseId}/modules`} className="hover:text-gray-600">
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
        <span className="text-gray-600">{topic?.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        {topic?.imageUrl ? (
          <img
            src={topic.imageUrl}
            alt={topic.title}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex-shrink-0"
            style={{ backgroundColor: color.hex }}
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {topic?.title}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Topic content — lesson + materials
          </p>
        </div>
      </div>

      {/* Lesson content editor */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Lesson content
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Rich text lesson shown to students at the top of this topic
            </p>
          </div>
          <button
            onClick={handleSaveContent}
            disabled={savingContent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600
                       hover:bg-blue-700 disabled:bg-blue-400 text-white
                       text-sm font-medium rounded-xl transition-colors"
          >
            {contentSaved ? (
              <><Check size={14} /> Saved</>
            ) : (
              <><Save size={14} /> {savingContent ? "Saving..." : "Save content"}</>
            )}
          </button>

          <Link
            href={`/admin/courses/${courseId}/modules/${moduleId}/topics/${topicId}/quizzes`}
            className="flex items-center gap-2 px-4 py-2 border border-purple-200
                      bg-purple-50 text-purple-700 text-sm font-medium rounded-xl
                      hover:bg-purple-100 transition-colors"
          >
            <ClipboardList size={14} />
            Manage quizzes
</Link>
        </div>

        <RichTextEditor
          value={lessonContent}
          onChange={setLessonContent}
          placeholder="Write the lesson content for this topic..."
          minHeight="250px"
        />
      </div>

      {/* Materials */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4
                        border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Materials
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Videos and PDFs for this topic
            </p>
          </div>
          <button
            onClick={() => setShowMatForm(!showMatForm)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs
                       font-medium border border-blue-200 bg-blue-50 text-blue-700
                       hover:bg-blue-100 transition-colors"
          >
            <Plus size={13} />
            Add material
          </button>
        </div>

        {/* Material form */}
        {showMatForm && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            {matError && (
              <div className="mb-3 p-2.5 bg-red-50 rounded-lg text-xs text-red-600">
                {matError}
              </div>
            )}
            <form onSubmit={handleAddMaterial} className="space-y-3">
              <input
                type="text"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                placeholder="Material title"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                {(["video", "pdf"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMatType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium
                               transition-colors ${
                                 matType === t
                                   ? "bg-blue-600 text-white"
                                   : "bg-white border border-gray-200 text-gray-600"
                               }`}
                  >
                    {t === "video" ? (
                      <span className="flex items-center gap-1">
                        <Video size={12} /> Video
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <FileText size={12} /> PDF
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {matType === "video" && (
                <input
                  type="url"
                  value={matVideoUrl}
                  onChange={(e) => setMatVideoUrl(e.target.value)}
                  placeholder="https://vimeo.com/..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                />
              )}

              {matType === "pdf" && (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setMatFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5
                               file:px-3 file:rounded-lg file:border-0 file:text-xs
                               file:font-medium file:bg-blue-50 file:text-blue-700"
                  />
                  {uploading && (
                    <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addingMat || uploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700
                             disabled:bg-blue-400 text-white text-xs font-medium
                             rounded-xl transition-colors"
                >
                  {addingMat ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMatForm(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600
                             text-xs font-medium rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Materials list */}
        {materials.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No materials yet. Add videos or PDFs above.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {materials.map((mat, index) => (
              <div
                key={mat.id}
                className="flex items-center gap-3 px-6 py-3
                           hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-gray-300 w-4">{index + 1}</span>
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded
                             text-xs font-medium ${
                               mat.type === "video"
                                 ? "bg-blue-50 text-blue-700"
                                 : "bg-orange-50 text-orange-700"
                             }`}
                >
                  {mat.type === "video" ? (
                    <Video size={10} />
                  ) : (
                    <FileText size={10} />
                  )}
                  {mat.type.toUpperCase()}
                </span>
                <span className="flex-1 text-sm text-gray-900">{mat.title}</span>
                <button
                  onClick={() => handleDeleteMaterial(mat.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                             text-xs font-medium border border-red-200 bg-red-50
                             text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={11} />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}