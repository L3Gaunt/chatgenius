export interface FileSearchResult {
  type: 'file';
  id: number;
  name: string;
  fileType: string;
  sharedBy: string;
  sharedAt: string;
}

export interface PersonSearchResult {
  type: 'person';
  id: number;
  name: string;
  status: 'online' | 'offline' | 'away';
  title: string;
} 