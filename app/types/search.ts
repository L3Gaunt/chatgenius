export interface FileSearchResult {
  id: string;
  name: string;
  fileType: string;
  sharedBy: string;
  sharedAt: string;
  filePath: string;
}

export interface PersonSearchResult {
  id: string;
  name: string;
  fullName: string;
  avatarUrl: string | null;
  status: 'online' | 'offline' | 'away';
  title: string;
  lastSeenAt: string | null;
}

import { Message } from "./message";

export interface SearchResults {
  messages: Message[];
  files: FileSearchResult[];
  people: PersonSearchResult[];
} 