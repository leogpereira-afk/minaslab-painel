-- Tarefas do CRM aparecem nas Tarefas do painel, e o Acompanhamento de provedores cria tarefa
-- automática para o dia em que a amostra deve chegar no provedor.
--
-- 1) CRM -> painel: cada tarefa do CRM (public.tarefas + tarefa_responsaveis) vira uma tarefa no
--    painel (ml_tarefas) para cada responsável que tem usuário no painel (crm_sso_vinculos).
--    Prazo, título, descrição, prioridade e situação acompanham o CRM.
-- 2) painel -> CRM: iniciar/concluir/reabrir a tarefa no painel atualiza a parte daquele
--    responsável no CRM (tarefa_responsaveis), e o CRM recalcula a situação da tarefa.
-- 3) Provedores: envio com "previsão de chegada" e "responsável", ainda não chegado
--    (Aguardando envio / Enviada), gera no CRM a tarefa "Confirmar chegada da amostra" com prazo
--    no dia previsto, 9h. Ao marcar "No provedor" (ou depois) a tarefa é concluída; cancelado ou
--    excluído, a tarefa é cancelada. A tarefa do CRM segue para o painel pelo item 1.
-- Laço evitado com a variável de sessão ml.tarefa_origem ('crm' ou 'painel').

alter table public.provedor_envios add column if not exists responsavel_id uuid references public.profiles(id) on delete set null;
alter table public.provedor_envios add column if not exists previsao_chegada date;
comment on column public.provedor_envios.responsavel_id is 'Quem acompanha o envio: recebe a tarefa de confirmar a chegada no provedor.';
comment on column public.provedor_envios.previsao_chegada is 'Dia em que a amostra deve chegar no provedor (gera a tarefa de confirmação).';

alter table public.tarefas add column if not exists provedor_envio_id uuid references public.provedor_envios(id) on delete set null;
create index if not exists tarefas_provedor_envio_idx on public.tarefas (provedor_envio_id) where provedor_envio_id is not null;

alter table public.ml_tarefas add column if not exists crm_tarefa_id uuid references public.tarefas(id) on delete set null;
alter table public.ml_tarefas add column if not exists crm_usuario_id uuid;
create unique index if not exists ml_tarefas_crm_unq on public.ml_tarefas (crm_tarefa_id, crm_usuario_id) where crm_tarefa_id is not null;

