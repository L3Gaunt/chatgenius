export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id: string
          username: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          updated_at?: string
          created_at?: string
        }
      }
      channels: {
        Row: {
          id: string
          name: string
          type: 'public' | 'private' | 'direct'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: 'public' | 'private' | 'direct'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'public' | 'private' | 'direct'
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          channel_id: string
          user_id: string | null
          parent_message_id: string | null
          content: string
          attachments: Json
          timestamp: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          user_id?: string | null
          parent_message_id?: string | null
          content: string
          attachments?: Json
          timestamp?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          user_id?: string | null
          parent_message_id?: string | null
          content?: string
          attachments?: Json
          timestamp?: string
          created_at?: string
          updated_at?: string
        }
      }
      reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      channel_users: {
        Row: {
          id: string
          channel_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          user_id?: string
          created_at?: string
        }
      }
    }
  }
}

export type Profile = {
  id: string
  username: string
  created_at: string
  updated_at: string
} 