create unique index if not exists uq_interacoes_chatpro_external_id
on public.interacoes (external_id)
where source_system = 'CHATPRO' and external_id is not null;
