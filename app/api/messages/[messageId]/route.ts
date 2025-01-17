import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { DatabaseMessage } from '@/types/database'

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

    // Get the message and verify ownership
    const { data: message } = await supabase
      .from('messages')
      .select('attachments, user_id')
      .eq('id', params.messageId)
      .single<DatabaseMessage>()

    if (!message) {
      return new NextResponse('Message not found', { status: 404 })
    }

    if (message.user_id !== session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Delete the message (will cascade delete reactions)
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', params.messageId)

    if (deleteError) {
      throw deleteError
    }

    // Clean up attachments asynchronously
    if (message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0) {
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