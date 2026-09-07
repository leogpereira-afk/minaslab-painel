update recebimentos r
set cliente_id = c.id,
    cliente = c.nome,
    cnpj_cpf = coalesce(nullif(c.cnpj_cpf,''), r.cnpj_cpf),
    updated_at = now()
from clientes_financeiro c
where r.origem = 'OMIE'
  and r.apagado = false
  and c.id_omie = r.dados_omie->>'codigo_cliente_fornecedor';

update despesas d
set fornecedor = c.nome,
    cnpj_cpf = coalesce(nullif(c.cnpj_cpf,''), d.cnpj_cpf),
    updated_at = now()
from clientes_financeiro c
where d.origem = 'OMIE'
  and d.apagado = false
  and c.id_omie = d.dados_omie->>'codigo_cliente_fornecedor';
