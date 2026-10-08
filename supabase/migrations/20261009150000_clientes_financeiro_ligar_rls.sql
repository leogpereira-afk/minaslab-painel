-- Segunda trava de segurança: liga o RLS (sem criar regra de acesso) em clientes_financeiro.
-- Hoje a tabela já não dá permissão a anon/authenticated; o RLS acrescenta a camada que as demais tabelas do sistema já têm.
-- Quem lê continua lendo: service_role (servidor), postgres (dono, inclusive as funções SECURITY DEFINER) e donboy_leitor ignoram o RLS.
-- Já aplicada em produção em 09/10/2026 (conferido: dono e servidor enxergam as 1.100 linhas; anon e authenticated seguem negados).
alter table public.clientes_financeiro enable row level security;
