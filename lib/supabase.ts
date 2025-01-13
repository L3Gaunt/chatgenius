import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

export const supabase = createClientComponentClient<Database>()

export type Profile = {
  id: string
  username: string
  updated_at: string
  created_at: string
} 