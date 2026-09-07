-- Normaliza metadados de notas fiscais vindas da Omie sem alterar o status bruto da integração.
create or replace function public.financeiro_normaliza_nota_omie()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_qtd integer;
  v_venc date;
  v_receb uuid;
begin
  if upper(coalesce(new.origem,'')) <> 'OMIE' then
    return new;
  end if;

  new.nome_emitente := coalesce(
    nullif(new.nome_emitente,''),
    nullif(new.dados_omie->'Cabecalho'->>'cRazaoEmissor',''),
    (select e.nome from public.empresas e where e.id=new.empresa_id)
  );
  new.nome_destinatario := coalesce(
    nullif(new.nome_destinatario,''),
    nullif(new.dados_omie->'Cabecalho'->>'cRazaoDestinatario','')
  );
  new.chave_acesso := coalesce(
    nullif(new.chave_acesso,''),
    nullif(new.dados_omie->'Cabecalho'->>'cCodigoVerifNFSe','')
  );

  if upper(coalesce(new.status_omie,'')) = 'C' then
    new.status_fiscal := 'CANCELADA';
  elsif upper(coalesce(new.status_omie,'')) = 'F' then
    new.status_fiscal := 'AUTORIZADA';
  elsif new.status_fiscal is null and upper(coalesce(new.status_omie,'')) in ('EMITIDA','AUTORIZADA') then
    new.status_fiscal := 'AUTORIZADA';
  elsif new.status_fiscal is null and upper(coalesce(new.status_omie,'')) = 'CANCELADA' then
    new.status_fiscal := 'CANCELADA';
  end if;

  if new.numero_nf is not null then
    select count(*), min(r.data_vencimento), min(r.id::text)::uuid
      into v_qtd, v_venc, v_receb
    from public.recebimentos r
    where r.empresa_id=new.empresa_id
      and r.numero_nf=new.numero_nf
      and coalesce(r.apagado,false)=false;

    new.data_vencimento := coalesce(new.data_vencimento, v_venc);
    if v_qtd = 1 then
      new.recebimento_id := coalesce(new.recebimento_id, v_receb);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_financeiro_normaliza_nota_omie on public.notas_fiscais;
create trigger trg_financeiro_normaliza_nota_omie
before insert or update of origem,status_omie,dados_omie,numero_nf,empresa_id
on public.notas_fiscais
for each row execute function public.financeiro_normaliza_nota_omie();
