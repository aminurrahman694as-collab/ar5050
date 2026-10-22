import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Reel } from '../types';

export const ReelFeed: React.FC = () => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async () => {
    try {
      setLoading(true);
      // Supabase-এর `reels` টেবিল থেকে ভিডিও এবং `audio_library` থেকে অডিও একসাথে আনা
      const { data, error } = await supabase
        .from('reels')
        .select(`
          *,
          audio:audio_library(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setReels(data as Reel[]);
    } catch (err) {
      console.error('ভিডিও লোড করতে সমস্যা হয়েছে:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black text-white">
        ভিডিও লোড হচ্ছে...
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-black text-white">
        কোনো ভিডিও পাওয়া যায়নি! প্রথমে কয়েকটি ভিডিও আপলোড করুন।
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black">
      {reels.map((reel) => (
        <div
          key={reel.id}
          className="h-screen w-full snap-start relative flex items-center justify-center bg-black"
        >
          {/* ভিডিও প্লেয়ার */}
          <video
            src={reel.video_url}
            className="h-full w-full object-cover"
            controls
            loop
            playsInline
          />

          {/* ভিডিওর ওপর বিবরণ ও পণ্য লিংক */}
          <div className="absolute bottom-6 left-4 right-16 text-white bg-gradient-to-t from-black/80 to-transparent p-4 rounded-xl">
            {reel.caption && (
              <p className="font-semibold text-sm mb-2">{reel.caption}</p>
            )}

            {/* ব্যাকগ্রাউন্ড মিউজিক তথ্য */}
            {reel.audio && (
              <div className="flex items-center text-xs text-gray-300 mb-2">
                <span className="mr-1">🎵</span>
                <span>
                  {reel.audio.title} {reel.audio.artist ? `- ${reel.audio.artist}` : ''}
                </span>
              </div>
            )}

            {/* প্রোডাক্ট কেনার বাটন */}
            {reel.product_id && (
              <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xs px-3 py-1.5 rounded-full flex items-center shadow-lg">
                🛍️ পণ্যটি কিনুন ({reel.product_id})
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
