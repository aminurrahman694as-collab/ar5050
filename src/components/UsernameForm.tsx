import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

/** Same rule as the database CHECK in migration 022. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Asks a signed-in user to pick their public @username (needed before the first post). */
export default function UsernameForm({ onSaved }: { onSaved?: () => void }) {
  const { user, refreshProfile } = useAuth();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = USERNAME_RE.test(value);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !valid || saving) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('profiles').update({ username: value }).eq('id', user.id);
    if (err) {
      if (err.code === '23505') setError('That username is already taken. Try another one.');
      else if (/reserved/i.test(err.message)) setError('That username is reserved. Please choose another one.');
      else setError('Could not save the username. Please try again.');
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
    onSaved?.();
  };

  return (
    <form onSubmit={save} className="bg-dark-800 border border-dark-700 rounded-2xl p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-white font-medium">Choose your username</h2>
        <p className="mt-1 text-sm text-dark-400">
          This is the name shown on your reels and in your profile link. Letters, numbers and underscore, 3–20 characters.
        </p>
      </div>

      <div className="flex items-center rounded-lg border border-dark-600 bg-dark-700 focus-within:ring-2 focus-within:ring-primary-500">
        <span className="pl-3 text-dark-400">@</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          placeholder="your_name"
          className="w-full bg-transparent px-2 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none"
        />
      </div>
      {value.length > 0 && !valid && <p className="text-xs text-dark-400">At least 3 characters.</p>}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={!valid || saving}
        className="flex w-full items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save username
      </button>
    </form>
  );
}
