-- Supabase database schema for ChatGenius

-- 1) Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add a trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2) Channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',     -- 'public', 'private', 'direct'
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

-- 3) Channel membership table
CREATE TABLE IF NOT EXISTS public.channel_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, user_id)
);

-- 4) Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  parent_message_id UUID REFERENCES public.messages (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',  -- For storing file metadata directly
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5) Reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)  -- each user can react with a specific emoji only once
);

-- Row Level Security (RLS) Policies
-- Profiles: Users can read all profiles but only update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Channels: Public channels are viewable by everyone, private channels only by members
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
  WITH CHECK (true);

-- Prevent deletion of the general channel
CREATE POLICY "General channel cannot be deleted"
  ON public.channels FOR DELETE
  USING (name != 'general');

-- Allow deletion of other channels
CREATE POLICY "Users can delete non-general channels"
  ON public.channels FOR DELETE
  USING (name != 'general' AND type = 'public');

-- Channel Users: Members can view their channel memberships
ALTER TABLE public.channel_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their channel memberships"
  ON public.channel_users FOR SELECT
  USING (user_id = auth.uid());

-- Messages: Users can view messages in channels they're members of
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their channels"
  ON public.messages FOR SELECT
  USING (
    channel_id IN (
      SELECT channel_id FROM public.channel_users
      WHERE user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM public.channels
      WHERE channels.id = messages.channel_id
      AND channels.type = 'public'
    )
  );

CREATE POLICY "Users can insert messages in their channels"
  ON public.messages FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT channel_id FROM public.channel_users
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.channels
      WHERE channels.id = channel_id
      AND channels.type = 'public'
    )
  );

CREATE POLICY "Users can only delete their own messages"
  ON public.messages FOR DELETE
  USING (user_id = auth.uid());

-- Reactions: Users can view and add reactions to messages they can see
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on visible messages"
  ON public.reactions FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM public.messages
      WHERE channel_id IN (
        SELECT channel_id FROM public.channel_users
        WHERE user_id = auth.uid()
      ) OR channel_id IN (
        SELECT id FROM public.channels
        WHERE type = 'public'
      )
    )
  );

CREATE POLICY "Users can add reactions to visible messages"
  ON public.reactions FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT id FROM public.messages
      WHERE channel_id IN (
        SELECT channel_id FROM public.channel_users
        WHERE user_id = auth.uid()
      ) OR channel_id IN (
        SELECT id FROM public.channels
        WHERE type = 'public'
      )
    )
  );

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE channels;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_users;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- Grant permissions (moved to end)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

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

ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

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

-- Create a function to delete files from storage when a message is deleted
CREATE OR REPLACE FUNCTION delete_message_attachments()
RETURNS TRIGGER AS $$
DECLARE
  attachment JSONB;
BEGIN
  -- Loop through each attachment in the deleted message
  FOR attachment IN SELECT * FROM jsonb_array_elements(OLD.attachments)
  LOOP
    -- The attachment->>'id' contains the full path including channel_id/filename
    -- Delete the file from storage by deleting from storage.objects table
    DELETE FROM storage.objects 
    WHERE bucket_id = 'attachments' 
    AND name = attachment->>'id';
  END LOOP;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS delete_message_attachments_trigger ON public.messages;

-- Create trigger to automatically delete files when a message is deleted
CREATE TRIGGER delete_message_attachments_trigger
  BEFORE DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION delete_message_attachments();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO postgres, authenticated;
GRANT ALL ON storage.objects TO postgres, authenticated;