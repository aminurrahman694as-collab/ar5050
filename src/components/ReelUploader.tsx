import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AudioTrack } from '../types';

export const ReelUploader: React.FC<{ onUploadSuccess?: () => void }> = ({ onUploadSuccess }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [audioList, setAudioList] = useState<AudioTrack[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchAudio = async () => {
      const { data, error } = await supabase.from('audio_library').select('*');
      if (!error && data) {
        setAudioList(data);
      }
    };
    fetchAudio();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setMessage('অনুগ্রহ করে একটি ভিডিও নির্বাচন করুন।');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `reels/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(filePath, videoFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('reels')
        .getPublicUrl(filePath);

      const videoUrl = urlData.publicUrl;
      const { data: userData } = await supabase.auth.getUser();
      
      const { error: dbError } = await supabase.from('reels').insert([
        {
          user_id: userData.user?.id,
          video_url: videoUrl,
          caption,
          product_id: productId || null,
          audio_id: selectedAudioId || null,
        },
      ]);

      if (dbError) throw dbError;

      setMessage('ভিডিও সফলভাবে আপলোড হয়েছে! 🎉');
      setVideoFile(null);
      setCaption('');
      setProductId('');
      setSelectedAudioId('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error(err);
      setMessage(`আপলোড ব্যর্থ হয়েছে: ${err.message || 'অজানা সমস্যা'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-xl shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">নতুন রিল আপলোড করুন</h2>
      
      {message && (
        <div className="mb-4 p-2 text-sm text-center rounded bg-blue-50 text-blue-700">
          {message}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ভিডিও ফাইল</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ক্যাপশন</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="ভিডিওর বিবরণ লিখুন..."
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">প্রোডাক্ট আইডি (ঐচ্ছিক)</label>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="উদাহরণ: PRD-102"
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ব্যাকগ্রাউন্ড মিউজিক</label>
          <select
            value={selectedAudioId}
            onChange={(e) => setSelectedAudioId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">মূল ভিডিওর শব্দ ব্যবহার করুন</option>
            {audioList.map((audio) => (
              <option key={audio.id} value={audio.id}>
                🎵 {audio.title} {audio.artist ? `- ${audio.artist}` : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition duration-200 disabled:opacity-50"
        >
          {uploading ? 'আপলোড হচ্ছে...' : 'রিল পোস্ট করুন'}
        </button>
      </form>
    </div>
  );
};