-- ------------------------------------------------------------------ 1) CRM -> painel
create or replace function public.crm_tarefa_espelhar(p_tarefa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t record; r record; v_dono text; v_status text; v_apagar boolean; v_id uuid; v_novo boolean; v_desc text;
begin
  select * into t from public.tarefas where id = p_tarefa;
  if not found then
    update public.ml_tarefas set apagada = true, atualizado_em = now() where crm_tarefa_id = p_tarefa and not apagada;
    return;
  end if;
  perform set_config('ml.tarefa_origem', 'crm', true);
  v_apagar := t.deleted_at is not null or upper(coalesce(t.status,'')) = 'CANCELADA';
  select v.usuario_painel into v_dono from public.crm_sso_vinculos v where v.crm_user_id = t.created_by;
  v_desc := concat_ws(E'\n\n', nullif(btrim(coalesce(t.descricao,'')),''),
            'Tarefa do CRM — atualize por aqui ou no CRM (Tarefas): https://leogpereira-afk.github.io/minaslab-painel/crm/tarefas');

  for r in
    select x.usuario_id, coalesce(x.status, 'PENDENTE') st, x.concluida_em, v.usuario_painel
      from (select tr.usuario_id, tr.status, tr.concluida_em from public.tarefa_responsaveis tr where tr.tarefa_id = t.id
            union all
            select t.responsavel_id, t.status, null::timestamptz where t.responsavel_id is not null
              and not exists (select 1 from public.tarefa_responsaveis tr where tr.tarefa_id = t.id)) x
      join public.crm_sso_vinculos v on v.crm_user_id = x.usuario_id
      join public.ml_contas c on c.usuario = v.usuario_painel and coalesce(c.ativo, true)
  loop
    v_status := case upper(r.st) when 'CONCLUIDA' then 'concluida' when 'CONCLUÍDA' then 'concluida' when 'EM ANDAMENTO' then 'em_andamento' else 'nova' end;
    select id into v_id from public.ml_tarefas where crm_tarefa_id = t.id and crm_usuario_id = r.usuario_id;
    v_novo := v_id is null;
    if v_novo then
      if v_apagar then continue; end if;
      insert into public.ml_tarefas (titulo, descricao, proprietario, responsavel, prazo, urgente, status, iniciada_em, concluida_em, concluida_por, marcadores, crm_tarefa_id, crm_usuario_id, lembrete_min)
      values (left(t.titulo, 200), v_desc, coalesce(v_dono, r.usuario_painel), r.usuario_painel, t.prazo,
              upper(coalesce(t.prioridade,'')) in ('ALTA','URGENTE'), v_status,
              case when v_status <> 'nova' then now() end,
              case when v_status = 'concluida' then coalesce(r.concluida_em, now()) end,
              case when v_status = 'concluida' then r.usuario_painel end,
              array['CRM'], t.id, r.usuario_id,
              case when t.provedor_envio_id is not null then 60 end)
      returning id into v_id;
      if v_status <> 'concluida' then
        insert into public.ml_notificacoes (usuario, tipo, titulo, corpo, link, ref_tipo, ref_id)
        values (r.usuario_painel, 'tarefa_nova', 'Nova tarefa do CRM', left(t.titulo, 200), '/tarefas?abrir=' || v_id, 'tarefa', v_id);
      end if;
    else
      update public.ml_tarefas m set
        titulo = left(t.titulo, 200), descricao = v_desc, responsavel = r.usuario_painel, prazo = t.prazo,
        urgente = upper(coalesce(t.prioridade,'')) in ('ALTA','URGENTE'),
        status = case when m.status = 'aguardando' and v_status = 'em_andamento' then m.status else v_status end,
        iniciada_em = case when v_status <> 'nova' then coalesce(m.iniciada_em, now()) else m.iniciada_em end,
        concluida_em = case when v_status = 'concluida' then coalesce(m.concluida_em, r.concluida_em, now()) end,
        concluida_por = case when v_status = 'concluida' then coalesce(m.concluida_por, r.usuario_painel) end,
        apagada = v_apagar, atualizado_em = now()
      where m.id = v_id
        and (m.titulo, m.descricao, m.responsavel, m.prazo, m.urgente, m.status, m.apagada) is distinct from
            (left(t.titulo, 200), v_desc, r.usuario_painel, t.prazo, upper(coalesce(t.prioridade,'')) in ('ALTA','URGENTE'),
             case when m.status = 'aguardando' and v_status = 'em_andamento' then m.status else v_status end, v_apagar);
    end if;
  end loop;

  -- responsável retirado da tarefa no CRM: some do painel dele
  update public.ml_tarefas m set apagada = true, atualizado_em = now()
   where m.crm_tarefa_id = t.id and not m.apagada
     and not exists (select 1 from public.tarefa_responsaveis tr where tr.tarefa_id = t.id and tr.usuario_id = m.crm_usuario_id)
     and m.crm_usuario_id is distinct from (case when not exists (select 1 from public.tarefa_responsaveis tr where tr.tarefa_id = t.id) then t.responsavel_id end);
end $$;
revoke all on function public.crm_tarefa_espelhar(uuid) from public, anon, authenticated;

create or replace function public.trg_crm_tarefa_espelhar()
returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(coalesce(new, old)); -- serve para tarefas e tarefa_responsaveis
begin
  if coalesce(current_setting('ml.tarefa_origem', true), '') = 'painel' then return null; end if;
  perform public.crm_tarefa_espelhar((case when tg_table_name = 'tarefas' then j->>'id' else j->>'tarefa_id' end)::uuid);
  return null;
end $$;

drop trigger if exists trg_tarefas_espelhar_painel on public.tarefas;
create trigger trg_tarefas_espelhar_painel after insert or update on public.tarefas
  for each row execute function public.trg_crm_tarefa_espelhar();
drop trigger if exists trg_tarefa_resp_espelhar_painel on public.tarefa_responsaveis;
create trigger trg_tarefa_resp_espelhar_painel after insert or update or delete on public.tarefa_responsaveis
  for each row execute function public.trg_crm_tarefa_espelhar();

-- ------------------------------------------------------------------ 2) painel -> CRM
create or replace function public.trg_ml_tarefa_para_crm()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_st text;
begin
  if new.crm_tarefa_id is null or new.status is not distinct from old.status then return null; end if;
  if coalesce(current_setting('ml.tarefa_origem', true), '') = 'crm' then return null; end if;
  perform set_config('ml.tarefa_origem', 'painel', true);
  v_st := case new.status when 'concluida' then 'CONCLUIDA' when 'nova' then 'PENDENTE' else 'EM ANDAMENTO' end;
  update public.tarefa_responsaveis
     set status = v_st, concluida_em = case when v_st = 'CONCLUIDA' then coalesce(new.concluida_em, now()) end, updated_at = now()
   where tarefa_id = new.crm_tarefa_id and usuario_id = new.crm_usuario_id and status is distinct from v_st;
  if not found and not exists (select 1 from public.tarefa_responsaveis where tarefa_id = new.crm_tarefa_id) then
    update public.tarefas set status = v_st, ativo = v_st <> 'CONCLUIDA', updated_at = now()
     where id = new.crm_tarefa_id and upper(coalesce(status,'')) <> 'CANCELADA';
  end if;
  perform set_config('ml.tarefa_origem', '', true);
  return null;
