-- Canais: visual de cada publicação (estilo do cartão e cor da paleta), para o
-- mural não ficar todo igual. {} = automático (o sistema varia pelo tipo).
alter table public.ml_canais_posts add column if not exists visual jsonb not null default '{}'::jsonb;
