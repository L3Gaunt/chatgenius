"use client"

import { useState, useRef, useEffect } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { SearchBox } from './search-box'
import { MessageComponent } from './message-component'
import { ChatInput } from './chat-input'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { Database } from '@/types/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

type DatabaseMessage = Database['public']['Tables']['messages']['Row']
type DatabaseProfile = Database['public']['Tables']['profiles']['Row']
type Channel = Database['public']['Tables']['channels']['Row']

interface Message extends DatabaseMessage {
  user: DatabaseProfile;
  reactions: {
    emoji: string;
    count: number;
  }[];
  replies?: Message[];
}

export function ChatArea() {
  const params = useParams()
  const channelId = params.channelId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [channel, setChannel] = useState<Channel | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch channel details
    const fetchChannel = async () => {
      const { data: channelData, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single()

      if (error) {
        console.error('Error fetching channel:', error)
        return
      }

      setChannel(channelData)
    }

    fetchChannel()
  }, [channelId])

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:user_id (
            id,
            username,
            status,
            updated_at,
            created_at
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
        return
      }

      // Fetch reactions for each message
      const messagesWithReactions = await Promise.all(
        messagesData.map(async (message) => {
          const { data: reactions } = await supabase
            .from('reactions')
            .select('emoji')
            .eq('message_id', message.id)

          const reactionCounts = reactions?.reduce((acc, { emoji }) => {
            acc[emoji] = (acc[emoji] || 0) + 1
            return acc
          }, {} as Record<string, number>) || {}

          return {
            ...message,
            reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({
              emoji,
              count
            }))
          } as Message
        })
      )

      setMessages(messagesWithReactions)
    }

    fetchMessages()

    // Subscribe to new messages
    const channel: RealtimeChannel = supabase.channel(`messages:${channelId}`)

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('id, username, status, updated_at, created_at')
            .eq('id', payload.new.user_id)
            .single()

          if (userData) {
            const newMessage: Message = {
              ...payload.new as DatabaseMessage,
              user: userData,
              reactions: [],
              replies: []
            }

            setMessages(prev => [...prev, newMessage])
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [channelId])

  const handleSendMessage = async (content: string, attachments: File[]) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    // Upload attachments if any
    const uploadedAttachments = await Promise.all(
      attachments.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${channelId}/${fileName}`

        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(filePath, file)

        if (error) {
          console.error('Error uploading file:', error)
          return null
        }

        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath)

        return {
          id: fileName,
          name: file.name,
          url: publicUrl
        }
      })
    )

    // Insert message
    const { error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: userData.user.id,
        content,
        parent_message_id: replyingTo?.id || null,
        attachments: uploadedAttachments.filter(Boolean)
      })

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    setReplyingTo(null)
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { error } = await supabase
      .from('reactions')
      .insert({
        message_id: messageId,
        user_id: userData.user.id,
        emoji
      })

    if (error) {
      console.error('Error adding reaction:', error)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (error) {
      console.error('Error deleting message:', error)
    }
  }

  const filteredMessages = messages.filter(message => 
    message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (message.replies && message.replies.some(reply => 
      reply.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.user.username.toLowerCase().includes(searchQuery.toLowerCase())
    ))
  )

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold mr-4">
            # {channel?.name || 'Loading...'}
          </h2>
        </div>
        <SearchBox onSearch={handleSearch} />
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {filteredMessages.map((message) => (
          <MessageComponent 
            key={message.id} 
            message={message}
            onDelete={handleDeleteMessage}
            onReaction={handleReaction}
            onReply={setReplyingTo}
          />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <ChatInput 
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  )
}

