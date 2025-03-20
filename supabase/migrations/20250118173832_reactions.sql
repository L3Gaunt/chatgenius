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