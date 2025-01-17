import { FileText, MessageSquare, User } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Message } from "../types/message"
import { MessageComponent } from './message-component'
import { FileSearchResult, PersonSearchResult, SearchResults as SearchResultsType } from '../types/search'

interface SearchResultsProps {
  results: SearchResultsType;
  onClose: () => void;
  isOpen: boolean;
  currentUserId?: string;
  onDirectMessageSelect?: (userId: string) => void;
}

export function SearchResults({ results, onClose, isOpen, currentUserId, onDirectMessageSelect }: SearchResultsProps) {
  if (!isOpen) return null;

  // Add defensive checks and logging
  console.log('Received search results:', results);
  
  const messages = results?.messages || [];
  const files = results?.files || [];
  const people = results?.people || [];
  
  console.log('Processed results - messages:', messages.length, 'files:', files.length, 'people:', people.length);

  const handleDelete = () => {
    // Handle message deletion
  };

  const handleReaction = () => {
    // Handle message reaction
  };

  const handleReply = () => {
    // Handle message reply
  };

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">Search Results</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </div>
      <Tabs defaultValue="messages" className="flex-1 flex flex-col">
        <TabsList className="justify-start p-4 border-b">
          <TabsTrigger value="messages" className="flex items-center">
            <MessageSquare className="w-4 h-4 mr-2" />
            Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Files ({files.length})
          </TabsTrigger>
          <TabsTrigger value="people" className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            People ({people.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4 space-y-2">
              {messages.map((message) => (
                <MessageComponent
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId || ''}
                  onDelete={handleDelete}
                  onReaction={handleReaction}
                  onReply={handleReply}
                  isSearchResult={true}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="files" className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4 space-y-2">
              {files.map((result) => (
                <Card key={result.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      <div>
                        <a 
                          href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/${result.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline text-blue-600"
                        >
                          {result.name}
                        </a>
                        <div className="text-xs text-muted-foreground">
                          {result.fileType} • Shared by {result.sharedBy} • {new Date(result.sharedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="people" className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4 space-y-2">
              {people.map((result) => (
                <Card key={result.id}>
                  <CardContent 
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => {
                      if (onDirectMessageSelect) {
                        onDirectMessageSelect(result.id);
                        onClose();
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <div className="relative mr-2">
                        {result.avatarUrl ? (
                          <img 
                            src={result.avatarUrl} 
                            alt={result.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <User className="w-8 h-8" />
                        )}
                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                          result.status === 'online' ? 'bg-green-500' :
                          result.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <div className="ml-3">
                        <div className="font-medium">{result.name}</div>
                        <div className="text-sm text-muted-foreground">{result.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.status === 'online' ? 'Online' :
                           result.status === 'away' ? 'Away' :
                           result.lastSeenAt ? `Last seen ${new Date(result.lastSeenAt).toLocaleString()}` : 'Offline'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

