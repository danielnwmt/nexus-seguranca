-- Força o PostgREST a recarregar o schema cache após alterações DDL
NOTIFY pgrst, 'reload schema';