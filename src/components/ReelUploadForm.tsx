import { useEffect, useRef, useState } from 'react';
import { Loader2, VideoIcon, ImagePlus, X, RefreshCw, Package } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase, Product, Reel } from '../lib/supabase';
import { formatPrice } from '../lib/format';
import { deleteReelFiles, uploadReelFile } from '../lib/reelUpload';
import {
  MAX_CAPTION, MAX_VIDEO_MB, MAX_VIDEO_SECONDS, captureThumbnail, extractHashtags, formatMB,
  readVideoMeta, validateThumbFile, validateVideoFile,
} from '../lib/reelLimits';

interface ReelUploadFormProps {
  /** The signed-in seller's approved products. Empty for everyone else (content reels only). */
  products?: Product[];
  onDone: (reel: Reel) => void;
  onCancel?: () => void;
}

type Phase = 'idle' | 'uploading' | 'saving';
type Uploaded = { path: string; url: string };

const EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Upload form shared by the Create page (everyone) and the seller dashboard.
 * Checks type, size and the real duration BEFORE uploading, shows progress, and on a failure
 * keeps what already uploaded so "Retry" never sends the same video twice.
 */
export default function ReelUploadForm({ products = [], onDone, onCancel }: ReelUploadFormProps) {
  const { user } = useAuth();

  const [productId, setProductId] = useState(''); // '' = content reel (no product)
  const [caption, setCaption] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [autoThumb, setAutoThumb] = useState<Blob | null>(null);
  const [autoThumbPreview, setAutoThumbPreview] = useState<string | null>(null);
  const [customThumb, setCustomThumb] = useState<File | null>(null);
  const [customThumbPreview, setCustomThumbPreview] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // What is already in storage for this form (kept for Retry, removed on cancel / new file)
  const uploadedVideo = useRef<Uploaded | null>(null);
  const uploadedThumb = useRef<Uploaded | null>(null);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const hashtags = extractHashtags(caption);
  const busy = phase !== 'idle';

  // Stop an upload that is still running if the form disappears
  useEffect(() => () => abortRef.current?.abort(), []);
  // Free object URLs
  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview); }, [videoPreview]);
  useEffect(() => () => { if (autoThumbPreview) URL.revokeObjectURL(autoThumbPreview); }, [autoThumbPreview]);
  useEffect(() => () => { if (customThumbPreview) URL.revokeObjectURL(customThumbPreview); }, [customThumbPreview]);

  const discardUploaded = async () => {
    const urls = [uploadedVideo.current?.url ?? null, uploadedThumb.current?.url ?? null];
    uploadedVideo.current = null;
    uploadedThumb.current = null;
    if (urls.some(Boolean)) await deleteReelFiles(urls);
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;

    setError(null);
    await discardUploaded();
    setVideoFile(null);
    setVideoPreview(null);
    setAutoThumb(null);
    setAutoThumbPreview(null);

    const typeError = validateVideoFile(file);
    if (typeError) {
      setError(typeError);
      return;
    }

    setChecking(true);
    try {
      const meta = await readVideoMeta(file);
      if (meta.duration > MAX_VIDEO_SECONDS + 0.5) {
        setError(`This video is ${Math.round(meta.duration)} seconds long. The limit is ${MAX_VIDEO_SECONDS} seconds.`);
        return;
      }
      setVideoFile(file);
      setDuration(meta.duration);
      setVideoPreview(URL.createObjectURL(file));
      const thumb = await captureThumbnail(file, meta.duration);
      if (thumb) {
        setAutoThumb(thumb);
        setAutoThumbPreview(URL.createObjectURL(thumb));
      }
    } catch {
      setError('This browser cannot read that video. Please use a standard MP4 (H.264) video.');
    } finally {
      setChecking(false);
    }
  };

  const handleThumbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const thumbError = validateThumbFile(file);
    if (thumbError) {
      setError(thumbError);
      return;
    }
    setError(null);
    // a replaced thumbnail that already uploaded is no longer needed
    if (uploadedThumb.current) {
      deleteReelFiles([uploadedThumb.current.url]);
      uploadedThumb.current = null;
    }
    setCustomThumb(file);
    setCustomThumbPreview(URL.createObjectURL(file));
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !user) return;
    setError(null);

    if (!videoFile) {
      setError('Please choose a video.');
      return;
    }
    if (caption.length > MAX_CAPTION) {
      setError(`The caption is too long (${MAX_CAPTION} characters at most).`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setPhase('uploading');
      setProgress(0);

      // 1. video (skipped when a previous attempt already uploaded it)
      if (!uploadedVideo.current) {
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[videoFile.type] ?? 'mp4'}`;
        const url = await uploadReelFile({
          path,
          file: videoFile,
          signal: controller.signal,
          onProgress: setProgress,
        });
        uploadedVideo.current = { path, url };
      }

      // 2. thumbnail: the one the user picked, otherwise the frame we captured
      const thumbSource: Blob | null = customThumb ?? autoThumb;
      if (thumbSource && !uploadedThumb.current) {
        const type = thumbSource.type || 'image/jpeg';
        const path = `${user.id}/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[type] ?? 'jpg'}`;
        try {
          const url = await uploadReelFile({ path, file: thumbSource, signal: controller.signal });
          uploadedThumb.current = { path, url };
        } catch (thumbErr) {
          // A missing thumbnail must not block the reel; the video still posts.
          if (thumbErr instanceof DOMException && thumbErr.name === 'AbortError') throw thumbErr;
        }
      }

      // 3. the reel row
      setPhase('saving');
      const { data, error: insertErr } = await supabase
        .from('reels')
        .insert({
          seller_id: user.id,
          kind: productId ? 'product' : 'content',
          product_id: productId || null,
          video_url: uploadedVideo.current.url,
          thumbnail_url: uploadedThumb.current?.url ?? null,
          caption: caption.trim() || null,
          hashtags,
        })
        .select('*')
        .single();
      if (insertErr) throw insertErr;

      uploadedVideo.current = null;
      uploadedThumb.current = null;
      onDone(data as Reel);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Upload cancelled.');
      } else {
        // Supabase errors are not always `Error` instances, so read `.message` from any object
        const raw = (err as { message?: unknown } | null)?.message;
        const message = typeof raw === 'string' && raw ? raw : 'Something went wrong. Please try again.';
        setError(
          /row-level security/i.test(message)
            ? 'You cannot post right now. Your account may be restricted.'
            : message
        );
      }
      setPhase('idle');
    } finally {
      setPhase('idle');
      abortRef.current = null;
    }
  };

  const cancel = async () => {
    abortRef.current?.abort();
    await discardUploaded();
    onCancel?.();
  };

  const thumbPreview = customThumbPreview ?? autoThumbPreview;
  const retrying = error !== null && uploadedVideo.current !== null;

  return (
    <form onSubmit={submit} className="bg-dark-800 border border-dark-700 rounded-2xl p-5 sm:p-6 space-y-4">
      {onCancel && (
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium">New reel</h3>
          <button type="button" onClick={cancel} className="p-1.5 text-dark-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Product (sellers only) */}
      {products.length > 0 && (
        <div>
          <label className="block text-xs text-dark-400 mb-1">Link to a product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">No product (content only)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProduct ? (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-dark-600 bg-dark-700/60 p-2.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dark-700">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-dark-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{selectedProduct.name}</p>
                <p className="text-xs text-primary-400">{formatPrice(selectedProduct.price)} · viewers get a Buy Now button</p>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-dark-500">A content reel has no Buy Now button.</p>
          )}
        </div>
      )}

      {/* Video + thumbnail */}
      <div className="grid grid-cols-2 gap-3">
        <label className="relative flex flex-col items-center justify-center gap-1.5 aspect-[9/16] max-h-64 rounded-xl bg-dark-700 border border-dashed border-dark-600 cursor-pointer hover:border-primary-500 transition-colors text-dark-400 text-xs text-center overflow-hidden">
          {videoPreview ? (
            <video src={videoPreview} muted playsInline controls className="absolute inset-0 h-full w-full object-cover" />
          ) : checking ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <VideoIcon className="w-7 h-7" />
              <span className="px-2">Choose video</span>
              <span className="px-2 text-[11px] text-dark-500">up to {MAX_VIDEO_SECONDS}s · {MAX_VIDEO_MB} MB</span>
            </>
          )}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            onChange={handleVideoChange}
            disabled={busy}
            className="hidden"
          />
        </label>

        <label className="relative flex flex-col items-center justify-center gap-1.5 aspect-[9/16] max-h-64 rounded-xl bg-dark-700 border border-dashed border-dark-600 cursor-pointer hover:border-primary-500 transition-colors text-dark-400 text-xs text-center overflow-hidden">
          {thumbPreview ? (
            <img src={thumbPreview} alt="Thumbnail preview" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="w-7 h-7" />
              <span className="px-2">Thumbnail</span>
              <span className="px-2 text-[11px] text-dark-500">made from your video automatically</span>
            </>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumbChange} disabled={busy} className="hidden" />
        </label>
      </div>
      {videoFile && (
        <p className="text-xs text-dark-400">
          {videoFile.name} · {formatMB(videoFile.size)} · {Math.round(duration)}s
          {customThumb ? ' · custom thumbnail' : ''}
        </p>
      )}

      {/* Caption */}
      <div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          maxLength={MAX_CAPTION}
          disabled={busy}
          placeholder="Write a caption… add #hashtags so people can find it"
          className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-xs text-dark-500">
          <span className="min-w-0 break-words">
            {hashtags.length > 0 ? hashtags.map((t) => `#${t}`).join(' ') : ' '}
          </span>
          <span className="shrink-0">{caption.length}/{MAX_CAPTION}</span>
        </div>
      </div>

      {/* Progress */}
      {phase !== 'idle' && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-dark-700">
            <div
              className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
              style={{ width: `${phase === 'saving' ? 100 : Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-dark-400">
            {phase === 'saving' ? 'Publishing…' : `Uploading… ${Math.round(progress * 100)}%`}
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || checking || !videoFile}
          className="flex flex-1 items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : retrying ? <RefreshCw className="w-4 h-4" /> : null}
          {busy ? 'Please wait…' : retrying ? 'Retry' : 'Post reel'}
        </button>
        {busy && (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded-xl"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-dark-500">
        By posting you confirm the video is yours (or you have the right to use it) and follow our rules in the Terms.
        Up to 10 reels per day.
      </p>
    </form>
  );
}
