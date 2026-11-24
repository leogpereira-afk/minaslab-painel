# Compras: fluxo pedido → ordem → estoque — Implementation Plan

> **For agentic workers:** implement inline (executing-plans). Steps use checkboxes.

**Goal:** aprovado vai para a fila de ordem; ordem comprada → itens "Comprada"; chegada dá entrada; aba Produtos separada.
**Architecture:** só tela (React). Pedidos/ordens já gravam por `salvar` (upsert avisa quem pediu). Regras puras novas em `src/components/compras/comum.jsx`.
**Tech Stack:** React 18, Vite, node:test.
**Spec:** docs/superpowers/specs/2026-11-24-compras-fluxo-ordem-estoque-design.md

## Global Constraints
- Não alterar registros existentes no banco; nada de migração.
- Textos em português, como a casa escreve.

## Review Focus
- Item aprovado já numa ordem não pode aparecer na fila (nem em duas ordens).
- Pedido "Solicitada" não pode entrar em ordem.
- Marcar a ordem Comprada não pode rebaixar item já "Recebida"/"Recusada".
- Pedido antigo cotando/comprada sem ordem continua tendo caminho até "Recebida".
- Quem só vê o Estoque (sem edição) não ganha a aba Produtos.

### Task 1: regras puras (comum.jsx) + testes
- `aguardandoOrdem(c)`: `c.status === "aprovada" && !c.ordemId`.
- `podeEntrarEmOrdem(c)`: sem ordem e status em aprovada/cotando/comprada.
- `statusAoComprarOrdem(c)`: "comprada" se status em aprovada/cotando; senão o mesmo.
- `STATUS_ORDEM.enviada` = "Comprada".
- Teste em `src/lib/comprasFluxo.test.mjs`. Commit.

### Task 2: Pedidos
- Linha: aprovada sem ordem → sem seta; chip "Aguardando ordem". Item com ordem → sem seta (a ordem conduz).
- Barra de lote: só Desmarcar, Não aprovar, Aprovar.

### Task 3: Ordens
- Cartão "Aguardando ordem" com marcação + "Criar ordem" → `acoes.novaOrdemCom(ids)`.
- FormOrdem: disponíveis via `podeEntrarEmOrdem`.
- salvarOrdem: itens novos aprovados → "cotando". avancarOrdem: ordem "enviada" e itens via `statusAoComprarOrdem`.
- Botão com texto "Chegou — dar entrada" (status enviada); seta vira "Marcar comprada".

### Task 4: aba Produtos / Estoque só controle
- ABAS + COLECOES_POR_ABA `produtos`; visível com `editaEstoque`.
- `AbaProdutos.jsx`: tabela + Novo/Editar (FormProduto com excluir).
- AbaEstoque: tirar Novo produto e Editar.

### Task 5: verificação
- `npm test`, `npx eslint src`, `npm run build`; PR; CI; merge após OK da Ana.
