// Post data is loaded from Supabase — see src/app/social-feed/components/SocialFeedScreen.tsx
// This file is kept for backwards compatibility only. Do not add mock data here.

export interface Post {
  id: string;
  content: string;
  title?: string | null;
  image_url?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  community_id?: string | null;
  user_profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
  } | null;
  communities?: {
    name: string;
    slug: string;
  } | null;
}

export const MOCK_POSTS: Post[] = [];