import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const MAX_RESULTS = 5

// GET /api/embeddings/search - Search for similar messages
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession()
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
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float"
    })

    const embedding = embeddingResponse.data[0].embedding

    // Search for similar messages and include user data in the same query
    const { data: similarMessages, error } = await supabase
      .rpc('search_messages', {
        query_embedding: embedding,
        similarity_threshold: 0.0, // No threshold cutoff
        match_count: MAX_RESULTS
      })
      .select(`
        *,
        user:profiles(
          id,
          username,
          created_at,
          updated_at
        ),
        reactions(emoji, user_id),
        replies:messages!parent_message_id(
          *,
          user:profiles(
            id,
            username,
            created_at,
            updated_at
          ),
          reactions(emoji, user_id)
        )
      `)

    if (error) {
      return NextResponse.json({ error: 'Failed to search messages' }, { status: 500 })
    }

    // Transform messages to include properly formatted reactions and user data
    const transformedMessages = similarMessages.map((message: any) => {
      // Process reactions
      const reactionsByEmoji = (message.reactions || []).reduce((acc: any, reaction: any) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = { count: 0, users: [] };
        }
        acc[reaction.emoji].count += 1;
        acc[reaction.emoji].users.push(reaction.user_id);
        return acc;
      }, {});

      const formattedReactions = Object.entries(reactionsByEmoji).map(([emoji, data]: [string, any]) => ({
        emoji,
        count: data.count,
        users: data.users
      }));

      // Process replies if they exist
      const processedReplies = message.replies?.map((reply: any) => {
        const replyReactionsByEmoji = (reply.reactions || []).reduce((acc: any, reaction: any) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = { count: 0, users: [] };
          }
          acc[reaction.emoji].count += 1;
          acc[reaction.emoji].users.push(reaction.user_id);
          return acc;
        }, {});

        const formattedReplyReactions = Object.entries(replyReactionsByEmoji).map(([emoji, data]: [string, any]) => ({
          emoji,
          count: data.count,
          users: data.users
        }));

        return {
          ...reply,
          reactions: formattedReplyReactions
        };
      });

      return {
        ...message,
        reactions: formattedReactions,
        replies: processedReplies || []
      };
    });

    return NextResponse.json(transformedMessages)
  } catch (error) {
    console.error('Error in GET /api/embeddings/search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 