# Para quem mexe no Estoque, no ml-sync e nas permissões

Auditoria de 28/09/2026. Estas três áreas estavam em desenvolvimento ativo (os commits de 25 a 27/09), então quase nada aqui foi alterado: fica anotado para você decidir e consertar no seu ritmo. O relatório completo está fora do repositório, com o dono do sistema.

**Antes de continuar: `git pull`.** E antes de publicar qualquer função, puxe o main também. Publicação de função não se mescla; quem publica por último apaga o que o outro publicou.

## O que foi mexido nos seus arquivos (já no main)

Tudo em `src/pages/GestaoEstoque.jsx`, sempre cirúrgico:

| commit | o que | por quê |
|---|---|---|
| ad7fc54 | `ShoppingCart` na importação do lucide | o deploy estava travado desde 27/09 21h18 |
| 9d4f453 | cinco regex com barra dupla (`/(\\d+)/g` e afins) | **todo pedido novo nascia PC-01 e apagava o PC-01 existente** (a RPC trata código preenchido como edição). Também: CSV numa linha só, prazo de alerta que nunca validava, etiqueta com id cru |
| c6d6093 | `html()` escapando os campos da etiqueta | nome de produto virava HTML no popup de mesma origem |
| (este) | trava no lápis da Entrada | ver o item 1 abaixo |
| (este) | `resumoDoc` declarado antes de `lista` (linha 121) | qualquer filtro de documentação diferente de TODOS derrubava a tela (TDZ) |

A barra dupla vem de arquivo gravado por script. Vale uma varredura antes de cada commit: regex literal com `\\d`, `\\s`, `\\b`, e texto com `"\\r\\n"` fora de `new RegExp(...)`.

## Estoque: conferido e NÃO consertado

1. **Editar lote pelo lápis zera as retiradas.** Conferido. A edição chama `estoqueEntrada` (`ml-sync/index.ts`, perto da linha 697), que faz `qtdRetirada = 0`, `totalAtual = total` e grava outra ENTRADA "CADASTRO NOVO". Num lote com saída, o saldo volta inteiro. Medido em 28/09: 398 lotes, nenhum afetado. **Pus uma trava temporária na tela** (lote com retirada não se edita pelo lápis). O conserto de verdade é uma ação própria de edição que preserve a retirada e registre um AJUSTE com a diferença.

Os itens abaixo vieram do revisor do Estoque e **não foram conferidos à mão**:

2. `estoque_lotes` está fora do mapa do `estoqueSalvar` (`ml-sync:600-609`): a "Edição Produto/Lote" dá 403 para todos, inclusive a direção, e empurra o usuário para o lápis do item 1.
3. O código ML-N do lote é calculado no navegador (`GestaoEstoque.jsx:74`): duas entradas com a lista desatualizada geram o mesmo id e a segunda apaga a primeira. O servidor devia numerar.
4. Na edição de pedido, o item novo recebe id pela posição e pode sobrescrever um existente; dá para remover item CONCLUÍDO (`migrations/20260925173000_ml_estoque_pedido_salvar.sql:12`).
5. Lote e produto casados pelo nome exato (`:44`): o lote é gravado em maiúsculas e o produto como foi digitado, então produto com estoque aparece zerado.
6. Depois da inspeção a tela mostra "Lote em Estoque", mas nenhum lote é criado (`:182`).
7. Fornecedor: a tela lê `proximaAvaliacao` e a RPC grava `dataProximaAvaliacao` (`migrations/20260925183000...:16`); reprovado aparece REGULAR.
8. O anexo da entrada (NF, certificado, laudo) vira `{}` e nunca é enviado (`:83`).
9. Datas em UTC em 9 pontos e no `ml-sync:727`: depois das 21h o registro ganha a data de amanhã.
10. Compras e Gestão de Estoque mantêm saldos separados, sem ponte, os dois no menu.
11. `jspdf` e `jspdf-autotable` importados no topo: abrir a tela baixa ~780 KB de PDF. Um `import()` dentro do botão resolve.

## ml-sync (não mexido)

- `admissaoConferida = true` ao confirmar QUALQUER documento (`ml-sync:866-867`). A admissão das fichas veio da primeira batida no relógio; confirmar um ASO não confere a admissão.
- `upsert` e `delete` genéricos (`:397`) pulam as RPCs do estoque e o livro que devia ser só de acréscimo.
- URL assinada vale para qualquer bucket e caminho (`:551`, `:652`); o `ml-arquivos` também guarda documento do RH.
- O `bump` do rev é ler-calcular-gravar (`:156-165`, e igual em `ml-ponto` e `ml-omie`): duas gravações simultâneas apagam o carimbo uma da outra, e outras abas ficam com cópia velha.
- `listarVarias` lê os dados antes do rev (`:443-479`); o rev devia vir antes.

## Permissões (não mexido)

- Desativar conta ou trocar senha não derruba a sessão na maioria das funções (só `ml-sync`, `ml-patrimonio` e três de serviços consultam `ml_contas`). A tela promete o contrário em `Acessos.jsx:272` e `:414`.
- `gerarSenha` (`Acessos.jsx:67-73`): 5.760 combinações e `Math.random`. Trocar por `crypto.getRandomValues` com mais letras.
- A tela de Acessos sempre grava `__matriz_v1` (`:380`, `:429`), e o servidor só deixa escrever direção ou equipe sem matriz (`ml-sync:397`): conta Equipe criada vira só consulta, sem aviso.
- O freio de login é por usuário e vem antes da senha (`ml-sync:327`): qualquer um tranca a conta `leo`.

## Funções: o que mudou no servidor em 28/09

- `ml-financeiro-nfse`, `-dps`, `-homologacao`, `-sefin`: a `auth()` só decodificava o crachá; agora confere assinatura, sistema, validade e papel (a mesma da `-producao`).
- `ml-financeiro-arquivos-v2`: confere o crachá antes de regenerar o PDF.
- 12 funções que só existiam no Supabase agora estão no repositório. 10 mortas foram apagadas.
- `ml-financeiro-omie-auto` lê o hash do token do agendamento do segredo `ML_OMIE_AUTO_ROTINA_HASH`.
- Cinco funções estavam diferentes do repositório (publicadas sem commit). Foram trazidas para cá **a partir do que rodava**. Se você tinha uma versão local de alguma delas, compare antes de publicar.
- A `ml-financeiro` (a central) ficou de fora: o pacote publicado não traz mapa de fonte, então não deu para provar que é igual ao repositório. Falta nela a trava que impede mandar NFS-e autorizada para a lixeira (`notaExcluir`, linha 102); por enquanto a trava está só na tela.
