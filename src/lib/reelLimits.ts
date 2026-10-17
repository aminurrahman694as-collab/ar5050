/**
 * Upload rules for reels (Step 1). Change the numbers here; the database enforces its own
 * backstop (migration 021: 50 MB per file, 10 reels and 30 files per user per 24 h,
 * 300-character caption), so keep these at or below those.
 *
 * Why 25 MB / 60 s: storage is the fastest-growing cost and heavy videos are the main reason
 * reels load slowly on mobile data. The free Supabase plan has 1 GB of storage in total —
 * at 25 MB each that is only ~40 reels, so raise the limit only after upgrading the plan.
 */
export const MAX_VIDEO_MB = 25;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_CAPTION = 300;
export const MAX_HASHTAGS = 10;
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
const ALLOWED_THUMB_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns an error message, or null when the file is acceptable. */
export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return 'Please choose an MP4, WebM or MOV video.';
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `This video is ${formatMB(file.size)}. The limit is ${MAX_VIDEO_MB} MB — trim or compress it and try again.`;
  }
  return null;
}

export function validateThumbFile(file: File): string | null {
  if (!ALLOWED_THUMB_TYPES.includes(file.type)) return 'The thumbnail must be a JPG, PNG or WebP image.';
  if (file.size > MAX_THUMB_BYTES) return 'The thumbnail must be 2 MB or smaller.';
  return null;
}

export type VideoMeta = { duration: number; width: number; height: number };

/** Reads the real duration/size from the file itself (never trusts the file name). */
export function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const done = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      const meta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      done();
      if (!Number.isFinite(meta.duration) || meta.duration <= 0) reject(new Error('unreadable'));
      else resolve(meta);
    };
    video.onerror = () => {
      done();
      reject(new Error('unreadable'));
    };
    video.src = url;
  });
}

/** Grabs a frame near the start as a small JPEG, used as the reel's thumbnail. */
export function captureThumbnail(file: File, duration: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const finish = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, duration / 2);
    };
    video.onseeked = () => {
      try {
        const w = 360;
        const h = 640; // 9:16, matches the reel screen
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx || !video.videoWidth) return finish(null);
        // "cover" crop
        const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
        canvas.toBlob((b) => finish(b), 'image/jpeg', 0.8);
      } catch {
        finish(null);
      }
    };
    video.src = url;
  });
}

/** "#Fashion tips #eid_2026" -> ["fashion", "eid_2026"] (lowercase, unique, at most 10). */
export function extractHashtags(caption: string): string[] {
  const found = caption.match(/#[\p{L}\p{N}_]{2,30}/gu) ?? [];
  return [...new Set(found.map((t) => t.slice(1).toLowerCase()))].slice(0, MAX_HASHTAGS);
}
