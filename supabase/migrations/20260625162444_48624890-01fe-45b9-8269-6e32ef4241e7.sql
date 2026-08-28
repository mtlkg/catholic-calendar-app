CREATE POLICY "Users can insert their own profile"
ON public.organizer_profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);