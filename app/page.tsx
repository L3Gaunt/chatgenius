'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './components/sidebar'
import { ChatArea } from './components/chat-area'

export default function Home() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    const ensureGeneralChannel = async () => {
      // Find the general channel ID
      const { data: channels, error } = await supabase
        .from('channels')
        .select('id')
        .eq('name', 'general')
        .single()

      if (error || !channels) {
        // If general channel doesn't exist, create it
        const { data: newChannel } = await supabase
          .from('channels')
          .insert([
            { name: 'general', type: 'public' }
          ])
          .select('id')
          .single()

        if (newChannel) {
          setSelectedChannelId(newChannel.id)
        }
      } else {
        setSelectedChannelId(channels.id)
      }
    }

    ensureGeneralChannel()
  }, [])

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId)
    setSelectedUserId(null)
  }

  const handleDirectMessageSelect = (userId: string) => {
    setSelectedUserId(userId)
    setSelectedChannelId(null)
  }

  return (
    <main className="flex h-screen">
      <Sidebar 
        onChannelSelect={handleChannelSelect}
        onDirectMessageSelect={handleDirectMessageSelect}
      />
      <ChatArea 
        channelId={selectedChannelId || undefined}
        userId={selectedUserId || undefined}
      />
    </main>
  )
}

