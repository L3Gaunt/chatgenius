'use client'

import './globals.css'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const presenceChannelRef = useRef<any>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        if (session?.user) {
          supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              username: session.user.email?.split('@')[0] || 'user'
            })
            .then(({ error }) => {
              if (error) console.error('Error updating profile:', error)
            })
        }
      }
      router.refresh()
    })

    presenceChannelRef.current = supabase.channel('online-users', {
      config: {
        presence: {
          key: 'userId'
        }
      }
    })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Join:', newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Leave:', leftPresences)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current?.presenceState()
        console.log('Current online users:', state)
      })
      .subscribe()

    // Track current user's presence when signed in
    const trackPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await presenceChannelRef.current?.track({
          userId: session.user.id,
          email: session.user.email,
          timestamp: new Date().toISOString()
        })
      }
    }
    
    trackPresence()

    return () => {
      subscription.unsubscribe()
      presenceChannelRef.current?.untrack()
      presenceChannelRef.current?.unsubscribe()
    }
  }, [supabase, router])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

