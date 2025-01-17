import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { DatabaseProfile } from '@/types/database'

export const supabase = createClientComponentClient<Database>()

export type { DatabaseProfile as Profile } 