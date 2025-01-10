import React, { useState } from 'react';

// ... existing code ...

const handleSendMessage = (content: string, attachments: File[]) => {
  const newMsg: Message = {
    id: Date.now(),
    user: currentUser,
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'online',
    reactions: {},
    attachments: attachments.map(file => ({
      id: file.name,
      name: file.name,
      url: URL.createObjectURL(file)
    }))
  }

  if (replyingTo) {
    setMessages(prevMessages => prevMessages.map(msg => {
      if (msg.id === replyingTo.id) {
        return {
          ...msg,
          replies: [...(msg.replies || []), newMsg]
        }
      }
      // Also check nested replies
      if (msg.replies) {
        const updatedReplies = msg.replies.map(reply => {
          if (reply.id === replyingTo.id) {
            return {
              ...reply,
              replies: [...(reply.replies || []), newMsg]
            }
          }
          return reply
        })
        return { ...msg, replies: updatedReplies }
      }
      return msg
    }))
    setReplyingTo(null)
  } else {
    setMessages(prevMessages => [...prevMessages, newMsg])
  }
}

// ... existing code ...