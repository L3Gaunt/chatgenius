import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 1. Get the message and verify ownership
    const { data: message } = await supabase
      .from('messages')
      .select('attachments, user_id')
      .eq('id', params.messageId)
      .single()

    if (!message) {
      return new NextResponse('Message not found', { status: 404 })
    }

    if (message.user_id !== session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Delete the message first (this will cascade delete reactions due to our schema)
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', params.messageId)

    if (deleteError) {
      throw deleteError
    }

    // 3. Clean up attachments asynchronously after message is deleted
    if (message.attachments && message.attachments.length > 0) {
      // Don't await this operation since we don't need to block the response
      Promise.all(
        (message.attachments as { id: string }[]).map(attachment =>
          supabase.storage
            .from('attachments')
            .remove([attachment.id])
            .then(({ error }) => {
              if (error) {
                console.error('Error deleting attachment:', attachment.id, error)
              }
            })
        )
      ).catch(error => {
        console.error('Error in attachment cleanup:', error)
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting message:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 