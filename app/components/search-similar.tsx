import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Message, transformDatabaseMessage } from '../types/message'
import { MessageComponent } from './message-component'

interface SearchSimilarProps {
  currentUserId: string;
  onDelete: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
}

export function SearchSimilar({ currentUserId, onDelete, onReaction, onReply }: SearchSimilarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/embeddings/search?query=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const similarMessages = await response.json()
      
      // Transform the messages to match the Message type
      const transformedMessages = await Promise.all(similarMessages.map(async (msg: any) => {
        // Fetch user data for each message
        const userResponse = await fetch(`/api/users/${msg.user_id}`)
        const userData = await userResponse.json()

        return transformDatabaseMessage({
          ...msg,
          user: userData
        })
      }))

      setResults(transformedMessages)
    } catch (error) {
      console.error('Error searching messages:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="p-4 border-t">
      <div className="flex gap-2 mb-4">
        <Input
          type="text"
          placeholder="Search similar messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={isSearching}
          variant="outline"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Similar Messages</h3>
          {results.map((message) => (
            <MessageComponent
              key={message.id}
              message={message}
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