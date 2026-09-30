alter table public.leads
  add column if not exists email_contato text,
  add column if not exists empresa_contato text;

comment on column public.leads.email_contato is 'E-mail informado no atendimento antes da conversão em cliente/contato.';
comment on column public.leads.empresa_contato is 'Empresa informada no atendimento antes da conversão em cliente/contato.';