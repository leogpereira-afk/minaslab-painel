-- Messenger: arquivos e imagens nas conversas. O arquivo fica no bucket PRIVADO ml-arquivos (pasta conversas/<id>/);
-- a mensagem guarda nome, tipo, tamanho e caminho. Só os membros baixam, por link assinado de curta duração.
alter table public.ml_conversa_mensagens add column if not exists anexo_nome text;
alter table public.ml_conversa_mensagens add column if not exists anexo_tipo text;
alter table public.ml_conversa_mensagens add column if not exists anexo_tamanho integer;
alter table public.ml_conversa_mensagens add column if not exists anexo_caminho text;

-- Mensagem só com arquivo (sem legenda) é válida.
alter table public.ml_conversa_mensagens drop constraint if exists ml_conversa_mensagens_texto_check;
alter table public.ml_conversa_mensagens add constraint ml_conversa_mensagens_texto_check check (length(btrim(texto)) > 0 or anexo_caminho is not null);
