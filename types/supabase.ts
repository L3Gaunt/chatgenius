export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          status: 'online' | 'offline' | 'away'
          updated_at: string
          created_at: string
        }
        Insert: {
          id: string
          username: string
          status?: 'online' | 'offline' | 'away'
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          status?: 'online' | 'offline' | 'away'
          updated_at?: string
          created_at?: string
        }
      }
    }
  }
} 