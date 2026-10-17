import { supabase } from './supabase';

const BUCKET = 'reel-videos';

type UploadArgs = {
  path: string;
  file: Blob;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Uploads a file to the reel-videos bucket with real progress.
 * supabase-js has no progress callback, so this posts the same multipart request it would,
 * through XMLHttpRequest. Returns the public URL.
 */
export async function uploadReelFile({ path, file, onProgress, signal }: UploadArgs): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again and retry.');

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', anon);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = 'Upload failed. Please try again.';
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        const text = body.message || body.error || '';
        if (/row-level security|violates/i.test(text)) {
          message = 'You cannot upload right now (daily upload limit reached or account restricted).';
        } else if (/exceeded|too large|maximum/i.test(text)) {
          message = 'The file is too large.';
        } else if (text) {
          message = text;
        }
      } catch {
        /* keep the generic message */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Network problem while uploading. Check your connection and retry.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());

    const form = new FormData();
    form.append('cacheControl', '31536000'); // file names are unique, so browsers/CDN may keep them for a year
    form.append('', file);
    xhr.send(form);
  });

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** "…/object/public/<bucket>/<path>" -> { bucket, path } */
function parsePublicUrl(url: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?.*)?$/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

/**
 * Removes a reel's video and thumbnail from storage. Deleting only the database row would leave
 * the files behind and keep eating the storage quota. Errors are ignored on purpose: the reel is
 * already gone, and a failed cleanup must not block the user.
 */
export async function deleteReelFiles(urls: (string | null)[]): Promise<void> {
  const byBucket: Record<string, string[]> = {};
  urls.forEach((u) => {
    const parsed = parsePublicUrl(u);
    if (parsed) (byBucket[parsed.bucket] ??= []).push(parsed.path);
  });
  await Promise.all(
    Object.entries(byBucket).map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths).catch(() => null))
  );
}

/** Same native share sheet / copy-link behaviour on every reel screen. */
export async function shareReel(reelId: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = `${window.location.origin}/reels?start=${reelId}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
