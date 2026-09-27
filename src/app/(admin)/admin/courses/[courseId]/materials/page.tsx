"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { Material, Course, Section } from "@/types";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface SectionWithMaterials extends Section {
  materials: Material[];
}

export default function MaterialsPage() {
  const { courseId } = useParams() as { courseId: string };

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<SectionWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // New section form
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  // Add material form
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"video" | "pdf" | "note">("video");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchData() {
    const [courseSnap, sectionsSnap] = await Promise.all([
      getDoc(doc(db, "courses", courseId)),
      getDocs(
        query(
          collection(db, "courses", courseId, "sections"),
          orderBy("order", "asc")
        )
      ),
    ]);

    if (courseSnap.exists()) {
      setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
    }

    const sectionsWithMaterials = await Promise.all(
      sectionsSnap.docs.map(async (sDoc) => {
        const section = { id: sDoc.id, ...sDoc.data() } as Section;
        const materialsSnap = await getDocs(
          query(
            collection(
              db,
              "courses",
              courseId,
              "sections",
              sDoc.id,
              "materials"
            ),
            orderBy("order", "asc")
          )
        );
        const materials = materialsSnap.docs.map(
          (m) => ({ id: m.id, ...m.data() } as Material)
        );
        return { ...section, materials } as SectionWithMaterials;
      })
    );

    setSections(sectionsWithMaterials);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [courseId]);

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    setAddingSection(true);
    try {
      await addDoc(collection(db, "courses", courseId, "sections"), {
        title: newSectionTitle,
        order: sections.length,
        createdAt: serverTimestamp(),
      });
      setNewSectionTitle("");
      fetchData();
    } finally {
      setAddingSection(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    await deleteDoc(doc(db, "courses", courseId, "sections", sectionId));
    fetchData();
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSectionId) return;
    setError("");

    if (!title.trim()) { setError("Please enter a title."); return; }
    if (type === "video" && !videoUrl.trim()) {
      setError("Please enter a Vimeo URL."); return;
    }
    if (type === "pdf" && !pdfFile) {
      setError("Please select a PDF file."); return;
    }

    setSaving(true);
    try {
      let fileUrl = "";
      if (type === "pdf" && pdfFile) {
        setUploading(true);
        const storageRef = ref(
          storage,
          `materials/${courseId}/${Date.now()}_${pdfFile.name}`
        );
        const uploadTask = uploadBytesResumable(storageRef, pdfFile);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              setUploadProgress(
                Math.round(
                  (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                )
              );
            },
            reject,
            async () => {
              fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
        setUploading(false);
      }

      // Get current material count for ordering
      const section = sections.find((s) => s.id === activeSectionId);
      const order = section?.materials.length ?? 0;

      await addDoc(
        collection(
          db,
          "courses",
          courseId,
          "sections",
          activeSectionId,
          "materials"
        ),
        {
          title,
          type,
          order,
          videoUrl: type === "video" ? videoUrl : "",
          fileUrl: type === "pdf" ? fileUrl : "",
          description: "",
          createdAt: serverTimestamp(),
        }
      );

      setTitle("");
      setVideoUrl("");
      setPdfFile(null);
      setUploadProgress(0);
      setActiveSectionId(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Failed to add material.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMaterial(sectionId: string, materialId: string) {
    await deleteDoc(
      doc(db, "courses", courseId, "sections", sectionId, "materials", materialId)
    );
    fetchData();
  }

  function toggleSection(sectionId: string) {
    setCollapsed((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
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
          <Link
            href={`/admin/courses/${courseId}`}
            className="hover:text-gray-600"
          >
            {course?.title}
          </Link>
          <span>/</span>
          <span className="text-gray-600">Materials</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Materials</h1>
        <p className="text-sm text-gray-500 mt-1">
          Organize course content into sections
        </p>
      </div>

      {/* Add section form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Add new section
        </h2>
        <form onSubmit={handleAddSection} className="flex gap-3">
          <input
            type="text"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="e.g. Week 1: Introduction, Assignment 1, Tests"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl
                       text-sm text-gray-900 bg-white focus:outline-none
                       focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={addingSection || !newSectionTitle.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white text-sm font-medium rounded-xl transition-colors"
          >
            {addingSection ? "Adding..." : "Add section"}
          </button>
        </form>
      </div>

      {/* Sections list */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">
            No sections yet. Add your first section above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-4
                              border-b border-gray-100">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <span
                    className={cn(
                      "text-gray-400 transition-transform duration-200 text-xs",
                      collapsed[section.id] ? "-rotate-90" : ""
                    )}
                  >
                    ▼
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {section.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({section.materials.length} item
                    {section.materials.length !== 1 ? "s" : ""})
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setActiveSectionId(
                        activeSectionId === section.id ? null : section.id
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border
                               border-blue-200 bg-blue-50 text-blue-700
                               hover:bg-blue-100 transition-colors"
                  >
                    + Add material
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border
                               border-red-200 bg-red-50 text-red-600
                               hover:bg-red-100 transition-colors"
                  >
                    Delete section
                  </button>
                </div>
              </div>

              {/* Add material form for this section */}
              {activeSectionId === section.id && (
                <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
                  {error && (
                    <div className="mb-3 p-2.5 bg-red-50 border border-red-100
                                   rounded-lg text-xs text-red-600">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleAddMaterial} className="space-y-3">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl
                                 text-sm text-gray-900 bg-white focus:outline-none
                                 focus:ring-2 focus:ring-blue-500"
                      placeholder="Material title"
                    />

                    <div className="flex gap-2">
                      {(["video", "pdf", "note"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium
                                     transition-colors ${
                                       type === t
                                         ? "bg-blue-600 text-white"
                                         : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                     }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>

                    {type === "video" && (
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl
                                   text-sm text-gray-900 bg-white focus:outline-none
                                   focus:ring-2 focus:ring-blue-500"
                        placeholder="https://vimeo.com/123456789"
                      />
                    )}

                    {type === "pdf" && (
                      <div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf"
                          onChange={(e) =>
                            setPdfFile(e.target.files?.[0] ?? null)
                          }
                          className="w-full text-sm text-gray-600
                                     file:mr-3 file:py-1.5 file:px-3
                                     file:rounded-lg file:border-0 file:text-xs
                                     file:font-medium file:bg-blue-50 file:text-blue-700
                                     hover:file:bg-blue-100"
                        />
                        {uploading && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div
                                className="bg-blue-600 h-1 rounded-full transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving || uploading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700
                                   disabled:bg-blue-400 text-white text-xs
                                   font-medium rounded-xl transition-colors"
                      >
                        {saving ? "Adding..." : "Add material"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSectionId(null)}
                        className="px-4 py-2 bg-white border border-gray-200
                                   text-gray-600 text-xs font-medium rounded-xl
                                   hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Materials list */}
              {!collapsed[section.id] && (
                <div>
                  {section.materials.length === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-gray-400">
                      No materials in this section yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {section.materials.map((material, index) => (
                        <div
                          key={material.id}
                          className="flex items-center gap-3 px-5 py-3
                                     hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-xs text-gray-300 w-5 text-center">
                            {index + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              material.type === "video"
                                ? "bg-blue-50 text-blue-700"
                                : material.type === "pdf"
                                ? "bg-orange-50 text-orange-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {material.type.toUpperCase()}
                          </span>
                          <span className="flex-1 text-sm text-gray-900">
                            {material.title}
                          </span>
                          <button
                            onClick={() =>
                              handleDeleteMaterial(section.id, material.id)
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-medium
                                       border border-red-200 bg-red-50 text-red-600
                                       hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}