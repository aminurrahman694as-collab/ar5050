import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Trash2, Film, Eye, EyeOff, ShieldAlert, Heart } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Product, Reel } from '../../lib/supabase';
import { deleteReelFiles } from '../../lib/reelUpload';
import { formatCount } from '../../lib/format';
import ReelUploadForm from '../../components/ReelUploadForm';
import UsernameForm from '../../components/UsernameForm';

export default function ReelManagement() {
  const { user, profile } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [{ data: reelsData, error: reelsError }, { data: productsData }] = await Promise.all([
      supabase.from('reels').select('*').eq('seller_id', user!.id).order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('*')
        .eq('seller_id', user!.id)
        .eq('status', 'approved')
        .order('name', { ascending: true }),
    ]);

    if (reelsError) setError(reelsError.message);
    setReels((reelsData as Reel[]) ?? []);
    setProducts((productsData as Product[]) ?? []);
    setLoading(false);
  };

  const handleDelete = async (reel: Reel) => {
    if (!confirm('Delete this reel? This cannot be undone.')) return;
    const { error: err } = await supabase.from('reels').delete().eq('id', reel.id);
    if (err) {
      setError(err.message);
      return;
    }
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
    deleteReelFiles([reel.video_url, reel.thumbnail_url]);
  };

  const toggleActive = async (reel: Reel) => {
    const { error: err } = await supabase.from('reels').update({ is_active: !reel.is_active }).eq('id', reel.id);
    if (err) setError(err.message);
    else setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, is_active: !reel.is_active } : r)));
  };

  const productName = (id: string | null) => (id ? products.find((p) => p.id === id)?.name || 'Product' : null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {profile && !profile.username ? (
        <UsernameForm />
      ) : (
        <>
          {profile?.username && (
            <p className="text-sm text-dark-400">
              Your public page:{' '}
              <Link to={`/u/${profile.username}`} className="text-primary-400 hover:text-primary-300">
                @{profile.username}
              </Link>
            </p>
          )}

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Reel
            </button>
          ) : (
            <ReelUploadForm
              products={products}
              onCancel={() => setShowForm(false)}
              onDone={() => {
                setShowForm(false);
                loadData();
              }}
            />
          )}
        </>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-white font-medium">My Reels ({reels.length})</h3>
        </div>

        {reels.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-10">No reels yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
            {reels.map((reel) => (
              <div key={reel.id} className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
                <div className="aspect-[9/16] bg-dark-700 relative flex items-center justify-center">
                  {reel.thumbnail_url ? (
                    <img src={reel.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-8 h-8 text-dark-500" />
                  )}
                  {reel.hidden_by_admin ? (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1 px-2 text-center text-xs text-red-300">
                      <ShieldAlert className="w-5 h-5" />
                      Hidden by admin
                      {reel.hidden_reason && <span className="text-[11px] text-dark-300">{reel.hidden_reason}</span>}
                    </div>
                  ) : (
                    !reel.is_active && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-dark-300">
                        Hidden
                      </div>
                    )
                  )}
                </div>
                <div className="p-2">
                  <p className="text-white text-xs truncate flex items-center gap-1">
                    <Film className="w-3 h-3 text-primary-400 flex-shrink-0" />
                    {reel.kind === 'content' ? 'Content reel' : productName(reel.product_id) ?? 'Product reel'}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-dark-400">
                    <Heart className="w-3 h-3" /> {formatCount(reel.like_count ?? 0)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => toggleActive(reel)}
                      disabled={reel.hidden_by_admin}
                      className="p-1 text-dark-400 hover:text-white disabled:opacity-40"
                      title={reel.is_active ? 'Hide' : 'Show'}
                    >
                      {reel.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDelete(reel)} className="p-1 text-dark-400 hover:text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
