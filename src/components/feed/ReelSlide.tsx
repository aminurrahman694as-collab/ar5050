import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Package, Play, Share2, ShoppingBag } from 'lucide-react';
import type { ReelWithProduct } from '../../lib/supabase';
import { formatCount, formatPrice } from '../../lib/format';
import { LoadMode, PLAY_DELAY_MS, STALL_AFTER_MS, preloadFor, unloadVideo } from '../../lib/reelPlayback';
import { shareReel } from '../../lib/reelUpload';

interface ReelSlideProps {
  reel: ReelWithProduct;
  /** Shop name of the seller (product reels). */
  shopName?: string;
  /** Public @username of the uploader (content reels). */
  creatorUsername?: string | null;
  /** This slide is the one currently centered on screen. */
  isActive: boolean;
  /** How much of the video to download (see lib/reelPlayback.ts). */
  loadMode: LoadMode;
  /** The slide on screen is stuck buffering (true) / playing again (false). */
  onStalled: (stalled: boolean) => void;
  muted: boolean;
  /** Sound is off only because the browser hasn't had a tap yet — the first tap should just enable sound. */
  soundLocked: boolean;
  /** play() with sound was refused by the browser (autoplay policy). */
  onPlayBlocked: () => void;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
}

/**
 * One full-screen reel: video, seller/caption, and a Buy Now bar.
 * Plays only while active, pauses (and rewinds) when scrolled away, and releases its
 * video data when it is no longer next to the slide on screen.
 */
export default function ReelSlide({ reel, shopName, creatorUsername, isActive, loadMode, onStalled, muted, soundLocked, onPlayBlocked, liked, likeCount, onToggleLike }: ReelSlideProps) {
  const navigate = useNavigate();
  // Product reels show a Buy Now bar; content reels (kind 'content') have no product at all.
  const product = reel.kind === 'content' ? null : reel.product;
  const soldOut = product ? product.stock <= 0 : false;
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const result = await shareReel(reel.id, reel.caption?.slice(0, 60) || 'Reel');
    if (result === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reset the manual pause whenever this slide stops being the active one.
  useEffect(() => {
    if (!isActive) setUserPaused(false);
  }, [isActive]);

  // Release the data of slides that are no longer near the one on screen
  const hadSource = useRef(false);
  useEffect(() => {
    if (loadMode !== 'off') {
      hadSource.current = true;
      return;
    }
    const video = videoRef.current;
    if (video && hadSource.current) {
      unloadVideo(video);
      hadSource.current = false;
    }
  }, [loadMode]);

  // Auto play / pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;

    if (isActive && !userPaused) {
      if (!video.paused) return;
      // Short delay: a slide flung past during a fast swipe is no longer active
      // by then (cleanup below), so it never plays and never makes a sound.
      const timer = window.setTimeout(() => {
        video.play().catch((err: unknown) => {
          // Sound was refused by the browser: fall back to muted playback and
          // let the feed show the "tap for sound" hint again.
          if (!muted && err instanceof DOMException && err.name === 'NotAllowedError') {
            video.muted = true;
            video.play().catch(() => {});
            onPlayBlocked();
          }
        });
      }, PLAY_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    video.pause();
    if (!isActive) {
      if (hadSource.current) video.currentTime = 0;
      setProgress(0);
    }
  }, [isActive, userPaused, muted, onPlayBlocked]);

  // Tell the feed when the video on screen is stuck buffering, so neighbours stop competing
  const stallTimer = useRef<number | null>(null);
  const clearStall = () => {
    if (stallTimer.current !== null) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
  };
  useEffect(() => {
    if (!isActive) {
      clearStall();
      return;
    }
    return clearStall;
  }, [isActive]);
  const handleWaiting = () => {
    if (!isActive || stallTimer.current !== null) return;
    stallTimer.current = window.setTimeout(() => onStalled(true), STALL_AFTER_MS);
  };
  const handleRecovered = () => {
    clearStall();
    if (isActive) onStalled(false);
  };

  // Pause when the browser tab is hidden
  useEffect(() => {
    if (!isActive) return;
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (!userPaused) video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isActive, userPaused]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    // First tap of the visit only turns the sound on; it must not pause the reel.
    if (soundLocked) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  return (
    <section className="h-full w-full snap-start snap-always flex justify-center bg-black">
      <div className="relative h-full w-full max-w-md overflow-hidden bg-dark-900">
        <video
          ref={videoRef}
          src={loadMode === 'off' ? undefined : reel.video_url}
          poster={reel.thumbnail_url ?? undefined}
          loop
          muted={muted}
          playsInline
          preload={preloadFor(loadMode)}
          onClick={togglePlay}
          onWaiting={handleWaiting}
          onPlaying={handleRecovered}
          onCanPlay={handleRecovered}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (isActive && v.duration) setProgress(v.currentTime / v.duration);
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {isActive && userPaused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Play className="h-16 w-16 fill-white/80 text-white/80" />
          </div>
        )}

        {/* Right action rail: Like + Comment (comment opens the product page for now) */}
        <div
          className="absolute right-3 z-20 flex flex-col items-center gap-5"
          style={{ bottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={onToggleLike}
            className="flex flex-col items-center gap-1 text-white"
            aria-label={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <Heart
                className={`h-6 w-6 transition-transform active:scale-125 ${
                  liked ? 'fill-red-500 text-red-500' : ''
                }`}
              />
            </span>
            <span className="text-xs font-semibold drop-shadow">{formatCount(likeCount)}</span>
          </button>
          {product ? (
            <button
              onClick={() => navigate(`/product/${product.id}`)}
              className="flex flex-col items-center gap-1 text-white"
              aria-label="Comments — open product page"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
                <MessageCircle className="h-6 w-6" />
              </span>
            </button>
          ) : (
            <button onClick={share} className="flex flex-col items-center gap-1 text-white" aria-label="Share">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
                <Share2 className="h-6 w-6" />
              </span>
              <span className="text-xs font-semibold drop-shadow">{copied ? 'Copied' : 'Share'}</span>
            </button>
          )}
        </div>

        {/* Bottom info + Buy Now */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-28"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {product ? (
            shopName && <p className="mb-1 text-sm font-semibold text-white">@{shopName}</p>
          ) : creatorUsername ? (
            <Link to={`/u/${creatorUsername}`} className="mb-1 inline-block text-sm font-semibold text-white">
              @{creatorUsername}
            </Link>
          ) : null}
          {reel.caption && (
            <p className="mb-2 line-clamp-2 pr-14 text-sm text-white/90">{reel.caption}</p>
          )}
          {reel.hashtags?.length > 0 && !product && (
            <p className="mb-3 line-clamp-1 pr-14 text-xs text-white/70">
              {reel.hashtags.map((t) => `#${t}`).join(' ')}
            </p>
          )}

          {product && (
            <div className="mt-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 p-2.5 backdrop-blur">
              <Link
                to={`/product/${product.id}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-dark-700"
              >
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-dark-500" />
                )}
              </Link>
              <Link to={`/product/${product.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{product.name}</p>
                <p className="font-bold text-primary-400">{formatPrice(product.price)}</p>
              </Link>
              <button
                disabled={soldOut}
                onClick={() => navigate(`/checkout/${product.id}?qty=1`)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-400"
              >
                <ShoppingBag className="h-4 w-4" />
                {soldOut ? 'Sold out' : 'Buy Now'}
              </button>
            </div>
          )}
        </div>

        {/* Progress line */}
        <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/20">
          <div className="h-full bg-white/80" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
