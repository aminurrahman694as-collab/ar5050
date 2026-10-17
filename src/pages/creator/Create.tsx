import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Film, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Product } from '../../lib/supabase';
import { AuthModal } from '../../components/AuthModal';
import ReelUploadForm from '../../components/ReelUploadForm';
import UsernameForm from '../../components/UsernameForm';

/** /create — anyone signed in can post a content reel; sellers can also tag one of their products. */
export default function Create() {
  const { user, profile } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [posted, setPosted] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const isSeller = profile?.role === 'seller';

  useEffect(() => {
    if (!user || !isSeller) return;
    setProductsLoading(true);
    supabase
      .from('products')
      .select('*')
      .eq('seller_id', user.id)
      .eq('status', 'approved')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setProducts((data as Product[]) ?? []);
        setProductsLoading(false);
      });
  }, [user, isSeller]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-white">
        <Film className="h-5 w-5 text-primary-400" /> Create
      </h1>
      <p className="mb-5 text-sm text-dark-400">Share a short video with everyone on the feed.</p>

      {!user ? (
        <div className="rounded-2xl border border-dark-700 bg-dark-800 p-6 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-dark-500" />
          <p className="mb-4 text-sm text-dark-300">Sign in to post a reel.</p>
          <button
            onClick={() => setShowAuth(true)}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Sign in / Sign up
          </button>
        </div>
      ) : profile && !profile.is_active ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
          Your account is restricted, so you cannot post right now. Please contact us if you think this is a mistake.
        </div>
      ) : !profile ? (
        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary-500" /></div>
      ) : !profile.username ? (
        <UsernameForm />
      ) : posted ? (
        <div className="rounded-2xl border border-dark-700 bg-dark-800 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary-400" />
          <p className="mb-1 font-medium text-white">Your reel is live</p>
          <p className="mb-5 text-sm text-dark-400">It now shows on the feed and on your profile.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to={`/u/${profile.username}`}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              View my profile
            </Link>
            <button
              onClick={() => { setPosted(false); setFormKey((k) => k + 1); }}
              className="rounded-xl bg-dark-700 px-5 py-2.5 text-sm text-white hover:bg-dark-600"
            >
              Post another
            </button>
          </div>
        </div>
      ) : productsLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary-500" /></div>
      ) : (
        <ReelUploadForm key={formKey} products={products} onDone={() => setPosted(true)} />
      )}

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} title="Sign in to post a reel" />
    </div>
  );
}
