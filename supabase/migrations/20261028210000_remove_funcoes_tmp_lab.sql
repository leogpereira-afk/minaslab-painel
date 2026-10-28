-- Remove as funções temporárias usadas só na importação inicial do laboratório.
drop function if exists public.ml_tmp_import(text, text);
drop function if exists public.ml_tmp_b(text);
drop function if exists public.ml_tmp_d(text);
drop function if exists public.ml_tmp_l(text, text[]);
