'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './components/sidebar'
import { ChatArea } from './components/chat-area'

export default function Home() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    const selectGeneralChannel = async () => {
      const { data: generalChannel } = await supabase
        .from('channels')
        .select('id')
        .eq('name', 'general')
        .single()

      if (generalChannel) {
        setSelectedChannelId(generalChannel.id)
      }
    }

    selectGeneralChannel()
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
    <main className="flex h-screen overflow-hidden">
      <Sidebar 
        onChannelSelect={handleChannelSelect}
        onDirectMessageSelect={handleDirectMessageSelect}
      />
      <ChatArea 
        channelId={selectedChannelId || undefined}
        userId={selectedUserId || undefined}
        onDirectMessageSelect={handleDirectMessageSelect}
      />
    </main>
  )
}

