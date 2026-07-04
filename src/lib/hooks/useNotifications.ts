'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export type NotificationType =
  | 'like' |'reel_like' |'comment' |'reply' |'follow' |'mention' |'community_post' |'community_invite' |'community_announcement' |'group_invite' |'direct_message' |'moderator_action' |'verification_update' |'ai_assistant';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  notification_type: NotificationType;
  type: string;
  entity_id: string | null;
  entity_type: string;
  title: string;
  body: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  actor?: {
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
  } | null;
}

export type FilterType = 'all' | 'likes' | 'comments' | 'follows' | 'mentions' | 'messages' | 'community' | 'system';

const PAGE_SIZE = 20;

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const pageRef = useRef(0);
  const supabase = createClient();

  const getFilterTypes = (f: FilterType): NotificationType[] | null => {
    switch (f) {
      case 'likes': return ['like', 'reel_like'];
      case 'comments': return ['comment', 'reply'];
      case 'follows': return ['follow'];
      case 'mentions': return ['mention'];
      case 'messages': return ['direct_message'];
      case 'community': return ['community_post', 'community_invite', 'community_announcement', 'group_invite'];
      case 'system': return ['moderator_action', 'verification_update', 'ai_assistant'];
      default: return null;
    }
  };

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!userId) return;
    if (reset) {
      setLoading(true);
      pageRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const from = reset ? 0 : pageRef.current * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('notifications')
        .select('*, actor:actor_id(username, display_name, avatar_url, is_verified)')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      const filterTypes = getFilterTypes(filter);
      if (filterTypes) {
        query = query.in('notification_type', filterTypes);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const items = (data || []) as Notification[];

      if (reset) {
        setNotifications(items);
        pageRef.current = 1;
      } else {
        setNotifications(prev => [...prev, ...items]);
        pageRef.current += 1;
      }

      setHasMore(items.length === PAGE_SIZE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, filter]);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications(true);
    fetchUnreadCount();
  }, [userId, filter]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('notifications')
            .select('*, actor:actor_id(username, display_name, avatar_url, is_verified)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            const notif = data as Notification;
            const filterTypes = getFilterTypes(filter);
            const matchesFilter = !filterTypes || filterTypes.includes(notif.notification_type);
            if (matchesFilter) {
              setNotifications(prev => [notif, ...prev]);
            }
            if (!notif.is_read) {
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } as Notification : n)
          );
          // Recount unread
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, filter]);

  const markAsRead = useCallback(async (notifId: string) => {
    const notif = notifications.find(n => n.id === notifId);
    if (!notif || notif.is_read) return;

    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
  }, [userId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchNotifications(false);
    }
  }, [loadingMore, hasMore, fetchNotifications]);

  const retry = useCallback(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    loadingMore,
    error,
    unreadCount,
    hasMore,
    filter,
    setFilter,
    markAsRead,
    markAllRead,
    loadMore,
    retry,
    fetchUnreadCount,
  };
}
