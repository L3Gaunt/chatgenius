import { Sidebar } from './components/sidebar'
import { ChatArea } from './components/chat-area'

export default function Home() {
  return (
    <main className="flex h-screen">
      <Sidebar />
      <ChatArea />
    </main>
  )
}

