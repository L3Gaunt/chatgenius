import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Message } from '@/app/types/message'
import { SearchResults, FileSearchResult, PersonSearchResult } from '@/app/types/search'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const MAX_RESULTS = 5

// GET /api/embeddings/search - Search for similar messages and files
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Ensure user is authenticated
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    // Generate embeddings for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    })
    const embedding = embeddingResponse.data[0].embedding

    // Search messages
    const { data: messageRows, error: messageError } = await supabase
      .rpc('search_messages', {
        query_embedding: embedding,
        similarity_threshold: 0.0,
        match_count: MAX_RESULTS,
      })
      .select('*')
    
    if (messageError) {
      console.error('Message search error:', messageError)
      return NextResponse.json({ error: 'Failed to search messages' }, { status: 500 })
    }

    // Search file chunks
    const { data: fileRows, error: fileError } = await supabase
      .rpc('search_file_chunks', {
        query_embedding: embedding,
        similarity_threshold: 0.0,
        match_count: MAX_RESULTS,
      })
      .select('*')

    if (fileError) {
      console.error('File search error:', fileError)
      return NextResponse.json({ error: 'Failed to search files' }, { status: 500 })
    }

    // Transform message rows
    const messages: Message[] = messageRows.map((row: any) => ({
      id: row.id,
      content: row.content,
      channel_id: row.channel_id,
      user_id: row.user_id,
      parent_message_id: row.parent_message_id || null,
      attachments: (row.attachments || []).map((attachment: any) => ({
        id: attachment.id || '',
        name: attachment.name || '',
        url: attachment.url || ''
      })),
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        full_name: row.full_name || '',
        avatar_url: row.avatar_url || null,
        created_at: row.user_created_at || row.created_at,
        updated_at: row.user_updated_at || row.updated_at,
      },
      reactions: (row.reactions || []).map((reaction: any) => ({
        emoji: reaction.emoji || '',
        count: reaction.count || 0,
        users: reaction.users || []
      })),
      replies: row.replies || []
    }))

    // Transform file rows
    const files: FileSearchResult[] = fileRows.map((row: any) => ({
      id: row.id,
      name: row.file_path.split('/').pop() || '',
      fileType: row.file_path.split('.').pop() || '',
      sharedBy: row.username || 'Unknown',
      sharedAt: row.created_at
    }))

    // Add mock people results for now
    const people: PersonSearchResult[] = messageRows
      .filter((row: any) => row.user_id && row.username)
      .slice(0, MAX_RESULTS)
      .map((row: any) => ({
        id: row.user_id,
        name: row.username,
        status: 'offline',
        title: row.full_name || 'User'
      }))

    const results: SearchResults = {
      messages,
      files,
      people
    }

    // Add detailed logging of search results
    console.log('Search query:', query);
    console.log('Message results:', JSON.stringify(messages, null, 2));
    console.log('File results:', JSON.stringify(files, null, 2));
    console.log('Complete search results:', JSON.stringify(results, null, 2));

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in GET /api/embeddings/search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 