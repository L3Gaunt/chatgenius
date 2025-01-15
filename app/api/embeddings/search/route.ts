import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const MAX_RESULTS = 5

// GET /api/embeddings/search - Search for similar messages (joined with user data)
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

    // Call the updated Postgres function which returns joined data:
    // ( messages + some profile columns, so PostgREST recognizes them )
    const { data: rows, error } = await supabase
      .rpc('search_messages', {
        query_embedding: embedding,
        similarity_threshold: 0.0,
        match_count: MAX_RESULTS,
      })
      .select('*') // Since the function returns a known record structure
    
    if (error) {
      console.error('Search error:', error)
      return NextResponse.json({ error: 'Failed to search messages' }, { status: 500 })
    }

    // Transform the joined rows into a friendlier format
    const transformed = rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      channel_id: row.channel_id,
      similarity: row.similarity,
      user: {
        id: row.user_id,
        username: row.username,
        created_at: row.user_created_at,
        updated_at: row.user_updated_at,
      },
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error in GET /api/embeddings/search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 