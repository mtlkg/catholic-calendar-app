
CREATE TABLE public.dm_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  peer_user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT 'epoch',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, peer_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_conversation_state TO authenticated;
GRANT ALL ON public.dm_conversation_state TO service_role;

ALTER TABLE public.dm_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own conversation state"
ON public.dm_conversation_state
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_dm_conversation_state_updated_at
BEFORE UPDATE ON public.dm_conversation_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dm_conversation_state_user ON public.dm_conversation_state(user_id, deleted_at);
