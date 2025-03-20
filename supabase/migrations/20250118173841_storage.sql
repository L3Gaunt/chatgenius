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