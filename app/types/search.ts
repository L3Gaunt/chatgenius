export interface FileSearchResult {
  id: string;
  name: string;
  fileType: string;
  sharedBy: string;
  sharedAt: string;
}

export interface PersonSearchResult {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'away';
  title: string;
}

import { Message } from "./message";

export interface SearchResults {
  messages: Message[];
  files: FileSearchResult[];
  people: PersonSearchResult[];
} 