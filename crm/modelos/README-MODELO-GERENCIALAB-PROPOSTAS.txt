MODELO SOLICITADO — GERENCIALAB → PROPOSTAS

Este modelo NÃO representa a estrutura real do GerenciaLab.
Ele define as informações que o CRM MinasLab 2.0 gostaria de receber em uma futura exportação.
Quando o arquivo real do GerenciaLab estiver disponível, o mapeamento deverá ser auditado coluna por coluna antes de qualquer importação definitiva.

ARQUIVO 1 — MODELO-GERENCIALAB-PROPOSTAS.csv
Uma linha por proposta, com identificação externa, cliente, solicitante, status, valores e datas comerciais.

ARQUIVO 2 — MODELO-GERENCIALAB-PROPOSTA-ITENS.csv
Uma linha por item da proposta, vinculada preferencialmente pelo ID externo da proposta e/ou número da proposta.

Se o GerenciaLab só permitir um único arquivo, os campos da proposta poderão se repetir por item. O importador definitivo deverá tratar essa repetição sem criar propostas duplicadas.

REGRAS DE SEGURANÇA
- O modelo é apenas uma especificação desejada de exportação.
- Não presume nomes reais de colunas do GerenciaLab.
- Não define unicidade de NUMERO_PROPOSTA.
- Não substitui UUID interno do CRM por identificador externo.
- Não aplica UPSERT automático.
- Não migra dados históricos nesta etapa.
