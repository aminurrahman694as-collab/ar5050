import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ProfileGuardProps {
  children: React.ReactNode;
}

export default function ProfileGuard({ children }: ProfileGuardProps) {
  const [loading, setLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkProfileCompletion();
  }, []);

  async function checkProfileCompletion() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: complete, error } = await supabase.rpc('is_profile_complete', {
        user_id: user.id
      });

      if (error) throw error;
      setIsComplete(!!complete);

      if (!complete) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, avatar_url')
          .eq('id', user.id)
          .single();

        if (profile) {
          setPhone(profile.phone || '');
          setAvatarUrl(profile.avatar_url || '');
        }
      }
    } catch (err) {
      console.error('প্রোফাইল চেক করতে সমস্যা হয়েছে:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const phoneRegex = /^01[3-9][0-9]{8}$/;
      if (!phoneRegex.test(phone)) {
        alert('দয়া করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017xxxxxxxx)।');
        setUpdating(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          phone,
          avatar_url: avatarUrl || 'https://via.placeholder.com/150',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      alert('প্রোফাইল সফলভাবে আপডেট হয়েছে!');
      setIsComplete(true);
    } catch (err: any) {
      alert('ত্রুটি: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">লোড হচ্ছে...</div>;
  }

  if (!isComplete) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-center">প্রোফাইল সম্পন্ন করুন</h2>
        <p className="text-sm text-gray-600 mb-6 text-center">
          এয়ার ট্রেডার্স প্ল্যাটফর্ম ব্যবহার করতে আপনার ফোন নম্বর এবং অ্যাভাটার যুক্ত করা বাধ্যতামূলক।
        </p>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">মোবাইল নম্বর (বাংলাদেশ)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712345678"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">অ্যাভাটার ইমেজ লিংক (URL)</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={updating}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
          >
            {updating ? 'সংরক্ষণ করা হচ্ছে...' : 'প্রোফাইল সেভ করুন'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
