ALTER TABLE public.snapshots
  ADD COLUMN week_start date NULL,
  ADD COLUMN week_end date NULL,
  ADD COLUMN week_number int NULL CHECK (week_number BETWEEN 1 AND 53),
  ADD COLUMN year int NULL;

CREATE OR REPLACE FUNCTION public.create_new_week(_label text, _week_label text, _month_label text, _week_start date, _week_end date, _week_number int, _year int)
 RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE prev public.snapshots; new_id uuid;
BEGIN
  SELECT * INTO prev FROM public.snapshots WHERE user_id = auth.uid() AND is_current ORDER BY created_at DESC LIMIT 1;
  UPDATE public.snapshots SET is_current = false WHERE user_id = auth.uid() AND is_current;
  INSERT INTO public.snapshots(user_id,label,month_label,week_label,annual_label,is_current,week_start,week_end,week_number,year)
  VALUES (auth.uid(), _label, _month_label, _week_label, COALESCE(prev.annual_label,'31/DIC/2026'), true,_week_start,_week_end,_week_number,_year)
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
REVOKE EXECUTE ON FUNCTION public.create_new_week(text,text,text,date,date,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_new_week(text,text,text,date,date,int,int) TO authenticated;