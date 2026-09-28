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
| 76d9e27 | trava no lápis da Entrada | provisória; **saiu no mesmo dia**, quando a edição segura de lote (3f4e0d1, 4335260, ff30975) entrou no ar |
| (este) | `resumoDoc` declarado antes de `lista` (linha 121) | qualquer filtro de documentação diferente de TODOS derrubava a tela (TDZ) |

A barra dupla vem de arquivo gravado por script. Vale uma varredura antes de cada commit: regex literal com `\\d`, `\\s`, `\\b`, e texto com `"\\r\\n"` fora de `new RegExp(...)`.

## Estoque: conferido e NÃO consertado

1. ~~Editar lote pelo lápis zera as retiradas.~~ **Resolvido por você em 28/09**: a edição passou a usar `estoqueLoteEditar` (ml-sync), que preserva a retirada, e a trava provisória saiu. Conferido: o `ml-sync` no ar é o do main.

Os itens abaixo vieram do revisor do Estoque e **não foram conferidos à mão**:

2. ~~`estoque_lotes` fora do mapa do `estoqueSalvar` (a "Edição Produto/Lote" dava 403).~~ **Resolvido** pela mesma edição segura.
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
- `ml-financeiro-nfse` (salvar rascunho): só RASCUNHO e REJEITADA se editam. AUTORIZADA e PROCESSANDO recebem 409; antes, "Abrir" e "Salvar" rebaixava nota autorizada para rascunho.
- `ml-financeiro-arquivos-v2`: confere o crachá antes de regenerar o PDF. Uma queda do serviço devolve 503 e não desloga mais ninguém.
- `ml-financeiro` (a central), ação `notaExcluir`: recusa com 409 mandar para a lixeira nota emitida aqui ou pela Omie que esteja AUTORIZADA ou PROCESSANDO. A tela faz a mesma conta.
- `ml-financeiro-listas`: o filtro "VENCIDO" de Contas a pagar e a receber passou a ser pela data (em aberto, com saldo, vencimento antes de hoje em São Paulo). É a mesma regra do painel e do selo das listas, em `src/lib/tituloVencido.js`.
- `ml-financeiro-movimentacao-extrato`: o resumo soma todos os lançamentos (parava em 1.000).
- `ml-financeiro-omie-auto` lê o hash do token do agendamento do segredo `ML_OMIE_AUTO_ROTINA_HASH`.
- 12 funções que só existiam no Supabase agora estão no repositório. 10 mortas foram apagadas.

## Financeiro: dois pontos para quem mexe na tela e no banco

- `src/components/financeiro/FinanceiroLayout.jsx`: os cartões do painel ("Vencidos", "Contas a receber vencidas", "A pagar no mês" etc.) continuam interceptados pelo Layout, mas os filtros agora vão no `state` da navegação (`filtroCartao`: empresa, status, ano, mês) e as listas os leem no primeiro render. Antes eram aplicados no DOM depois de navegar, e a empresa voltava para "Todas" quando as opções ainda não tinham chegado. O cartão "Vencidos" abre a lista que tem vencido (a pagar, quando só há despesa vencida).
- Gatilho `financeiro_normaliza_nota_omie` (migração `20260907134500`, linha 36): o status "CANCELADA" por extenso só é gravado quando `status_fiscal` está vazio. Nota que chegou "EMITIDA" e depois foi cancelada fica AUTORIZADA. Hoje nenhuma está assim (2.065 "F", 274 "C", 72 "EMITIDA"). A lixeira já olha o `status_omie` para não travar essa nota; o gatilho em si falta consertar.

## O ar e o GitHub: onde ainda divergem

Conferido em 28/09 à tarde, lendo o fonte publicado das 41 funções (os dois formatos de pacote, o do painel e o da linha de comando) contra o `main`: **33 iguais, 8 diferentes.**

Quatro foram trazidas para cá como estão no ar, porque o ar era o GitHub com pequenas melhorias: `ml-financeiro-servicos-grupar` (mensagem ao retirar OS), `ml-financeiro-nfse-importacao` (só formatação), `ml-financeiro-movimentos-internos` (travas de "movimento já resolvido") e `ml-financeiro-servicos-nfse-vincular` (só espaços).

**Quatro divergiram de verdade.** Decisão do Léo (28/09): pôr as proteções, desde que nada quebre. Ficou assim no GitHub:

| função | o que está no GitHub agora |
|---|---|
| `ml-financeiro-nfse-producao` | a versão do ar (município pelo CEP, e-mail fiscal escolhido) **mais** as duas proteções que só o GitHub tinha: guarda a chave quando a nota é autorizada e o XML não volta (fica em PROCESSANDO para reconciliar), e registra o erro de produção na nota (relendo o que já foi gravado, para não apagar a tentativa) |
| `ml-financeiro-nfse-danfse` | a versão do ar (DANFSe montado na função) **mais** porta: crachá da direção para qualquer nota; sem crachá, só o caso do gatilho do banco (autorizada, com XML e sem PDF). Antes atendia qualquer um |
| `ml-financeiro-omie-extrato` | a versão do ar. A do GitHub tinha a conciliação automática (`autoConciliar`), que é funcionalidade nova, não proteção: fica no histórico do git se alguém quiser retomar |
| `ml-financeiro-omie-v2` | a versão do ar (já segue o status da Omie em cada sincronização) |

As duas primeiras **ainda precisam ser publicadas** (a publicação ficou barrada nesta sessão). Até lá, o GitHub está à frente do ar nelas.

Antes de publicar qualquer função, baixe o que está no ar (`supabase functions download <nome>`) e compare com o seu arquivo. Publicação de função não se mescla: quem publica por último apaga o que o outro publicou.
