import { getCourseColor } from "@/lib/utils/courseColors";
import { cn } from "@/lib/utils/cn";

interface CourseThumbnailProps {
  courseId: string;
  title: string;
  thumbnailUrl?: string;  // ← new prop
  className?: string;
  size?: "sm" | "md" | "lg";
}

function getInitials(title: string): string {
  const words = title.trim().split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return "?";

  const skip = new Set([
    "to", "in", "of", "the", "a", "an", "and",
    "for", "on", "at", "by", "with", "from",
  ]);

  const meaningful = words.filter((w) => !skip.has(w.toLowerCase()));
  const source = meaningful.length > 0 ? meaningful : words;

  if (source.length === 1) {
    return source[0].slice(0, 2).toUpperCase();
  }

  return source.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
}

export default function CourseThumbnail({
  courseId,
  title,
  thumbnailUrl,
  className,
  size = "md",
}: CourseThumbnailProps) {
  const color = getCourseColor(courseId);
  const initials = getInitials(title);

  const heights = {
    sm: "h-16",
    md: "h-36",
    lg: "h-48",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-2xl",
    lg: "text-3xl",
  };

  // ── If admin uploaded an image, show it ──────────────────
  if (thumbnailUrl) {
    return (
      <div
        className={cn(
          `w-full ${heights[size]} rounded-xl overflow-hidden relative`,
          className
        )}
      >
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // ── Fallback: gradient with initials ─────────────────────
  return (
    <div
      className={cn(
        `w-full ${heights[size]} bg-gradient-to-br ${color.bg}`,
        "rounded-xl flex items-center justify-center relative overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white" />
      </div>

      <span
        className={cn(
          `${textSizes[size]} font-bold text-white relative z-10`,
          "tracking-wider drop-shadow-sm"
        )}
      >
        {initials}
      </span>
    </div>
  );
}