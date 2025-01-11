import { ChatArea } from "@/app/components/chat-area"
import { Sidebar } from "@/app/components/sidebar"

export default function ChannelPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <ChatArea />
    </div>
  )
} 