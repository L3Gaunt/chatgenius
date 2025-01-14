import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// POST /api/embeddings - Add embeddings to a message
export async function POST(request: Request) {
  try {
    const { messageId } = await request.json()
    
    // Get the message content
    const supabase = createRouteHandlerClient({ cookies })
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('content')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Generate embeddings using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message.content,
      encoding_format: "float"
    })

    const embedding = embeddingResponse.data[0].embedding

    // Update the message with embeddings
    const { error: updateError } = await supabase
      .from('messages')
      .update({ embedding })
      .eq('id', messageId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update message embeddings' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/embeddings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 