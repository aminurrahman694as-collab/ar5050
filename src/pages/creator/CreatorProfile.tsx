import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Film, Heart, Loader2, Package, Plus, ShieldAlert, Trash2, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Reel } from '../../lib/supabase';
import { deleteReelFiles } from '../../lib/reelUpload';
import { formatCount } from '../../lib/format';

type CreatorInfo = {
  id: string;
  username: string;
  shop_name: string | null;
  reel_count: number;
  like_total: number;
};

/** /u/:username — public creator page. Unknown or blocked users get a 404 view. */
export default function CreatorProfile() {
  const { username = '' } = useParams();
  const { user } = useAuth();

  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCreator(null);
      setReels([]);

      const { data } = await supabase.rpc('public_creator_profile', { p_username: username });
      const row = ((data as CreatorInfo[] | null) ?? [])[0] ?? null;
      if (cancelled) return;
      if (!row) {
        setLoading(false);
        return;
      }
      setCreator(row);

      const { data: reelData } = await supabase
        .from('reels')
        .select('*')
        .eq('seller_id', row.id)
        .order('created_at', { ascending: false })
        .limit(60);
      if (cancelled) return;
      setReels((reelData as Reel[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const isOwner = !!user && !!creator && user.id === creator.id;
  // Public visitors only get visible reels from the database anyway; owners/admins also get hidden ones, so
  // everyone else is shown just the visible ones.
  const visible = reels.filter((r) => isOwner || (r.is_active && !r.hidden_by_admin));

  const toggleActive = async (reel: Reel) => {
    const { error: err } = await supabase.from('reels').update({ is_active: !reel.is_active }).eq('id', reel.id);
    if (err) setError(err.message);
    else setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, is_active: !reel.is_active } : r)));
  };

  const remove = async (reel: Reel) => {
    if (!confirm('Delete this reel? This cannot be undone.')) return;
    const { error: err } = await supabase.from('reels').delete().eq('id', reel.id);
    if (err) {
      setError(err.message);
      return;
    }
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
    deleteReelFiles([reel.video_url, reel.thumbnail_url]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <UserX className="mx-auto mb-4 h-12 w-12 text-dark-500" />
        <h1 className="mb-1 text-lg font-semibold text-white">Profile not found</h1>
        <p className="mb-6 text-sm text-dark-400">There is no creator called @{username}.</p>
        <Link to="/" className="text-primary-400 hover:text-primary-300">Back to the feed</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-2xl font-semibold uppercase text-primary-400">
          {creator.username[0]}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">@{creator.username}</h1>
          {creator.shop_name && <p className="truncate text-sm text-dark-400">{creator.shop_name}</p>}
          <p className="mt-1 text-sm text-dark-300">
            <b className="text-white">{formatCount(Number(creator.reel_count))}</b> reels ·{' '}
            <b className="text-white">{formatCount(Number(creator.like_total))}</b> likes
          </p>
        </div>
        {isOwner && (
          <Link
            to="/create"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> New reel
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-dark-400">No reels yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {visible.map((reel) => (
            <div key={reel.id} className="relative overflow-hidden rounded-lg bg-dark-800">
              <Link
                to={`/reels?user=${creator.id}&start=${reel.id}`}
                className="relative flex aspect-[9/16] items-center justify-center bg-dark-700"
              >
                {reel.thumbnail_url ? (
                  <img src={reel.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Film className="h-7 w-7 text-dark-500" />
                )}
                <span className="absolute bottom-1 left-1.5 flex items-center gap-1 text-[11px] font-medium text-white drop-shadow">
                  <Heart className="h-3 w-3" /> {formatCount(reel.like_count ?? 0)}
                </span>
                {reel.kind === 'product' && (
                  <span className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white">
                    <Package className="h-3 w-3" />
                  </span>
                )}
                {isOwner && reel.hidden_by_admin ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 px-1 text-center text-[11px] text-red-300">
                    <ShieldAlert className="h-4 w-4" /> Hidden by admin
                  </span>
                ) : (
                  isOwner &&
                  !reel.is_active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] text-dark-300">
                      Hidden
                    </span>
                  )
                )}
              </Link>
              {isOwner && (
                <div className="flex items-center justify-between px-1.5 py-1">
                  <button
                    onClick={() => toggleActive(reel)}
                    disabled={reel.hidden_by_admin}
                    className="p-1 text-dark-400 hover:text-white disabled:opacity-40"
                    title={reel.is_active ? 'Hide' : 'Show'}
                  >
                    {reel.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(reel)} className="p-1 text-dark-400 hover:text-red-400" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** /profile — sends the signed-in user to their own page (or to Create, to pick a username first). */
export function MyProfileRedirect() {
  const { user, profile } = useAuth();
  if (!user) return <Navigate to="/create" replace />;
  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  return <Navigate to={profile.username ? `/u/${profile.username}` : '/create'} replace />;
}
