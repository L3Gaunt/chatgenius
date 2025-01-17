import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf"
import { Document } from "@langchain/core/documents"

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

interface PDFAttachment {
  id: string
  url: string
  name: string
}

async function processPDFAttachment(messageId: string, attachment: PDFAttachment) {
  try {
    console.log(`[PDF] Processing PDF attachment for message ${messageId}, path: ${attachment.id}`)
    
    // Download PDF from storage
    const { data, error } = await supabaseAdmin
      .storage
      .from('attachments')
      .download(attachment.id)
    
    if (error) {
      console.error('[PDF] Failed to download PDF:', error)
      throw error
    }
    console.log('[PDF] Successfully downloaded PDF from storage')

    // Convert to blob
    const blob = new Blob([data], { type: 'application/pdf' })
    console.log('[PDF] Created blob:', { size: blob.size, type: blob.type })
    
    // Load and split PDF
    const loader = new WebPDFLoader(blob)
    const docs = await loader.load()
    console.log(`[PDF] Successfully loaded PDF, got ${docs.length} chunks:`)
    docs.forEach((doc, i) => {
      console.log(`\n--- Chunk ${i} ---\n${doc.pageContent}\n--------------`)
    })
    
    // Process each chunk
    const results = await Promise.all(docs.map(async (doc: Document, index: number) => {
      try {
        console.log(`[PDF] Generating embedding for chunk ${index}`)
        // Generate embedding for chunk
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: doc.pageContent,
          encoding_format: "float"
        })

        const embedding = embeddingResponse.data[0].embedding
        console.log(`[PDF] Successfully generated embedding for chunk ${index}`)

        // Store chunk and embedding
        console.log(`[PDF] Storing chunk ${index} in database`)
        const { error: insertError } = await supabaseAdmin
          .from('file_chunk_embeddings')
          .insert({
            message_id: messageId,
            file_path: attachment.id,
            chunk_index: index,
            content: doc.pageContent,
            embedding,
            is_embedding_processed: true
          })

        if (insertError) {
          console.error(`[PDF] Failed to insert chunk ${index}:`, insertError)
          throw insertError
        }
        console.log(`[PDF] Successfully stored chunk ${index}`)
        return { success: true }
      } catch (error) {
        console.error(`[PDF] Error processing chunk ${index}:`, error)
        return { success: false }
      }
    }))

    const success = results.every((r: { success: boolean }) => r.success)
    console.log(`[PDF] Finished processing PDF with ${success ? 'success' : 'some failures'}`)
    return success
  } catch (error) {
    console.error('[PDF] Error processing PDF:', error)
    return false
  }
}

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
      .select('id, content, attachments')
      .returns<{ id: string, content: string, attachments: PDFAttachment[] }[]>()

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
        // Generate embeddings for message content
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

        // Process PDF attachments if any
        if (message.attachments && message.attachments.length > 0) {
          console.log('[PDF] Found attachments:', message.attachments)
          const pdfAttachments = message.attachments.filter(
            (att) => att.name.toLowerCase().endsWith('.pdf')
          )
          
          console.log('[PDF] Found PDF attachments:', pdfAttachments)
          for (const pdfAttachment of pdfAttachments) {
            await processPDFAttachment(message.id, pdfAttachment)
          }
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