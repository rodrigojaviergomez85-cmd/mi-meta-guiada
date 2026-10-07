CREATE TABLE public.company_issue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  company public.goal_company NOT NULL,
  position integer NOT NULL CHECK (position >= 1),
  text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, company, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_issue_items TO authenticated;
GRANT ALL ON public.company_issue_items TO service_role;

ALTER TABLE public.company_issue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company issue items"
ON public.company_issue_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.snapshots s
    WHERE s.id = company_issue_items.snapshot_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.snapshots s
    WHERE s.id = company_issue_items.snapshot_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "owner only"
ON public.company_issue_items
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

CREATE TRIGGER t_company_issue_items
BEFORE UPDATE ON public.company_issue_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.company_issue_items (snapshot_id, company, position, text)
SELECT snapshot_id, company, 1, body
FROM public.company_issues
WHERE btrim(body) <> '';

COMMENT ON TABLE public.company_issues IS 'DEPRECATED: replaced by public.company_issue_items';

CREATE OR REPLACE FUNCTION public.add_company_issue_item(
  _snapshot_id uuid,
  _company public.goal_company
)
RETURNS public.company_issue_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE r public.company_issue_items;
BEGIN
  INSERT INTO public.company_issue_items(snapshot_id, company, position, text)
  SELECT _snapshot_id, _company, COALESCE(MAX(position), 0) + 1, ''
  FROM public.company_issue_items
  WHERE snapshot_id = _snapshot_id AND company = _company
  RETURNING * INTO r;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_company_issue_item(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE item public.company_issue_items;
BEGIN
  SELECT * INTO item FROM public.company_issue_items WHERE id = _id;
  IF item.id IS NULL THEN RETURN; END IF;
  DELETE FROM public.company_issue_items WHERE id = _id;
  UPDATE public.company_issue_items SET position = position + 100000
  WHERE snapshot_id = item.snapshot_id AND company = item.company AND position > item.position;
  UPDATE public.company_issue_items SET position = position - 100001
  WHERE snapshot_id = item.snapshot_id AND company = item.company AND position > 100000;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_company_issue_item(uuid, public.goal_company) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_company_issue_item(uuid) TO authenticated;