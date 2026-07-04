export interface Message {
  id: string;
  text: string;
  time: string;
  isSelf: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

export const MOCK_MESSAGES: Record<string, Message[]> = {};