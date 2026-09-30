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
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Module, Course } from "@/types";
import Link from "next/link";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  BookOpen,
  GripVertical,
  X,
  Check,
} from "lucide-react";

export default function ModulesPage() {
  const { courseId } = useParams() as { courseId: string };
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  // New module form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formOverview, setFormOverview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchData() {
    const [courseSnap, modulesSnap] = await Promise.all([
      getDoc(doc(db, "courses", courseId)),
      getDocs(
        query(
          collection(db, "courses", courseId, "modules"),
          orderBy("order", "asc")
        )
      ),
    ]);

    if (courseSnap.exists()) {
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
    }
    setModules(
      modulesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Module))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [courseId]);

  function openNew() {
    setEditingId(null);
    setFormTitle("");
    setFormOverview("");
    setShowForm(true);
    setError("");
  }

  function openEdit(module: Module) {
    setEditingId(module.id);
    setFormTitle(module.title);
    setFormOverview(module.overview ?? "");
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      setError("Module title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateDoc(doc(db, "courses", courseId, "modules", editingId), {
          title: formTitle,
          overview: formOverview,
        });
      } else {
        await addDoc(collection(db, "courses", courseId, "modules"), {
          title: formTitle,
          overview: formOverview,
          order: modules.length,
          createdAt: serverTimestamp(),
        });
      }
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (err) {
      setError("Failed to save module.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(moduleId: string) {
    if (!confirm("Delete this module and all its topics?")) return;
    await deleteDoc(doc(db, "courses", courseId, "modules", moduleId));
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
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
        <Link href="/admin/courses" className="hover:text-gray-600">
          Courses
        </Link>
        <ChevronRight size={14} />
        <Link
          href={`/admin/courses/${courseId}`}
          className="hover:text-gray-600"
        >
          {course?.title}
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-600">Modules</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Modules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Organize course content into modules
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium
                     rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add module
        </button>
      </div>

      {/* Module form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {editingId ? "Edit module" : "New module"}
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

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Module title
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Module 1: Fundamentals of Care"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overview
              </label>
              <p className="text-xs text-gray-400 mb-2">
                This appears on the module Overview tab for students
              </p>
              <RichTextEditor
                value={formOverview}
                onChange={setFormOverview}
                placeholder="Describe what students will learn in this module..."
                minHeight="150px"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                           hover:bg-blue-700 disabled:bg-blue-400 text-white
                           text-sm font-medium rounded-xl transition-colors"
              >
                <Check size={15} />
                {saving ? "Saving..." : "Save module"}
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

      {/* Modules list */}
      {modules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">No modules yet.</p>
          <button
            onClick={openNew}
            className="text-sm text-blue-600 hover:underline"
          >
            Create your first module →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module, index) => (
            <div
              key={module.id}
              className="bg-white rounded-2xl border border-gray-100 p-5
                         hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical size={16} className="text-gray-300" />
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center
                                  justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {module.title}
                    </p>
                    {module.overview && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1"
                        dangerouslySetInnerHTML={{
                          __html: module.overview.replace(/<[^>]*>/g, " ").slice(0, 80) + "...",
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/courses/${courseId}/modules/${module.id}/topics`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium border border-purple-200
                               bg-purple-50 text-purple-700 hover:bg-purple-100
                               transition-colors"
                  >
                    <BookOpen size={13} />
                    Topics
                  </Link>
                  <button
                    onClick={() => openEdit(module)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-xs font-medium border border-blue-200
                               bg-blue-50 text-blue-700 hover:bg-blue-100
                               transition-colors"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(module.id)}
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
          ))}
        </div>
      )}
    </div>
  );
}