-- Supabase database schema for ChatGenius
-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;
-- Add a trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) Profiles table (extends Supabase Auth users)
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP FUNCTION IF EXISTS public.delete_message_attachments CASCADE;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS) Policies
-- Profiles: Users can read all profiles but only update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create a function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'No name given')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;


-- CHANNELS
DROP TABLE IF EXISTS public.channels CASCADE;
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the general channel by default
INSERT INTO public.channels (name, type)
VALUES ('general', 'public')
ON CONFLICT (name) DO NOTHING;

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public channels are viewable by everyone"
  ON public.channels FOR SELECT
  USING (type = 'public' OR EXISTS (
    SELECT 1 FROM public.channel_users
    WHERE channel_users.channel_id = channels.id
    AND channel_users.user_id = auth.uid()
  ));

-- Allow users to create channels
CREATE POLICY "Users can create channels"
  ON public.channels FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Prevent deletion of the general channel
CREATE POLICY "General channel cannot be deleted"
  ON public.channels FOR DELETE
  USING (name != 'general');

-- Allow deletion of other channels
CREATE POLICY "Users can delete non-general channels"
  ON public.channels FOR DELETE
  USING (name != 'general' AND type = 'public');

ALTER PUBLICATION supabase_realtime ADD TABLE channels;




-- CHANNEL_USERS (channel membership)
DROP TABLE IF EXISTS public.channel_users CASCADE;
CREATE TABLE IF NOT EXISTS public.channel_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, user_id)
);

-- Channel Users: Members can view their channel memberships
ALTER TABLE public.channel_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their channel memberships"
  ON public.channel_users FOR SELECT
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE channel_users;



-- MESSAGES (and searching)
-- Enable vector extension
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
    can_view_message(id, auth.uid())
  );

CREATE POLICY "Users can only delete their own messages"
  ON public.messages FOR DELETE
  USING (user_id = auth.uid());

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;




-- REACTIONS
DROP TABLE IF EXISTS public.reactions CASCADE;
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)  -- each user can react with a specific emoji only once
);



ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on visible messages"
  ON public.reactions FOR SELECT
  USING (can_view_message(message_id, auth.uid()));

CREATE POLICY "Users can add reactions to visible messages"
  ON public.reactions FOR INSERT
  WITH CHECK (can_view_message(message_id, auth.uid()));

CREATE POLICY "Users can delete their own reactions"
  ON public.reactions FOR DELETE
  USING (user_id = auth.uid());

-- Create function to toggle reactions
CREATE OR REPLACE FUNCTION toggle_reaction(
  message_id_param UUID,
  user_id_param UUID,
  emoji_param TEXT
) RETURNS void AS $$
BEGIN
  -- Try to delete the reaction first
  DELETE FROM public.reactions
  WHERE message_id = message_id_param
    AND user_id = user_id_param
    AND emoji = emoji_param;
  
  -- If no row was deleted (indicated by FOUND being false), insert the reaction
  IF NOT FOUND THEN
    INSERT INTO public.reactions(message_id, user_id, emoji)
    VALUES (message_id_param, user_id_param, emoji_param);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION toggle_reaction TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER TABLE public.reactions REPLICA IDENTITY FULL; -- for realtime updates


-- STORAGE
-- Drop existing storage policies
DROP POLICY IF EXISTS "Attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Postgres can delete objects" ON storage.objects;

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket
CREATE POLICY "Attachments are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attachments' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Update storage policies to allow the postgres role to delete objects
CREATE POLICY "Postgres can delete objects"
ON storage.objects FOR DELETE
TO postgres
USING (true);
