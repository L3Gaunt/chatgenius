export interface DatabaseMessage {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  parent_message_id?: string;
  attachments?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseProfile {
  id: string;
  username: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message extends DatabaseMessage {
  user: DatabaseProfile;
  reactions: {
    emoji: string;
    count: number;
    users?: string[];
  }[];
  replies?: Message[];
} 