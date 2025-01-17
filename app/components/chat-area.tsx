"use client"

import { useState, useRef, useEffect } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { SearchBox } from './search-box'
import { MessageComponent } from './message-component'
import { ChatInput } from './chat-input'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/supabase'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { User, Hash, X } from 'lucide-react'
import { Message, transformDatabaseMessage } from "../types/message"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import { SearchResults } from './search-results'

type DatabaseMessage = Database['public']['Tables']['messages']['Row']
type DatabaseProfile = Database['public']['Tables']['profiles']['Row']
type Channel = Database['public']['Tables']['channels']['Row']
type DatabaseReaction = Database['public']['Tables']['reactions']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']
type ReactionRow = Database['public']['Tables']['reactions']['Row']

interface ChatAreaProps {
  channelId?: string;
  userId?: string;
}

export function ChatArea({ channelId, userId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [channel, setChannel] = useState<Channel | null>(null)
  const [dmUser, setDmUser] = useState<DatabaseProfile | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Add effect to get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (!channelId && !userId) return

    setLoading(true)
    setMessages([])
    
    const fetchChannelAndMessages = async () => {
      try {
        // If we have a userId, fetch the user's profile
        if (userId) {
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

          if (userError) {
            console.error('Error fetching user:', userError)
          } else {
            setDmUser(userData)
          }
        } else {
          setDmUser(null)
        }

        let targetChannelId = channelId

        // If we have a userId, find or create the DM channel
        if (userId) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Create a consistent name pattern for DM channels
          const dmChannelName = [user.id, userId].sort().join('_')

          const { data: dmChannel } = await supabase
            .from('channels')
            .select('id')
            .eq('type', 'direct')
            .eq('name', dmChannelName)
            .single()

          if (dmChannel) {
            targetChannelId = dmChannel.id
          }
        }

        if (!targetChannelId) return

        // Fetch channel details and messages in parallel
        const [channelResponse, messagesResponse] = await Promise.all([
          supabase
            .from('channels')
            .select('*')
            .eq('id', targetChannelId)
            .single(),
          
          supabase
            .from('messages')
            .select(`
              *,
              user:profiles(
                id,
                username,
                created_at,
                updated_at
              ),
              reactions(emoji, user_id),
              replies:messages!parent_message_id(
                *,
                user:profiles(
                  id,
                  username,
                  created_at,
                  updated_at
                ),
                reactions(emoji, user_id)
              )
            `)
            .eq('channel_id', targetChannelId)
            .is('parent_message_id', null)
            .order('created_at', { ascending: true })
        ])

        const { data: channelData, error: channelError } = channelResponse
        const { data: messagesData, error: messagesError } = messagesResponse

        if (channelError) {
          console.error('Error fetching channel:', channelError)
          return
        }

        if (messagesError) {
          console.error('Error fetching messages:', messagesError)
          return
        }

        setChannel(channelData)

        // Transform messages to include properly formatted reactions
        const transformedMessages = messagesData?.map((message: any) => {
          // Process reactions
          const reactionsByEmoji = (message.reactions || []).reduce((acc: any, reaction: any) => {
            if (!acc[reaction.emoji]) {
              acc[reaction.emoji] = { count: 0, users: [] };
            }
            acc[reaction.emoji].count += 1;
            acc[reaction.emoji].users.push(reaction.user_id);
            return acc;
          }, {});

          const formattedReactions = Object.entries(reactionsByEmoji).map(([emoji, data]: [string, any]) => ({
            emoji,
            count: data.count,
            users: data.users
          }));

          // Process replies if they exist
          const processedReplies = message.replies?.map((reply: any) => {
            const replyReactionsByEmoji = (reply.reactions || []).reduce((acc: any, reaction: any) => {
              if (!acc[reaction.emoji]) {
                acc[reaction.emoji] = { count: 0, users: [] };
              }
              acc[reaction.emoji].count += 1;
              acc[reaction.emoji].users.push(reaction.user_id);
              return acc;
            }, {});

            const formattedReplyReactions = Object.entries(replyReactionsByEmoji).map(([emoji, data]: [string, any]) => ({
              emoji,
              count: data.count,
              users: data.users
            }));

            return {
              ...reply,
              reactions: formattedReplyReactions
            };
          });

          return {
            ...message,
            reactions: formattedReactions,
            replies: processedReplies || []
          };
        }) || [];

        setMessages(transformedMessages)
        setLoading(false)
        scrollToBottom()
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchChannelAndMessages()

    // Set up realtime subscriptions for the channel
    let realtimeChannel: RealtimeChannel | null = null

    const setupRealtimeSubscription = async () => {
      let targetChannelId = channelId

      // If this is a DM, get the correct channel ID
      if (userId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const dmChannelName = [user.id, userId].sort().join('_')
        const { data: dmChannel } = await supabase
          .from('channels')
          .select('id')
          .eq('type', 'direct')
          .eq('name', dmChannelName)
          .single()

        if (dmChannel) {
          targetChannelId = dmChannel.id
        }
      }

      if (!targetChannelId) return

      realtimeChannel = supabase.channel(`messages:${targetChannelId}`)

      realtimeChannel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${targetChannelId}`
          },
          async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            console.log('Message event received:', payload.eventType, payload)

            if (payload.eventType === 'DELETE' && payload.old?.id) {
              console.log('Deleting message:', payload.old.id)
              setMessages(prev => {
                // Check if it's a top-level message
                const isTopLevel = prev.some(msg => msg.id === payload.old?.id)
                if (isTopLevel) {
                  return prev.filter(msg => msg.id !== payload.old?.id)
                }

                // If it's a reply, find the parent message and remove the reply
                return prev.map(msg => {
                  if (msg.replies?.some(reply => reply.id === payload.old?.id)) {
                    return {
                      ...msg,
                      replies: msg.replies.filter(reply => reply.id !== payload.old?.id)
                    }
                  }
                  return msg
                })
              })
              return
            }

            // For INSERT and UPDATE events, fetch the complete message data
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const { data: messageData, error: messageError } = await supabase
                .from('messages')
                .select(`
                  *,
                  user:profiles(
                    id,
                    username,
                    created_at,
                    updated_at
                  ),
                  reactions(emoji, user_id),
                  replies:messages!parent_message_id(
                    *,
                    user:profiles(
                      id,
                      username,
                      created_at,
                      updated_at
                    ),
                    reactions(emoji, user_id)
                  )
                `)
                .eq('id', payload.new.id)
                .single()

              if (messageError) {
                console.error('Error fetching message data:', messageError)
                return
              }

              if (messageData) {
                // Transform the message data
                const transformedMessage = {
                  ...messageData,
                  reactions: processReactions(messageData.reactions || []),
                  replies: messageData.replies?.map((reply: any) => ({
                    ...reply,
                    reactions: processReactions(reply.reactions || [])
                  })) || []
                }

                setMessages(prev => {
                  if (payload.eventType === 'INSERT') {
                    if (transformedMessage.parent_message_id) {
                      // Add reply to parent message
                      return prev.map(msg => {
                        if (msg.id === transformedMessage.parent_message_id) {
                          return {
                            ...msg,
                            replies: [...(msg.replies || []), transformedMessage]
                          }
                        }
                        return msg
                      })
                    }
                    // Add new top-level message
                    return [...prev, transformedMessage]
                  } else {
                    // Update existing message
                    return prev.map(msg => {
                      if (msg.id === transformedMessage.id) {
                        return transformedMessage
                      }
                      if (msg.replies?.some(reply => reply.id === transformedMessage.id)) {
                        return {
                          ...msg,
                          replies: msg.replies.map(reply =>
                            reply.id === transformedMessage.id ? transformedMessage : reply
                          )
                        }
                      }
                      return msg
                    })
                  }
                })
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reactions'
          },
          async (payload: RealtimePostgresChangesPayload<ReactionRow>) => {
            console.log('Reaction event received:', payload.eventType, payload)
            
            let messageId: string | undefined
            if (payload.eventType === 'DELETE') {
              messageId = payload.old?.message_id
            } else {
              messageId = payload.new?.message_id
            }

            if (!messageId) {
              console.log('No message ID found in payload')
              return
            }

            // Fetch the complete message data with reactions
            const { data: messageData, error: messageError } = await supabase
              .from('messages')
              .select(`
                *,
                user:profiles(
                  id,
                  username,
                  created_at,
                  updated_at
                ),
                reactions(emoji, user_id),
                replies:messages!parent_message_id(
                  *,
                  user:profiles(
                    id,
                    username,
                    created_at,
                    updated_at
                  ),
                  reactions(emoji, user_id)
                )
              `)
              .eq('id', messageId)
              .single()

            if (messageError) {
              console.error('Error fetching message data:', messageError)
              return
            }

            if (messageData) {
              // Transform the message data
              const transformedMessage = {
                ...messageData,
                reactions: processReactions(messageData.reactions || []),
                replies: messageData.replies?.map((reply: any) => ({
                  ...reply,
                  reactions: processReactions(reply.reactions || [])
                })) || []
              }

              setMessages(prev => prev.map(msg => {
                if (msg.id === messageId) {
                  return transformedMessage
                }
                if (msg.replies?.some(reply => reply.id === messageId)) {
                  return {
                    ...msg,
                    replies: msg.replies.map(reply =>
                      reply.id === messageId ? transformedMessage : reply
                    )
                  }
                }
                return msg
              }))
            }
          }
        )
        .subscribe()
    }

    setupRealtimeSubscription()

    return () => {
      if (realtimeChannel) {
        realtimeChannel.unsubscribe()
      }
    }
  }, [channelId, userId])

  // Helper function to process reactions
  const processReactions = (reactions: any[]) => {
    const reactionsByEmoji = reactions.reduce((acc: any, reaction: any) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = { count: 0, users: [] };
      }
      acc[reaction.emoji].count += 1;
      acc[reaction.emoji].users.push(reaction.user_id);
      return acc;
    }, {});

    return Object.entries(reactionsByEmoji).map(([emoji, data]: [string, any]) => ({
      emoji,
      count: data.count,
      users: data.users
    }));
  }

  const handleSendMessage = async (content: string, attachments: File[]) => {
    if (!currentUserId) return

    try {
      let targetChannelId = channelId

      // If this is a DM, get the correct channel ID
      if (userId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const dmChannelName = [user.id, userId].sort().join('_')
        const { data: dmChannel } = await supabase
          .from('channels')
          .select('id')
          .eq('type', 'direct')
          .eq('name', dmChannelName)
          .single()

        if (!dmChannel) {
          console.error('DM channel not found')
          return
        }

        targetChannelId = dmChannel.id
      }

      if (!targetChannelId) return

      // Create the message object
      const messageData = {
        channel_id: targetChannelId,
        user_id: currentUserId,
        content,
        parent_message_id: replyingTo?.id || null,
        attachments: [] as { id: string; name: string; url: string; }[]
      }

      // Handle file uploads if any
      if (attachments.length > 0) {
        const uploadedAttachments = await Promise.all(
          attachments.map(async (file) => {
            const fileName = `${Date.now()}-${file.name}`
            const { data, error } = await supabase.storage
              .from('attachments')
              .upload(`${targetChannelId}/${fileName}`, file)

            if (error) throw error

            const { data: { publicUrl } } = supabase.storage
              .from('attachments')
              .getPublicUrl(`${targetChannelId}/${fileName}`)

            return {
              id: data.path,
              name: file.name,
              url: publicUrl
            }
          })
        )

        messageData.attachments = uploadedAttachments
      }

      // Insert the message
      const { data: message, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          user:profiles(
            id,
            username,
            created_at,
            updated_at
          )
        `)
        .single()

      if (error) throw error

      // Clear the replyingTo state after sending
      setReplyingTo(null)

      // Return the message ID
      return message.id

    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { error } = await supabase
      .rpc('toggle_reaction', {
        message_id_param: messageId,
        user_id_param: userData.user.id,
        emoji_param: emoji
      })

    if (error) {
      console.error('Error toggling reaction:', {
        error,
        details: error.details,
        message: error.message,
        messageId,
        emoji
      })
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message. Please try again.')
    }
  }

  const handleSearch = (searchMessages: Message[]) => {
    setSearchResults(searchMessages)
    setIsSearchOpen(true)
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

  const handleReply = (message: Message) => {
    setReplyingTo(message)
  }

  if (!channelId && !userId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a channel or user to start chatting
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold mr-4">
            {userId ? (
              <span className="flex items-center">
                <User size={20} className="mr-2" />
                {dmUser?.username || 'Loading...'}
              </span>
            ) : (
              <span className="flex items-center">
                <Hash size={20} className="mr-2" />
                {channel?.name || 'Loading...'}
              </span>
            )}
          </h2>
        </div>
        <SearchBox 
          onSearch={handleSearch}
          onFocus={() => setIsSearchOpen(true)}
        />
      </div>
      <div className="flex-1 flex overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          {messages.map((message) => (
            <MessageComponent 
              key={message.id} 
              message={message}
              currentUserId={currentUserId}
              onDelete={handleDeleteMessage}
              onReaction={handleReaction}
              onReply={handleReply}
            />
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        {isSearchOpen && (
          <SearchResults 
            results={searchResults.map(msg => ({
              type: 'message',
              id: parseInt(msg.id),
              user: msg.user?.username || 'Unknown',
              content: msg.content,
              timestamp: new Date(msg.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            }))}
            isOpen={isSearchOpen}
            onClose={() => {
              setIsSearchOpen(false)
              setSearchResults([])
            }}
          />
        )}
      </div>
      <ChatInput 
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  )
}

