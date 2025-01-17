import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Message } from "../types/message"
import { SearchResults } from "../types/search"

interface SearchBoxProps {
  onSearch: (results: SearchResults) => void
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/embeddings/search?query=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('Search failed.')
      }

      const { messages = [], files = [], people = [] } = await response.json()
      onSearch({ messages, files, people })
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <Input
        type="text"
        placeholder="Search messages or files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-grow"
        disabled={isSearching}
      />
      <Button type="submit" size="icon" disabled={isSearching}>
        <Search className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </Button>
    </form>
  )
}

