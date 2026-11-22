const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Safely parses any standard YouTube link or 11-char ID and returns the validated 11-character video ID.
 * Returns null if the input is not a valid YouTube video URL/ID.
 */
export function extractYouTubeVideoId(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
      return null;
    }

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return YOUTUBE_ID_REGEX.test(seg) ? seg : null;
    }

    const vParam = parsed.searchParams.get('v');
    if (vParam && YOUTUBE_ID_REGEX.test(vParam)) {
      return vParam;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (
      segments.length >= 2 &&
      (segments[0] === 'embed' ||
        segments[0] === 'shorts' ||
        segments[0] === 'live' ||
        segments[0] === 'v')
    ) {
      return YOUTUBE_ID_REGEX.test(segments[1]) ? segments[1] : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  if (!YOUTUBE_ID_REGEX.test(videoId)) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function buildYouTubeWatchUrl(videoId: string): string {
  if (!YOUTUBE_ID_REGEX.test(videoId)) return '';
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildYouTubeThumbnailUrl(videoId: string): string {
  if (!YOUTUBE_ID_REGEX.test(videoId)) return '';
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
