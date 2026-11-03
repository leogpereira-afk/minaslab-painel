-- Cliente 360: o histórico do relacionamento passa a enxergar ChatPro e e-mail.
-- Mensagens do ChatPro (interacoes) e e-mails (email_mensagens) ficavam presos ao atendimento (lead) sem o cliente;
-- quando o atendimento era ligado ao cliente, as mensagens antigas continuavam sem cliente.
-- 1) Preenche o cliente pelo atendimento já ligado e, nos e-mails, pelo endereço de um contato/cliente (só quando é de um único cliente).
-- 2) Daqui em diante: ao ligar o atendimento ao cliente, as mensagens dele vão junto; mensagem nova com atendimento ligado já nasce com cliente.

update public.interacoes i set cliente_id = l.cliente_convertido_id, contato_id = coalesce(i.contato_id, l.contato_convertido_id)
  from public.leads l where l.id = i.lead_id and i.cliente_id is null and l.cliente_convertido_id is not null;

update public.email_mensagens e set cliente_id = l.cliente_convertido_id, contato_id = coalesce(e.contato_id, l.contato_convertido_id)
  from public.leads l where l.id = e.lead_id and e.cliente_id is null and l.cliente_convertido_id is not null;

with enderecos as (
  select e.id, lower(btrim(case when e.direcao = 'SENT' then coalesce(e.para[1], '') else coalesce(e.de_email, '') end)) em
    from public.email_mensagens e where e.cliente_id is null),
donos as (
  select x.id, min(c.cliente_id::text)::uuid cliente_id, count(distinct c.cliente_id) n
    from enderecos x join (
      select k.cliente_id, lower(btrim(k.email)) em from public.contatos k where k.deleted_at is null and k.email like '%@%'
      union select c.id, lower(btrim(c.email_principal)) from public.clientes c where c.deleted_at is null and c.email_principal like '%@%') c on c.em = x.em
   where x.em like '%@%' and x.em not like '%@minaslab%'
   group by x.id)
update public.email_mensagens e set cliente_id = d.cliente_id from donos d where d.id = e.id and d.n = 1;

create or replace function public.crm_lead_cliente_propagar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cliente_convertido_id is not null and new.cliente_convertido_id is distinct from old.cliente_convertido_id then
    update public.interacoes set cliente_id = new.cliente_convertido_id, contato_id = coalesce(contato_id, new.contato_convertido_id)
     where lead_id = new.id and (cliente_id is null or cliente_id = old.cliente_convertido_id);
    update public.email_mensagens set cliente_id = new.cliente_convertido_id, contato_id = coalesce(contato_id, new.contato_convertido_id)
     where lead_id = new.id and (cliente_id is null or cliente_id = old.cliente_convertido_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_lead_cliente_propagar on public.leads;
create trigger trg_lead_cliente_propagar after update of cliente_convertido_id on public.leads
  for each row execute function public.crm_lead_cliente_propagar();

create or replace function public.crm_msg_cliente_do_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cli uuid; v_ct uuid;
begin
  if new.cliente_id is null and new.lead_id is not null then
    select l.cliente_convertido_id, l.contato_convertido_id into v_cli, v_ct from public.leads l where l.id = new.lead_id;
    if v_cli is not null then new.cliente_id := v_cli; new.contato_id := coalesce(new.contato_id, v_ct); end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_interacoes_cliente_do_lead on public.interacoes;
create trigger trg_interacoes_cliente_do_lead before insert or update of lead_id on public.interacoes
  for each row execute function public.crm_msg_cliente_do_lead();
drop trigger if exists trg_email_cliente_do_lead on public.email_mensagens;
create trigger trg_email_cliente_do_lead before insert or update of lead_id on public.email_mensagens
  for each row execute function public.crm_msg_cliente_do_lead();
