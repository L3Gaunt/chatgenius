import { FileText, MessageSquare, User } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Message } from "../types/message"
import { MessageComponent } from './message-component'

interface FileSearchResult {
  type: 'file';
  id: number;
  name: string;
  fileType: string;
  sharedBy: string;
  sharedAt: string;
}

interface PersonSearchResult {
  type: 'person';
  id: number;
  name: string;
  status: 'online' | 'offline' | 'away';
  title: string;
}

type SearchResult = Message | FileSearchResult | PersonSearchResult;

interface SearchResultsProps {
  results: SearchResult[];
  onClose: () => void;
  isOpen: boolean;
  currentUserId?: string;
}

export function SearchResults({ results, onClose, isOpen, currentUserId }: SearchResultsProps) {
  if (!isOpen) return null;

  const messageResults = results.filter((r): r is Message => 'content' in r && 'user' in r);
  const fileResults = results.filter((r): r is FileSearchResult => 'type' in r && r.type === 'file');
  const personResults = results.filter((r): r is PersonSearchResult => 'type' in r && r.type === 'person');

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
            Messages ({messageResults.length})
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Files ({fileResults.length})
          </TabsTrigger>
          <TabsTrigger value="people" className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            People ({personResults.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4 space-y-2">
              {messageResults.map((message) => (
                <MessageComponent
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="files" className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4 space-y-2">
              {fileResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      <div>
                        <div className="font-medium">{result.name}</div>
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
              {personResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="relative mr-2">
                        <User className="w-6 h-6" />
                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                          result.status === 'online' ? 'bg-green-500' :
                          result.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <div>
                        <div className="font-medium">{result.name}</div>
                        <div className="text-xs text-muted-foreground">{result.title}</div>
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

