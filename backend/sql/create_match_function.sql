-- Create the vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  similarity float,
  times_used int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.question,
    kb.answer,
    1 - (kb.embedding <=> query_embedding) AS similarity,
    kb.times_used
  FROM knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;