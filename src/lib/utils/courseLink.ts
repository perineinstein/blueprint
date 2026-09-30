export function getCourseLearnLink(
  courseId: string,
  trackId: string | null | undefined
): string {
  if (trackId === "nclex" || trackId === "ielts") {
    return `/tracks/${trackId}/${courseId}`;
  }
  return `/courses/${courseId}/learn`;
}
