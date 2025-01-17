import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Message } from '@/app/types/message'
import { SearchResults, FileSearchResult, PersonSearchResult } from '@/app/types/search'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const MAX_RESULTS = 50

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

    // Search for people based on username and full name
    const messageAuthors = messageRows.map((row: any) => ({
      id: row.user_id,
      username: row.username,
      created_at: row.user_created_at || row.created_at,
      updated_at: row.user_updated_at || row.updated_at
    }));

    const { data: peopleRows, error: peopleError } = await supabase
      .from('profiles')
      .select('id, username, created_at, updated_at')
      .or(`username.ilike.%${query}%`)
      .limit(MAX_RESULTS)

    if (peopleError) {
      console.error('People search error:', peopleError)
      return NextResponse.json({ error: 'Failed to search people' }, { status: 500 })
    }

    // Combine and deduplicate people results
    const combinedPeople = [...messageAuthors, ...peopleRows];
    const uniquePeople = Array.from(new Map(combinedPeople.map(person => [person.id, person])).values());

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

    // Transform and deduplicate file rows with rank-based scoring
    const fileScores = new Map<string, { score: number, data: any }>();
    fileRows.forEach((row: any, index: number) => {
      const filePath = row.file_path;
      const rankScore = 1 / (index + 1); // Reciprocal rank scoring
      
      if (fileScores.has(filePath)) {
        // Add to existing score
        fileScores.get(filePath)!.score += rankScore;
      } else {
        // Create new entry
        fileScores.set(filePath, {
          score: rankScore,
          data: row
        });
      }
    });

    // Convert to array and sort by score
    const files: FileSearchResult[] = Array.from(fileScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .map(([_, { data }]) => ({
        id: data.id,
        name: data.file_path.split('/').pop() || '',
        fileType: data.file_path.split('.').pop() || '',
        sharedBy: data.username || 'Unknown',
        sharedAt: data.created_at,
        filePath: data.file_path
      }));

    // Calculate scores for people based on message authorship and direct matches
    const peopleScores = new Map<string, { score: number, data: any }>();
    
    // Score from message authorship
    messageRows.forEach((row: any, index: number) => {
      const userId = row.user_id;
      const rankScore = 1 / (index + 1);
      
      if (peopleScores.has(userId)) {
        peopleScores.get(userId)!.score += rankScore;
      } else {
        peopleScores.set(userId, {
          score: rankScore,
          data: {
            id: row.user_id,
            username: row.username,
            updated_at: row.user_updated_at || row.updated_at
          }
        });
      }
    });

    // Add scores from direct people matches
    peopleRows.forEach((row: any, index: number) => {
      const rankScore = 1 / (index + 1);
      
      if (peopleScores.has(row.id)) {
        peopleScores.get(row.id)!.score += rankScore;
      } else {
        peopleScores.set(row.id, {
          score: rankScore,
          data: row
        });
      }
    });

    // Transform people rows with online status, sorted by score
    const people: PersonSearchResult[] = Array.from(peopleScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .map(([_, { data }]) => {
        const lastSeen = new Date(data.updated_at || 0);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        let status: 'online' | 'offline' | 'away' = 'offline';
        if (lastSeen > fiveMinutesAgo) {
          status = 'online';
        } else if (lastSeen > new Date(Date.now() - 30 * 60 * 1000)) {
          status = 'away';
        }

        return {
          id: data.id,
          name: data.username,
          fullName: data.username,
          avatarUrl: null,
          status,
          title: data.username,
          lastSeenAt: data.updated_at
        };
      });

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