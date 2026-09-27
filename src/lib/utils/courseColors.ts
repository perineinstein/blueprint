// Curated palette that complements the blue theme
const COURSE_COLORS = [
  {
    bg: "from-blue-400 to-blue-600",
    light: "bg-blue-50",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
    hex: "#3B82F6",
  },
  {
    bg: "from-violet-400 to-violet-600",
    light: "bg-violet-50",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-800",
    hex: "#7C3AED",
  },
  {
    bg: "from-teal-400 to-teal-600",
    light: "bg-teal-50",
    text: "text-teal-700",
    badge: "bg-teal-100 text-teal-800",
    hex: "#0D9488",
  },
  {
    bg: "from-rose-400 to-rose-600",
    light: "bg-rose-50",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-800",
    hex: "#F43F5E",
  },
  {
    bg: "from-amber-400 to-amber-600",
    light: "bg-amber-50",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    hex: "#D97706",
  },
  {
    bg: "from-emerald-400 to-emerald-600",
    light: "bg-emerald-50",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    hex: "#059669",
  },
  {
    bg: "from-indigo-400 to-indigo-600",
    light: "bg-indigo-50",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-800",
    hex: "#4F46E5",
  },
];

// Deterministic color based on course ID
// Same course always gets same color
export function getCourseColor(courseId: string) {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    hash = courseId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COURSE_COLORS.length;
  return COURSE_COLORS[index];
}