ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_position_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_position_min CHECK (position >= 1);

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
    INSERT INTO public.goals(snapshot_id,company,level,position,text,done)
    SELECT new_id, company, level, position, text, false FROM public.goals WHERE snapshot_id = prev.id;
  ELSE
    INSERT INTO public.goals(snapshot_id,company,level,position,text)
    SELECT new_id, c, l, 1, '' FROM unnest(enum_range(NULL::public.goal_company)) c,
      unnest(enum_range(NULL::public.goal_level)) l;
  END IF;
  RETURN new_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.add_goal(_snapshot_id uuid, _company public.goal_company, _level public.goal_level)
 RETURNS public.goals LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE r public.goals;
BEGIN
  INSERT INTO public.goals(snapshot_id, company, level, position, text)
  SELECT _snapshot_id, _company, _level, COALESCE(MAX(position),0)+1, ''
  FROM public.goals WHERE snapshot_id = _snapshot_id AND company = _company AND level = _level
  RETURNING * INTO r;
  RETURN r;
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_goal(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE g public.goals;
BEGIN
  SELECT * INTO g FROM public.goals WHERE id = _id;
  IF g.id IS NULL THEN RETURN; END IF;
  DELETE FROM public.goals WHERE id = _id;
  UPDATE public.goals SET position = position + 100000
   WHERE snapshot_id = g.snapshot_id AND company = g.company AND level = g.level;
  UPDATE public.goals t SET position = s.rn FROM (
    SELECT id, row_number() OVER (ORDER BY position) rn FROM public.goals
     WHERE snapshot_id = g.snapshot_id AND company = g.company AND level = g.level) s
   WHERE t.id = s.id;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.add_goal(uuid, public.goal_company, public.goal_level) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_goal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_goal(uuid, public.goal_company, public.goal_level) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_goal(uuid) TO authenticated;