"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !appUser) router.push("/login");
    if (!loading && appUser && appUser.role !== "admin") router.push("/dashboard");
  }, [appUser, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-sm text-white/40">Loading...</div>
      </div>
    );
  }

  if (!appUser || appUser.role !== "admin") return null;

  return (
    <div className="min-h-screen flex bg-gray-50"> 
      <AdminSidebar />
      <main
        className="flex-1 p-8 transition-all duration-300"
        style={{ marginLeft: "260px" }}
      >
        {children}
      </main>
    </div>
  );
}