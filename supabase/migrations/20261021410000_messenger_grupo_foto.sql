-- Messenger: foto e descrição do grupo (painel "Sobre o grupo"). A foto usa o mesmo bucket público das fotos de perfil.
alter table public.ml_conversas add column if not exists foto text;
alter table public.ml_conversas add column if not exists descricao text not null default '';
