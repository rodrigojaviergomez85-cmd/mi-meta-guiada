CREATE TABLE public.habit_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  habit text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'personal',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX habit_challenges_one_active ON public.habit_challenges(user_id) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_challenges TO authenticated;
GRANT ALL ON public.habit_challenges TO service_role;
ALTER TABLE public.habit_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habit challenges" ON public.habit_challenges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner only" ON public.habit_challenges AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.habit_challenge_days (
  challenge_id uuid NOT NULL REFERENCES public.habit_challenges(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 66),
  checked_on date NOT NULL DEFAULT CURRENT_DATE,
  comment text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, day_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_challenge_days TO authenticated;
GRANT ALL ON public.habit_challenge_days TO service_role;
ALTER TABLE public.habit_challenge_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habit challenge days" ON public.habit_challenge_days FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.habit_challenges c WHERE c.id = challenge_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.habit_challenges c WHERE c.id = challenge_id AND c.user_id = auth.uid()));
CREATE POLICY "owner only" ON public.habit_challenge_days AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());