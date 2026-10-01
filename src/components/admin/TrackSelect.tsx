"use client";

import { TRACKS, TrackId } from "@/types";

// undefined = not chosen yet, null = "No track (legacy)".
export type TrackChoice = TrackId | null | undefined;

export default function TrackSelect({
  value,
  onChange,
  lockedTrack,
}: {
  value: TrackChoice;
  onChange: (v: TrackId | null) => void;
  // Track admins can only use their own track.
  lockedTrack?: TrackId | null;
}) {
  if (lockedTrack) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Track
        </label>
        <p className="text-sm text-gray-900">
          {TRACKS.find((t) => t.id === lockedTrack)?.name ?? lockedTrack}
        </p>
      </div>
    );
  }

  const options: { id: TrackId | null; label: string }[] = [
    ...TRACKS.map((t) => ({ id: t.id as TrackId | null, label: t.name })),
    { id: null, label: "No track (legacy)" },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Which track does this course belong to?{" "}
        <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <button
            key={o.id ?? "none"}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border
                        transition-colors ${
                          value === o.id
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">
        NCLEX and IELTS courses use the modules and topics structure. &quot;No
        track&quot; uses the old flat materials layout.
      </p>
    </div>
  );
}
