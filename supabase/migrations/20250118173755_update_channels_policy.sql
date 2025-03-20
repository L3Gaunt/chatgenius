-- Update the channels policy to include private channels that the user is a member of
DROP POLICY IF EXISTS "Public channels are viewable by everyone" ON public.channels;

-- Replace with more comprehensive policy
CREATE POLICY "Channels are viewable by members and public channels by everyone"
  ON public.channels FOR SELECT
  USING (type = 'public' OR EXISTS (
    SELECT 1 FROM public.channel_users
    WHERE channel_users.channel_id = channels.id
    AND channel_users.user_id = auth.uid()
  )); 