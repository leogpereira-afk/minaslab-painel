# Cargos ligados (plano → funções → RH) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Funções do plano carregáveis por setor (com as descrições DF da direção), Cargo do RH como lista do plano, e promoção no plano atualizando cargo/salário/histórico do RH.

**Architecture:** Regras puras em `.mjs` testadas com `node --test`; tela só mostra e grava. Escrita no RH por ação estreita nova no `ml-comercial`.

**Tech Stack:** React 19 + Vite, Deno Edge Function, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-cargos-ligados-rh-design.md`

## Global Constraints
- Lista única = `NIVEIS` de `gestao/src/lib/planoCarreira.js`; nomes de cargo no servidor vêm de `gestao/supabase/functions/ml-comercial/cargosPlano.mjs` e um teste garante que batem.
- Exclusão sempre lápide; nada de DELETE.
- Documento impresso de função leva o código **DF**.
- Comercial: as 4 funções existentes não mudam; só entram as que faltam.

## Review Focus
- Função existente com nome antigo (ex.: "Analista Comercial" = Aux. Comercial II) → não recria.
- Modelo com id fixo (Analista I/II) cujo registro está em lápide → volta a valer e mantém o vínculo da equipe.
- Movimentação com data futura para pessoa com RH → recusada.
- Movimentação retroativa mais antiga que o último marco de cargo/salário → só histórico, ficha não muda.
- Reenviar a mesma movimentação → não duplica marcos (ids derivados).

---

### Task 1: Regras puras do RH (`carreiraRH.mjs`) e nomes no servidor
**Files:** Create `gestao/supabase/functions/ml-comercial/cargosPlano.mjs`, `carreiraRH.mjs`, `carreiraRH.test.mjs`; Modify `gestao/src/lib/planoCarreira.test.mjs`.
**Produces:** `CARGO_POR_NIVEL: Record<nivelId,string>`; `aplicarCarreiraRH({ pessoa, historico, nivelId, salario, data, movId, hoje, usuario }) -> { erro } | { pessoa: obj|null, marcos: obj[] }`.
- [ ] Testes: data > hoje → erro; cargo muda → pessoa.cargo novo + marco `{id:"rhc_<movId>_cargo", tipo:"cargo", data, valorDe, valorPara}`; salário igual → sem marco de salário; marco mais novo do mesmo tipo → pessoa não muda mas marco entra; nivelId desconhecido → erro; nomes de `CARGO_POR_NIVEL` == `NIVEIS[].cargo`.
- [ ] Implementar, `npm test` verde, commit.

### Task 2: Ação `carreiraRH` e formulário de movimentação
**Files:** Modify `ml-comercial/index.ts`, `gestao/src/services/dados.js`, `gestao/src/pages/Carreira.jsx`.
**Consumes:** `aplicarCarreiraRH`.
- [ ] Servidor: exige `podeGravar(perm, setor, "carreira")`; lê membro em `colecaoDe(setor,"equipe")`, usa `rhPessoaId` dele; lê `rh_pessoas`/`rh_historico` da pessoa; grava; `bump`.
- [ ] Cliente: `carreiraRH({setor, membroId, nivelId, salario, data, movId})`; formulário com "Novo salário (R$)" (faixa de referência e aviso), data máxima hoje quando há RH; chama após gravar a movimentação e mostra o resultado; texto de "Apagar" avisa que o RH não volta.
- [ ] Build + testes, commit.

### Task 3: Funções do plano por setor + DF
**Files:** Create `gestao/src/lib/cargosPlano.js` (gerado das descrições DF e dos rascunhos); Modify `gestao/src/pages/Funcoes.jsx`, `gestao/src/lib/cargosMinasLab.js` (nivelId nos modelos).
- [ ] `modelosDoSetor(setor, funcoes)` puro e testado: só cargos do setor; reconhece existente por nome, `funcao` ou `antigos` do nível; modelo com `idFixo` usa esse id.
- [ ] "Nova função"/salvar recusa nome repetido.
- [ ] Impressão da descrição com código DF no cabeçalho.
- [ ] Build + testes, commit.

### Task 4: Cargo do RH como lista
**Files:** Modify `src/components/rh/AbaPessoas.jsx`.
- [ ] Select agrupado por trilha (NIVEIS) + Sócio, Gerente, Diretora + "Outro (digitar)"; valor fora da lista aparece selecionado como está.
- [ ] Build raiz, commit, PR, merge, publicar `ml-comercial`.
