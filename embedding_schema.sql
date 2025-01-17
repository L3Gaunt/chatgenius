-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create table for file chunk embeddings
DROP TABLE IF EXISTS public.file_chunk_embeddings;
CREATE TABLE public.file_chunk_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL, -- Storage path for the file this chunk came from
  chunk_index INTEGER NOT NULL, -- For ordering chunks within a file
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_embedding_processed BOOLEAN DEFAULT false,
  embedding_error TEXT
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS file_chunk_embeddings_updated_at ON public.file_chunk_embeddings;
CREATE TRIGGER file_chunk_embeddings_updated_at
  BEFORE UPDATE ON public.file_chunk_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS file_chunk_embeddings_embedding_idx 
ON public.file_chunk_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS file_chunk_embeddings_message_id_idx
ON public.file_chunk_embeddings(message_id);

CREATE INDEX IF NOT EXISTS file_chunk_embeddings_file_path_idx
ON public.file_chunk_embeddings(file_path);

CREATE INDEX IF NOT EXISTS file_chunk_embeddings_processed_idx
ON public.file_chunk_embeddings(is_embedding_processed)
WHERE is_embedding_processed = false;

-- Enable RLS
ALTER TABLE public.file_chunk_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view file chunk embeddings for accessible messages"
  ON public.file_chunk_embeddings FOR SELECT
  USING (can_view_message(message_id, auth.uid()));

-- Updated search function to handle file chunk embeddings
CREATE OR REPLACE FUNCTION search_file_chunks(
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  message_id UUID,
  file_path TEXT,
  chunk_index INTEGER,
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
      fce.id,
      fce.content,
      fce.message_id,
      fce.file_path,
      fce.chunk_index,
      m.channel_id,
      fce.created_at,
      fce.updated_at,
      p.id as user_id,
      p.username,
      1 - (fce.embedding <=> query_embedding) as similarity
    FROM file_chunk_embeddings fce
    LEFT JOIN messages m ON fce.message_id = m.id
    LEFT JOIN profiles p ON m.user_id = p.id
    WHERE fce.embedding IS NOT NULL
      AND 1 - (fce.embedding <=> query_embedding) > similarity_threshold
    ORDER BY fce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION search_file_chunks TO authenticated;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE file_chunk_embeddings; 

-- Create function to delete file chunk embeddings when files are deleted
CREATE OR REPLACE FUNCTION public.delete_message_attachments()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete file chunk embeddings for the deleted file
  DELETE FROM public.file_chunk_embeddings
  WHERE file_path = OLD.name;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on storage.objects
DROP TRIGGER IF EXISTS on_storage_object_delete ON storage.objects;
CREATE TRIGGER on_storage_object_delete
  BEFORE DELETE ON storage.objects
  FOR EACH ROW
  WHEN (OLD.bucket_id = 'attachments')
  EXECUTE FUNCTION public.delete_message_attachments();
