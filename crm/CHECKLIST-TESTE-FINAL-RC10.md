# CRM MinasLab 2.0 — Checklist da bateria final

Executar somente quando o pacote candidato estiver instalado e compilado em ambiente funcional.

- [ ] npm install/ci e npm run build sem erros
- [ ] login válido, senha inválida, logout e persistência de sessão
- [ ] recuperação e redefinição de senha
- [ ] usuário inativo bloqueado
- [ ] RBAC: crm.read / crm.write / crm.deactivate
- [ ] RBAC: operational.read / operational.import
- [ ] RBAC: imports.manage / admin.manage / audit.read
- [ ] Dashboard sem números inventados e sem erros de RLS
- [ ] Primeiro Atendimento → Lead → Cliente/Oportunidade
- [ ] Cliente 360 e seus blocos condicionais
- [ ] Pipeline → Oportunidade detalhada
- [ ] Oportunidade → Proposta → Itens → Timeline/Tarefas
- [ ] Contrato → OS → Amostras → Parâmetros sem misturar entidades
- [ ] Agenda e Coletas
- [ ] Tarefas / Follow-up / Workflows sem automação inventada
- [ ] Pós-venda / recorrência histórica
- [ ] Relatórios / Inteligência / Matriz Analítica
- [ ] Importação CSV/TXT: prévia → staging → detalhe/diff
- [ ] Importação XLSX: prévia → staging → detalhe/diff
- [ ] GerenciaLab → Clientes / Dashboard / Histórico Analítico / Propostas
- [ ] Administração / usuários / permissões
- [ ] Auditoria read-only
- [ ] estados loading / vazio / erro / sem permissão
- [ ] responsividade desktop/tablet/mobile
- [ ] nenhuma página branca em erro inesperado
- [ ] nenhuma service_role/segredo privado no frontend ou ZIP
- [ ] nenhuma migração de dados reais antes da aprovação
