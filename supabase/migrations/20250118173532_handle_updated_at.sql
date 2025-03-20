-- Supabase database schema for ChatGenius
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;
-- Add a trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;