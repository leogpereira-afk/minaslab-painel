insert into clientes_financeiro (nome,nome_fantasia,cnpj_cpf,uf,cidade,origem,id_omie,usa_minaslab,usa_mlab,ativo,created_at,updated_at)
select coalesce(nullif(registro->>'nome',''),nullif(registro->>'fantasia',''),'Cliente Omie '||(registro->>'omieId')),
       nullif(registro->>'fantasia',''),nullif(registro->>'doc',''),nullif(registro->>'uf',''),nullif(registro->>'cidade',''),
       'OMIE',registro->>'omieId',true,false,not coalesce((registro->>'inativo')::boolean,false),now(),now()
from ml_registros m
where m.colecao='fin_clientes' and m.apagado=false
  and coalesce(m.registro->>'omieId','')<>''
  and not exists (select 1 from clientes_financeiro c where c.id_omie=m.registro->>'omieId');

update recebimentos r set updated_at=now() where r.origem='OMIE' and r.apagado=false and r.cliente_id is null;
update despesas d set updated_at=now() where d.origem='OMIE' and d.apagado=false and d.fornecedor_id is null;
