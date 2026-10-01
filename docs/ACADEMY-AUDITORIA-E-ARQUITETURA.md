# MinasLab Academy — Etapa 1: auditoria e arquitetura

Data: 01/10/2026 · Branch: `claude/serene-mayer-8e1ffz` · Status: **projeto (nada implementado, nada aplicado no banco)**

Fontes: repositório (`src/`, `supabase/`, `crm/`, `.github/`), proposta da Diretoria (.docx) e consulta somente-leitura de metadados do projeto Supabase "Projetos Léo" (nomes de colunas e contagens; nenhum dado pessoal lido).

## 1. O que já existe

| Tema | Situação |
|---|---|
| Treinamentos / Academy | **Não existe** página, tabela ou rota. Nada a evoluir; módulo novo, sem duplicação. (As ocorrências de "capacitação/competência" no código são texto de RH/Ponto, não funcionalidade.) |
| Colaboradores | Coleção `rh_pessoas` dentro de `ml_registros` (jsonb). 20 ativos. Campos úteis: `id`, `nome`, `apelido`, `cargo`, `setor`, `gestorId`, `ativo`, `admissao`, `email`. Setores fixos no código: Coleta, Análises, Qualidade, Administrativo, Comercial, Direção. |
| Hierarquia | `gestorId` já existe por pessoa (usado em Feedback do RH). Serve de base para "gestor vê só sua equipe". |
| Documentos | Tabelas `rh_documentos`/`rh_documento_eventos` (RH, privadas) e bucket privado `ml-arquivos` com URL assinada. Padrão de evento/auditoria reaproveitável. |
| Competências | Não existe. |
| Notificações | Não há central de notificações interna. |
| Exportação | `jspdf`, `jspdf-autotable`, `fflate`, `src/lib/planilha.js` já no projeto. |

## 2. Autenticação, usuários e permissões (ponto crítico)

- O painel **não usa Supabase Auth**. Login próprio na Edge Function `ml-sync` (PBKDF2, freio de tentativas), JWT de 12 h com `sub`, `papel`, `sis`. O navegador nunca fala com o Postgres; as tabelas têm RLS ligado e **sem policy**, e só a Edge Function (service_role, no servidor) lê/grava. O CRM é outro app (Supabase Auth + RLS por `profiles/roles`) e **não** é a base da Academy.
- Papéis: `direcao`, `equipe`, `leitura` (`ml_contas`: usuario, nome, papel, senha, ativo, `paginas_consulta`).
- Permissão fina: matriz `paginas_consulta` com chave `__matriz_v1` + páginas/subpáginas (`catalogoPermissoes.js`, `sessao.js`, e lista **duplicada** `PAGINAS_VALIDAS` em `ml-sync`, que rejeita chaves desconhecidas). Contas sem matriz ("legadas") abrem tudo que não está em `SO_DIRECAO`.
- Gestão de contas: tela Acessos (só direção).
- **Lacuna 1 — não há vínculo conta ↔ colaborador.** `ml_contas` não tem `pessoa_id`; hoje o elo é só por nome. A Academy precisa dele para "meus treinamentos".
- **Lacuna 2 — não existem os perfis RH, Qualidade, Gestor.** RH é módulo exclusivo da direção. Gestor só existe como `gestorId` no cadastro.
- **Armadilha:** `leitura` ("só olha") e `equipe` precisam gravar o próprio progresso e provas. Isso não pode passar pelo `podeEscrever` do `ml-sync`; a Academy terá função própria com regras próprias.

### Decisão proposta (sem criar sistema paralelo)
Reusar a matriz `paginas_consulta`, acrescentando chaves `academy`, `academy/catalogo`, `academy/trilhas`, `academy/avaliacoes`, `academy/gestor`, `academy/certificados`, `academy/matriz`, `academy/gestao`, mais a capacidade `academy/qualidade`. Mapeamento:

| Responsabilidade | Como é decidida (sempre no servidor) |
|---|---|
| Colaborador | conta vinculada a uma `pessoa` → vê só o que é seu (base `academy`, aberta por padrão a contas legadas e concedida a contas com matriz) |
| Gestor | `academy/gestor` + hierarquia `gestorId` (ele e sua equipe direta/indireta) |
| RH | `academy/gestao` + `academy/matriz` (todo o quadro) |
| Qualidade | `academy/qualidade` (valida conteúdo técnico, versões e evidências) |
| Administrador | `direcao` |

