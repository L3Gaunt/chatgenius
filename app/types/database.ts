import { Json, Database } from '../../types/supabase'

export type DatabaseMessage = Database['public']['Tables']['messages']['Row']

export type DatabaseProfile = Database['public']['Tables']['profiles']['Row']

export type Channel = Database['public']['Tables']['channels']['Row']

export type DatabaseReaction = Database['public']['Tables']['reactions']['Row'] 