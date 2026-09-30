"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";

const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/admin",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "announcements",
    label: "Announcements",
    href: "/admin/announcements",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    id: "courses",
    label: "Courses",
    href: "/admin/courses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: "students",
    label: "Students",
    href: "/admin/students",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "enrollments",
    label: "Enrollments",
    href: "/admin/enrollments",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },

  {
    id: "credentialing",
    label: "Credentialing",
    href: "/admin/credentialing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  
];

export default function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, appUser } = useAuth();
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = collapsedState && !mobileOpen;
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("#admin-profile-area")) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const filteredNav = navItems.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col z-50 md:z-40",
        "bg-white border-r border-gray-100",
        "transition-all duration-300 ease-in-out",
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-5 mb-2">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2.5">
            <BlueprintIcon />
            <div>
              <span className="text-base font-bold text-gray-900 whitespace-nowrap">
                Blueprint
              </span>
              <span className="block text-[10px] text-gray-400 -mt-0.5">
                Admin Portal
              </span>
            </div>
          </Link>
        )}

        {collapsed && (
          <Link href="/admin" className="mx-auto">
            <BlueprintIcon />
          </Link>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg
                       text-gray-400 hover:text-gray-700 hover:bg-gray-100
                       transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <button
          onClick={onMobileClose}
          aria-label="Close menu"
          className="md:hidden w-11 h-11 -mr-2 flex items-center justify-center
                     rounded-lg text-gray-500 hover:text-gray-900
                     hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-6 w-6 h-6 bg-white border
                       border-gray-200 rounded-full flex items-center justify-center
                       text-gray-400 hover:text-gray-700 shadow-sm transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      {!collapsed && (
        <div className="px-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50
                          border border-gray-200 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="text-gray-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-sm text-gray-700
                         placeholder:text-gray-400 focus:outline-none w-full"
            />
          </div>
        </div>
      )}

      {/* ── Nav items ──────────────────────────────────────── */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? item.label : undefined}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm",
                "transition-all duration-150 group relative",
                collapsed ? "justify-center" : "",
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2
                                 w-1 h-5 bg-blue-600 rounded-r-full" />
              )}

              <span className={cn(
                "flex-shrink-0 transition-colors",
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 group-hover:text-gray-700"
              )}>
                {item.icon}
              </span>

              {!collapsed && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}

              {collapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900
                                text-white text-xs rounded-lg whitespace-nowrap
                                opacity-0 group-hover:opacity-100 pointer-events-none
                                transition-opacity duration-150 z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Separator ──────────────────────────────────────── */}
      <div className="mx-3 my-3 h-px bg-gray-100" />

      {/* ── Profile area ───────────────────────────────────── */}
      <div className="px-3 pb-4 relative" id="admin-profile-area">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl",
            "hover:bg-gray-50 transition-colors",
            collapsed ? "justify-center" : "",
            profileOpen ? "bg-gray-50" : ""
          )}
        >
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br
                            from-blue-500 to-violet-600 flex items-center
                            justify-center">
              <span className="text-white text-xs font-semibold">
                {appUser?.name?.charAt(0).toUpperCase() ?? "A"}
              </span>
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5
                             bg-emerald-400 rounded-full border-2 border-white" />
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {appUser?.name}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {appUser?.email}
                </p>
              </div>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className={cn(
                  "text-gray-400 transition-transform duration-200 flex-shrink-0",
                  profileOpen ? "rotate-180" : ""
                )}
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </>
          )}
        </button>

        {/* Dropdown */}
        {profileOpen && (
          <div className={cn(
            "absolute bottom-full mb-2 bg-white border border-gray-100",
            "rounded-2xl shadow-xl shadow-black/10 py-2 z-50",
            collapsed ? "left-full ml-2 w-48" : "left-3 right-3"
          )}>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                {appUser?.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {appUser?.email}
              </p>
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5
                               bg-blue-50 text-blue-700 text-xs rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Administrator
              </span>
            </div>

            <div className="py-1">
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-3 md:py-2.5 text-sm
                           text-gray-600 hover:bg-gray-50 hover:text-gray-900
                           transition-colors"
                onClick={() => setProfileOpen(false)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Dashboard
              </Link>
            </div>

            <div className="border-t border-gray-100 pt-1 mt-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 md:py-2.5 text-sm
                           text-red-500 hover:bg-red-50 transition-colors w-full"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function BlueprintIcon() {
  return (
    <Image
      src="/logo.png"
      alt="Blueprint"
      width={32}
      height={32}
      className="w-8 h-8 object-contain flex-shrink-0"
    />
  );
}
