'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const redirectToGeneralChannel = async () => {
      // Find the general channel ID
      const { data: channels, error } = await supabase
        .from('channels')
        .select('id')
        .eq('name', 'general')
        .single()

      if (error || !channels) {
        // If general channel doesn't exist, create it
        const { data: newChannel, error: createError } = await supabase
          .from('channels')
          .insert([
            { name: 'general', type: 'public' }
          ])
          .select('id')
          .single()

        if (!createError && newChannel) {
          router.push(`/channels/${newChannel.id}`)
        }
      } else {
        router.push(`/channels/${channels.id}`)
      }
    }

    redirectToGeneralChannel()
  }, [router])

  return null
}

