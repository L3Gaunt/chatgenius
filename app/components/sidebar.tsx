"use client"
import { useEffect, useState } from 'react'
import { Hash, ChevronDown, User, Plus, Trash2, LogOut } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { supabase } from '@/lib/supabase'
import { Channel, DatabaseProfile } from '@/types/database'
import { useRouter } from 'next/navigation'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SidebarProps {
  onChannelSelect?: (channelId: string) => void;
  onDirectMessageSelect?: (userId: string) => void;
}

export function Sidebar({ onChannelSelect, onDirectMessageSelect }: SidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [directMessages, setDirectMessages] = useState<DatabaseProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const router = useRouter()
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchChannelsAndUsers()

    // ------------------- PRESENCE SETUP -------------------
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user
      if (!currentUser) return

      // 1) Create a channel named 'site-presence'.
      const presenceChannel = supabase.channel('site-presence', {
        config: {
          presence: {
            key: currentUser.id,
          },
        },
      })

      // 2) Listen for presence events.
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState()
          const newOnlineUsers: Record<string, boolean> = {}

          // Flatten presence for each user. The `key` here is user.id
          Object.keys(state).forEach((userId) => {
            if (state[userId].length > 0) {
              newOnlineUsers[userId] = true
            }
          })

          // Log the updated list of active users
          console.log("Active users:", Object.keys(newOnlineUsers))

          setOnlineUsers(newOnlineUsers)
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          setOnlineUsers((prev) => {
            const updated = { ...prev, [key]: true }
            // Log the updated list of active users
            console.log("Active users:", Object.keys(updated))
            return updated
          })
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          // "leave" means a user (or a tab) disconnected.
          const state = presenceChannel.presenceState()
          const existing = state[key] || []
          // If no presences remain for that user, mark them offline
          if (existing.length === 0) {
            setOnlineUsers((prev) => {
              const updated = { ...prev }
              delete updated[key]
              // Log the updated list of active users
              console.log("Active users:", Object.keys(updated))
              return updated
            })
          }
        })

      // 3) Subscribe this browser/tab's presence data.
      presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            username: currentUser.email?.split('@')[0] || 'user',
            joinedAt: new Date().toISOString(),
          })
        }
      })
    })
    // ------------------- END PRESENCE SETUP -------------------

    // Subscribe to channel changes
    const channelSubscription = supabase
      .channel('channel-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        () => {
          fetchChannelsAndUsers()
        }
      )
      .subscribe()

    // Subscribe to profile changes
    const profileSubscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchChannelsAndUsers()
        }
      )
      .subscribe()

    return () => {
      channelSubscription.unsubscribe()
      profileSubscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Select general channel by default
    const selectDefaultChannel = async () => {
      const { data: generalChannel } = await supabase
        .from('channels')
        .select('id')
        .eq('name', 'general')
        .single()

      if (generalChannel) {
        handleChannelSelect(generalChannel.id)
      }
    }

    if (channels.length > 0 && !selectedChannelId) {
      selectDefaultChannel()
    }
  }, [channels, selectedChannelId])

  const fetchChannelsAndUsers = async () => {
    try {
      // Fetch only public channels
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select('*')
        .eq('type', 'public')
        .order('name')

      if (channelsError) throw channelsError

      // Fetch all users except the current user for direct messages
      const { data: { user } } = await supabase.auth.getUser()
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, created_at, updated_at')
        .neq('id', user?.id)
        .order('username')

      if (usersError) throw usersError

      setChannels(channelsData)
      setDirectMessages(usersData)
    } catch (error: any) {
      console.error('Error fetching data:', {
        error,
        details: error.details,
        message: error.message,
        type: 'channels-and-users-query'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateChannel = async () => {
    const channelName = prompt('Enter channel name:')
    if (!channelName) return

    try {
      // Check if channel name already exists
      const { data: existingChannel, error: checkError } = await supabase
        .from('channels')
        .select('id')
        .eq('name', channelName.toLowerCase())
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is what we want
        throw checkError
      }

      if (existingChannel) {
        alert('A channel with this name already exists')
        return
      }

      const { error } = await supabase
        .from('channels')
        .insert([
          { name: channelName.toLowerCase(), type: 'public' }
        ])

      if (error) throw error
    } catch (error: any) {
      console.error('Error creating channel:', {
        error,
        details: error.details,
        message: error.message,
        channelName: channelName.toLowerCase()
      })
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId)

      if (error) throw error

      // If the deleted channel was selected, switch to general
      if (channelId === selectedChannelId) {
        const { data: generalChannel } = await supabase
          .from('channels')
          .select('id')
          .eq('name', 'general')
          .single()

        if (generalChannel) {
          handleChannelSelect(generalChannel.id)
        }
      }
    } catch (error: any) {
      console.error('Error deleting channel:', {
        error: error.toString(),
        details: error.details || 'No details available',
        message: error.message || 'No message available',
        channelId
      })
    }
  }

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId)
    onChannelSelect?.(channelId)
  }

  const handleDirectMessageSelect = async (userId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create a consistent name pattern for DM channels
      const dmChannelName = [user.id, userId].sort().join('_')

      // Check if DM channel already exists between these users
      const { data: existingChannel, error: fetchError } = await supabase
        .from('channels')
        .select('id')
        .eq('type', 'direct')
        .eq('name', dmChannelName)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      let channelId: string

      if (existingChannel) {
        channelId = existingChannel.id
      } else {
        // Create new DM channel
        const { data: newChannel, error: createError } = await supabase
          .from('channels')
          .insert({
            name: dmChannelName,
            type: 'direct'
          })
          .select('id')
          .single()

        if (createError) throw createError
        if (!newChannel) throw new Error('Failed to create DM channel')

        channelId = newChannel.id

        // Add both users to the channel
        const { error: membersError } = await supabase
          .from('channel_users')
          .insert([
            { channel_id: channelId, user_id: user.id },
            { channel_id: channelId, user_id: userId }
          ])

        if (membersError) throw membersError
      }

      setSelectedChannelId(channelId)
      onDirectMessageSelect?.(userId)
    } catch (error: any) {
      console.error('Error handling direct message:', {
        error,
        details: error.details,
        message: error.message,
        userId
      })
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.refresh()
    } catch (error: any) {
      console.error('Error logging out:', {
        error,
        details: error.details,
        message: error.message
      })
    }
  }

  if (loading) {
    return <div className="w-64 bg-gray-800 text-white p-4">Loading...</div>
  }

  return (
    <div className="w-64 bg-gray-800 text-white p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">ChatGenius</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="hover:bg-gray-700"
              >
                <LogOut size={16} className="text-gray-400 hover:text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Logout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="mb-4">
        <h2 className="flex items-center justify-between text-sm font-semibold mb-2">
          Channels <ChevronDown size={16} />
        </h2>
        <ul>
          {channels.map((channel) => (
            <li key={channel.id} className="flex items-center justify-between mb-1 hover:bg-gray-700 p-1 rounded group">
              <div 
                className={`flex items-center cursor-pointer flex-1 ${selectedChannelId === channel.id ? 'text-blue-400' : ''}`}
                onClick={() => handleChannelSelect(channel.id)}
              >
                <Hash size={16} className="mr-2" /> {channel.name}
              </div>
              {channel.type === 'public' && channel.name !== 'general' && (
                <DeleteConfirmationDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden group-hover:flex"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </Button>
                  }
                  title="Are you sure you want to delete this channel?"
                  description="This action cannot be undone. This will permanently delete the channel and all its messages."
                  onDelete={() => handleDeleteChannel(channel.id)}
                />
              )}
            </li>
          ))}
          <li 
            className="flex items-center mb-1 cursor-pointer hover:bg-gray-700 p-1 rounded text-gray-400"
            onClick={handleCreateChannel}
          >
            <Plus size={16} className="mr-2" /> Add Channel
          </li>
        </ul>
      </div>

      <div className="flex-1">
        <h2 className="flex items-center justify-between text-sm font-semibold mb-2">
          Direct Messages <ChevronDown size={16} />
        </h2>
        <ul>
          {directMessages.map((user) => {
            // Check if user is online
            const isOnline = !!onlineUsers[user.id];

            return (
              <li
                key={user.id}
                className="flex items-center mb-1 cursor-pointer hover:bg-gray-700 p-1 rounded"
                onClick={() => handleDirectMessageSelect(user.id)}
              >
                <div className="relative mr-2">
                  <User size={16} />
                  <div
                    className={`
                      absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full
                      ${isOnline ? "bg-green-500" : "bg-gray-500"}
                    `}
                  />
                </div>
                {user.username}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  )
}

