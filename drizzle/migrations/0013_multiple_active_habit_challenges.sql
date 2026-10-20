DROP INDEX IF EXISTS public.habit_challenges_one_active;
CREATE INDEX habit_challenges_active_by_user ON public.habit_challenges(user_id, created_at) WHERE active;