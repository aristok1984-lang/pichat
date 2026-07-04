export interface ChatItem {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isTyping: boolean;
  isGroup: boolean;
  isMuted: boolean;
  pinned: boolean;
  isVerified: boolean;
  isMentioned: boolean;
  hasStory: boolean;
  lastMessageSelf: boolean;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
}

export const MOCK_CHATS: ChatItem[] = [];