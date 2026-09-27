"use client";

import { useAuth } from "@/lib/hooks/useAuth";

export default function ProfilePage() {
  const { appUser } = useAuth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Your account details</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-lg">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Full name</p>
            <p className="text-sm font-medium text-gray-900">{appUser?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Email</p>
            <p className="text-sm font-medium text-gray-900">{appUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Role</p>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {appUser?.role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}