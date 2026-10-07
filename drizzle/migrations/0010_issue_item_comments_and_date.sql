ALTER TABLE public.company_issue_items ADD COLUMN item_date date DEFAULT CURRENT_DATE;
UPDATE public.company_issue_items SET item_date = updated_at::date WHERE item_date IS NULL OR item_date = CURRENT_DATE;

CREATE TABLE public.issue_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.company_issue_items(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_item_comments TO authenticated;
GRANT ALL ON public.issue_item_comments TO service_role;
ALTER TABLE public.issue_item_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own issue item comments" ON public.issue_item_comments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_issue_items i JOIN public.snapshots s ON s.id = i.snapshot_id WHERE i.id = issue_item_comments.item_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_issue_items i JOIN public.snapshots s ON s.id = i.snapshot_id WHERE i.id = issue_item_comments.item_id AND s.user_id = auth.uid()));
CREATE POLICY "owner only" ON public.issue_item_comments AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE INDEX issue_item_comments_item ON public.issue_item_comments(item_id);
CREATE TRIGGER t_issue_item_comments BEFORE UPDATE ON public.issue_item_comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();