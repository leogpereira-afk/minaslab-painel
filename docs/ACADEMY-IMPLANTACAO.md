# MinasLab Academy — Etapa 2 (fundação): implantação e recuperação

Status: **implementado em código na branch `claude/serene-mayer-8e1ffz`; NÃO aplicado no banco nem publicado.**
Custo: nenhum (usa GitHub Pages, o Supabase atual, jsPDF e links do Drive; os testes rodam em PostgreSQL local).

## O que foi implementado
- Menu "Academy" no painel, submenu no topo (padrão do Financeiro, sem rolagem horizontal), só para quem tem permissão. Itens ainda não construídos aparecem desabilitados e só para a direção.
- **Gestão Academy**: criar treinamento (7 categorias iniciais), editar dados e critérios (responsável, obrigatoriedade, prazo, validade/reciclagem, carga horária, validação da Qualidade), módulos e aulas em sequência (texto, imagem, vídeo, PDF, apresentação e link por **link https**, estudo de caso, atividade prática), materiais por link, público (colaborador/cargo/setor/grupo), grupos, publicar, arquivar, nova versão e histórico de eventos.
- **Versionamento**: versão publicada é imutável (gatilhos no banco); "nova versão" copia a publicada para rascunho; publicar a nova marca a anterior como "substituída" sem apagar nada. Arquivar não apaga.
- **Vínculo conta ↔ colaborador** (só direção), com um colaborador por conta.
- **Permissões** (chaves planas na matriz de Acessos, sem herança): `academy-gestao`, `academy-qualidade` (funcionam agora); `academy`, `academy-gestor`, `academy-matriz` (aparecem na tela Acessos como "em preparação"). Contas sem matriz (legadas) **não** abrem a Academy; só a direção.
- Servidor: Edge Function `ml-academy-gestao`; toda escrita por funções SQL `ml_ac_*` que validam e gravam o evento de auditoria na mesma transação. Tabelas com RLS ligado e sem policy; acesso do navegador negado (`anon`/`authenticated`).

## O que NÃO está pronto (próximas etapas)
Experiência do colaborador, provas e correção, certificados, avaliação do gestor, matriz de competências, reciclagem/convocação, notificações, indicadores, exportações, envio de arquivos (hoje só links) e trilhas. Por isso a publicação só aceita critério "Somente conclusão das aulas": prova e avaliação do gestor ficam bloqueadas até existirem. Nenhum treinamento real foi cadastrado.

## Arquivos
- Migração: `supabase/migrations/20261005120000_academy_fundacao.sql`
- Servidor: `supabase/functions/ml-academy-gestao/index.ts`, `supabase/functions/_shared/academy-auth.ts`; alterado `ml-sync/index.ts` (só acrescenta 5 chaves à lista `PAGINAS_VALIDAS`)
- Painel: `src/components/academy/*`, `src/pages/academy/*`, `src/services/academy.js`, `src/lib/academy/*`; alterados `App.jsx`, `Layout.jsx`, `lib/sessao.js`, `lib/catalogoPermissoes.js`, `lib/api.js`, `pages/Acessos.jsx` (impede que contas legadas ganhem a Academy ao salvar), `package.json` (script de teste)
- Testes: `scripts/testar-academy-sql.mjs`, `src/lib/academy/*.test.mjs`

## Testes realizados
| Teste | Resultado |
|---|---|
| Migração + regras no banco (PGlite, isolado): criar, pendências de publicação, links inseguros, atomicidade da gravação, Qualidade (validação anulada por edição, carga horária), imutabilidade da versão publicada (update/delete/aulas/materiais), nova versão sem alterar a anterior, público, grupos, vínculos, arquivar sem apagar, auditoria imutável, `anon`/`authenticated` negados | 46 verificações passaram |
| `npm test` (inclui permissões da Academy: direção, conta legada, matriz sem herança) | 617 passaram, 0 falhas |
| `npm run lint` | 0 erros; sem avisos nos arquivos da Academy (53 avisos antigos do projeto) |
| `npm run build` | ok |
| Sintaxe TypeScript das Edge Functions (esbuild) | ok |
| Telas em computador (1366 px) e celular (390 px), sem rolagem horizontal da página | ok — capturas em `docs/academy-capturas/` (dados de teste simulados no navegador; não são dados reais) |

Para repetir o teste do banco: `PGLITE_ENTRY=<caminho do @electric-sql/pglite/dist/index.js> node scripts/testar-academy-sql.mjs`.

**Não testado ainda:** a Edge Function contra um banco real (não há Deno nem ambiente de testes gratuito) e o fluxo completo por perfil (RH/Qualidade/colaborador) com contas reais. Isso só é possível após a implantação abaixo.

## Implantação (somente após estabilizar o Estoque e com aprovação)
1. Fazer backup/ponto de restauração do projeto "Projetos Léo" (Supabase → Database → Backups).
2. Aplicar `20261005120000_academy_fundacao.sql` (só cria tabelas/funções `ml_ac_*`; não altera tabelas existentes).
3. Publicar as funções: `ml-academy-gestao` e a `ml-sync` atualizada (única mudança: 5 chaves novas na lista de páginas válidas). Fazer o deploy da `ml-sync` fora do horário de uso.
4. Publicar o painel (merge na `main` → GitHub Pages). A Academy só aparece para a direção; ninguém mais a vê até receber permissão em Acessos.
5. As contas da Ana (RH) e da Lidyane (Qualidade) **já existem com papel Direção**, que já tem todas as permissões da Academy; não é preciso criar logins nem conceder chaves. Em Gestão Academy → "Contas e colaboradores", vincular cada conta ao seu cadastro do RH. (Se no futuro quiserem restringir cada uma ao seu perfil, passar a conta para Equipe com a matriz e marcar só `academy-gestao` ou `academy-qualidade`.)
6. Teste de fumaça: criar um treinamento de rascunho, salvar, abrir em outra conta sem permissão (deve ser negado), arquivar o treinamento de teste.

## Recuperação em caso de falha
- **Front com problema:** reverter o merge na `main` (o Pages republica o anterior); a Academy some, os demais módulos não dependem dela.
- **`ml-sync`:** reimplantar a versão anterior da função (a mudança é só acréscimo de chaves).
- **Função `ml-academy-gestao`:** desativar/remover; sem ela a Academy só mostra erro de carregamento.
- **Banco:** as tabelas são novas e isoladas. Se ainda **não houver dados reais**, executar o script de reversão no final da migração. Se já houver dados, **não apagar**: restaurar do backup do passo 1 ou corrigir à frente (versões publicadas e auditoria são imutáveis por desenho).

## Pontos de atenção
- O vínculo conta ↔ colaborador precisa ser feito antes do uso pelos colaboradores (etapa 3).
- A tabela preexistente `clientes_financeiro` está com RLS desligado (não alterada aqui); recomenda-se tratar à parte.
