"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Menu } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
        <span className="text-sm font-semibold text-gray-900">Admin Portal</span>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main
        className="flex-1 min-w-0 md:min-w-[auto] md:ml-[260px] p-4 pt-[72px] md:p-8 transition-all duration-300"
      >
        {children}
      </main>
    </div>
  );
}