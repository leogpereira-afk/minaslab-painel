-- Pesquisa de satisfação: a tratativa passa a ter tipo. INSATISFACAO (a de sempre, aberta pelo
-- gatilho da resposta) ou MELHORIA (aberta pela Qualidade ao trocar o status da sugestão).
alter table public.satisfacao_tratativas
  add column if not exists tipo text not null default 'INSATISFACAO';
do $$ begin
  alter table public.satisfacao_tratativas
    add constraint satisfacao_tratativas_tipo_chk check (tipo in ('INSATISFACAO', 'MELHORIA'));
exception when duplicate_object then null; end $$;
-- Uma tratativa de melhoria por resposta.
create unique index if not exists satisfacao_tratativas_melhoria_uma
  on public.satisfacao_tratativas (resposta_id) where tipo = 'MELHORIA';
