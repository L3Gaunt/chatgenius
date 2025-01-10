"use client"

import { useRef, useState } from 'react'
import { Send, X, Paperclip } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileAttachment } from './file-attachment'

interface Message {
  id: number;
  user: string;
  content: string;
  timestamp: string;
  status: 'online' | 'offline' | 'away';
  reactions: { [key: string]: number };
  replies?: Message[];
  attachments?: {
    id: string;
    name: string;
    url: string;
  }[];
}

interface ChatInputProps {
  onSendMessage: (content: string, attachments: File[]) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
}

export function ChatInput({ onSendMessage, replyingTo, onCancelReply }: ChatInputProps) {
  const [newMessage, setNewMessage] = useState<string>('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newMessage.trim() || attachments.length > 0) {
      onSendMessage(newMessage, attachments)
      setNewMessage('')
      setAttachments([])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)])
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_: File, i: number) => i !== index))
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t flex flex-col">
      {replyingTo && (
        <div className="mb-2 p-2 bg-gray-100 rounded flex items-center justify-between">
          <span className="text-sm">
            Replying to <strong>{replyingTo.user}</strong>: {replyingTo.content}
          </span>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault()
              onCancelReply()
            }}
          >
            <X size={16} />
          </Button>
        </div>
      )}
      <div className="flex flex-col space-y-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file: File, index: number) => (
              <FileAttachment key={index} file={file} onRemove={() => handleRemoveAttachment(index)} />
            ))}
          </div>
        )}
        <div className="flex">
          <Input
            type="text"
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 mr-2"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={16} />
          </Button>
          <Button type="submit" className="ml-2">
            <Send size={16} className="mr-2" /> Send
          </Button>
        </div>
      </div>
    </form>
  )
} 