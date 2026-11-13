# Cargos ligados: plano de carreira → Funções e cargos → RH (design)

Pedido da direção em 13/11/2026, opção B escolhida.

## Intenção
Hoje o mesmo cargo é escrito à mão em três lugares e diverge (ex.: Anderson
"Analista II" no RH e III na planilha; "Analista de Laboratorio" x "Analista de
Laboratório I"). A direção quer **uma lista só — a do plano de carreira
(`gestao/src/lib/planoCarreira.js`, `NIVEIS`)** — usada ao cadastrar no RH e em
Funções e cargos, e quer que **a promoção registrada no plano de carreira
atualize o RH sozinha** (cargo, salário e histórico).

## Objetivos
1. **Funções e cargos (Gestão):** carregar as funções do plano que faltam em
   cada setor, já com escopo → missão, requisitos e treinamentos do plano;
   impedir duplicata por nome; limpar as cópias repetidas que existem hoje no
   Laboratório.
2. **RH (painel, `src/components/rh/AbaPessoas.jsx`):** o campo Cargo vira uma
   lista com os cargos do plano (agrupados por trilha) + cargos fora do plano
   (Sócio, Gerente, Diretora) + "Outro" com texto livre. Valor antigo que não
   está na lista continua aparecendo e salvo como está.
3. **Promoção atualiza o RH:** ao registrar uma movimentação (promoção,
   lateral ou enquadramento) no plano de carreira, para quem tem ficha no RH
   (`membro.rhPessoaId`):
   - `rh_pessoas.cargo` passa ao nome do cargo do plano;
   - se informado, `rh_pessoas.salario` passa ao novo salário;
   - `rh_historico` ganha "Mudança de cargo" e, se mudou, "Mudança de
     salário", com `data` = a data de vigência da movimentação (não o dia do
     registro), no mesmo formato que a ficha do RH já grava (`marcosDaFicha`).
4. Formulário de movimentação ganha **"Novo salário (R$)" opcional**, com a
   faixa do cargo de destino como referência e aviso se ficar fora dela.

## Não objetivos
- Mudança de cargo feita direto na ficha do RH **não** muda a função na
  Gestão (sentido único: o plano é onde se promove). A ficha do RH mostra uma
  dica dizendo isso.
- Não lê nem mostra o salário atual do RH dentro da Gestão (o valor "de" do
  histórico é calculado no servidor).
- Não cria funções de cargos fora do plano (Sócio, Gerente, Diretora).

## Anti-objetivos
- Gravar no RH sem passar pelo servidor que confere o crachá e a permissão.
- Apagar de verdade (DELETE) qualquer registro: a limpeza é lápide (`apagado`).
- Duplicar histórico: registrar a mesma movimentação duas vezes não pode criar
  dois marcos iguais (id do marco derivado da movimentação).

## Constraints
- Gestão só fala com o banco pelo `ml-comercial` (`dadosGravar` etc., conferido
  por página em `acessos.mjs`). A escrita no RH entra como **ação nova e
  estreita** no `ml-comercial` (`carreiraRH`), permitida a quem pode gravar a
  página Carreira; ela só toca `rh_pessoas.cargo`, `rh_pessoas.salario` e
  insere em `rh_historico`.
- O painel raiz (`src/`) e a Gestão (`gestao/`) são apps Vite separados no
  mesmo repositório; a Gestão já importa de fora da sua pasta
  (`supabase/functions/ml-comercial/acessos.mjs`). O RH importa a lista de
  `gestao/src/lib/planoCarreira.js` (fonte única).
- Publicação da Edge Function pelo workflow `publicar-funcoes.yml`.

## Abordagens consideradas
- **A) Só a mesma lista** — mais barato; risco de esquecer de atualizar o RH.
- **B) Promoção no plano atualiza o RH (escolhida pela direção)** — o plano
  vira o único lugar de promoção; custa uma ação nova no servidor.
- **B') Sincronia nos dois sentidos** — descartada: duas fontes de verdade
  brigando; a ficha do RH muda cargo por outros motivos (correção de digitação).

## Mapeamento setor → funções (decisão do construtor, revisável)
- Laboratório: trilhas Laboratório e Qualidade.
- Comercial: trilhas Comercial e administrativo, Coleta e amostragem, Financeiro
  (o José Roberto já está na equipe do Comercial).

## Decisões tomadas na revisão (calls do construtor, marcadas para a direção conferir)
1. **Data de vigência:** para quem tem ficha no RH, a data da movimentação não
   pode ser futura (a mudança é registrada quando passa a valer; folha usa o
   salário do RH). Data passada é aceita: o histórico do RH recebe o marco com
   essa data, e a ficha (cargo/salário) só é sobrescrita se não houver marco
   do mesmo tipo com data posterior (registro retroativo não desfaz mudança
   mais nova).
2. **Limpeza de duplicadas (Laboratório):** só nomes idênticos contam como
   duplicata. Fica a cópia ligada a alguém da equipe; se nenhuma está ligada,
   a mais antiga (`criadoEm`). `equipe.funcaoId` que aponte para uma cópia é
   repontado antes da lápide. Feito uma vez, por script SQL revisado.
3. **Retroativos:** nada a reenviar — a única movimentação registrada
   (Giovanna, 01/09/2026) já está igual no RH.
4. **Correção/exclusão de movimentação:** a ação só aplica, nunca desfaz.
   Apagar uma movimentação no histórico da carreira não mexe no RH (o aviso de
   confirmação passa a dizer isso). Os ids dos marcos derivam do id da
   movimentação, então reenviar a mesma não duplica.
5. **Permissão:** o servidor recebe `setor` e `membroId`, exige
   `podeGravar(perm, setor, "carreira")`, lê o membro na equipe daquele setor e
   usa o `rhPessoaId` gravado lá (nunca o enviado pelo navegador). O nome do
   cargo vem de `nivelId` resolvido no servidor pela lista do plano.

## Deixado para o construtor
Texto das dicas, layout da lista agrupada, ordem dos campos, nomes internos.
