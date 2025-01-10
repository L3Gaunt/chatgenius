"use client"
import { Hash, ChevronDown, User, Plus, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { useState } from 'react'

const initialChannels = ['general', 'random', 'announcements']
const directMessages = [
  { name: 'Alice', status: 'online' },
  { name: 'Bob', status: 'offline' },
  { name: 'Charlie', status: 'away' }
]

export function Sidebar() {
  const [channels, setChannels] = useState(initialChannels)

  const handleDeleteChannel = (channel: string) => {
    // Here you would typically call an API to delete the channel
    console.log(`Deleting channel: ${channel}`)
    setChannels(channels.filter(c => c !== channel))
  }

  return (
    <div className="w-64 bg-gray-800 text-white p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-4">Slack Clone</h1>
      
      <div className="mb-4">
        <h2 className="flex items-center justify-between text-sm font-semibold mb-2">
          Channels <ChevronDown size={16} />
        </h2>
        <ul>
          {channels.map((channel) => (
            <li key={channel} className="flex items-center justify-between mb-1 hover:bg-gray-700 p-1 rounded group">
              <div className="flex items-center cursor-pointer">
                <Hash size={16} className="mr-2" /> {channel}
              </div>
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
                onDelete={() => handleDeleteChannel(channel)}
              />
            </li>
          ))}
          <li className="flex items-center mb-1 cursor-pointer hover:bg-gray-700 p-1 rounded text-gray-400">
            <Plus size={16} className="mr-2" /> Add Channel
          </li>
        </ul>
      </div>
      
      <div>
        <h2 className="flex items-center justify-between text-sm font-semibold mb-2">
          Direct Messages <ChevronDown size={16} />
        </h2>
        <ul>
          {directMessages.map((user) => (
            <li key={user.name} className="flex items-center mb-1 cursor-pointer hover:bg-gray-700 p-1 rounded">
              <div className="relative mr-2">
                <User size={16} />
                <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                  user.status === 'online' ? 'bg-green-500' :
                  user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
              </div>
              {user.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

