-- Supabase database schema for ChatGenius

-- 1) Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',  -- 'online', 'offline', or 'away'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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