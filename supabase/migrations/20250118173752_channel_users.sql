
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