export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  audio_url: string;
  created_at?: string;
}

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  caption?: string;
  product_id?: string;
  audio_id?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  audio?: AudioTrack;
}
