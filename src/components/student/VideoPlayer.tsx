"use client";

interface VideoPlayerProps {
  url: string;
}

export default function VideoPlayer({ url }: VideoPlayerProps) {
  // Convert Vimeo URL to embed URL
  function getEmbedUrl(rawUrl: string): string {
    // Handle formats:
    // https://vimeo.com/123456789
    // https://player.vimeo.com/video/123456789
    // https://vimeo.com/channels/xxx/123456789

    const vimeoRegex =
      /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/)?|player\.vimeo\.com\/video\/)(\d+)/;
    const match = rawUrl.match(vimeoRegex);

    if (match) {
      return `https://player.vimeo.com/video/${match[1]}?autoplay=0&title=0&byline=0&portrait=0`;
    }

    // YouTube support
    const youtubeRegex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const ytMatch = rawUrl.match(youtubeRegex);

    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }

    // Return as-is if already an embed URL
    return rawUrl;
  }

  const embedUrl = getEmbedUrl(url);

  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Course video"
      />
    </div>
  );
}