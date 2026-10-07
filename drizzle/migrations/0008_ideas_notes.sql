CREATE TABLE public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL DEFAULT 'personal' CHECK (category IN ('personal','e4kids','e4cc','otros')),
  idea_date date NOT NULL DEFAULT CURRENT_DATE,
  text text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideas TO authenticated;
GRANT ALL ON public.ideas TO service_role;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ideas" ON public.ideas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner only" ON public.ideas AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE INDEX ideas_user_date ON public.ideas(user_id, idea_date DESC);
CREATE TRIGGER t_ideas BEFORE UPDATE ON public.ideas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();