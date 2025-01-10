"use client"

import { Button } from "@/components/ui/button"
import { Smile, MessageSquare, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

const emojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀']

interface Attachment {
  id: string;
  name: string;
  url: string;
}

interface Message {
  id: number;
  user: string;
  content: string;
  timestamp: string;
  status: 'online' | 'offline' | 'away';
  reactions: { [key: string]: number };
  replies?: Message[];
  attachments?: Attachment[];
}

interface MessageComponentProps {
  message: Message;
  isReply?: boolean;
  currentUser: string;
  onDelete: (messageId: number) => void;
  onReaction: (messageId: number, emoji: string) => void;
  onReply: (message: Message) => void;
}

export const MessageComponent = ({ 
  message, 
  isReply = false,
  currentUser,
  onDelete,
  onReaction,
  onReply
}: MessageComponentProps) => (
  <div className={`mb-4 ${isReply ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
    <div className="flex items-baseline justify-between">
      <div className="flex items-center">
        <span className="font-bold mr-2">{message.user}</span>
        <div className={`w-2 h-2 rounded-full ${
          message.status === 'online' ? 'bg-green-500' :
          message.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
        }`}></div>
        <span className="text-xs text-gray-500 ml-2">{message.timestamp}</span>
      </div>
      {message.user === currentUser && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this message?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your message.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(message.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
    <p>{message.content}</p>
    {message.attachments && message.attachments.length > 0 && (
      <div className="mt-2 space-y-2">
        {message.attachments.map(attachment => (
          <div key={attachment.id} className="flex items-center bg-gray-100 p-2 rounded-md">
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              {attachment.name}
            </a>
          </div>
        ))}
      </div>
    )}
    <div className="mt-1 flex items-center">
      {Object.entries(message.reactions).map(([emoji, count]) => (
        <span key={emoji} className="mr-2 bg-gray-100 rounded-full px-2 py-1 text-sm">
          {emoji} {count}
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            <Smile size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1">
          <div className="flex">
            {emojis.map(emoji => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                onClick={() => onReaction(message.id, emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="sm" onClick={() => onReply(message)}>
        <MessageSquare size={16} />
      </Button>
    </div>
    {message.replies && message.replies.length > 0 && (
      <div className="mt-2">
        {message.replies.map(reply => (
          <MessageComponent 
            key={reply.id} 
            message={reply} 
            isReply={true}
            currentUser={currentUser}
            onDelete={onDelete}
            onReaction={onReaction}
            onReply={onReply}
          />
        ))}
      </div>
    )}
  </div>
) 