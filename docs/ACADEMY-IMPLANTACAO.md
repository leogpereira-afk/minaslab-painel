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

---

# Etapa 3 (aprendizagem) — implementada em código, NÃO aplicada

Status: na branch `claude/serene-mayer-8e1ffz`; nada aplicado no banco nem publicado. Custo zero.

## O que foi implementado
- **Colaborador:** Minha Academy (obrigatórios, em andamento, prazo vencido, concluídos, reciclagem necessária), Catálogo (treinamentos publicados do meu perfil; opcionais podem ser iniciados), Avaliações, Meus Certificados e sino de notificações (nova atribuição, resultado, conclusão).
- **Player de aulas:** aulas em sequência (texto, imagem/vídeo/PDF/apresentação/link por link https, estudo de caso e atividade prática com resposta salva), progresso salvo no servidor, retoma da última aula mesmo em outro computador.
- **Prova automática:** múltipla escolha, verdadeiro/falso e múltiplas respostas; nota mínima e limite de tentativas configuráveis; **nota, acerto e aprovação calculados no banco**; só libera após concluir todas as aulas; a resposta ao colaborador traz acerto/erro e feedback por questão, nunca o gabarito; tentativas, respostas e datas ficam no histórico imutável.
- **Atribuições:** ao publicar (e ao abrir Minha Academy) o sistema aplica o público (todos/setor/cargo/colaborador/grupo) aos colaboradores ativos do RH, com prazo = data + dias configurados. Sem duplicar, e **publicar nova versão não reatribui sozinho** (convocar reciclagem é decisão explícita, Etapa 4).
- **Certificado:** só existe para treinamento concluído (todas as aulas + aprovação, quando há prova); registro imutável com colaborador, treinamento, versão, data, responsável e código; carga horária só se cadastrada **e** validada pela Qualidade; PDF gerado no navegador a partir do registro do servidor, com a ressalva de que não substitui validação de competência prática.
- **Gestão:** nova aba "Avaliação" no editor (questões, gabarito, nota mínima, tentativas); publicação exige questões válidas; ao publicar/salvar o público informa quantos colaboradores receberam o treinamento.

## Arquivos
- Migração: `supabase/migrations/20261006120000_academy_aprendizagem.sql` (aditiva; depois da `20261005120000`).
- Servidor: `supabase/functions/ml-academy/index.ts` (novo), `ml-academy-gestao/index.ts` (questões, atribuição), `_shared/academy-auth.ts`.
- Painel: `src/pages/academy/{MinhaAcademy,Catalogo,Avaliacoes,TreinamentoPlayer,Certificados}.jsx`, `TreinamentoEditor.jsx` (aba Avaliação), `AcademyLayout.jsx` (sino), `src/lib/academy/{regras,certificadoPdf}.js`, `src/services/academy.js`, `App.jsx`, `lib/api.js`, `lib/catalogoPermissoes.js`.
- Testes: `scripts/testar-academy-aprendizagem.mjs`, `src/lib/academy/*.test.mjs`.

## Testes realizados
| Teste | Resultado |
|---|---|
| Banco (PGlite) fundação | 47 verificações passaram |
| Banco (PGlite) aprendizagem: regras de publicação da prova, público e atribuições (todos/setor/cargo/colaborador/grupo, idempotência, prazo 30 dias), progresso e retomada, isolamento entre colaboradores, correção dos 3 tipos de questão (inclui resposta parcial = errada), limite de tentativas, tentativa/resposta/certificado imutáveis, conclusão só com aulas + aprovação, certificado só com requisitos, idempotência, histórico e tentativas da v1 preservados após publicar v2, matrícula pelo catálogo restrita ao público, `anon`/`authenticated` negados | 83 verificações passaram |
| Curso Gestão do Tempo carregado no banco | aceito; única pendência: responsável |
| `npm test` | 622 passaram, 0 falhas |
| `npm run lint` / `npm run build` | 0 erros / ok |
| Sintaxe TypeScript das 3 funções | ok |
| Fluxo completo no navegador (API simulada): Minha Academy → aula → estudo de caso → prova (única + múltiplas) → resultado → certificado e PDF, em 1366 px e 390 px | sem erros de console e sem rolagem horizontal; PDF gerado e conferido (sem carga horária quando não validada). Capturas em `docs/academy-capturas/*-colab-*.png` (dados simulados) |

**Não testado ainda** (exige a implantação): as Edge Functions contra um banco real e o fluxo com contas reais de RH, Qualidade e colaborador; a avaliação de mais de uma pessoa simultânea.

## Implantação (acrescenta aos passos da Etapa 2, na mesma janela)
1. Backup do projeto (Supabase → Database → Backups).
2. Aplicar `20261005120000_academy_fundacao.sql` e depois `20261006120000_academy_aprendizagem.sql`.
3. Publicar as funções `ml-academy-gestao` (atualizada), `ml-academy` (nova) e `ml-sync` (5 chaves novas).
4. Publicar o painel (merge na `main`). Continua visível só para a direção.
5. Importar o curso Gestão do Tempo (Gestão Academy → novo treinamento → Conteúdo → Importar modelo), escolher Lidyane como responsável, definir público "Todos", salvar, publicar. **Antes de publicar**, vincular as contas aos colaboradores (Gestão Academy → Contas e colaboradores): só quem tem vínculo recebe e vê treinamentos.
6. Para liberar a colaboradores: em Acessos conceder a chave **Academy · Colaborador** (`academy`) às contas com matriz; para contas sem matriz (legadas), retirar `"academy"` de `SO_DIRECAO` em `src/lib/sessao.js` no dia da liberação.
7. Teste de fumaça com duas contas: concluir o curso numa, conferir que a outra não vê nada da primeira, baixar o certificado.

## Recuperação
- **Front:** reverter o merge na `main`. **`ml-academy`:** desativar a função. **`ml-academy-gestao`/`ml-sync`:** reimplantar a versão anterior.
- **Banco:** se ainda **não houver dados reais de aprendizagem**, usar o script de reversão no fim de cada migração (primeiro a 2, depois a 1) e reaplicar as funções da migração 1. **Havendo tentativas, certificados ou progresso reais, não apagar:** restaurar do backup do passo 1 ou corrigir à frente (histórico imutável por desenho).

## Ainda não existe (Etapa 4)
Avaliação prática do gestor e modelo híbrido, matriz de competências (teoria × prática × validade), convocação de reciclagem, indicadores, exportações, trilhas e envio de arquivos. Por isso a Academy ainda **não** deve ser usada para declarar um colaborador "apto" a uma atividade crítica.
