import Link from "next/link";
import { TRACKS } from "@/types";
import { BookOpen, ArrowRight } from "lucide-react";

const TRACK_VISUALS = {
  nclex: {
    gradient: "from-blue-600 to-blue-800",
    lightBg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "🏥",
    description: "National Council Licensure Examination",
    detail: "Comprehensive NCLEX preparation covering all tested areas including fundamentals, pharmacology, and clinical judgment.",
  },
  ielts: {
    gradient: "from-emerald-600 to-emerald-800",
    lightBg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "📝",
    description: "International English Language Testing System",
    detail: "Complete IELTS preparation for all four components: Listening, Reading, Writing, and Speaking.",
  },
};

export default function TracksPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Learning Tracks
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose your examination track to get started
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {TRACKS.map((track) => {
          const visual = TRACK_VISUALS[track.id];
          return (
            <Link
              key={track.id}
              href={`/tracks/${track.id}`}
              className="group bg-white rounded-2xl border border-gray-100
                         hover:border-gray-200 hover:shadow-md transition-all
                         overflow-hidden"
            >
              {/* Header gradient */}
              <div
                className={`h-32 bg-gradient-to-br ${visual.gradient}
                            flex items-center justify-center relative`}
              >
                <div className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
                    backgroundSize: "20px 20px",
                  }}
                />
                <BookOpen size={40} className="text-white/80 relative z-10" />
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {track.name}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {visual.description}
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-gray-300 group-hover:text-gray-600
                               group-hover:translate-x-1 transition-all mt-1
                               flex-shrink-0"
                  />
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {visual.detail}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}