## 3. Reaproveitamento

- Layout: `Layout.jsx` (array `MODULOS`, cores por módulo) e rota em `App.jsx` com `Guarda`. Submenu: padrão `FinanceiroLayout` (linhas `financeiro-nav-linha` com quebra, sem rolagem horizontal; a conferir no CSS na Etapa 2).
- UI: `ui.jsx` (`Card`, `StatCard`, `PageTitle`, `Modal`, `Aviso`, `Empty`...), `lista.jsx`, `JanelaFormulario`, `PeriodoFiltro`, `ValorFiltro`, paginação do financeiro. Paleta `brand` do Tailwind já é a da logo (verde-água `#0f766e`, petróleo `#24444f`); nada de azul do conceito.
- Serviços: padrão `chamar()` de `services/dados.js`, `comCracha()` de `sessao.js`.
- Servidor: padrão do `ml-patrimonio` (valida crachá via `ml-sync`, reconfere conta ativa e permissões em `ml_contas`, escrita por RPC).
- Testes: `node --test` em `src/lib/**/*.test.mjs` (regras puras de nota, aprovação, escopo e validade serão testadas aqui). CI: lint + test + build.

## 4. Arquitetura proposta

**Stack:** o painel é JavaScript/JSX (Vite/React 18), não TypeScript; o CRM é que é TS. Proposta: Academy em JSX (consistência, mesmo lint/CI) e Edge Functions em TypeScript (Deno), como as demais.

**Dados** — tabelas novas `ml_ac_*`, RLS ligado e sem policy (acesso só por Edge Function, mesmo modelo de segurança das tabelas `ml_*`), constraints reais e gatilhos. Nada em `ml_registros`.

| Tabela | Função |
|---|---|
| `ml_ac_vinculos` | usuario ↔ `pessoa_id` (administrado pela direção) |
| `ml_ac_categorias`, `ml_ac_grupos(+membros)` | 7 categorias iniciais; grupos de público |
| `ml_ac_treinamentos` | identidade, categoria, responsável, status (rascunho/publicado/arquivado), versão atual |
| `ml_ac_versoes` | conteúdo/critérios de uma versão: nota mínima, tentativas, modalidade (automática/gestor/híbrida), prática exigida, validade/reciclagem, carga horária validada. **Imutável após publicar** (gatilho) |
| `ml_ac_modulos`, `ml_ac_aulas`, `ml_ac_materiais` | estrutura por versão; aula = texto/imagem/vídeo/PDF/apresentação/link/pergunta/caso/atividade prática |
| `ml_ac_questoes`, `ml_ac_opcoes`, `ml_ac_gabaritos` | tipo extensível (múltipla escolha, V/F, múltiplas respostas; associação/ordenação depois). **Gabarito em tabela separada, nunca enviado ao navegador** |
| `ml_ac_publico` | alvo: colaborador, cargo, setor ou grupo; obrigatoriedade e prazo |
| `ml_ac_atribuicoes` | pessoa × versão: origem, prazo, status, validade/vencimento |
| `ml_ac_progresso` | aula concluída/posição, para retomar |
| `ml_ac_tentativas`, `ml_ac_respostas` | nota calculada no servidor, data, tentativa nº |
| `ml_ac_avaliacoes_praticas` | checklist, parecer, avaliador, data, resultado (Apto / Necessita Reciclagem), evidências (arquivos) |
| `ml_ac_competencias` | **estados separados**: treinamento realizado · teoria aprovada · prática demonstrada · reciclagem necessária, com validade. Prova nunca marca "Apto" sozinha |
| `ml_ac_certificados` | código único, colaborador, versão, data, responsável; imutável |
| `ml_ac_trilhas(+itens)` | sequências de treinamentos |
| `ml_ac_notificacoes` | internas (atribuição, prazo, avaliação liberada, resultado, reciclagem) |
| `ml_ac_eventos` | trilha de auditoria append-only |

Versionamento: publicar nova versão cria nova linha em `ml_ac_versoes` com cópia de módulos/aulas/questões; atribuições, tentativas, práticas e certificados apontam para a **versão realizada** e nunca são reescritos. Arquivar/editar não apaga evidência (sem DELETE; gatilhos bloqueiam UPDATE/DELETE de históricos). "Convocar reciclagem" cria novas atribuições para os afetados.

