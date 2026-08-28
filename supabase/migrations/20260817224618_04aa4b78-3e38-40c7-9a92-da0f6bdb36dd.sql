ALTER TABLE public.discussion_threads ADD COLUMN IF NOT EXISTS diocese_slug text REFERENCES public.dioceses(slug);
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS diocese_slug text REFERENCES public.dioceses(slug);

UPDATE public.discussion_threads t
SET diocese_slug = p.diocese_slug
FROM public.organizer_profiles p
WHERE p.user_id = t.author_user_id AND t.diocese_slug IS NULL;

UPDATE public.direct_messages m
SET diocese_slug = p.diocese_slug
FROM public.organizer_profiles p
WHERE p.user_id = m.sender_user_id AND m.diocese_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_discussion_threads_diocese ON public.discussion_threads(diocese_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_diocese ON public.direct_messages(diocese_slug);