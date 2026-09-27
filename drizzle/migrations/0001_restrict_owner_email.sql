CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email','')) = 'english4callcenters@gmail.com'
     AND coalesce((auth.jwt() ->> 'email_verified')::boolean, true)
$$;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
CREATE POLICY "owner only" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "owner only" ON public.snapshots AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "owner only" ON public.goals AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());