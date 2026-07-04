'use client';

export interface CommentAuthor {
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  depth: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  user_profiles: CommentAuthor | null;
  // client-side state
  replies?: Comment[];
  isLiked?: boolean;
  isCollapsed?: boolean;
}

export type SortOrder = 'best' | 'new' | 'top';
