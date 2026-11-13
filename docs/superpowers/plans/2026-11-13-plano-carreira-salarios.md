# Plano de carreira: novos cargos e faixas salariais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novos cargos e trilhas no PCC e faixa salarial em R$ (padrão + ajuste da direção) visível nas trilhas e no PCC.

**Architecture:** Regras puras em `gestao/src/lib/planoCarreira.js` (testadas em `planoCarreira.test.mjs`); a tela `pages/Carreira.jsx` e o documento `components/DocumentosCarreira.jsx` só mostram e gravam.

**Tech Stack:** React 19 + Vite, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-plano-carreira-salarios-design.md`

## Global Constraints
- Valores padrão exatamente os da tabela do spec.
- `nivelDaFuncao("Gerente")` continua `null` (Lidyane fora do plano).
- Textos em português, mesmo tom dos níveis existentes.

## Review Focus
- Direção apaga o mínimo/máximo no ajuste → volta para o valor padrão (não fica vazio nem 0).
- Direção digita "2.400,50" ou "R$ 2400" → número 2400.5 / 2400.
- Mínimo maior que máximo → salvar recusa com mensagem.
- Ajuste antigo com `faixa` texto e sem números → padrão + texto como observação.
- Cargo que está em duas trilhas (Supervisor Administrativo) → aviso de ordem conferido em cada trilha.

---

### Task 1: Cargos, trilhas e faixas em `planoCarreira.js`

**Files:** Modify `gestao/src/lib/planoCarreira.js`; Test `gestao/src/lib/planoCarreira.test.mjs`

**Interfaces — Produces:**
- Cada nível tem `salario: { min: number, max: number, obs?: string }`.
- Novos ids: `lab-est`, `qual-est`, `qual-an`, `qual-ger`, `fin-an`, `adm-ger`, `fin-ger`.
- Trilhas: laboratorio `[lab-est, lab-aux, lab-an1, lab-an2, lab-an3, lab-sup]`; qualidade `[qual-est, qual-an, qual-sup, qual-ger]`; comercial `[..., adm-sup, adm-ger]`; nova `financeiro` `[adm-fin, fin-an, fin-ger]`; administrativo deixa de existir (adm-fin vai para financeiro).
- Laterais novas: `lab-an2 → qual-an`, `lab-an3 → qual-an` (mantém as atuais).
- `faixaSalarial(id, ajustes) -> { min, max, obs, ajustada: boolean } | null`
- `lerReais(texto) -> number | null` ("2.400,50" → 2400.5; "" → null)
- `formatarFaixa({min,max}) -> "R$ 2.250 a R$ 2.550"`
- `avisosFaixas(ajustes) -> [{ trilha, de, para, texto }]` (mínimo de um degrau < mínimo do anterior, ou min > max).

- [ ] Testes: todos os níveis têm `salario.min <= salario.max`; `faixaSalarial("lab-an3", {})` = 2250/2550; com ajuste `{ "lab-an3": { salarioMin: 2300 } }` → min 2300, max 2550, ajustada true; `lerReais("2.400,50")===2400.5`, `lerReais("R$ 2400")===2400`, `lerReais("")===null`; `avisosFaixas({})` vazio; `avisosFaixas({ "lab-an2": { salarioMin: 1500 } })` com um aviso na trilha laboratorio; `proximosPassos("adm-sup")` inclui `adm-ger`; `proximosPassos("lab-an2")` = `["lab-an3","qual-an"]`; `nivelDaFuncao("Gerente")===null`; `nivelDaFuncao("Gerente Financeiro").id==="fin-ger"`.
- [ ] Rodar `npm test` → falha.
- [ ] Implementar.
- [ ] `npm test` → passa. Commit.

### Task 2: Tela e PCC

**Files:** Modify `gestao/src/pages/Carreira.jsx`, `gestao/src/components/DocumentosCarreira.jsx`, `gestao/src/estilo.css`

**Consumes:** `faixaSalarial`, `formatarFaixa`, `lerReais`, `avisosFaixas` da Task 1.

- [ ] Degrau mostra `formatarFaixa(faixaSalarial(id, c.ajustes))`.
- [ ] `DetalheNivel`: campos "Salário mínimo (R$)" e "Salário máximo (R$)" no lugar de "Faixa salarial", placeholder = padrão; grava `salarioMin`/`salarioMax` (null quando vazio); recusa min > max; botão para voltar ao padrão = limpar os dois.
- [ ] Card "Faixas para conferir" na aba Trilhas quando `avisosFaixas` não vazio.
- [ ] PCC: coluna "Tempo mínimo · faixa" usa `formatarFaixa`; texto `TEXTO_PLANO.salario` atualizado (valores de referência nov/2026, revisão anual, estágio = bolsa-auxílio Lei 11.788).
- [ ] `npm run build` passa. Commit, PR.
