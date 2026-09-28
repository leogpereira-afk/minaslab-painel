-- Notas da Omie: o status fiscal segue sempre o status da Omie.
-- Mesma função de 20260907134500 (financeiro_normaliza_nota_omie), só o bloco do status muda.
-- O gatilho trg_financeiro_normaliza_nota_omie continua o mesmo (BEFORE INSERT OR UPDATE OF
-- origem, status_omie, dados_omie, numero_nf, empresa_id).

create or replace function public.financeiro_normaliza_nota_omie()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_qtd integer;
  v_venc date;
  v_receb uuid;
begin
  if upper(coalesce(new.origem,'')) <> 'OMIE' then
    return new;
  end if;

  new.nome_emitente := coalesce(nullif(new.nome_emitente,''), nullif(new.dados_omie->'Cabecalho'->>'cRazaoEmissor',''), (select e.nome from public.empresas e where e.id=new.empresa_id));
  new.nome_destinatario := coalesce(nullif(new.nome_destinatario,''), nullif(new.dados_omie->'Cabecalho'->>'cRazaoDestinatario',''));
  new.chave_acesso := coalesce(nullif(new.chave_acesso,''), nullif(new.dados_omie->'Cabecalho'->>'cCodigoVerifNFSe',''));

  -- Vale o que a Omie disser, sempre (decisão do Léo, 28/09/2026): nota cancelada na Omie depois
  -- de emitida vira CANCELADA aqui, mesmo que o status fiscal já estivesse preenchido. Antes,
  -- "CANCELADA" e "EMITIDA" por extenso só valiam com o status fiscal vazio.
  if upper(coalesce(new.status_omie,'')) in ('C','CANCELADA','CANCELADO') then
    new.status_fiscal := 'CANCELADA';
  elsif upper(coalesce(new.status_omie,'')) in ('F','EMITIDA','AUTORIZADA') then
    new.status_fiscal := 'AUTORIZADA';
  end if;

  if new.numero_nf is not null then
    select count(*), min(r.data_vencimento), min(r.id::text)::uuid
      into v_qtd, v_venc, v_receb
    from public.recebimentos r
    where r.empresa_id=new.empresa_id
      and r.numero_nf=new.numero_nf
      and coalesce(r.apagado,false)=false;

    new.data_vencimento := coalesce(new.data_vencimento, v_venc);
    if v_qtd = 1 then new.recebimento_id := coalesce(new.recebimento_id, v_receb); end if;
  end if;

  return new;
end;
$function$;
