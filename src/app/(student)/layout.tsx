"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import StudentSidebar from "@/components/student/StudentSidebar";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !appUser) {
      router.push("/login");
    }
  }, [appUser, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!appUser) return null;

  const isLearnPage = pathname.includes("/learn");

  return (
    <div className="min-h-screen flex bg-gray-50">
      <StudentSidebar />
      {/* Main content — uses CSS variable for margin */}
      <main
        className={`flex-1 transition-all duration-300 ${
          isLearnPage ? "p-4" : "p-8"
        }`}
        style={{ marginLeft: "260px" }}
        id="main-content"
      >
        {children}
      </main>
    </div>
  );
}