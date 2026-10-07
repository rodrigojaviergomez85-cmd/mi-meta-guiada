CREATE OR REPLACE FUNCTION public.move_goal(_id uuid, _new_pos int)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE g public.goals; n int; p int;
BEGIN
  SELECT * INTO g FROM public.goals WHERE id = _id;
  IF g.id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.goals WHERE snapshot_id = g.snapshot_id AND company = g.company AND level = g.level;
  p := LEAST(GREATEST(_new_pos, 1), n);
  IF p = g.position THEN RETURN; END IF;
  UPDATE public.goals SET position = position + 100000 WHERE snapshot_id = g.snapshot_id AND company = g.company AND level = g.level;
  UPDATE public.goals t SET position = s.rn FROM (
    SELECT id, row_number() OVER (ORDER BY
      CASE WHEN id = _id THEN p
           WHEN g.position < p AND position - 100000 > g.position AND position - 100000 <= p THEN position - 100000 - 1
           WHEN g.position > p AND position - 100000 >= p AND position - 100000 < g.position THEN position - 100000 + 1
           ELSE position - 100000 END) rn
    FROM public.goals WHERE snapshot_id = g.snapshot_id AND company = g.company AND level = g.level) s
  WHERE t.id = s.id;
END; $$;

CREATE OR REPLACE FUNCTION public.move_company_issue_item(_id uuid, _new_pos int)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE g public.company_issue_items; n int; p int;
BEGIN
  SELECT * INTO g FROM public.company_issue_items WHERE id = _id;
  IF g.id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.company_issue_items WHERE snapshot_id = g.snapshot_id AND company = g.company;
  p := LEAST(GREATEST(_new_pos, 1), n);
  IF p = g.position THEN RETURN; END IF;
  UPDATE public.company_issue_items SET position = position + 100000 WHERE snapshot_id = g.snapshot_id AND company = g.company;
  UPDATE public.company_issue_items t SET position = s.rn FROM (
    SELECT id, row_number() OVER (ORDER BY
      CASE WHEN id = _id THEN p
           WHEN g.position < p AND position - 100000 > g.position AND position - 100000 <= p THEN position - 100000 - 1
           WHEN g.position > p AND position - 100000 >= p AND position - 100000 < g.position THEN position - 100000 + 1
           ELSE position - 100000 END) rn
    FROM public.company_issue_items WHERE snapshot_id = g.snapshot_id AND company = g.company) s
  WHERE t.id = s.id;
END; $$;

GRANT EXECUTE ON FUNCTION public.move_goal(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_company_issue_item(uuid, int) TO authenticated;