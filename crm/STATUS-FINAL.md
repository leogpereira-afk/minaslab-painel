# CRM MINASLAB 2.0 — STATUS DE FECHAMENTO DO CÓDIGO

Data de fechamento: 2026-08-30
Base técnica: FULL BUILD RC13

## Estado

- Desenvolvimento principal encerrado nesta base.
- Este pacote passa a representar o código-fonte consolidado para publicação/versionamento no GitHub.
- Não foram migrados dados históricos reais neste fechamento.
- Não foi realizada publicação em produção neste fechamento.
- O build executável completo e a bateria manual de homologação permanecem como gate de implantação, devido ao bloqueio de acesso ao registry npm no ambiente de geração.
- Correções funcionais ou visuais identificadas durante a verificação do usuário devem ser feitas posteriormente sobre a base oficial no GitHub, preservando histórico de commits.
- Alterações de banco, quando necessárias, devem ser feitas por migrations controladas; não devem ser confundidas com alterações normais de frontend.

## Pendências conhecidas que não impedem o fechamento do código

- Validar o arquivo real de exportação GerenciaLab → Propostas quando estiver disponível e confirmar o mapeamento das colunas.
- Arquivo XLS legado permanece bloqueado/orientado para conversão; XLSX, CSV e TXT são os formatos preparados.
- Executar npm ci, npm run build e a bateria final de homologação em ambiente com npm funcional antes da implantação definitiva.

## Regra de continuidade

A partir deste fechamento, evitar novas sequências de ZIPs RC. O GitHub deve ser tratado como fonte oficial do código. Novas correções devem ser feitas de forma incremental, rastreável e testável.
