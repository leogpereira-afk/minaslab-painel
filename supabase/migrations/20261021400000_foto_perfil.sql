-- Foto de perfil de quem entra no painel (cadastrada pela direção em Acessos).
-- A foto fica num bucket PÚBLICO só de leitura (nome com data: troca de foto = endereço novo, sem cache velho);
-- quem grava é a função ml-contas (service role). A coluna guarda só o endereço.
alter table public.ml_contas add column if not exists foto text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ml-fotos-perfil', 'ml-fotos-perfil', true, 512000, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 512000, allowed_mime_types = array['image/jpeg'];
