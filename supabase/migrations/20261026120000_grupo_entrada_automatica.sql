-- Grupos de mensagens com entrada automática: todo colaborador novo do painel entra sozinho.
-- Marcado por conversa (não pelo nome), então renomear o grupo não quebra a regra.
alter table public.ml_conversas add column if not exists entrada_automatica boolean not null default false;
update public.ml_conversas set entrada_automatica = true
 where id = '68045f7f-5504-4f97-84f8-645b3eb27d92' and tipo = 'grupo'; -- grupo "MinasLab"

create or replace function public.ml_entrar_grupos_automaticos()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare g record; ultima bigint; nova record;
begin
  if not coalesce(new.ativo, true) then return new; end if;
  for g in select id from ml_conversas where tipo = 'grupo' and entrada_automatica and not apagada loop
    if exists (select 1 from ml_conversa_membros where conversa_id = g.id and usuario = new.usuario and saiu_em is null) then continue; end if;
    -- Começa "lido" até a última mensagem: quem chega não recebe o histórico como não lido.
    select coalesce(max(seq), 0) into ultima from ml_conversa_mensagens where conversa_id = g.id;
    insert into ml_conversa_membros (conversa_id, usuario, papel, entrou_em, lido_ate, saiu_em)
    values (g.id, new.usuario, 'membro', now(), ultima, null)
    on conflict (conversa_id, usuario) do update set saiu_em = null, entrou_em = now(), lido_ate = excluded.lido_ate;
    insert into ml_conversa_mensagens (conversa_id, autor, tipo, texto)
    values (g.id, null, 'sistema', coalesce(nullif(initcap(lower(trim(new.nome))), ''), new.usuario) || ' entrou no grupo.')
    returning seq, criado_em, texto into nova;
    update ml_conversas set ultima_msg_em = nova.criado_em, ultima_msg_texto = nova.texto, ultima_msg_autor = null where id = g.id;
    update ml_conversa_membros set lido_ate = nova.seq where conversa_id = g.id and usuario = new.usuario;
  end loop;
  return new;
end $$;
revoke all on function public.ml_entrar_grupos_automaticos() from public, anon, authenticated;

drop trigger if exists ml_contas_grupos_automaticos on public.ml_contas;
create trigger ml_contas_grupos_automaticos after insert on public.ml_contas
for each row execute function public.ml_entrar_grupos_automaticos();
