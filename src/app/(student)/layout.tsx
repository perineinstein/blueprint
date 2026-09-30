"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import StudentSidebar from "@/components/student/StudentSidebar";
import { Menu } from "lucide-react";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !appUser) {
      router.push("/login");
    }
  }, [appUser, loading, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 px-4 flex items-center gap-3 bg-white border-b border-gray-100"
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Menu size={22} />
        </button>
        <span className="text-sm font-semibold text-gray-900">Blueprint</span>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <StudentSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main
        className={`flex-1 min-w-0 md:min-w-[auto] md:ml-[260px] transition-all duration-300 ${
          isLearnPage ? "p-4 pt-[72px] md:pt-4" : "p-4 pt-[72px] md:p-8"
        }`}
        id="main-content"
      >
        {children}
      </main>
    </div>
  );
}