end $$;
drop trigger if exists trg_ml_tarefas_para_crm on public.ml_tarefas;
create trigger trg_ml_tarefas_para_crm after update of status on public.ml_tarefas
  for each row execute function public.trg_ml_tarefa_para_crm();

-- ------------------------------------------------------------------ 3) Provedores -> tarefa
create or replace function public.provedor_envio_tarefa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e public.provedor_envios := new; v_tarefa uuid; v_aberto boolean; v_chegou boolean; v_titulo text; v_desc text; v_prazo timestamptz; v_cliente text;
begin
  select id into v_tarefa from public.tarefas where provedor_envio_id = e.id and deleted_at is null order by created_at desc limit 1;
  v_chegou := e.status in ('NO_PROVEDOR','RESULTADO_RECEBIDO','ENVIADO_CLIENTE');
  v_aberto := e.deleted_at is null and e.status in ('AGUARDANDO_ENVIO','ENVIADA')
              and e.previsao_chegada is not null and e.responsavel_id is not null;

  if v_tarefa is null and not v_aberto then return null; end if;

  if v_tarefa is not null and (e.deleted_at is not null or e.status = 'CANCELADA'
                               or (not v_chegou and (e.previsao_chegada is null or e.responsavel_id is null))) then
    update public.tarefas set status = 'CANCELADA', ativo = false, updated_at = now() where id = v_tarefa and upper(coalesce(status,'')) <> 'CANCELADA';
    return null;
  end if;

  if v_tarefa is not null and v_chegou then
    update public.tarefa_responsaveis set status = 'CONCLUIDA', concluida_em = coalesce(concluida_em, now()), updated_at = now()
     where tarefa_id = v_tarefa and status <> 'CONCLUIDA';
    update public.tarefas set status = 'CONCLUIDA', ativo = false, updated_at = now() where id = v_tarefa and status <> 'CONCLUIDA';
    return null;
  end if;

  if not v_aberto then return null; end if;

  select coalesce(nullif(c.nome_fantasia,''), c.razao_social) into v_cliente from public.clientes c where c.id = e.cliente_id;
  v_titulo := left('Confirmar chegada da amostra no provedor ' || coalesce(nullif(e.provedor_nome,''), 'parceiro')
              || coalesce(' — OS ' || e.numero_os, ''), 200);
  v_desc := concat_ws(E'\n',
    'Verifique com o provedor se a amostra chegou e atualize o Acompanhamento de provedores no CRM (marque "No provedor" e a data de chegada).',
    '', 'Provedor: ' || coalesce(e.provedor_nome, '—'),
    'OS: ' || coalesce(e.numero_os, '—') || coalesce(' · Proposta: ' || e.numero_proposta, ''),
    'Cliente: ' || coalesce(v_cliente, '—'),
    'Amostras: ' || coalesce(nullif(concat_ws(' · ', e.grupo, e.amostras), ''), '—'),
    'Enviada em: ' || coalesce(to_char(e.data_envio, 'DD/MM/YYYY'), 'ainda não enviada'),
    'Previsão de chegada: ' || to_char(e.previsao_chegada, 'DD/MM/YYYY'),
    case when coalesce(e.transportadora, e.codigo_rastreio) is not null then 'Transporte: ' || concat_ws(' · ', e.transportadora, 'rastreio ' || e.codigo_rastreio) end,
    'Acompanhamento: https://leogpereira-afk.github.io/minaslab-painel/crm/provedores');
  v_prazo := (e.previsao_chegada + time '09:00') at time zone 'America/Sao_Paulo';

  if v_tarefa is null then
    insert into public.tarefas (titulo, descricao, prazo, status, prioridade, responsavel_id, cliente_id, ativo, created_by, updated_by, provedor_envio_id)
    values (v_titulo, v_desc, v_prazo, 'PENDENTE', 'ALTA', e.responsavel_id, e.cliente_id, true, coalesce(e.updated_by, e.created_by), coalesce(e.updated_by, e.created_by), e.id)
    returning id into v_tarefa;
    insert into public.tarefa_responsaveis (tarefa_id, usuario_id, status) values (v_tarefa, e.responsavel_id, 'PENDENTE')
    on conflict (tarefa_id, usuario_id) do nothing;
  else
    update public.tarefas set titulo = v_titulo, descricao = v_desc, prazo = v_prazo, responsavel_id = e.responsavel_id, cliente_id = e.cliente_id,
           status = case when upper(coalesce(status,'')) in ('CANCELADA','CONCLUIDA') then 'PENDENTE' else status end, ativo = true, updated_at = now()
     where id = v_tarefa
       and (titulo, descricao, prazo, responsavel_id, cliente_id, upper(coalesce(status,'')) in ('CANCELADA','CONCLUIDA'))
           is distinct from (v_titulo, v_desc, v_prazo, e.responsavel_id, e.cliente_id, false);
    if not exists (select 1 from public.tarefa_responsaveis where tarefa_id = v_tarefa and usuario_id = e.responsavel_id) then
      delete from public.tarefa_responsaveis where tarefa_id = v_tarefa;
      insert into public.tarefa_responsaveis (tarefa_id, usuario_id, status) values (v_tarefa, e.responsavel_id, 'PENDENTE');
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_provedor_envio_tarefa on public.provedor_envios;
create trigger trg_provedor_envio_tarefa after insert or update on public.provedor_envios
  for each row execute function public.provedor_envio_tarefa();

-- Tarefas do CRM já existentes passam para o painel.
do $$ declare x uuid; begin
  for x in select id from public.tarefas where deleted_at is null and upper(coalesce(status,'')) not in ('CONCLUIDA','CANCELADA') loop
    perform public.crm_tarefa_espelhar(x);
  end loop;
end $$;
