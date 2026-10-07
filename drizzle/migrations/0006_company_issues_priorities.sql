CREATE TABLE public.company_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  company public.goal_company NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, company)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_issues TO authenticated;
GRANT ALL ON public.company_issues TO service_role;

ALTER TABLE public.company_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company issues"
ON public.company_issues
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.snapshots s
    WHERE s.id = company_issues.snapshot_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.snapshots s
    WHERE s.id = company_issues.snapshot_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "owner only"
ON public.company_issues
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

CREATE TRIGGER t_company_issues
BEFORE UPDATE ON public.company_issues
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();