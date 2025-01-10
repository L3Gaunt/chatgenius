"use client"

import { useState, useRef, useEffect } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { SearchBox } from './search-box'
import { MessageComponent } from './message-component'
import { ChatInput } from './chat-input'

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

const initialMessages: Message[] = [
  { 
    id: 1, 
    user: 'Alice', 
    content: 'Hey everyone! How\'s it going?', 
    timestamp: '2:30 PM', 
    status: 'online', 
    reactions: {},
    replies: [
      { id: 4, user: 'Bob', content: 'Going great, Alice!', timestamp: '2:33 PM', status: 'offline', reactions: {} },
      { id: 5, user: 'Charlie', content: 'Busy day, but good!', timestamp: '2:35 PM', status: 'away', reactions: {} }
    ]
  },
  { id: 2, user: 'Bob', content: 'I have a question about the new feature.', timestamp: '2:40 PM', status: 'offline', reactions: {} },
  { id: 3, user: 'Charlie', content: 'Just finished the new feature. Can someone review it?', timestamp: '3:00 PM', status: 'away', reactions: {} },
]

export function ChatArea() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const currentUser = 'You' // In a real app, this would come from authentication
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const filteredMessages = messages.filter(message => 
    message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (message.replies && message.replies.some(reply => 
      reply.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.user.toLowerCase().includes(searchQuery.toLowerCase())
    ))
  )

  const handleSendMessage = (content: string, attachments: File[]) => {
    const newMsg: Message = {
      id: Date.now(),
      user: currentUser,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'online',
      reactions: {},
      attachments: attachments.map(file => ({
        id: file.name,
        name: file.name,
        url: URL.createObjectURL(file)
      }))
    }

    if (replyingTo) {
      setMessages(messages.map(msg => 
        msg.id === replyingTo.id 
          ? { ...msg, replies: [...(msg.replies || []), newMsg] }
          : msg
      ))
      setReplyingTo(null)
    } else {
      setMessages([...messages, newMsg])
    }
  }

  const handleReaction = (messageId: number, emoji: string) => {
    setMessages(messages.map(msg => {
      if (msg.id === messageId) {
        const updatedReactions = { ...msg.reactions }
        updatedReactions[emoji] = (updatedReactions[emoji] || 0) + 1
        return { ...msg, reactions: updatedReactions }
      }
      return msg
    }))
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message)
  }

  const handleDeleteMessage = (messageId: number) => {
    setMessages(messages.filter(msg => msg.id !== messageId))
  }

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
      <div className="p-4 border-b">
        <SearchBox onSearch={handleSearch} />
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {filteredMessages.map((message) => (
          <MessageComponent 
            key={message.id} 
            message={message}
            currentUser={currentUser}
            onDelete={handleDeleteMessage}
            onReaction={handleReaction}
            onReply={handleReply}
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

