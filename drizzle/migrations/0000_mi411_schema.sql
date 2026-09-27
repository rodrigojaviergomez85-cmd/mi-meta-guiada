CREATE TYPE public.goal_company AS ENUM ('personal','e4cc','e4kids');
CREATE TYPE public.goal_level AS ENUM ('annual','monthly','weekly');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT 'Rodrigo Galdamez',
  core_values text NOT NULL DEFAULT '1) Serve  2) Protect  3) Kaizen  4) Golden Rule  5) Great Attitude',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  snapshot_date date NOT NULL DEFAULT current_date,
  month_label text NOT NULL DEFAULT '',
  week_label text NOT NULL DEFAULT '',
  annual_label text NOT NULL DEFAULT '31/DIC/2026',
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.snapshots(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshots TO authenticated;
GRANT ALL ON public.snapshots TO service_role;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  company public.goal_company NOT NULL,
  level public.goal_level NOT NULL,
  position int NOT NULL CHECK (position BETWEEN 1 AND 5),
  text text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, company, level, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.snapshots s WHERE s.id = snapshot_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.snapshots s WHERE s.id = snapshot_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER t_snap BEFORE UPDATE ON public.snapshots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_goal BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bump_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN UPDATE public.snapshots SET updated_at = now() WHERE id = NEW.snapshot_id; RETURN NEW; END; $$;
CREATE TRIGGER t_goal_bump AFTER UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.bump_snapshot();

CREATE OR REPLACE FUNCTION public.create_new_week(_label text, _week_label text, _month_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
  END IF;
  INSERT INTO public.goals(snapshot_id,company,level,position,text)
  SELECT new_id, c, l, p, '' FROM unnest(enum_range(NULL::public.goal_company)) c,
    unnest(enum_range(NULL::public.goal_level)) l, generate_series(1,5) p
  ON CONFLICT DO NOTHING;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.make_current(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.snapshots SET is_current = false WHERE user_id = auth.uid() AND is_current AND id <> _id;
  UPDATE public.snapshots SET is_current = true WHERE user_id = auth.uid() AND id = _id;
END; $$;

CREATE OR REPLACE FUNCTION public.seed_if_empty() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE sid uuid; g text[]; i int;
BEGIN
  INSERT INTO public.profiles(id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.snapshots WHERE user_id = auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.snapshots(user_id,label,month_label,week_label,annual_label,is_current,snapshot_date)
  VALUES (auth.uid(),'9.06.26','SEPT','7-12 SEPT','31/DIC/2026',true,'2026-09-06') RETURNING id INTO sid;
  g := ARRAY[
  'personal','annual','acepto la voluntad de Dios en mi vida, fluyo, escucho a la vida, y sirvo de Corazon',
  'personal','annual','ayudo a los necesitados, becas, asilos, orfanatos y escuela emprendedores',
  'personal','annual','estoy fit, sano y atleta alto rendimiento 9% body fat',
  'personal','annual','Genero $25,000 ingreso pasivo de mis inversiones, invierto 3m',
  'personal','annual','ser feliz en el amor conmigo, NAMASTE, CONMIGO Y TODOS',
  'personal','monthly','meditar 2 veces al dia, pidiendo Dios tome el control 4.10-4.30am mediodia 12.10-12.30md',
  'personal','monthly','AYUDA PRESUPUESTO MENSUAL A COLABORADORES Y OTROS',
  'personal','monthly','comer saludable hacer menu para la semana cena, salpicon, train hard, no cheats till Saturday, sleep 7.30pm',
  'personal','monthly','venta propiedades ineficientes y analisis compra propiedades de $300-$500',
  'personal','monthly','hacer namaste todos los dias',
  'personal','weekly','meditar 2 veces al dia, pidiendo Dios tome el control 4.10-4.30am mediodia 12.10-12.30md',
  'personal','weekly','fondo financiero de alivio',
  'personal','weekly','comer saludable hacer menu para la semana cena, salpicon, train hard, no cheats till Saturday, sleep 7.30pm',
  'personal','weekly','venta de propiedades y analisis financiero mio',
  'personal','weekly','hacer namaste',
  'e4cc','annual','Rentabilidad Anual 15%',
  'e4cc','annual','Customer''s NPS 92%, llegar B2+',
  'e4cc','annual','Team member''s NPS 92%',
  'e4cc','annual','17 million sales',
  'e4cc','annual','A players en toda gerencia',
  'e4cc','monthly','fix evaluations system + game plan individual + new curricula',
  'e4cc','monthly','AI PREZIS y clases, fix intermedios repitentes, y monotono y aburrido clase y tarea, BET/WELL/WRITING, increase task complexity, zero passiveness in AF + Evaluations Team',
  'e4cc','monthly','read and action plan plus missing one on ones with academic and sales team',
  'e4cc','monthly','add ons?? Light course / ultra light course 24.99 a month / 29.99 private',
  'e4cc','monthly','DOMINATE BACHILLERES 6/10 SE INSCRIBAN CON NOSOTROS',
  'e4cc','weekly','TIKTOK BACHILLERES',
  'e4cc','weekly','implement BET/WELL + EVALUATION SYSTEM CALIBRATIONS + GAME PLAN BOTTOM STUDENTS',
  'e4cc','weekly','leer csat',
  'e4cc','weekly','NEW PRICES AND NEW INBOX FLOW',
  'e4cc','weekly','leadership training books to read / senior recruiter',
  'e4kids','annual','Rentabilidad 23%, increase retention by 20%',
  'e4kids','annual','Customer''s NPS 92%, llegar B1+ solido',
  'e4kids','annual','Team member''s NPS 92%',
  'e4kids','annual','20m',
  'e4kids','annual','A PLAYERS en toda gerencia',
  'e4kids','monthly','SLOW PROGRESS NO RESULTS / WEEK 2 QA / REPETITIVE CONTENT: FIX FIRST 8 MONTHS CURRICULA REDESIGN, NEWER ACTIVITIES / MONTHLY AND WEEKLY EVALUATIONS AND CURRICULA REDESIGN / QA DE TODAS LAS LINEAS (si tengo JRS y KIDS me monitoreas las dos) / TRAINING LOW PARTICIPATION, COACH TALKING TIME / WALL OF FAME',
  'e4kids','monthly','AI PREZIS y clases, EPIC AF y new evo flow, WELL/BET + writing + AF variations and completely new flows + videos de progreso',
  'e4kids','monthly','evaluation calibration with coaches',
  'e4kids','monthly','5 audits',
  'e4kids','monthly','push for SV influencers, muppies',
  'e4kids','weekly','QAS WEEK',
  'e4kids','weekly','IMPLEMENT BET/WELL + MONTHLY EVAS + GAME PLAN BOTTOM STUDENTS',
  'e4kids','weekly','leer csat y exit + severance pay',
  'e4kids','weekly','GAMES IN PLATFORM, EPIC CURRICULUM',
  'e4kids','weekly','leadership school, propuesta aumento, data analyst, 12 books to read, curricula manager, recruit 5 F leaders'
  ];
  FOR i IN 0..44 LOOP
    INSERT INTO public.goals(snapshot_id,company,level,position,text)
    VALUES (sid, g[i*3+1]::public.goal_company, g[i*3+2]::public.goal_level, (i % 5) + 1, g[i*3+3]);
  END LOOP;
END; $$;

-- Is there already a registered user? (for hiding sign-up)
CREATE OR REPLACE FUNCTION public.has_any_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles);
$$;

GRANT EXECUTE ON FUNCTION public.create_new_week(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.make_current(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_if_empty() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_user() TO anon, authenticated;