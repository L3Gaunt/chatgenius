"use client"

import { useRef, useState } from 'react'
import { Send, X, Paperclip } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileAttachment } from './file-attachment'
import { DatabaseMessage, DatabaseProfile } from '@/types/database'
import { Message } from "@/types/message"
import { toast } from 'sonner'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

interface ChatInputProps {
  onSendMessage: (content: string, attachments: File[]) => Promise<string | undefined>;
  replyingTo: Message | null;
  onCancelReply: () => void;
}

export function ChatInput({ onSendMessage, replyingTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File ${file.name} is too large. Maximum size is 20MB.`)
      return false
    }
    return true
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if ((message.trim() || attachments.length > 0) && !isUploading) {
      setIsUploading(true)
      try {
        const messageId = await onSendMessage(message.trim(), attachments)
        if (messageId) {
          // Generate embeddings for the message in the background
          fetch('/api/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messageId }),
          }).catch(error => {
            console.error('Error generating embeddings:', error)
          })
        }
        setMessage('')
        setAttachments([])
      } catch (error) {
        toast.error('Failed to send message. Please try again.')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const validFiles = Array.from(e.target.files).filter(validateFile)
      setAttachments(prev => [...prev, ...validFiles])
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_: File, i: number) => i !== index))
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <form onSubmit={handleSend} className="p-4 border-t flex flex-col">
      {replyingTo && (
        <div className="mb-2 p-2 bg-gray-100 rounded flex items-center justify-between">
          <span className="text-sm">
            Replying to <strong>{replyingTo.user.username}</strong>: {replyingTo.content}
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
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 mr-2"
            disabled={isUploading}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Paperclip size={16} />
          </Button>
          <Button type="submit" className="ml-2" disabled={isUploading}>
            <Send size={16} className="mr-2" /> {isUploading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </form>
  )
} 