# Compras: pedido → ordem → estoque, e cadastro de produto separado (Ana, 24/11/2026)

## Por quê
"Está confuso": no Estoque, cadastro e controle se misturam; e não fica claro como o
pedido aprovado vira compra e entra no estoque.

## Fluxo decidido
1. Solicitar material: colaborador pede (sem mudança).
2. Pedidos: quem trata aprova (com a quantidade). O aprovado **não avança mais por botão em
   Pedidos**: fica "Aguardando ordem". Recusar continua.
3. Ordens de compra: no topo, a fila **"Aguardando ordem"** (aprovados sem ordem). Marca os do
   mesmo fornecedor → **Criar ordem** (abre o formulário já com os itens). Criar a ordem põe os
   itens "Em cotação". Marcar a ordem **Comprada** (antes "Enviada ao fornecedor") põe os itens
   "Comprada" (quem pediu é avisado no sino, pelo upsert).
4. **Chegou — dar entrada** (botão com texto na ordem comprada): a conferência que já existe
   (ModalRecebimento) lança no estoque e marca "Recebida".
- Escolha da Ana: juntar por fornecedor (fila), e entrada quando o material CHEGA.

## Produtos × Estoque
- Nova aba **Produtos** (quem edita o Estoque): lista do cadastro, Novo produto, Editar, Excluir.
- **Estoque** fica só com saldo, entrada/saída e extrato (sem Novo produto e sem Editar).

## Não muda
Os 21 pedidos "Solicitada" existentes não são alterados (andam no fluxo novo). Prazo, sino,
Retiradas. Pedido antigo "Em cotação"/"Comprada" fora de ordem mantém os botões de hoje.

## Approaches
- Fila em Ordens para juntar por fornecedor (ESCOLHIDA) × uma ordem automática por item
  aprovado (muitas ordens, fornecedor preenchido depois).
- Entrada na chegada com conferência (ESCOLHIDA) × entrada ao marcar comprada (estoque
  mostraria o que não chegou).
