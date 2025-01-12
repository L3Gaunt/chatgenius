'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'

type PresenceState = {
  userId: string
  email?: string
  timestamp: string
}

export default function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState[]>>({})
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Subscribe to presence channel
    const channel = supabase.channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        setOnlineUsers(state)
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [supabase])

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Online Users</h2>
      <ul className="space-y-1">
        {Object.values(onlineUsers).map((presences) => (
          presences.map((presence) => (
            <li 
              key={presence.userId}
              className="flex items-center space-x-2"
            >
              <span className="w-2 h-2 bg-green-500 rounded-full"/>
              <span>{presence.email || presence.userId}</span>
            </li>
          ))
        ))}
      </ul>
    </div>
  )
} 