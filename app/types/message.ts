import { DatabaseProfile } from './database'
import { Json } from './supabase'

export interface Message {
  id: string;
  content: string;
  channel_id: string;
  user_id: string | null;
  parent_message_id: string | null;
  attachments: { id: string; name: string; url: string; }[];
  created_at: string;
  updated_at: string;
  user: DatabaseProfile;
  reactions: {
    emoji: string;
    count: number;
    users?: string[];
  }[];
  replies?: Message[];
}

export function transformDatabaseMessage(message: DatabaseMessage & { user: DatabaseProfile }): Message {
  return {
    ...message,
    attachments: (message.attachments as any[] || []).map(attachment => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url
    })),
    reactions: [],
    replies: []
  }
} 