import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Volume2, VolumeX, Share2, ShoppingBag, Package, Film, Play } from 'lucide-react';
import { supabase, fetchCreators, Creator, ReelWithProduct } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';
import { shareReel } from '../../lib/reelUpload';
import { useReelSound } from '../../hooks/useReelSound';
import { useActiveSlide } from '../../hooks/useActiveSlide';
import {
  PLAY_DELAY_MS, STALL_AFTER_MS, isSlowConnection, loadModeFor, preloadFor, unloadVideo,
} from '../../lib/reelPlayback';

export default function ReelsFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  // /reels?user=<id> shows only that creator's reels (opened from a profile page)
  const userFilter = searchParams.get('user');

  const [reels, setReels] = useState<ReelWithProduct[]>([]);
  const [creators, setCreators] = useState<Record<string, Creator>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { muted, needsTap, toggle: toggleSound, onPlayBlocked } = useReelSound();
  const [manualPaused, setManualPaused] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // The scroll container exists only after loading; keep it in state so the slide observer
  // attaches when it appears (see useActiveSlide).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setContainer(el);
  }, []);
  const [stalled, setStalled] = useState(false);
  const stallTimer = useRef<number | null>(null);
  const [active, setActive] = useActiveSlide(container, reels.length, () => {
    setManualPaused(null);
    setStalled(false);
  });
  const slow = isSlowConnection();
  const hadSource = useRef<Record<number, boolean>>({});
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const didScrollToStart = useRef(false);

  // ---- Load reels (RLS returns active, un-hidden reels: content reels, and product reels of approved products) ----
  useEffect(() => {
    (async () => {
      let query = supabase
        .from('reels')
        .select('*, product:products(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (userFilter) query = query.eq('seller_id', userFilter);
      const { data, error: err } = await query;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      // Admins/owners can also read hidden rows, so re-check visibility here
      const list = ((data as ReelWithProduct[]) ?? []).filter(
        (r) => r.is_active && !r.hidden_by_admin && (r.kind === 'content' || r.product)
      );
      setReels(list);

      setCreators(await fetchCreators(list.map((r) => r.seller_id)));
      setLoading(false);
    })();
  }, [userFilter]);

  // ---- Jump to ?start=<reelId> once ----
  useEffect(() => {
    if (loading || didScrollToStart.current || !startId) return;
    const idx = reels.findIndex((r) => r.id === startId);
    didScrollToStart.current = true;
    if (idx > 0 && containerRef.current) {
      containerRef.current.scrollTo({ top: idx * containerRef.current.clientHeight });
      setActive(idx);
    }
  }, [loading, reels, startId, setActive]);

  // ---- Play only the active video; release the data of videos that are no longer near ----
  useEffect(() => {
    const timers: number[] = [];
    Object.entries(videoRefs.current).forEach(([key, video]) => {
      if (!video) return;
      const idx = Number(key);
      video.muted = muted;

      if (loadModeFor(idx - active, stalled, slow) === 'off') {
        if (hadSource.current[idx]) {
          unloadVideo(video);
          hadSource.current[idx] = false;
        }
      } else {
        hadSource.current[idx] = true;
      }

      if (idx === active && manualPaused !== active) {
        if (!video.paused) return;
        // Short delay: a reel flung past during a fast swipe is no longer active by
        // then (cleanup below), so it never plays and never makes a sound.
        timers.push(
          window.setTimeout(() => {
            video.play().catch((err: unknown) => {
              // Browser refused sound: play muted and show the "tap for sound" hint again
              if (!muted && err instanceof DOMException && err.name === 'NotAllowedError') {
                video.muted = true;
                video.play().catch(() => {});
                onPlayBlocked();
              }
            });
          }, PLAY_DELAY_MS)
        );
      } else {
        video.pause();
        if (idx !== active && hadSource.current[idx]) video.currentTime = 0;
      }
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active, muted, manualPaused, reels, loading, stalled, slow, onPlayBlocked]);

  // The video on screen is stuck buffering -> neighbours stop downloading
  const handleWaiting = (idx: number) => {
    if (idx !== active || stallTimer.current !== null) return;
    stallTimer.current = window.setTimeout(() => setStalled(true), STALL_AFTER_MS);
  };
  const handleRecovered = (idx: number) => {
    if (stallTimer.current !== null) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
    if (idx === active) setStalled(false);
  };
  useEffect(
    () => () => {
      if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    },
    []
  );

  // ---- Keyboard navigation (desktop) ----
  const scrollByReel = useCallback((dir: 1 | -1) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollByReel(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollByReel(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrollByReel]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const togglePlay = (idx: number) => {
    const video = videoRefs.current[idx];
    if (!video) return;
    // First tap of the visit only turns the sound on; it must not pause the reel.
    if (needsTap) return;
    if (video.paused) {
      setManualPaused(null);
      video.play().catch(() => {});
    } else {
      setManualPaused(idx);
      video.pause();
    }
  };

  const share = async (reel: ReelWithProduct) => {
    const result = await shareReel(reel.id, reel.product?.name ?? (reel.caption?.slice(0, 60) || 'Reel'));
    if (result === 'copied') setToast('Link copied');
  };

  if (loading) {
    return (
      <div className="h-[calc(100dvh-var(--header-h)-var(--bottom-nav-h))] flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || reels.length === 0) {
    return (
      <div className="h-[calc(100dvh-var(--header-h)-var(--bottom-nav-h))] flex flex-col items-center justify-center bg-dark-900 text-center px-6">
        <Film className="w-12 h-12 text-dark-500 mb-3" />
        <p className="text-dark-400 mb-4">{error ?? 'No reels yet — check back soon.'}</p>
        <Link to="/shop" className="text-primary-400 hover:text-primary-300">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-var(--header-h)-var(--bottom-nav-h))] bg-black">
      <div
        ref={setContainerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels.map((reel, i) => {
          const product = reel.kind === 'content' ? null : reel.product;
          const soldOut = product ? product.stock <= 0 : false;
          const creator = creators[reel.seller_id];
          const mode = loadModeFor(i - active, stalled, slow);

          return (
            <section
              key={reel.id}
              data-index={i}
              className="h-full snap-start snap-always flex justify-center"
            >
              <div className="relative h-full w-full max-w-md bg-dark-900 overflow-hidden">
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={mode === 'off' ? undefined : reel.video_url}
                  poster={reel.thumbnail_url ?? undefined}
                  loop
                  muted={muted}
                  playsInline
                  preload={preloadFor(mode)}
                  onClick={() => togglePlay(i)}
                  onWaiting={() => handleWaiting(i)}
                  onPlaying={() => handleRecovered(i)}
                  onCanPlay={() => handleRecovered(i)}
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {manualPaused === i && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="w-16 h-16 text-white/80 fill-white/80" />
                  </div>
                )}

                {/* Right action rail */}
                <div className="absolute right-3 bottom-44 flex flex-col items-center gap-4 z-10">
                  <button
                    onClick={toggleSound}
                    className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => share(reel)}
                    className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                    aria-label="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Bottom info + Buy Now */}
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                  {product ? (
                    creator?.shopName && (
                      <p className="text-white font-semibold text-sm mb-1">@{creator.shopName}</p>
                    )
                  ) : creator?.username ? (
                    <Link to={`/u/${creator.username}`} className="mb-1 inline-block text-sm font-semibold text-white">
                      @{creator.username}
                    </Link>
                  ) : null}
                  {reel.caption && (
                    <p className="text-white/90 text-sm line-clamp-2 mb-2 pr-14">{reel.caption}</p>
                  )}
                  {!product && reel.hashtags?.length > 0 && (
                    <p className="mb-3 line-clamp-1 pr-14 text-xs text-white/70">
                      {reel.hashtags.map((t) => `#${t}`).join(' ')}
                    </p>
                  )}

                  {product && (
                    <div className="flex items-center gap-3 bg-black/50 backdrop-blur rounded-2xl p-2.5 border border-white/10">
                      <Link
                        to={`/product/${product.id}`}
                        className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-dark-700 flex items-center justify-center"
                      >
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-dark-500" />
                        )}
                      </Link>
                      <Link to={`/product/${product.id}`} className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{product.name}</p>
                        <p className="text-primary-400 font-bold">{formatPrice(product.price)}</p>
                      </Link>
                      <button
                        disabled={soldOut}
                        onClick={() => navigate(`/checkout/${product.id}?qty=1`)}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-400 text-white text-sm font-semibold rounded-xl"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {soldOut ? 'Sold out' : 'Buy Now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {needsTap && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            সাউন্ড চালু করতে ট্যাপ করুন
          </span>
        </div>
      )}

      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/80 text-white text-sm z-20">
          {toast}
        </div>
      )}
    </div>
  );
}
