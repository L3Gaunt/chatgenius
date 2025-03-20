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

-- Simple policy for now - will be enhanced after channel_users table is created
CREATE POLICY "Public channels are viewable by everyone"
  ON public.channels FOR SELECT
  USING (type = 'public');

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