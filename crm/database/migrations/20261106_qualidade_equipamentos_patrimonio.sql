-- Equipamentos: o cadastro é o do Patrimônio (ml_patrimonio). qualidade_equipamentos vira a ficha metrológica
-- do bem (ISO 17025 6.4/6.5), criada e atualizada pela função ml-qualidade para todo bem que requer calibração ou
-- qualificação. "bloqueado" = não apto (calibração/verificação reprovada), mostrado também no Patrimônio e em Manutenções.
alter table public.qualidade_equipamentos add column if not exists bem_id text unique;
alter table public.qualidade_equipamentos add column if not exists faixa_uso text;
alter table public.qualidade_equipamentos add column if not exists bloqueado boolean not null default false;
alter table public.qualidade_equipamentos add column if not exists bloqueio_motivo text;
alter table public.qualidade_calibracoes add column if not exists manutencao_id text;
