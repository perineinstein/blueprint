"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { CredentialingResource } from "@/types";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  Plus,
  Trash2,
  FileText,
  Link as LinkIcon,
  Upload,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function CredentialingResourcesPage() {
  const [resources, setResources] = useState<CredentialingResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"pdf" | "note" | "link">("pdf");
  const [linkUrl, setLinkUrl] = useState("");
  const [content, setContent] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchResources() {
    const snap = await getDocs(
      query(
        collection(db, "credentialingResources"),
        orderBy("order", "asc")
      )
    );
    setResources(
      snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CredentialingResource)
      )
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchResources();
  }, []);

  function resetForm() {
    setTitle("");
    setType("pdf");
    setLinkUrl("");
    setContent("");
    setPdfFile(null);
    setUploadProgress(0);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) { setError("Title is required."); return; }
    if (type === "link" && !linkUrl.trim()) {
      setError("Link URL is required."); return;
    }
    if (type === "pdf" && !pdfFile) {
      setError("PDF file is required."); return;
    }

    setSaving(true);
    try {
      let fileUrl = "";
      if (type === "pdf" && pdfFile) {
        setUploading(true);
        const storageRef = ref(
          storage,
          `credentialing-resources/${Date.now()}_${pdfFile.name}`
        );
        const task = uploadBytesResumable(storageRef, pdfFile);
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

      await addDoc(collection(db, "credentialingResources"), {
        title,
        type,
        fileUrl: type === "pdf" ? fileUrl : "",
        linkUrl: type === "link" ? linkUrl : "",
        content: type === "note" ? content : "",
        order: resources.length,
        createdAt: serverTimestamp(),
      });

      setSuccess("Cookie added successfully.");
      setShowForm(false);
      resetForm();
      fetchResources();
    } catch (err) {
      console.error(err);
      setError("Failed to save cookie.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(resourceId: string) {
    if (!confirm("Delete this cookie?")) return;
    await deleteDoc(doc(db, "credentialingResources", resourceId));
    fetchResources();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link
            href="/admin/credentialing"
            className="hover:text-gray-600 flex items-center gap-1"
          >
            <ShieldCheck size={13} />
            Credentialing
          </Link>
          <span>/</span>
          <span className="text-gray-600">Cookies</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Cookies
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Documents, links, and notes for enrolled students
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600
                       hover:bg-blue-700 text-white text-sm font-medium
                       rounded-xl transition-colors"
          >
            <Plus size={16} />
            Add cookie
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 rounded-xl text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              New cookie
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

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl
                           text-sm text-gray-900 bg-white focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. NCLEX Application Checklist"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <div className="flex gap-3">
                {(
                  [
                    { id: "pdf", label: "PDF" },
                    { id: "note", label: "Note" },
                    { id: "link", label: "Link" },
                  ] as { id: "pdf" | "note" | "link"; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium
                               border transition-colors ${
                                 type === t.id
                                   ? "border-blue-500 bg-blue-50 text-blue-700"
                                   : "border-gray-200 text-gray-600 hover:bg-gray-50"
                               }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {type === "pdf" && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2
                             file:px-4 file:rounded-xl file:border-0 file:text-sm
                             file:font-medium file:bg-blue-50 file:text-blue-700
                             hover:file:bg-blue-100"
                />
                {uploading && (
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {type === "link" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl
                             text-sm text-gray-900 bg-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            )}

            {type === "note" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write the note content..."
                  minHeight="150px"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                           hover:bg-blue-700 disabled:bg-blue-400 text-white
                           text-sm font-medium rounded-xl transition-colors"
              >
                <Check size={15} />
                {saving ? "Saving..." : "Save cookie"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-gray-200 text-gray-600
                           text-sm font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resources list */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : resources.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12
                        text-center">
          <FileText size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No cookies yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {resources.map((resource, index) => (
              <div
                key={resource.id}
                className="flex items-center gap-4 px-4 md:px-6 py-4
                           hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-gray-300 w-5">{index + 1}</span>
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center
                                justify-center flex-shrink-0">
                  {resource.type === "pdf" ? (
                    <FileText size={15} className="text-blue-600" />
                  ) : resource.type === "link" ? (
                    <LinkIcon size={15} className="text-blue-600" />
                  ) : (
                    <FileText size={15} className="text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {resource.title}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">
                    {resource.type}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(resource.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             text-xs font-medium border border-red-200 bg-red-50
                             text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}