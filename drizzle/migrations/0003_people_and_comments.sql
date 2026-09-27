CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own people" ON public.people FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner only" ON public.people AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

ALTER TABLE public.goals ADD COLUMN assignee_id uuid NULL REFERENCES public.people(id) ON DELETE SET NULL;

CREATE TABLE public.goal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX goal_comments_goal_id_idx ON public.goal_comments(goal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_comments TO authenticated;
GRANT ALL ON public.goal_comments TO service_role;
ALTER TABLE public.goal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goal comments" ON public.goal_comments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.goals g JOIN public.snapshots s ON s.id = g.snapshot_id WHERE g.id = goal_comments.goal_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.goals g JOIN public.snapshots s ON s.id = g.snapshot_id WHERE g.id = goal_comments.goal_id AND s.user_id = auth.uid()));
CREATE POLICY "owner only" ON public.goal_comments AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER t_comment BEFORE UPDATE ON public.goal_comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.create_new_week(_label text, _week_label text, _month_label text)
 RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE prev public.snapshots; new_id uuid;
BEGIN
  SELECT * INTO prev FROM public.snapshots WHERE user_id = auth.uid() AND is_current ORDER BY created_at DESC LIMIT 1;
  UPDATE public.snapshots SET is_current = false WHERE user_id = auth.uid() AND is_current;
  INSERT INTO public.snapshots(user_id,label,month_label,week_label,annual_label,is_current)
  VALUES (auth.uid(), _label, _month_label, _week_label, COALESCE(prev.annual_label,'31/DIC/2026'), true)
  RETURNING id INTO new_id;
  IF prev.id IS NOT NULL THEN
    INSERT INTO public.goals(snapshot_id,company,level,position,text,done,assignee_id)
    SELECT new_id, company, level, position, text, false, assignee_id FROM public.goals WHERE snapshot_id = prev.id;
  ELSE
    INSERT INTO public.goals(snapshot_id,company,level,position,text)
    SELECT new_id, c, l, 1, '' FROM unnest(enum_range(NULL::public.goal_company)) c,
      unnest(enum_range(NULL::public.goal_level)) l;
  END IF;
  RETURN new_id;
END; $function$;