-- Mantém texto digitado quando OS ou oportunidade não corresponde a um cadastro.
alter table public.coletas add column if not exists numero_os_referencia text;
alter table public.agendamentos add column if not exists numero_os_referencia text;
alter table public.propostas add column if not exists oportunidade_referencia text;

update public.coletas c set numero_os_referencia=os.numero_os
from public.ordens_servico os
where c.ordem_servico_id=os.id and c.numero_os_referencia is null;

update public.agendamentos a set numero_os_referencia=os.numero_os
from public.ordens_servico os
where a.ordem_servico_id=os.id and a.numero_os_referencia is null;

update public.propostas p set oportunidade_referencia=o.titulo
from public.oportunidades o
where p.oportunidade_id=o.id and p.oportunidade_referencia is null;

create index if not exists coletas_numero_os_referencia_idx on public.coletas(numero_os_referencia) where numero_os_referencia is not null;
create index if not exists agendamentos_numero_os_referencia_idx on public.agendamentos(numero_os_referencia) where numero_os_referencia is not null;
create index if not exists propostas_oportunidade_referencia_idx on public.propostas(oportunidade_referencia) where oportunidade_referencia is not null;
