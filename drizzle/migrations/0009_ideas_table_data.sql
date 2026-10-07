ALTER TABLE public.ideas ADD COLUMN table_data jsonb;
ALTER TABLE public.ideas ADD CONSTRAINT ideas_table_data_array CHECK (table_data IS NULL OR jsonb_typeof(table_data) = 'array');