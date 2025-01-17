import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Message } from "../types/message"

interface SearchBoxProps {
  onSearch: (messages: Message[]) => void;
  onFocus?: () => void;
}

export function SearchBox({ onSearch, onFocus }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/embeddings/search?query=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const messages = await response.json()
      onSearch(messages)
    } catch (error) {
      console.error('Error searching messages:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <Input
        type="text"
        placeholder="Search messages..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-grow"
        disabled={isSearching}
        onFocus={onFocus}
      />
      <Button type="submit" size="icon" disabled={isSearching}>
        <Search className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </Button>
    </form>
  )
}

