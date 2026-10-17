import { useEffect, useState } from 'react';
import { EyeOff, Eye, Film, Loader2, ShieldAlert, Trash2, Package } from 'lucide-react';
import { supabase, Reel } from '../../lib/supabase';
import { deleteReelFiles } from '../../lib/reelUpload';
import { formatCount } from '../../lib/format';

type Uploader = { id: string; username: string | null; email: string | null; full_name: string | null; role: string };
type Filter = 'all' | 'content' | 'product' | 'hidden';

/** Admin: review every reel; hide (reversible) or delete (also removes the files). */
export default function ReelsReview() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, Uploader>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const list = (data as Reel[]) ?? [];
    setReels(list);

    const ids = [...new Set(list.map((r) => r.seller_id))];
    if (ids.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, username, email, full_name, role')
        .in('id', ids);
      setUploaders(Object.fromEntries(((people as Uploader[]) ?? []).map((p) => [p.id, p])));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const hide = async (reel: Reel) => {
    const { error: err } = await supabase
      .from('reels')
      .update({ hidden_by_admin: true, hidden_reason: reason.trim() || null })
      .eq('id', reel.id);
    if (err) {
      setError(err.message);
      return;
    }
    setReels((prev) =>
      prev.map((r) => (r.id === reel.id ? { ...r, hidden_by_admin: true, hidden_reason: reason.trim() || null } : r))
    );
    setHidingId(null);
    setReason('');
    if (playing === reel.id) setPlaying(null);
  };

  const unhide = async (reel: Reel) => {
    const { error: err } = await supabase
      .from('reels')
      .update({ hidden_by_admin: false, hidden_reason: null })
      .eq('id', reel.id);
    if (err) setError(err.message);
    else setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, hidden_by_admin: false, hidden_reason: null } : r)));
  };

  const remove = async (reel: Reel) => {
    if (!confirm('Delete this reel and its video file permanently? This cannot be undone.')) return;
    const { error: err } = await supabase.from('reels').delete().eq('id', reel.id);
    if (err) {
      setError(err.message);
      return;
    }
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
    deleteReelFiles([reel.video_url, reel.thumbnail_url]);
  };

  const shown = reels.filter((r) =>
    filter === 'all' ? true : filter === 'hidden' ? r.hidden_by_admin : r.kind === filter
  );
  const hiddenCount = reels.filter((r) => r.hidden_by_admin).length;

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${reels.length})` },
    { key: 'content', label: 'Content' },
    { key: 'product', label: 'Product' },
    { key: 'hidden', label: `Hidden (${hiddenCount})` },
  ];

  const who = (id: string) => {
    const u = uploaders[id];
    if (!u) return 'Unknown user';
    return u.username ? `@${u.username}` : u.email || u.full_name || 'User';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Reels Review</h1>
        <p className="text-sm text-dark-400">
          Hide a reel to remove it from the public feed without deleting it (the owner is told it was hidden by an admin).
          Hiding, un-hiding and deleting are recorded in the audit log.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              filter === t.key ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-dark-400">No reels here.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((reel) => (
            <div key={reel.id} className="flex gap-3 rounded-2xl border border-dark-700 bg-dark-800 p-3">
              <div className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-xl bg-dark-700 sm:w-28">
                {playing === reel.id ? (
                  <video src={reel.video_url} controls autoPlay playsInline className="h-full w-full object-cover" />
                ) : (
                  <button onClick={() => setPlaying(reel.id)} className="flex h-full w-full items-center justify-center" title="Play">
                    {reel.thumbnail_url ? (
                      <img src={reel.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Film className="h-7 w-7 text-dark-500" />
                    )}
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-white">{who(reel.seller_id)}</span>
                  <span className="rounded-full bg-dark-700 px-2 py-0.5 text-[11px] text-dark-300">
                    {reel.kind === 'product' ? (
                      <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> Product</span>
                    ) : 'Content'}
                  </span>
                  {reel.hidden_by_admin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300">
                      <ShieldAlert className="h-3 w-3" /> Hidden
                    </span>
                  )}
                  {!reel.is_active && <span className="text-[11px] text-dark-500">hidden by owner</span>}
                </div>
                <p className="mt-0.5 text-xs text-dark-500">
                  {new Date(reel.created_at).toLocaleString()} · {formatCount(reel.like_count ?? 0)} likes
                </p>
                {reel.caption && <p className="mt-1.5 line-clamp-3 break-words text-sm text-dark-200">{reel.caption}</p>}
                {reel.hidden_by_admin && reel.hidden_reason && (
                  <p className="mt-1 text-xs text-red-300">Reason: {reel.hidden_reason}</p>
                )}

                {hidingId === reel.id ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={200}
                      placeholder="Reason (shown to the owner, optional)"
                      className="min-w-0 flex-1 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => hide(reel)} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">
                        Hide
                      </button>
                      <button
                        onClick={() => { setHidingId(null); setReason(''); }}
                        className="rounded-lg bg-dark-700 px-3 py-2 text-sm text-white hover:bg-dark-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    {reel.hidden_by_admin ? (
                      <button onClick={() => unhide(reel)} className="inline-flex items-center gap-1.5 rounded-lg bg-dark-700 px-3 py-1.5 text-sm text-white hover:bg-dark-600">
                        <Eye className="h-4 w-4" /> Show again
                      </button>
                    ) : (
                      <button onClick={() => { setHidingId(reel.id); setReason(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-dark-700 px-3 py-1.5 text-sm text-white hover:bg-dark-600">
                        <EyeOff className="h-4 w-4" /> Hide
                      </button>
                    )}
                    <button onClick={() => remove(reel)} className="inline-flex items-center gap-1.5 rounded-lg bg-dark-700 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
