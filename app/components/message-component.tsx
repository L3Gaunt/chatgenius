"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Smile, MessageSquare, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog"
import { Message } from '../types/message'

const emojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀']

interface MessageComponentProps {
  message: Message;
  isReply?: boolean;
  currentUserId: string;
  onDelete: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
}

interface Reaction {
  emoji: string;
  count: number;
  users?: string[];
}

export const MessageComponent = ({ 
  message, 
  isReply = false,
  currentUserId,
  onDelete,
  onReaction,
  onReply
}: MessageComponentProps) => {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false)
  const canDelete = message.user_id === currentUserId
  
  return (
    <div className={`mb-4 ${isReply ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center">
          <span className="font-bold mr-2">{message.user.username}</span>
          <span className="text-xs text-gray-500 ml-2">
            {new Date(message.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        {canDelete && (
          <DeleteConfirmationDialog
            trigger={
              <Button variant="ghost" size="sm">
                <Trash2 size={16} className="text-red-500" />
              </Button>
            }
            title="Are you sure you want to delete this message?"
            description="This action cannot be undone. This will permanently delete your message."
            onDelete={() => onDelete(message.id)}
          />
        )}
      </div>
      <p>{message.content}</p>
      {(message.attachments || []).length > 0 && (
        <div className="mt-2 space-y-2">
          {(message.attachments || []).map((attachment) => (
            <div key={attachment.id} className="flex items-center bg-gray-100 p-2 rounded-md">
              <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                {attachment.name}
              </a>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 flex items-center space-x-2">
        {(message.reactions || []).map(({ emoji, count, users = [] }: Reaction) => {
          const hasReacted = users.includes(currentUserId)
          return (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className={`mr-2 rounded-full px-2 py-1 text-sm transition-all ${
                hasReacted 
                  ? 'bg-blue-100 hover:bg-blue-200 border-2 border-blue-400 shadow-sm' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => onReaction(message.id, emoji)}
            >
              {emoji} {count}
            </Button>
          )
        })}
        <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Smile size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1">
            <div className="flex gap-1">
              {emojis.map(emoji => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onReaction(message.id, emoji)
                    setIsEmojiPickerOpen(false)
                  }}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {!isReply && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(message)}
          >
            <MessageSquare size={16} />
          </Button>
        )}
      </div>
      {message.replies && message.replies.length > 0 && (
        <div className="mt-2">
          {message.replies.map((reply: Message) => (
            <MessageComponent
              key={reply.id}
              message={reply}
              isReply={true}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onReaction={onReaction}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}