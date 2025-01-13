"use client"

import { useState, useRef, useEffect } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { SearchBox } from './search-box'
import { MessageComponent } from './message-component'
import { ChatInput } from './chat-input'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/supabase'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { User, Hash } from 'lucide-react'
import { Message } from "../types/message";

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
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

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

      // If we have a userId, find the DM channel
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

      // Fetch channel details
      const { data: channelData, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', targetChannelId)
        .single()

      if (error) {
        console.error('Error fetching channel:', error)
        return
      }

      setChannel(channelData)

      // Fetch messages for this channel
      const { data: messagesData, error: messagesError } = await supabase
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

      if (messagesError) {
        console.error('Error fetching messages:', messagesError)
        return
      }

      // Process messages to include reactions counts
      const processedMessages = messagesData?.map((message: any) => {
        const messageReactions = message.reactions || [];
        const reactionsByEmoji = messageReactions.reduce((acc: { [key: string]: { count: number, users: string[] } }, reaction: DatabaseReaction) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = { count: 0, users: [] };
          }
          acc[reaction.emoji].count += 1;
          acc[reaction.emoji].users.push(reaction.user_id);
          return acc;
        }, {});

        const formattedReactions = Object.entries(reactionsByEmoji).map(([emoji, data]) => ({
          emoji,
          count: (data as { count: number, users: string[] }).count,
          users: (data as { count: number, users: string[] }).users
        }));

        const processedReplies = message.replies?.map((reply: any) => {
          const replyReactionsByEmoji = (reply.reactions || []).reduce((acc: { [key: string]: { count: number, users: string[] } }, reaction: DatabaseReaction) => {
            if (!acc[reaction.emoji]) {
              acc[reaction.emoji] = { count: 0, users: [] };
            }
            acc[reaction.emoji].count += 1;
            acc[reaction.emoji].users.push(reaction.user_id);
            return acc;
          }, {});

          const formattedReplyReactions = Object.entries(replyReactionsByEmoji).map(([emoji, data]) => ({
            emoji,
            count: (data as { count: number, users: string[] }).count,
            users: (data as { count: number, users: string[] }).users
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

      setMessages(processedMessages)
      setLoading(false)
      scrollToBottom()
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

            const messageData = payload.new as MessageRow
            if (!messageData || !messageData.user_id) {
              console.log('No valid message data in payload')
              return
            }

            // For INSERT and UPDATE events
            const { data: userData, error: userError } = await supabase
              .from('profiles')
              .select('id, username, created_at, updated_at')
              .eq('id', messageData.user_id)
              .single()

            if (userError) {
              console.error('Error fetching user data:', userError)
              return
            }

            if (userData) {
              const newMessage: Message = {
                id: messageData.id,
                channel_id: messageData.channel_id,
                user_id: messageData.user_id,
                parent_message_id: messageData.parent_message_id,
                content: messageData.content,
                attachments: messageData.attachments || [],
                timestamp: messageData.timestamp,
                created_at: messageData.created_at,
                updated_at: messageData.updated_at,
                user: userData,
                reactions: [],
                replies: []
              }

              if (payload.eventType === 'INSERT') {
                console.log('Inserting new message:', newMessage)
                setMessages(prev => {
                  // If this is a reply (has parent_message_id), add it to the parent's replies
                  if (newMessage.parent_message_id) {
                    return prev.map(msg => {
                      if (msg.id === newMessage.parent_message_id) {
                        return {
                          ...msg,
                          replies: [...(msg.replies || []), newMessage]
                        }
                      }
                      return msg
                    })
                  }
                  // If it's a top-level message, add it to the messages array
                  return [...prev, newMessage]
                })
              } else if (payload.eventType === 'UPDATE') {
                console.log('Updating message:', newMessage)
                setMessages(prev => prev.map(msg => {
                  // If this is the message being updated
                  if (msg.id === newMessage.id) {
                    return newMessage
                  }
                  // If this message has the updated message as a reply
                  if (msg.replies?.some(reply => reply.id === newMessage.id)) {
                    return {
                      ...msg,
                      replies: msg.replies.map(reply => 
                        reply.id === newMessage.id ? newMessage : reply
                      )
                    }
                  }
                  return msg
                }))
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
              messageId = (payload.old as ReactionRow)?.message_id
            } else {
              messageId = (payload.new as ReactionRow)?.message_id
            }

            if (!messageId) {
              console.log('No message ID found in payload')
              return
            }

            console.log('Fetching updated reactions for message:', messageId)
            // Fetch updated reactions for the message
            const { data: reactionsData, error: reactionsError } = await supabase
              .from('reactions')
              .select('emoji, user_id')
              .eq('message_id', messageId)

            if (reactionsError) {
              console.error('Error fetching reactions:', reactionsError)
              return
            }

            console.log('Received reactions data:', reactionsData)
            // Update the message with new reactions
            setMessages(prev => {
              const updated = prev.map(message => {
                // Check if this is the message that got the reaction
                if (message.id === messageId) {
                  const reactionsByEmoji = (reactionsData || []).reduce((acc: { [key: string]: { count: number, users: string[] } }, reaction: { emoji: string, user_id: string }) => {
                    if (!acc[reaction.emoji]) {
                      acc[reaction.emoji] = { count: 0, users: [] };
                    }
                    acc[reaction.emoji].count += 1;
                    acc[reaction.emoji].users.push(reaction.user_id);
                    return acc;
                  }, {});

                  const formattedReactions = Object.entries(reactionsByEmoji).map(([emoji, data]) => ({
                    emoji,
                    count: data.count,
                    users: data.users
                  }));

                  return {
                    ...message,
                    reactions: formattedReactions
                  }
                }

                // Check if the reaction is for a reply
                if (message.replies?.some(reply => reply.id === messageId)) {
                  return {
                    ...message,
                    replies: message.replies.map(reply => {
                      if (reply.id === messageId) {
                        const reactionsByEmoji = (reactionsData || []).reduce((acc: { [key: string]: { count: number, users: string[] } }, reaction: { emoji: string, user_id: string }) => {
                          if (!acc[reaction.emoji]) {
                            acc[reaction.emoji] = { count: 0, users: [] };
                          }
                          acc[reaction.emoji].count += 1;
                          acc[reaction.emoji].users.push(reaction.user_id);
                          return acc;
                        }, {});

                        const formattedReactions = Object.entries(reactionsByEmoji).map(([emoji, data]) => ({
                          emoji,
                          count: data.count,
                          users: data.users
                        }));

                        return {
                          ...reply,
                          reactions: formattedReactions
                        }
                      }
                      return reply
                    })
                  }
                }

                return message
              })
              console.log('Updated messages state:', updated)
              return updated
            })
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
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .single()

      if (error) throw error

      // Clear the replyingTo state after sending
      setReplyingTo(null)

    } catch (error) {
      console.error('Error sending message:', error)
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
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (error) {
      console.error('Error deleting message:', {
        error,
        details: error.details,
        message: error.message,
        messageId
      })
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
        <SearchBox onSearch={handleSearch} />
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {filteredMessages.map((message) => (
          <MessageComponent 
            key={message.id} 
            message={message}
            currentUserId={currentUserId}
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

