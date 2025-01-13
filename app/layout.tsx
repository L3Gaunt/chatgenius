'use client'

import './globals.css'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClientComponentClient()
  const router = useRouter()

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

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

