CREATE POLICY "Participants can delete their messages"
ON public.direct_messages
FOR DELETE
USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);