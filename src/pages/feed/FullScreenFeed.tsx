import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Loader2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { supabase, fetchCreators, Creator, Product, ReelWithProduct } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useReelSound } from '../../hooks/useReelSound';
import { useActiveSlide } from '../../hooks/useActiveSlide';
import { isSlowConnection, loadModeFor } from '../../lib/reelPlayback';
import { AuthModal } from '../../components/AuthModal';
import ReelSlide from '../../components/feed/ReelSlide';
import ProductSlide from '../../components/feed/ProductSlide';
import { buildFeed } from '../../components/feed/types';

interface FullScreenFeedProps {
  /**
   * 'home'       — the homepage: sits between the site header and the bottom nav.
   * 'standalone' — covers the whole screen with only a back + mute button.
   */
  variant?: 'home' | 'standalone';
}

/**
 * TikTok-style full-screen vertical feed of reels and product cards
 * (Phase 14ক–14গ). Since 14ঘ it is the homepage (variant="home").
 */
export default function FullScreenFeed({ variant = 'standalone' }: FullScreenFeedProps) {
  const isHome = variant === 'home';
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [reels, setReels] = useState<ReelWithProduct[]>([]);
  const [plainProducts, setPlainProducts] = useState<Product[]>([]);
  const [creators, setCreators] = useState<Record<string, Creator>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stalled, setStalled] = useState(false);
  const { muted, needsTap, toggle: toggleSound, onPlayBlocked } = useReelSound();

  // Likes (14খ)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showAuth, setShowAuth] = useState(false);
  const [authTitle, setAuthTitle] = useState('Sign in to like reels');
  const pendingLikes = useRef<Set<string>>(new Set());

  const items = useMemo(() => buildFeed(reels, plainProducts), [reels, plainProducts]);

  // The scroll container exists only after loading; keep it in state so the slide observer
  // attaches when it appears (see useActiveSlide).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setContainer(el);
  }, []);
  const [active] = useActiveSlide(container, items.length, () => setStalled(false));
  const slow = isSlowConnection();

  // ---- Load reels (RLS returns active, un-hidden reels: content reels, and product reels of approved products) ----
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('reels')
        .select('*, product:products(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      // Admins/owners can also read hidden or non-approved rows, so re-check visibility here
      const list = ((data as ReelWithProduct[]) ?? []).filter(
        (r) =>
          r.is_active &&
          !r.hidden_by_admin &&
          (r.kind === 'content' ||
            (r.product && r.product.status === 'approved' && r.product.is_active))
      );
      setReels(list);
      setCounts(Object.fromEntries(list.map((r) => [r.id, r.like_count ?? 0])));

      // Approved products that have no reel -> shown as product cards (14গ)
      const withReel = new Set(list.map((r) => r.product_id).filter((id): id is string => !!id));
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'approved')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(60);
      const plain = ((prodData as Product[]) ?? []).filter((p) => !withReel.has(p.id)).slice(0, 30);
      setPlainProducts(plain);

      setCreators(await fetchCreators([...list.map((r) => r.seller_id), ...plain.map((p) => p.seller_id)]));
      setLoading(false);
    })();
  }, []);

  // ---- Which of these reels has the signed-in user liked? ----
  useEffect(() => {
    if (!user || reels.length === 0) {
      setLikedIds(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('reel_likes')
        .select('reel_id')
        .eq('user_id', user.id)
        .in('reel_id', reels.map((r) => r.id));
      setLikedIds(new Set((data as { reel_id: string }[] | null)?.map((l) => l.reel_id) ?? []));
    })();
  }, [user, reels]);

  // ---- Like / unlike (optimistic, reverts if the request fails) ----
  const toggleLike = async (reelId: string) => {
    if (!user) {
      setAuthTitle('Sign in to like reels');
      setShowAuth(true);
      return;
    }
    if (pendingLikes.current.has(reelId)) return;
    pendingLikes.current.add(reelId);

    const wasLiked = likedIds.has(reelId);
    const apply = (liked: boolean) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(reelId);
        else next.delete(reelId);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [reelId]: Math.max((prev[reelId] ?? 0) + (liked ? 1 : -1), 0),
      }));
    };

    apply(!wasLiked);
    const { error: err } = wasLiked
      ? await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', user.id)
      : await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: user.id });
    if (err) apply(wasLiked); // roll back
    pendingLikes.current.delete(reelId);
  };

  // ---- Arrow-key navigation (desktop) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        el.scrollBy({
          top: (e.key === 'ArrowDown' ? 1 : -1) * el.clientHeight,
          behavior: 'smooth',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Phase 16: "Become a Seller" lives here (top-left of the home feed), not in the site header.
  // Shown to guests and customers; sellers and admins already have their dashboard.
  const showSellerPill = isHome && profile?.role !== 'seller' && profile?.role !== 'admin';
  const onSellerClick = () => {
    if (!user) {
      setAuthTitle('Sign in to open your shop');
      setShowAuth(true);
    } else {
      navigate('/become-seller');
    }
  };

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  return (
    <div
      className={
        isHome
          ? 'relative h-[calc(100dvh-var(--header-h)-var(--bottom-nav-h))] bg-black'
          : 'fixed inset-0 bg-black'
      }
    >
      {/* Floating controls */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
        style={{ paddingTop: isHome ? '0.75rem' : 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div
          className="flex w-full max-w-md items-center px-3"
        >
          {!isHome && (
            <button
              onClick={goBack}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {showSellerPill && (
            <button
              onClick={onSellerClick}
              className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-black/40 px-3.5 text-sm font-medium text-white backdrop-blur"
            >
              <Sparkles className="h-4 w-4 text-primary-400" /> Become a Seller
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={toggleSound}
              className="pointer-events-auto ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Shown until the first tap, when the browser lets sound start */}
      {needsTap && items.length > 0 && !loading && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            সাউন্ড চালু করতে ট্যাপ করুন
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : error || items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <Film className="mb-3 h-12 w-12 text-dark-500" />
          <p className="mb-4 text-dark-400">{error ?? 'Nothing to show yet — check back soon.'}</p>
          <Link to="/shop" className="text-primary-400 hover:text-primary-300">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div
          ref={setContainerRef}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        >
          {items.map((item, i) => (
            <div key={item.key} data-index={i} className="h-full w-full">
              {item.kind === 'reel' ? (
                <ReelSlide
                  reel={item.reel}
                  shopName={creators[item.reel.seller_id]?.shopName ?? undefined}
                  creatorUsername={creators[item.reel.seller_id]?.username}
                  isActive={i === active}
                  loadMode={loadModeFor(i - active, stalled, slow)}
                  onStalled={setStalled}
                  muted={muted}
                  soundLocked={needsTap}
                  onPlayBlocked={onPlayBlocked}
                  liked={likedIds.has(item.reel.id)}
                  likeCount={counts[item.reel.id] ?? 0}
                  onToggleLike={() => toggleLike(item.reel.id)}
                />
              ) : (
                <ProductSlide product={item.product} shopName={creators[item.product.seller_id]?.shopName ?? undefined} />
              )}
            </div>
          ))}
        </div>
      )}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} title={authTitle} />
    </div>
  );
}
