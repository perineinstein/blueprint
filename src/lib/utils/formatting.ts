// Format pesewas to GHS display
export function formatPrice(pesewas: number): string {
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

// Format seconds to MM:SS for exam timer
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Truncate long text
export function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}