**Servidor** — Edge Function `ml-academy` (aprendizagem) e `ml-academy-gestao` (cadastro, correção, matriz, indicadores), com helper de autorização único em `_shared`. Em cada ação: crachá válido, conta ativa, permissão relida do banco, escopo (próprio / equipe por `gestorId` / todos). Correção e notas só no servidor; o colaborador não escreve nota, aprovação nem validação prática. Arquivos em novo bucket **privado** `ml-academy` com URL assinada e verificação de acesso (não reutilizar `ml-arquivos` do RH). Sem `service_role` no frontend.

**Frontend** — `AcademyLayout` com submenu no topo (8 itens, filtrados por permissão), páginas lazy sob `/academy/*`, um item novo em `MODULOS` e rotas em `App.jsx`; `catalogoPermissoes.js` + `PAGINAS_VALIDAS` do `ml-sync` + `PERMISSOES_DISPONIVEIS` mudam juntos. Exportações: CSV/XLSX/PDF com `planilha.js`/jsPDF, respeitando o escopo.

**Alterações em código existente (mínimas e justificadas):** `Layout.jsx` (1 módulo), `App.jsx` (rotas), `catalogoPermissoes.js`, `sessao.js` (regra do módulo), `ml-sync` (`PAGINAS_VALIDAS`), tela Acessos (gerir vínculo conta↔colaborador). Estoque, Financeiro, CRM e RH: **sem alteração**; RH é lido só no servidor (id, nome, cargo, setor, gestorId, ativo; sem CPF/salário).

## 5. Riscos e dependências

1. **Não há ambiente de desenvolvimento do banco.** Existe um único projeto Supabase de produção ("Projetos Léo", compartilhado com bsq_/domo_/dmd_/pdb_) e nenhuma branch Supabase. Migração aplicada vai direto à produção. Precisa de decisão (item 6).
2. Push na `main` publica o front no GitHub Pages. Mitigação: módulo oculto por permissão até a liberação; implantação só após estabilização do Estoque.
3. Lista de páginas válidas duplicada (`ml-sync` × catálogo): esquecer uma delas rejeita a permissão em silêncio.
4. Contas legadas (sem matriz) hoje abrem tudo que não é `SO_DIRECAO`; a Academy precisa de regra explícita para o admin não vazar.
5. Vínculo conta↔colaborador precisa ser preenchido antes do uso; sem ele o colaborador não vê treinamentos.
6. Achado preexistente (fora do escopo, não alterado): a tabela `public.clientes_financeiro` está com **RLS desligado** (2 linhas). Recomendo a direção decidir a correção separadamente: `ALTER TABLE public.clientes_financeiro ENABLE ROW LEVEL SECURITY;` (sem policy bloqueia o acesso pela chave anon; confirmar antes que nada depende dela).
7. Conteúdo real (3 pilotos) depende da MinasLab; até lá, apenas rascunhos vazios, sem procedimentos inventados.
8. Carga horária só aparece no certificado se cadastrada e validada pela Qualidade.

## 6. Sequência

1. **Fundação:** migração 1 (categorias, treinamentos, versões, módulos, aulas, públicos, vínculos, eventos), `ml-academy-gestao`, layout/menu/permissões, cadastro de treinamentos e versões, rascunho/publicar/arquivar.
2. **Aprendizagem:** progresso, aulas, provas automáticas no servidor, tentativas, certificados.
3. **Gestão:** avaliação do gestor/híbrido, matriz, reciclagem, notificações, indicadores, exportações.
4. **Piloto** (3 treinamentos com conteúdo real) e **expansão**.
Cada etapa: testes unitários de regras (`node --test`), teste de permissões por papel, verificação em desktop e celular, roteiro de implantação e de recuperação (migração reversa documentada).

## 7. Decisões pendentes

1. **Ambiente de validação do banco:** Supabase Branch (pago) / novo projeto de testes / aplicar em produção com módulo oculto. Recomendado: branch ou projeto de testes.
2. **Vínculo conta↔colaborador:** campo administrado na tela Acessos (recomendado) × inferência por nome (não recomendo).
3. **Linguagem:** JSX no painel (recomendado) × introduzir TypeScript só na Academy.
4. **Contas de RH e Qualidade:** quais contas receberão `academy/gestao` e `academy/qualidade`.
