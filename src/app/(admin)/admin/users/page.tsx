"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AppUser, isAdminRole, isSuperAdminRole } from "@/types";

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "admin_nclex", label: "NCLEX Admin" },
  { value: "admin_ielts", label: "IELTS Admin" },
  { value: "super_admin", label: "Super Admin" },
] as const;

type Filter = "all" | "admins" | "students";

export default function AdminUsersPage() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isSuper = isSuperAdminRole(appUser?.role);

  // Super admins only.
  useEffect(() => {
    if (!authLoading && appUser && !isSuper) router.push("/admin");
  }, [authLoading, appUser, isSuper, router]);

  useEffect(() => {
    if (!isSuper) return;
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, "users"));
        setUsers(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as AppUser))
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        );
      } catch (err) {
        console.error("Error fetching users:", err);
        setMessage({ type: "error", text: "Failed to load users." });
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [isSuper]);

  async function changeRole(user: AppUser, role: string) {
    setMessage(null);
    setSavingId(user.id);
    try {
      const res = await authenticatedFetch("/api/admin/users/role", {
        method: "POST",
        body: JSON.stringify({ uid: user.id, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update role.");
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: role as AppUser["role"] } : u))
      );
      setMessage({ type: "success", text: `Updated ${user.name || user.email}.` });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update role.",
      });
    } finally {
      setSavingId(null);
    }
  }

  if (!isSuper) return null;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "admins"
        ? isAdminRole(u.role)
        : !isAdminRole(u.role);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign admin roles. NCLEX and IELTS admins only see their own track.
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 max-w-sm px-4 py-2.5 md:py-2 border border-gray-200
                     rounded-lg text-sm text-gray-900 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1">
          {(["all", "admins", "students"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-medium capitalize
                         transition-colors ${
                           filter === f
                             ? "bg-blue-600 text-white"
                             : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                         }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">
          No users found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map((u) => {
              const isSelf = u.id === appUser?.id;
              // Legacy "admin" is shown as Super Admin.
              const currentValue = u.role === "admin" ? "super_admin" : u.role;
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-4 px-4 md:px-6 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {u.name || "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <select
                    value={currentValue}
                    disabled={isSelf || savingId === u.id}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                               text-gray-900 bg-white focus:outline-none
                               focus:ring-2 focus:ring-blue-500
                               disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
