CREATE TABLE public.btm_days (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL,
  follow_up text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE TABLE public.btm_priorities (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  scope text NOT NULL CHECK (scope IN ('day','week')),
  ref_date date NOT NULL,
  position int NOT NULL CHECK (position BETWEEN 1 AND 6),
  text text NOT NULL DEFAULT '',
  minutes int NULL CHECK (minutes IS NULL OR (minutes > 0 AND minutes <= 1440)),
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, ref_date, position),
  CHECK (scope <> 'week' OR extract(isodow FROM ref_date) = 1)
);
CREATE TABLE public.btm_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  activity text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX btm_blocks_user_day ON public.btm_blocks(user_id, day);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.btm_days, public.btm_priorities, public.btm_blocks TO authenticated;
GRANT ALL ON public.btm_days, public.btm_priorities, public.btm_blocks TO service_role;

ALTER TABLE public.btm_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btm_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btm_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own btm days" ON public.btm_days FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner only" ON public.btm_days AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "own btm priorities" ON public.btm_priorities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner only" ON public.btm_priorities AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "own btm blocks" ON public.btm_blocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner only" ON public.btm_blocks AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TRIGGER t_btm_days BEFORE UPDATE ON public.btm_days FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_btm_prio BEFORE UPDATE ON public.btm_priorities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_btm_blocks BEFORE UPDATE ON public.btm_blocks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();