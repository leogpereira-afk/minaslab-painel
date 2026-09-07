alter table public.movimentos_bancarios
  drop constraint if exists movimentos_bancarios_origem_check;

alter table public.movimentos_bancarios
  add constraint movimentos_bancarios_origem_check
  check (origem = any (array['MANUAL'::text,'OFX'::text,'OMIE'::text,'CSV_C6'::text]));
