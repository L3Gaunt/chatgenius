CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

DROP TABLE IF EXISTS public.messages CASCADE;
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  parent_message_id UUID REFERENCES public.messages (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',  -- For storing file metadata directly
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  embedding vector(1536),
  is_embedding_in_progress BOOLEAN DEFAULT false
);

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS messages_embedding_idx 
ON public.messages 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS messages_embedding_progress_idx
ON public.messages(is_embedding_in_progress)
WHERE is_embedding_in_progress = true;


DROP FUNCTION IF EXISTS public.search_messages CASCADE;
-- Create a function to search messages by similarity
CREATE OR REPLACE FUNCTION search_messages(
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  channel_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  username TEXT,
  attachments JSONB,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.id,
      m.content,
      m.channel_id,
      m.created_at,
      m.updated_at,
      p.id as user_id,
      p.username,
      m.attachments,
      1 - (m.embedding <=> query_embedding) as similarity
    FROM messages m
    JOIN profiles p ON m.user_id = p.id
    WHERE m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION search_messages TO authenticated;

-- Messages: Users can view messages in channels they're members of
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user can view a message
CREATE OR REPLACE FUNCTION can_view_message(message_id_param UUID, user_id_param UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id_param
    AND (
      m.channel_id IN (
        SELECT channel_id FROM public.channel_users
        WHERE user_id = user_id_param
      ) OR EXISTS (
        SELECT 1 FROM public.channels
        WHERE channels.id = m.channel_id
        AND channels.type = 'public'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view messages in their channels"
  ON public.messages FOR SELECT
  USING (can_view_message(id, auth.uid()));

CREATE POLICY "Users can insert messages in their channels"
  ON public.messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND  -- Ensure the message creator is the authenticated user
    (
      channel_id IN (
        SELECT channel_id FROM public.channel_users
        WHERE user_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.channels
        WHERE channels.id = channel_id
        AND channels.type = 'public'
      )
    )
  );

CREATE POLICY "Users can only delete their own messages"
  ON public.messages FOR DELETE
  USING (user_id = auth.uid());

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;