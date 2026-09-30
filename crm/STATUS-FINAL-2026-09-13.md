# CRM MinasLab 2.0 — Estado final da rodada 2026-09-13

## Escopo concluído

Esta rodada consolidou as fases de integridade, idempotência, observabilidade e regressão dos fluxos principais do CRM sem remover regras de negócio existentes.

### Fluxos protegidos por regressão

- Autenticação e recuperação de senha com URL oficial de produção.
- Atendimentos, Clientes, Oportunidades, Pipeline e Propostas.
- Contratos, Ordens de Serviço, Coletas e Agenda.
- Tarefas, Pós-venda, Inteligência Comercial e Relatórios.
- Integrações e importações.
- Permissões de CRM, Operacional, Administração, Importação e Auditoria.

### Integridade e idempotência

- Coletas reutilizam o mesmo agendamento interno em retentativas de Google Calendar.
- Falha ao vincular um novo agendamento à coleta reverte o agendamento recém-criado.
- Pós-venda reutiliza o agendamento já associado à recorrência.
- Agenda sincroniza pelo `agendamento_id` persistido e mantém o registro local quando a integração externa falha.
- A tela de Integrações passou a exibir saúde da sincronização e reprocessamento seguro de pendências sem criar novo agendamento.

### Observabilidade

A tela Integrações passa a consultar os agendamentos reais do CRM e mostrar:

- total lido;
- sincronizados com Google Calendar;
- pendentes de sincronização;
- lista das pendências recentes;
- ação de ressincronização para usuários autorizados.

A ressincronização utiliza o mesmo `agendamento_id`, evitando criar registros locais paralelos.

## Quality Gate obrigatório

A versão só deve ser integrada à `main` após aprovação de:

- TypeScript;
- ESLint;
- testes automatizados;
- build Vite.

## Limitação externa ainda não auditada

O código interno das Edge Functions do Supabase não ficou disponível para leitura pela conexão usada nesta rodada. Portanto, a implementação interna de `chatpro-webhook`, `google-calendar-sync` e demais funções hospedadas não é declarada como auditada neste documento.

Isso não impede a validação dos fluxos do frontend e da idempotência local, mas qualquer mudança futura dentro dessas Edge Functions deve passar por auditoria própria de autenticação, deduplicação, timeout e reenvios.

## Regra para próximas alterações

Manter funções, contratos públicos, regras de negócio e dados existentes; criar branch isolada; adicionar ou atualizar testes de regressão; executar Quality Gate completo; integrar somente após sucesso; confirmar o deployment de produção antes de considerar a mudança publicada.
