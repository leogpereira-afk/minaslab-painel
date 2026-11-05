-- Mensagens: responder uma mensagem específica (citação), pedido da Ana em 05/11/2026.
-- A resposta guarda o id da mensagem citada; apagar a original não apaga a resposta.
alter table public.ml_conversa_mensagens
  add column if not exists responde_a uuid references public.ml_conversa_mensagens(id) on delete set null;
create index if not exists ml_conversa_mensagens_responde_a_idx on public.ml_conversa_mensagens (responde_a) where responde_a is not null;
