-- Comissão do coletor por coleta (pedido da Ana, 05/11/2026).
-- Na coleta marca-se: NORMAL (sem comissão), COMPOSTA ou VIAGEM (+ km ida e volta).
-- A Folha de Pagamento do painel lê as COLETADAS do mês (Edge Function ml-rh-coletas).
alter table public.coletas
  add column if not exists tipo_pagamento text not null default 'NORMAL',
  add column if not exists km_viagem numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='coletas_tipo_pagamento_check') then
    alter table public.coletas add constraint coletas_tipo_pagamento_check check (tipo_pagamento in ('NORMAL','COMPOSTA','VIAGEM'));
  end if;
  if not exists (select 1 from pg_constraint where conname='coletas_km_viagem_check') then
    alter table public.coletas add constraint coletas_km_viagem_check check (km_viagem is null or km_viagem >= 0);
  end if;
end $$;
comment on column public.coletas.tipo_pagamento is 'Comissão do coletor: NORMAL (sem comissão), COMPOSTA ou VIAGEM. Lido pela Folha de Pagamento do painel.';
comment on column public.coletas.km_viagem is 'Km da viagem, ida e volta (só quando tipo_pagamento = VIAGEM).';
-- A lista da tela de Coletas passa a devolver os dois campos.
do $$ declare d text; begin
  select pg_get_functiondef('public.crm_coletas_list'::regproc) into d;
  if position('c.tipo_pagamento' in d) = 0 then
    d := replace(d, 'c.endereco_evento,c.updated_at,', 'c.endereco_evento,c.updated_at,c.tipo_pagamento,c.km_viagem,');
    execute d;
  end if;
end $$;
