import { useState, useRef, useEffect } from 'react'
import { Send, Smile, MessageSquare, X, Trash2, Paperclip } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { FileAttachment } from './file-attachment'
import { SearchBox } from './search-box'

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
  const [newMessage, setNewMessage] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (newMessage.trim() || attachments.length > 0) {
      const newMsg: Message = {
        id: Date.now(),
        user: currentUser,
        content: newMessage,
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
      setNewMessage('')
      setAttachments([])
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)])
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
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

  const MessageComponent = ({ message, isReply = false }: { message: Message; isReply?: boolean }) => (
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
                <AlertDialogAction onClick={() => handleDeleteMessage(message.id)}>
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
                  onClick={() => handleReaction(message.id, emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" onClick={() => handleReply(message)}>
          <MessageSquare size={16} />
        </Button>
      </div>
      {message.replies && message.replies.length > 0 && (
        <div className="mt-2">
          {message.replies.map(reply => (
            <MessageComponent key={reply.id} message={reply} isReply={true} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b">
        <SearchBox onSearch={handleSearch} />
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {filteredMessages.map((message) => (
          <MessageComponent key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <form onSubmit={handleSendMessage} className="p-4 border-t flex flex-col">
        {replyingTo && (
          <div className="mb-2 p-2 bg-gray-100 rounded flex items-center justify-between">
            <span className="text-sm">
              Replying to <strong>{replyingTo.user}</strong>: {replyingTo.content}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
              <X size={16} />
            </Button>
          </div>
        )}
        <div className="flex flex-col space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
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
    </div>
  )
}

