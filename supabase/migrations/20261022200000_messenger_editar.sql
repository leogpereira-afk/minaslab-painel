-- Messenger: editar mensagem enviada.
-- editada_em: mostra "editada" na conversa. texto_original: a primeira versão,
-- guardada para rastreabilidade (não aparece na tela).
-- alterado_em: quando a mensagem foi editada ou apagada — quem está com a
-- conversa aberta recebe a mudança na próxima atualização (sem reabrir).
alter table public.ml_conversa_mensagens add column if not exists editada_em timestamptz;
alter table public.ml_conversa_mensagens add column if not exists texto_original text;
alter table public.ml_conversa_mensagens add column if not exists alterado_em timestamptz;
create index if not exists ml_conversa_mensagens_alterado_idx on public.ml_conversa_mensagens (conversa_id, alterado_em) where alterado_em is not null;
