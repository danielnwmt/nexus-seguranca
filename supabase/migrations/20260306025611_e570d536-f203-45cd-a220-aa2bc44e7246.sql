
-- Alterar stream_key de UUID para TEXT para suportar chaves numéricas de 5-12 dígitos
ALTER TABLE public.cameras ALTER COLUMN stream_key SET DATA TYPE text USING stream_key::text;
ALTER TABLE public.cameras ALTER COLUMN stream_key SET DEFAULT '';

NOTIFY pgrst, 'reload schema';
