import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// POST /api/embeddings - Add embeddings to messages that don't have them
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the admin client for all database operations
    // First, mark unembedded messages as in progress
    const { data: messages, error: markError } = await supabaseAdmin
      .from('messages')
      .update({ is_embedding_in_progress: true })
      .is('embedding', null)
      .eq('is_embedding_in_progress', false)
      .select('id, content')
      .returns<{ id: string, content: string }[]>()

    if (markError) {
      console.error('Error marking messages:', markError)
      return NextResponse.json({ error: 'Failed to mark messages' }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'No messages to embed' })
    }

    // Process each message
    const results = await Promise.all(messages.map(async (message) => {
      try {
        // Generate embeddings using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: message.content,
          encoding_format: "float"
        })

        const embedding = embeddingResponse.data[0].embedding

        // Update the message with embeddings using admin client
        const { error: updateError } = await supabaseAdmin
          .from('messages')
          .update({ 
            embedding,
            is_embedding_in_progress: false 
          })
          .eq('id', message.id)

        if (updateError) {
          console.error(`Failed to update message ${message.id}:`, updateError)
          return { id: message.id, success: false }
        }

        return { id: message.id, success: true }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error)
        // Reset the in_progress flag on error using admin client
        await supabaseAdmin
          .from('messages')
          .update({ is_embedding_in_progress: false })
          .eq('id', message.id)
        return { id: message.id, success: false }
      }
    }))

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({ 
      processed: results.length,
      successful: successCount,
      failed: failureCount
    })
  } catch (error) {
    console.error('Error in POST /api/embeddings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 