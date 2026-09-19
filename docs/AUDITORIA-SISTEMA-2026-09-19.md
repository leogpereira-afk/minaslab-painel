# Auditoria MinasLab — 19/09/2026

## Alcance e método

Leitura do código das rotas, permissões, camada de dados e integrações do RH; análise estática completa; suíte automatizada; abertura em produção dos módulos principais com a conta de direção. Dados reais apenas consultados. Falhas de sessão foram reproduzidas em testes com dados fictícios, sem trocar usuários ou permissões em produção.

Esta auditoria não certifica todos os fluxos transacionais: não executou pagamentos, emissão/cancelamento de notas, exclusões, sincronização do relógio nem salvamento de fichas reais. Não houve teste autenticado com contas de outros papéis.

## Bugs confirmados e corrigidos

| Prioridade | Problema reproduzido | Correção | Evidência |
|---|---|---|---|
| Alta | Cache de coleções continuava disponível após sair e entrar com outro usuário. A mesma revisão dispensava a consulta de permissão e devolvia a cópia anterior. | Limpeza ao mudar sessão, separação por token, descarte de respostas em trânsito e remoção de coleções recusadas. | Teste falhou antes e passou depois; teste adicional de resposta atrasada. Não é evidência de vazamento ocorrido em produção. |
| Média | Datas impossíveis como 2025-02-29 e 1990-02-31 viravam aniversários. | Validação de dia/mês/ano antes de gerar ocorrências; datas inválidas contam como informação incompleta. | Teste de regressão falhou antes e passou depois. |
| Média | Aba do RH podia divergir do endereço: entrar por Vencimentos, abrir Pessoas e atualizar levava de volta a Vencimentos. | Aba passa a ser determinada pelo endereço; selecionar aba atualiza a URL, permitindo atualizar e voltar pelo navegador. | Revisão do fluxo e conferência no navegador após publicação. |

## Navegação principal

| Módulo | Verificação de leitura |
|---|---|
| Início | Resumos e títulos carregaram |
| Calendário | Datas, filtros de origens e integração RH revisados; aniversários pessoais e de empresa separados |
| Compromissos | Lista abriu; responsável usa ID do elenco do RH |
| Licitações | Listas em andamento e encerradas abriram |
| Marketing | Tela principal abriu |
| Compras | Tela principal abriu; elenco vem do RH |
| Manutenções | Agendadas, próximas e histórico abriram |
| Laboratório | Tela principal abriu |
| RH | Visão geral abriu; navegação por aba revisada |
| Ponto | Carregou com 6 pessoas e advertência de base parcial; não acionei sincronização |
| Finanças | Dashboard, saldos e seções carregaram; não executei transações |
| Curva ABC | Tela principal carregou |
| Acessos | Listagem e descrição de papéis carregaram; nenhuma conta alterada |

Abertura sem erro não prova exatidão de todos os números nem funcionamento de todas as ações internas.

## Melhorias prioritárias ainda não implementadas

1. **Falha ao carregar responsáveis:** Compras e Compromissos silenciam falhas do elenco. Exibir “não foi possível atualizar a equipe”, preservar a lista anterior e disponibilizar nova tentativa. Isso distingue ausência de pessoas de indisponibilidade do serviço.
2. **Financeiro — estabilidade dos componentes:** há manipulação direta de elementos e observadores globais para “Gerenciar este grupo” em App.jsx e ServicosGeradosAgrupado.jsx. Substituir por componentes e ações explícitas, preservando os agrupamentos existentes. É fragilidade de manutenção, não prova de botão quebrado.
3. **Avisos da análise estática:** 37 avisos, sem erros, na base auditada. Priorizar dependências de efeitos para evitar telas desatualizadas; não adicionar dependências mecanicamente, pois pode gerar loops de consulta.
4. **Qualidade do ponto:** a tela consultada indicava base parcial, 8 registros a conferir e 24 diferenças da origem no período 14–20/09. Revisar os registros e a comparação com Jibble antes de usar o total para fechamento. Não deduzir faltas ou horas faltantes automaticamente.
5. **Documentos do RH:** Vencimentos estava sem registros na conferência anterior desta sessão. Preencher as datas de validade pelo formulário; calendário vazio não comprova regularidade documental.
6. **Cobertura adicional:** ensaiar em ambiente de teste os fluxos de salvamento, renovação documental, permissões por papel, exportações e financeiro. Ampliar testes de navegação desktop/celular; a auditoria atual não substitui esse ensaio.

## Dados e permissões preservados

O cadastro do RH continua sendo a origem para pessoas; campos históricos e permissões dos módulos permanecem. Nenhum pagamento, vínculo de emprego, salário, batida ou documento real foi alterado nesta auditoria.
