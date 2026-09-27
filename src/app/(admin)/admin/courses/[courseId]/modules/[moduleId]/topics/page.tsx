"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { Module, Course, Topic, TOPIC_COLORS, TopicColorId } from "@/types";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  Upload,
  X,
  Check,
  Image as ImageIcon,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function TopicsPage() {
  const { courseId, moduleId } = useParams() as {
    courseId: string;
    moduleId: string;
  };

  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formColorId, setFormColorId] = useState<TopicColorId>("blue");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [existingImageUrl, setExistingImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchData() {
    const [courseSnap, moduleSnap, topicsSnap] = await Promise.all([
      getDoc(doc(db, "courses", courseId)),
      getDoc(doc(db, "courses", courseId, "modules", moduleId)),
      getDocs(
        query(
          collection(db, "courses", courseId, "modules", moduleId, "topics"),
          orderBy("order", "asc")
        )
      ),
    ]);

    if (courseSnap.exists()) {
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
    }
    if (moduleSnap.exists()) {
      setModule({ id: moduleSnap.id, ...moduleSnap.data() } as Module);
    }
    setTopics(
      topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [courseId, moduleId]);

  function openNew() {
    setEditingId(null);
    setFormTitle("");
    setFormColorId("blue");
    setImageFile(null);
    setImagePreview("");
    setExistingImageUrl("");
    setShowForm(true);
    setError("");
  }

  function openEdit(topic: Topic) {
    setEditingId(topic.id);
    setFormTitle(topic.title);
    setFormColorId(topic.colorId ?? "blue");
    setImageFile(null);
    setImagePreview("");
    setExistingImageUrl(topic.imageUrl ?? "");
    setShowForm(true);
    setError("");
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      setError("Topic title is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let imageUrl = existingImageUrl;

      // Upload new image if selected
      if (imageFile) {
        setUploadingImage(true);
        const storageRef = ref(
          storage,
          `topic-images/${courseId}/${moduleId}/${Date.now()}_${imageFile.name}`
        );
        const uploadTask = uploadBytesResumable(storageRef, imageFile);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            null,
            reject,
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
        setUploadingImage(false);
      }

      const topicData = {
        title: formTitle,
        colorId: formColorId,
        imageUrl,
        lessonContent: "",
        order: editingId
          ? topics.find((t) => t.id === editingId)?.order ?? 0
          : topics.length,
      };

      if (editingId) {
        await updateDoc(
          doc(
            db,
            "courses",
            courseId,
            "modules",
            moduleId,
            "topics",
            editingId
          ),
          topicData
        );
      } else {
        await addDoc(
          collection(db, "courses", courseId, "modules", moduleId, "topics"),
          {
            ...topicData,
            createdAt: serverTimestamp(),
          }
        );
      }

      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Failed to save topic.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(topicId: string) {
    if (!confirm("Delete this topic and all its content?")) return;
    await deleteDoc(
      doc(db, "courses", courseId, "modules", moduleId, "topics", topicId)
    );
    fetchData();
  }

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
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2 flex-wrap">
        <Link href="/admin/courses" className="hover:text-gray-600">Courses</Link>
        <ChevronRight size={14} />
        <Link href={`/admin/courses/${courseId}`} className="hover:text-gray-600">
          {course?.title}
        </Link>
        <ChevronRight size={14} />
        <Link
          href={`/admin/courses/${courseId}/modules`}
          className="hover:text-gray-600"
        >
          Modules
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-600">{module?.title}</span>
        <ChevronRight size={14} />
        <span className="text-gray-600">Topics</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Topics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {module?.title} — manage learning topics
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium
                     rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add topic
        </button>
      </div>

      {/* Topic form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {editingId ? "Edit topic" : "New topic"}
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
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic title
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Cardiovascular System"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic color
              </label>
              <div className="flex gap-2 flex-wrap">
                {TOPIC_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setFormColorId(color.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
                      "font-medium border transition-all",
                      formColorId === color.id
                        ? "border-gray-900 shadow-sm scale-105"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.label}
                    {formColorId === color.id && (
                      <Check size={11} className="text-gray-700" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic image / icon
              </label>
              <p className="text-xs text-gray-400 mb-2">
                This image appears as the topic's visual icon in the student portal
              </p>

              {imagePreview || existingImageUrl ? (
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={imagePreview || existingImageUrl}
                      alt="Topic image"
                      className="w-20 h-20 object-cover rounded-xl border
                                 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview("");
                        setExistingImageUrl("");
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500
                                 text-white rounded-full flex items-center
                                 justify-center"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border
                               border-dashed border-gray-300 rounded-xl text-xs
                               text-gray-500 hover:border-gray-400 transition-colors"
                  >
                    <Upload size={13} />
                    Replace image
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 border-2
                             border-dashed border-gray-200 rounded-xl text-sm
                             text-gray-400 hover:border-gray-300 hover:bg-gray-50
                             transition-colors w-full justify-center"
                >
                  <ImageIcon size={16} />
                  Click to upload topic image
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {uploadingImage && (
                <p className="text-xs text-blue-500 mt-1">
                  Uploading image...
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || uploadingImage}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                           hover:bg-blue-700 disabled:bg-blue-400 text-white
                           text-sm font-medium rounded-xl transition-colors"
              >
                <Check size={15} />
                {saving ? "Saving..." : "Save topic"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-gray-200 text-gray-600
                           text-sm font-medium rounded-xl hover:bg-gray-50
                           transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topics list */}
      {topics.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">No topics yet.</p>
          <button
            onClick={openNew}
            className="text-sm text-blue-600 hover:underline"
          >
            Add your first topic →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, index) => {
            const color = TOPIC_COLORS.find((c) => c.id === topic.colorId)
              ?? TOPIC_COLORS[0];

            return (
              <div
                key={topic.id}
                className="bg-white rounded-2xl border border-gray-100 p-4
                           hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Topic image or color block */}
                    {topic.imageUrl ? (
                      <img
                        src={topic.imageUrl}
                        alt={topic.title}
                        className="w-12 h-12 object-cover rounded-xl flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center
                                   justify-center flex-shrink-0 text-white
                                   font-bold text-sm"
                        style={{ backgroundColor: color.hex }}
                      >
                        {index + 1}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <p className="text-sm font-semibold text-gray-900">
                          {topic.title}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Topic {index + 1} · {color.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/courses/${courseId}/modules/${moduleId}/topics/${topic.id}/content`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 text-xs font-medium border border-purple-200
                                 bg-purple-50 text-purple-700 hover:bg-purple-100
                                 transition-colors"
                    >
                      <ClipboardList size={13} />
                      Content
                    </Link>
                    <button
                      onClick={() => openEdit(topic)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 text-xs font-medium border border-blue-200
                                 bg-blue-50 text-blue-700 hover:bg-blue-100
                                 transition-colors"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(topic.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 text-xs font-medium border border-red-200
                                 bg-red-50 text-red-600 hover:bg-red-100
                                 transition-colors"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}