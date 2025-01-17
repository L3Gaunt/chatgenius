import { Json } from './supabase'

export type DatabaseMessage = {
  id: string;
  content: string;
  channel_id: string;
  user_id: string | null;
  parent_message_id: string | null;
  attachments: Json;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export type DatabaseProfile = {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export type Channel = {
  id: string;
  name: string;
  type: 'public' | 'private' | 'direct';
  created_at: string;
  updated_at: string;
}

export type DatabaseReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
} 