// Ponto → aba RELATÓRIOS. O que sai do ponto em PAPEL e em PLANILHA.
//
// Pedido do Leonardo (28/08/2026): "quero relatório ano, mês e dia e comparação
// de período, para saber qual funcionário chega no horário etc, e ser possível
// baixar em pdf". São quatro perguntas diferentes, e cada uma virou uma visão:
//
//   DIA       quem estava aqui hoje, a que horas chegou e quanto deve
//   MÊS       o RANKING do mês: uma linha por pessoa, do maior para o menor
//   ANO       o ranking do ano E, abaixo, doze colunas: a TENDÊNCIA
//   COMPARAR  dois períodos livres lado a lado, com a diferença explicada
//
// ESTA ABA NÃO GRAVA NADA — não recebe `gravar` nem `apagarReg`. Relatório que
// altera o dado que ele mesmo mostra é o jeito mais rápido de perder a
// confiança no número.
//
// ============================================================================
// AS DECISÕES DESTA TELA
//
// 1. EXISTEM DOIS ATRASOS, E ELES NÃO SE SOMAM. O relatório mostra o da
//    PONTUALIDADE: a batida de entrada contra o começo previsto pela escala,
//    com a tolerância do art. 58 § 1º já aplicada (atrasoDoDia). O outro — o
//    saldo trabalhado-contra-previsto que vira desconto na folha
//    (apurarCompetencia().atrasosMin) — mora na aba Fechamento e continua lá.
//    Somar as duas réguas cobraria o mesmo atraso duas vezes; mostrar uma sem
//    dizer qual é faria o RH descontar pelo número errado. Por isso a coluna se
//    chama "Atrasos na chegada" e a tela escreve, em toda visão, que este
//    número não é o do desconto.
//
// 2. TOLERÂNCIA É TUDO OU NADA. Até 5 min por marcação e 10 no dia não são
//    atraso (CLT art. 58 § 1º, Súmula 366 do TST); passando disso conta-se a
//    TOTALIDADE, não o excedente. Quem faz essa conta é a lib — aqui a tela só
//    DIZ, em voz alta, que o número já sai com a tolerância aplicada. Número de
//    atraso sem essa frase ao lado é acusação sem régua.
//
// 3. PONTUALIDADE SEM DIA MEDIDO É "sem registro", NUNCA 0%. Zero por cento
//    leria como "nunca chega no horário" — o oposto exato do que o dado diz de
//    quem estava de férias o mês inteiro. É a mesma regra do resto da casa
//    (dado ausente não é zero), no lugar onde ela seria mais cara.
//
// 4. PORCENTAGEM SOBRE BASE ZERO NÃO EXISTE. Na comparação, período anterior
//    zerado (ou sem medição) escreve "sem base para comparar" — nunca "+100%",
//    nunca ∞. Quem foi de 0 para 3 faltas não piorou "cem por cento": passou a
//    ter faltas, e é isso que a tela escreve.
//
// 5. PERÍODOS DE TAMANHOS DIFERENTES NÃO SE COMPARAM PELO TOTAL. 30 dias contra
//    15 dá o dobro de horas sem ninguém ter trabalhado mais. A tela avisa
//    quando os dois períodos têm quantidades diferentes de DIAS DE ESCALA e
//    mostra a média por dia ao lado do total, sempre.
//
// 6. NULL NUNCA VIRA ZERO NUMA SOMA (somaOuNulo). Uma pessoa sem apuração não
//    baixa o total do grupo: ela não entra. E se ninguém tiver medição, o total
//    é "sem registro" — não é zero.
//
// 7. O RECORTE VAI IMPRESSO. Relatório de ponto que circula sem dizer de qual
//    período é, de qual filtro saiu, quando foi emitido e QUANDO O RELÓGIO FOI
//    IMPORTADO PELA ÚLTIMA VEZ é papel perigoso: alguém desconta de um mês
//    achando que o dia de ontem já entrou. O bloco `.apenas-impressao` diz as
//    quatro coisas.
//
// 8. QUEM NÃO BATE PONTO NÃO APARECE AQUI (decisão do Leonardo, 28/08/2026).
//    Não é chip, não é seção separada, não é linha de travessões: some da
//    lista, dos cartões do alto e de todo total. Quem não é medido pelo relógio
//    não tem o que fazer numa tela de ponto — o lugar dessa informação é a
//    ficha do RH, onde mora a marca (`batePonto`) e o motivo.
//    A REGRA DE LEITURA NÃO PODE SER INVERTIDA: `batePonto === false` é NÃO
//    BATE; ausente ou true é BATE. Ficha antiga não tem o campo, e tratar
//    `undefined` como false esvaziaria o relatório inteiro de uma vez, calado.
//    MAS O NÚMERO NÃO SOME: uma linha no rodapé diz quantas ficaram de fora.
//    "Não está aqui" não pode virar "não existe".
//
// 9. ATIVOS É O PADRÃO, E O TOTAL SÓ SOMA O QUE ESTÁ À MOSTRA. Pedido do
//    Leonardo: "não precisa aparecer os inativos junto". São 7 pessoas no
//    quadro e 13 desligadas — misturadas, a lista tripla de tamanho e o olho
//    perde as sete que importam. O Segmented Ativos/Todos/Desligados vale para
//    as quatro visões, a escolha fica guardada, e os totais, os cartões e a
//    planilha saem do MESMO recorte da lista. Rodapé que não bate com a lista
//    acima é o defeito clássico de quem recorta a tela e esquece a soma.
//    Desligada entra pelo dia trabalhado, não pela ficha: quem saiu em abril
//    aparece no relatório de março e não aparece no de maio.
//
// 10. O MÊS É UMA LISTA, NÃO UMA TABELA (29/08/2026). O dono mandou o print da
//     aba Vendedores do Painel da Impresilk: "eu quero a tela assim,
//     inteligente, que já sai os nomes assim, e bem mais moderno". A tabela de
//     nove colunas do Mês virou o RANKING do padrão da casa
//     (components/lista.jsx): nome, barra de proporção, dois apoios em cinza e
//     UM número forte à direita, a linha inteira abrindo o painel da pessoa.
//     TRÊS REGRAS QUE NÃO SE NEGOCIAM AQUI:
//       · A BARRA MEDE O MESMO NÚMERO QUE ESTÁ ESCRITO À DIREITA. Barra de
//         horas ao lado de "94%" é a mentira mais fácil de um ranking e a mais
//         difícil de perceber depois de pronta — por isso os dois saem do mesmo
//         `n` (ver `numeroDaLinha`), e o seletor "Número na tabela" troca os
//         dois de uma vez.
//       · PONTUALIDADE TEM TETO FIXO DE 100. Com teto relativo ao maior do
//         recorte, quem tirou 45% desenharia metade da barra de quem tirou 90%
//         — leitura falsa numa escala que já tem fim conhecido.
//       · O QUE A TABELA CONTAVA NÃO SUMIU: as nove colunas continuam inteiras
//         na planilha, os totais nos cartões do alto e no rodapé da lista, o
//         fechamento na linha de chips e a diferença entre "sem registro" e
//         "sem apuração" na linha logo abaixo da lista.
//     No ANO a tabela FICA: doze números por pessoa não cabem numa linha, e a
//     matriz é a razão de a visão existir. O ranking entra ACIMA dela, para a
//     tela abrir respondendo "quem trabalhou mais no ano".
//
// 11. A PRIMEIRA DOBRA É DO DADO (30/08/2026). O dono mandou o print: rolou a
//     tela do Ponto inteira e NÃO VIU UM NÚMERO — tudo o que cabia na altura da
//     tela era cabeçalho e explicação. O rodapé do cabeçalho tinha QUATRO
//     linhas de texto (escala, tolerância da CLT em parágrafo, carimbo do
//     relógio por extenso) entre os seletores e o primeiro cartão, e o carimbo
//     do relógio ainda REPETIA o que a faixa "Puxar do relógio" já dizia dois
//     blocos acima.
//     As quatro viraram UMA linha de fatos curtos — jornada · tolerância
//     aplicada · relógio lido hoje 21:45 — e um "entender os números" que abre
//     o texto inteiro, com a escolha guardada (`explicacao` em lerPrefs).
//     TRÊS COISAS NÃO RECOLHEM, e não recolhem de propósito:
//       · OS AVISOS (escala padrão, configuração que não carregou, turno não
//         entendido, divisor que não bate). Aviso escondido é aviso apagado.
//       · O CARIMBO DO RELÓGIO NO PAPEL. No `.apenas-impressao` ele continua
//         por extenso: na folha não há faixa nenhuma acima, e relatório
//         impresso que não diz de quando é já mandou descontar mês errado.
//       · O TEXTO DA TOLERÂNCIA. Ele não saiu do sistema — é o que evita
//         alguém confundir este atraso com o desconto da folha. Só deixou de
//         ocupar a altura que era do número. RECOLHER É DIFERENTE DE APAGAR.
//
// 12. A FOLHA JÁ INCLUI AS EXTRAS — E A TELA PASSOU A DIZER ISSO (30/08/2026).
//     Navegando o Jibble com o dono ao lado, a tela "Registros de Horário"
//     mostrou a CASCATA inteira, e ela desmentia a leitura desta aba:
//
//       Horas registradas       50h37   (crachá aberto: trabalho + pausa)
//         − pausa não remunerada  4h25
//       = Horas trabalhadas      46h13
//         − deduções automáticas  5h00   (1h/dia configurada na escala)
//       = HORAS DE FOLHA          41h13
//
//     E o bloco "Horas de folha de pagamento" abre a composição — no 28/08 da
//     Ana: normais 8h00 + extras diárias 1h15 = 9h15 DE FOLHA. Ou seja:
//     `payrollHours`, que a ponte grava como `trabalhadoMin` e esta tela
//     chamava de "Horas da folha", JÁ TEM AS EXTRAS DENTRO.
//     O ESTRAGO ERA DUPLO, e os dois eram silenciosos:
//       · "Horas da folha 177h30" ao lado de "Extra +50% 14h23" convidava a
//         SOMAR — pagando a mesma hora extra duas vezes;
//       · comparar as 177h30 com "Previsto no mês 193h00" para julgar se a
//         pessoa cumpriu a jornada é comparar peras com laranjas: o previsto é
//         de horas NORMAIS. No janeiro da VICTORIA as normais foram ~163h
//         contra 193h previstas — o déficit é o DOBRO do que a tela sugeria, e
//         era a hora extra que estava tapando justamente o buraco que ela
//         deveria denunciar.
//     O QUE MUDOU AQUI, e é regra desta aba daqui em diante:
//       · ONDE APARECE UM NÚMERO DE HORA, APARECE A CASCATA: normais, +50%,
//         +100% e, ao lado, a FOLHA como TOTAL — com o title dizendo em voz
//         alta que a folha já inclui as extras. Nunca a folha sozinha ao lado
//         de uma extra solta.
//       · QUEM SE COMPARA COM O PREVISTO É "NORMAIS", nunca a folha. O cartão
//         do Mês virou "Horas normais", com o previsto embaixo e a folha ao
//         lado como total.
//       · O SELETOR "Número na tabela" ganhou "Horas normais (sem extras)", e
//         o rótulo antigo virou "Horas da folha (com extras)" — quem escolhe
//         precisa saber qual é qual ANTES de escolher, não depois de somar.
//     QUEM FAZ A CONTA É A LIB (`normaisDoDia`), a MESMA que `apurarCompetencia`
//     usa: normal e extra saem da mesma linha, num lugar só. Se a tela fizesse
//     a subtração aqui, o mês e a linha divergiriam no primeiro conserto feito
//     de um lado só.
//
// 13. TRAVESSÃO SOZINHO NÃO DISTINGUE "NÃO TRABALHOU" DE "NÃO ERA DIA DE
//     TRABALHO" (30/08/2026). No Jibble o dia sem jornada vem com um selo
//     explícito ("Dia de descanso"), e é uma dúvida real de quem confere: o
//     sábado em branco desta tela lia igualzinho à segunda-feira em branco de
//     quem faltou. Onde a escala prevê ZERO minuto, o travessão passa a vir
//     acompanhado do selo `sem jornada` — e ele aparece TAMBÉM no sábado
//     TRABALHADO, onde a normal é 0 e a folha inteira é excedente: sem o selo,
//     "normais —" ao lado de "folha 4h20" pareceria erro de conta.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/Ponto.jsx)
// ----------------------------------------------------------------------------
//   pessoas   Object[]  todas as fichas (rh_pessoas), ativas e desligadas. O
//                       relatório de um mês passado precisa do nome de quem já
//                       saiu — quem foi desligado no dia 15 trabalhou até o 15.
//   ativos    Object[]  só quem está no quadro, JÁ ordenado por nome.
//   ponto     Object[]  coleção "rh_ponto" — o FECHAMENTO por pessoa/mês. Aqui
//                       ele responde UMA pergunta: este mês já foi conferido e
//                       fechado? (ver o comentário em COLUNAS_MES).
//   pontoDia  Object[]  coleção "rh_ponto_dia" INTEIRA (todos os meses) — é o
//                       dia a dia que sustenta as quatro visões.
//   hojeISO   string    "AAAA-MM-DD" LOCAL (ymdLocal).
//   setAviso  (aviso|null) => void   { tipo: "ok" | "erro", texto }.
//
// A competência (e o dia, e o ano, e os dois períodos) é DESTA ABA: a casca não
// guarda o mês — ver o comentário longo em pages/Ponto.jsx.
//
// A configuração global (jornada, divisor, fatores) vem de lerCfg(). Enquanto
// ela não chega, vale o padrão da casa E A TELA DIZ ISSO: previsto e atraso
// saem da escala, e escala suposta em silêncio é atraso inventado.

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlarmClock, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CalendarOff,
  ChevronDown, CircleAlert, Clock, Download, Minus, Percent, Printer, Settings2, Users,
} from "lucide-react";
import { lerCfg } from "../../services/dados.js";
import { dataCurta, dataLonga, diasEntre, ymdLocal, MESES, MESES_LONGOS } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import {
  apurarCompetencia, atrasoDoDia, ausenciaDoDia, cfgDoPonto, competenciaDe,
  descreverJornada, diaDaSemanaISO, diasDoMes, divisorDaJornada, duracaoTexto, ehCompetencia, fimPrevistoDoDia,
  horasDecimais, inicioPrevistoDoDia, minutosPrevistosDoDia, minutosPrevistosDoMes,
  minutosTrabalhados, normaisDoDia, NOMES_DIA_SEMANA, TOLERANCIA_DIA_MIN, TOLERANCIA_MARCACAO_MIN,
} from "../../lib/rh/ponto.js";
import { Card, Empty, Modal, SectionTitle, Segmented, StatCard } from "../ui.jsx";
/* O PADRÃO DA LISTA DE TRABALHO (components/lista.jsx) — o mesmo desenho da aba
   Vendedores do Painel da Impresilk, que o dono mandou em 28/08/2026. Nada é
   redesenhado aqui: cópia do desenho em cada tela é como o padrão apodrece. */
import { Explicacao, LinhaRanking, Pilulas, Secao } from "../lista.jsx";

// ============================================================================
// PALAVRAS E NÚMEROS — o vocabulário que as quatro visões dividem
// ============================================================================

const VISOES = [
  { valor: "dia", rotulo: "Dia" },
  { valor: "mes", rotulo: "Mês" },
  { valor: "ano", rotulo: "Ano" },
  { valor: "comparar", rotulo: "Comparar" },
];

/**
 * O RECORTE DE QUADRO — vale para as quatro visões ao mesmo tempo.
 *
 * "Ativos" é o padrão porque é a pergunta de todo dia ("como está a minha
 * equipe?"). "Todos" e "Desligados" existem para o mês fechado e para a
 * rescisão, que é quando se olha para trás.
 */
const QUADROS = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "todos", rotulo: "Todos" },
  { valor: "desligados", rotulo: "Desligados" },
];

/**
 * AS DOZE PÍLULAS DE MÊS. Rótulo curto ("jan", "fev") porque são doze numa
 * linha só: com o nome inteiro elas quebram em três fileiras e deixam de ser
 * uma régua para virar um parágrafo de botões.
 */
const PILULAS_MES = MESES.map((m, i) => ({ valor: String(i + 1).padStart(2, "0"), rotulo: m }));

/** A escolha do recorte FICA GUARDADA, como nas outras telas da casa. */
const K_PREFS = "minaslab.ponto.relatorios";

/**
 * O FIO QUE SEPARA A COLUNA PRESA — desenhado por sombra, não por borda.
 *
 * A tabela é `border-collapse: collapse` (padrão do Tailwind), e ali a borda
 * pertence à JUNÇÃO de duas células: quando a coluna presa desliza por cima da
 * vizinha, a borda fica para trás e o fio some ou se duplica no meio da
 * rolagem. Sombra é pintada com o elemento e viaja junto com ele.
 */
const FIO_DIREITA = { boxShadow: "1px 0 0 0 #e2e8f0" };
const FIO_ESQUERDA = { boxShadow: "-1px 0 0 0 #e2e8f0" };

/** A frase única para ausência de dado. Uma só, para a tela nunca hesitar. */
const SEM = "sem registro";
/** Ausência de MEDIÇÃO, que é outra coisa: houve o dia, ninguém apurou a faixa. */
const SEM_APURACAO = "sem apuração";

const TODAS = "__todas__";

/** Ausência de dado no recorte inteiro — a frase que manda a linha para o fim. */
const SEM_PERIODO = "sem registro no período";

const txt = (v) => String(v ?? "").trim();
const norm = (s) => String(s || "").toLowerCase();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const ehData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
const primeiroNome = (nome) => txt(nome).split(/\s+/)[0] || txt(nome) || "esta pessoa";

/**
 * BATE PONTO? A MESMA LEITURA DA FICHA (rh/AbaPessoas.jsx), e ela não pode ser
 * invertida: ausente ou `true` BATE; só o `false` gravado tira alguém daqui.
 * Ficha antiga não tem o campo — ler `undefined` como "não bate" apagaria o
 * relatório inteiro de uma vez, sem erro nenhum na tela.
 */
const batePontoDe = (p) => p?.batePonto !== false;

/** Está no quadro? Mesma régua da casca (pages/Ponto.jsx): só o false desliga. */
const estaAtiva = (p) => p?.ativo !== false;

const cabeNoQuadro = (p, quadro) => {
  if (quadro === "ativos") return estaAtiva(p);
  if (quadro === "desligados") return !estaAtiva(p);
  return true;
};

/** A frase de quem ficou de fora do quadro escolhido, na voz do quadro. */
function foraDoQuadroEmPalavras(quadro, n) {
  if (quadro === "desligados") return `${plural(n, "pessoa do quadro", "pessoas do quadro")} fora deste recorte`;
  return `${plural(n, "pessoa desligada", "pessoas desligadas")} fora deste recorte`;
}

/**
 * O que a tela lembra entre uma visita e outra. Sem localStorage, vale o padrão.
 *
 * `rankMes` e `rankAno` guardam a seção recolhida ou aberta — quem trabalha com
 * um quadro fechado não quer reabri-lo a cada visita —, e por isso o teste é
 * `!== false`: chave que ainda não existe (primeira visita, preferência antiga
 * gravada antes do ranking) tem de abrir a lista, não escondê-la.
 *
 * `medidaMes` é o número forte da lista do Mês. Guardado pela mesma razão do
 * quadro: quem abre a tela para olhar atraso não quer reescolher todo dia.
 *
 * `explicacao` é o texto do cabeçalho (escala, tolerância da CLT, carimbo do
 * relógio). Ao contrário dos rankings, ele nasce RECOLHIDO — `=== true` e não
 * `!== false` —: são quatro linhas de explicação que empurravam os cartões para
 * fora da primeira dobra, e quem já conhece a régua não a lê todo dia. Recolher
 * NÃO É APAGAR: o texto inteiro está a um clique, e o papel o leva sempre.
 */
function lerPrefs() {
  try {
    const salvo = JSON.parse(localStorage.getItem(K_PREFS) || "null");
    return {
      quadro: QUADROS.some((q) => q.valor === salvo?.quadro) ? salvo.quadro : "ativos",
      mesesTodos: salvo?.mesesTodos === true,
      // MEDIDAS é declarado mais abaixo neste arquivo: a leitura acontece no
      // primeiro render, muito depois do módulo terminar de carregar.
      medidaMes: MEDIDAS.some((m) => m.chave === salvo?.medidaMes) ? salvo.medidaMes : "horas",
      rankMes: salvo?.rankMes !== false,
      rankAno: salvo?.rankAno !== false,
      explicacao: salvo?.explicacao === true,
    };
  } catch {
    // Sem localStorage (ou JSON estragado) vale o padrão: só o quadro de hoje.
    return { quadro: "ativos", mesesTodos: false, medidaMes: "horas", rankMes: true, rankAno: true, explicacao: false };
  }
}

function gravarPrefs(prefs) {
  try {
    localStorage.setItem(K_PREFS, JSON.stringify(prefs));
  } catch {
    /* sem localStorage a escolha só não persiste */
  }
}

/**
 * Número que pode não existir — a mesma régua da lib: "" e null NÃO são 0.
 * Number("") devolve 0, e é assim que "não veio" vira "foi zero" na planilha.
 */
const numOuNulo = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const horasOuNada = (min) => duracaoTexto(min) || SEM;
const horasOuSemApuracao = (min) => duracaoTexto(min) || SEM_APURACAO;

function rotuloCompetencia(c) {
  const [ano, mes] = String(c || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(c || "");
}

/**
 * SOMA QUE NÃO INVENTA ZERO.
 *
 * `null` não entra na conta (não é 0: é "não medi"), e quando NINGUÉM tem
 * número o total sai null — não sai 0. A diferença aparece no rodapé de toda
 * tabela daqui: "sem registro" é a linha que ainda não foi apurada; "0h00" é a
 * que foi apurada e deu zero.
 */
function somaOuNulo(valores) {
  let total = 0;
  let algum = false;
  for (const v of valores) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    total += v;
    algum = true;
  }
  return algum ? total : null;
}

/** Instante do servidor ("...T14:32:10Z") → "28/08/2026 às 11:32" no fuso de quem lê. */
function instanteLocal(iso) {
  const t = new Date(String(iso ?? ""));
  if (Number.isNaN(t.getTime())) return null;
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${dataLonga(ymdLocal(t))} às ${hh}:${mm}`;
}

/** O mesmo instante em VERSÃO CURTA — "hoje 21:45", "28/08 21:45". É a marca do
    rodapé recolhido; a versão por extenso continua no papel (RecorteImpresso) e
    na faixa "Puxar do relógio", que é onde a ação de importar mora. */
function instanteCurto(iso, hojeISO) {
  const t = new Date(String(iso ?? ""));
  if (Number.isNaN(t.getTime())) return null;
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const dia = ymdLocal(t);
  return `${dia === hojeISO ? "hoje" : dataCurta(dia)} ${hh}:${mm}`;
}

/**
 * QUANDO O RELÓGIO FOI IMPORTADO PELA ÚLTIMA VEZ.
 *
 * O carimbo é da ponte (ml-ponto grava `atualizadoPor: "jibble"` e
 * `atualizadoEm` em todo dia que traz). Só esses contam: dia corrigido à mão
 * tem outro autor, e usá-lo faria a folha dizer que o relógio rodou quando
 * quem rodou foi uma pessoa.
 *
 * Nenhum carimbo devolve null, e a tela escreve "não sei dizer" — dizer
 * "nunca importado" seria afirmar sobre o Jibble a partir da ausência de um
 * campo que pode simplesmente ser velho.
 *
 * DEVOLVE O INSTANTE CRU, não a frase: a mesma leitura é escrita em dois
 * tamanhos (curto na tela, por extenso no papel), e formatar aqui obrigaria a
 * varrer a coleção duas vezes ou a recortar texto já pronto.
 */
function ultimaImportacaoISO(pontoDia) {
  let maior = "";
  for (const d of pontoDia || []) {
    if (txt(d.atualizadoPor) !== "jibble") continue;
    const q = txt(d.atualizadoEm);
    if (q > maior) maior = q;
  }
  return maior || null;
}

// ---- datas -----------------------------------------------------------------

/** "AAAA-MM-DD" + n dias, em data LOCAL (nada de UTC, que volta um dia no Brasil). */
function somarDias(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return iso;
  return ymdLocal(new Date(+m[1], +m[2] - 1, +m[3] + n));
}

/** Dias CORRIDOS de um intervalo fechado dos dois lados. 1º a 1º = 1 dia. */
function diasCorridos(de, ate) {
  if (!ehData(de) || !ehData(ate)) return null;
  const n = diasEntre(de, ate) + 1;
  return n > 0 ? n : null;
}

/**
 * As datas de um intervalo, uma a uma.
 *
 * TETO DE SEGURANÇA: dez anos. Ano digitado errado ("20026-01-01") pediria
 * dezoito mil anos de laço e travaria a aba sem dizer por quê — com o teto, a
 * tela devolve o que cabe e o aviso de período inválido aparece antes.
 */
function datasDoIntervalo(de, ate) {
  if (!ehData(de) || !ehData(ate) || de > ate) return [];
  const out = [];
  let atual = de;
  while (atual <= ate && out.length < 3660) {
    out.push(atual);
    atual = somarDias(atual, 1);
  }
  return out;
}

/**
 * Quantos dias do intervalo a ESCALA prevê trabalho — o denominador honesto da
 * média diária.
 *
 * Estourou o teto do laço (ano digitado errado): devolve null, e a média sai
 * como "sem registro". Devolver a contagem truncada daria um denominador
 * errado, e denominador errado é média errada com cara de número certo.
 */
function diasDeEscala(de, ate, jornada) {
  const datas = datasDoIntervalo(de, ate);
  if (datas.length >= 3660) return null;
  return datas.filter((iso) => (minutosPrevistosDoDia(iso, jornada) ?? 0) > 0).length;
}

/** "2026-08" → "2026-07". Texto puro: mês não se calcula com Date. */
function competenciaAnterior(c) {
  const [ano, mes] = String(c || "").split("-").map(Number);
  if (!ano || !mes) return c;
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

const primeiroDiaDoMes = (c) => `${c}-01`;
const ultimoDiaDoMes = (c) => diasDoMes(c).slice(-1)[0] || `${c}-28`;

// ============================================================================
// O ÍNDICE — os dias de rh_ponto_dia, resolvidos por pessoa, UMA vez
// ============================================================================

/**
 * ID MANDA, NOME SÓ EXIBE: o dia casa com a ficha por `pessoaId` ou por
 * `jibbleId`. Nome nunca — nome igual entre duas pessoas cria sósia, e nome que
 * mudou some com o dia inteiro.
 *
 * DIA REPETIDO NÃO SOMA DUAS VEZES. O mesmo dia aparece duplicado quando
 * alguém lançou à mão antes de a pessoa ser vinculada e a importação trouxe o
 * mesmo dia depois (ids diferentes, pdm_… e pd_…). Vale o corrigido — o que
 * alguém conferiu — e o repetido sai CONTADO, para a tela dizer que existe.
 *
 * BATIDA ÓRFÃ NÃO SOME: entra na contagem de pendências com o nome que o
 * relógio mandou. Sumir esconderia trabalho de gente real, e órfão quase sempre
 * é id variante — se reconecta, não se descarta.
 */
function montarIndice(pessoas, pontoDia) {
  const porId = new Map((pessoas || []).map((p) => [p.id, p]));
  const porJibble = new Map();
  for (const p of pessoas || []) {
    const j = txt(p.jibbleId);
    if (j) porJibble.set(j, p);
  }

  const porPessoa = new Map(); // pessoaId → { pessoa, dias: Map(data → dia) }
  const orfaos = new Map(); // jibbleId → { jibbleId, nomeNoRelogio, dias }
  let repetidos = 0;
  let semData = 0;

  for (const d of pontoDia || []) {
    const pessoa =
      (d.pessoaId && porId.get(d.pessoaId)) || (txt(d.jibbleId) && porJibble.get(txt(d.jibbleId))) || null;

    if (!pessoa) {
      const chave = txt(d.jibbleId) || "(sem id no relógio)";
      const g = orfaos.get(chave) || { jibbleId: chave, nomeNoRelogio: "", dias: 0 };
      g.dias += 1;
      if (!g.nomeNoRelogio && d.pessoaNome) g.nomeNoRelogio = d.pessoaNome;
      orfaos.set(chave, g);
      continue;
    }

    // Data ilegível não entra em recorte de período nenhum (não há onde
    // colocá-la), mas sai contada: registro que some calado é problema
    // escondido, e o Fechamento continua enxergando esse dia.
    if (!ehData(d.data)) {
      semData += 1;
      continue;
    }

    let grupo = porPessoa.get(pessoa.id);
    if (!grupo) {
      grupo = { pessoa, dias: new Map() };
      porPessoa.set(pessoa.id, grupo);
    }
    const atual = grupo.dias.get(d.data);
    if (!atual) {
      grupo.dias.set(d.data, d);
      continue;
    }
    repetidos += 1;
    if (d.corrigido === true && atual.corrigido !== true) grupo.dias.set(d.data, d);
  }

  return { porPessoa, orfaos: [...orfaos.values()], repetidos, semData };
}

/** Os dias de uma pessoa dentro de um intervalo fechado, em ordem de data. */
function diasNoPeriodo(grupo, de, ate) {
  if (!grupo) return [];
  const out = [];
  for (const [data, d] of grupo.dias) {
    if (data >= de && data <= ate) out.push(d);
  }
  return out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

/**
 * Quem PODE entrar no relatório de um período: o QUADRO DE HOJE mais quem teve
 * dia no período. Desligada no dia 15 trabalhou até o dia 15 — o mês dela sai
 * inteiro, e o mês seguinte fecha sem ela.
 *
 * A DESLIGADA ENTRA PELO DIA, NÃO PELA FICHA: quem saiu e não tem dia no
 * recorte não aparece nem no recorte "Desligados". Treze linhas de travessão
 * não informam nada — é a mesma sujeira que o dono mandou tirar da tela.
 * A ATIVA ENTRA SEMPRE, mesmo sem um dia sequer: ali a ausência É a notícia
 * (relógio não trouxe, ninguém lançou), e ela vai para o FIM da lista dizendo
 * "sem registro no período".
 */
function candidatasDoPeriodo(ativos, indice, de, ate) {
  const mapa = new Map((ativos || []).map((p) => [p.id, p]));
  for (const [id, grupo] of indice.porPessoa) {
    if (mapa.has(id)) continue;
    if (diasNoPeriodo(grupo, de, ate).length === 0) continue;
    mapa.set(id, grupo.pessoa);
  }
  return [...mapa.values()];
}

/**
 * O RECORTE, APLICADO UMA VEZ SÓ — e contando o que tirou.
 *
 * Duas peneiras, nesta ordem: o quadro (ativos/todos/desligados) e o relógio
 * (quem não bate ponto não aparece em tela de ponto). A ordem importa para a
 * CONTA: a desligada que também não bate ponto é contada uma vez, no motivo que
 * a tirou primeiro — somar os dois números daria mais gente fora do que existe.
 *
 * Devolve os dois números junto com a lista porque eles saem juntos na tela:
 * lista sem a linha do que ficou de fora transforma "não está aqui" em "não
 * existe", que é exatamente o que um relatório de ponto não pode fazer.
 */
function recortarPessoas(candidatas, quadro) {
  const lista = [];
  let foraDoQuadro = 0;
  let semPonto = 0;
  for (const p of candidatas) {
    if (!cabeNoQuadro(p, quadro)) {
      foraDoQuadro += 1;
      continue;
    }
    if (!batePontoDe(p)) {
      semPonto += 1;
      continue;
    }
    lista.push(p);
  }
  lista.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
  return { lista, foraDoQuadro, semPonto };
}

/** As duas peneiras num passo só, para as quatro visões não divergirem. */
function pessoasDoPeriodo(ativos, indice, de, ate, quadro) {
  return recortarPessoas(candidatasDoPeriodo(ativos, indice, de, ate), quadro);
}

// ============================================================================
// A AGREGAÇÃO — a régua única das visões Mês, Ano e Comparar
// ============================================================================

/**
 * O que um punhado de dias diz sobre uma pessoa.
 *
 * A parte do trabalho (horas da folha, extras, faltas, ausências) é
 * `apurarCompetencia`, a MESMA que o Fechamento usa — o relatório não pode ter
 * uma segunda opinião sobre o mês que o RH fechou.
 *
 * A parte da PONTUALIDADE é somada aqui, dia a dia, com `atrasoDoDia`:
 *  - `diasMedidos` são os dias em que dava para medir (a escala prevê trabalho
 *    E existe entrada batida). Fim de semana e dia sem batida não entram — e é
 *    por isso que a porcentagem não engana.
 *  - `atrasoChegadaMin` é a soma do que a TOLERÂNCIA DEIXA COBRAR, não do
 *    atraso cru. Os dois números existem na lib; este é o defensável.
 *  - tudo vira null quando `diasMedidos` é 0. Zero dia medido não é "chegou
 *    sempre na hora" nem "nunca chegou": é não ter havido o que medir.
 */
function agregar(dias, jornada) {
  const ap = apurarCompetencia(dias, jornada);

  let medidos = 0;
  let pontuais = 0;
  let atrasoMin = 0;
  for (const d of dias) {
    const p = atrasoDoDia(d, jornada);
    if (!p) continue;
    medidos += 1;
    if (p.pontual) pontuais += 1;
    atrasoMin += p.atrasoMin;
  }

  /* PERÍODO SEM NENHUM DIA NÃO TEM CONTAGEM ZERO — tem ausência de contagem.
     `apurarCompetencia` devolve 0 nas ausências, e ali o 0 é medida de verdade:
     o mês foi percorrido e ninguém lançou nada. Aqui não há mês percorrido —
     não existe uma linha sequer daquela pessoa naquele período (ela ainda não
     tinha entrado na casa, ou o relógio não trouxe nada). Deixar o 0 passar
     escreveria "0 faltas em janeiro" na coluna de quem foi admitido em agosto,
     e é justamente a leitura que a tabela de doze colunas convida a fazer. */
  const semNenhumDia = dias.length === 0;
  const contado = (n) => (semNenhumDia ? null : n);

  return {
    ...ap,
    diasComBatida: contado(ap.diasComBatida),
    diasEmAberto: contado(ap.diasEmAberto),
    ausenciasTotal: contado(ap.ausenciasTotal),
    faltasQueDescontam: contado(ap.faltasQueDescontam),
    ausenciasSemDesconto: contado(ap.ausenciasSemDesconto),
    ausenciasDesconhecidas: contado(ap.ausenciasDesconhecidas),
    diasComRegistro: dias.length,
    diasMedidos: medidos,
    diasPontuais: medidos > 0 ? pontuais : null,
    pontualidadePct: medidos > 0 ? (pontuais / medidos) * 100 : null,
    atrasoChegadaMin: medidos > 0 ? atrasoMin : null,
    atrasoMedioMin: medidos > 0 ? Math.round(atrasoMin / medidos) : null,
  };
}

// ---- as medidas (o número que o Ano e o Comparar escolhem) -----------------

/**
 * `sentido` é o que a seta de melhorou/piorou pode afirmar:
 *   "maisEhMelhor"   pontualidade — subir é melhorar
 *   "menosEhMelhor"  atraso e falta — subir é piorar
 *   "neutro"         horas e extras — subiram, e dizer se isso é bom depende do
 *                    mês; a tela escreve "subiu"/"desceu" e não julga. Hora
 *                    extra a mais pode ser entrega salva ou custo fora do
 *                    controle, e não é o relatório que decide qual.
 */
const MEDIDAS = [
  {
    chave: "horas",
    /* O RÓTULO DIZ O QUE O NÚMERO TEM DENTRO. "Horas da folha", sozinho, foi
       lido durante meses como "a hora comum" — e ele traz a extra dentro (ver
       a decisão 12). O parêntese é feio e é de propósito: quem escolhe no
       seletor decide ANTES de somar, não depois. */
    rotulo: "Horas da folha (com extras)",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.folhaMin,
    ajuda:
      "O que o relógio apurou para a folha (payrollHours), somado — E ELE JÁ INCLUI AS HORAS EXTRAS. Dia em aberto não entra. Para comparar com o previsto da escala, use Horas normais.",
  },
  {
    chave: "normais",
    rotulo: "Horas normais (sem extras)",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.normaisMin,
    ajuda:
      "A folha MENOS as extras: a hora comum, a única que se compara com o previsto da escala. Somar esta com as extras dá a folha — somar a FOLHA com as extras paga a mesma hora duas vezes.",
  },
  {
    chave: "extra",
    rotulo: "Extra +50%",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.extrasMin,
    ajuda: "Hora extra de dia normal, apurada pelo relógio (ou derivada, no dia lançado à mão).",
  },
  {
    chave: "extraDobro",
    rotulo: "Extra +100%",
    unidade: "horas",
    sentido: "neutro",
    valor: (a) => a.extrasDobroMin,
    ajuda: "Extra de descanso, feriado ou dobra. Sem dia apurado pelo relógio, fica sem apuração.",
  },
  {
    chave: "atrasos",
    rotulo: "Atrasos na chegada",
    unidade: "horas",
    sentido: "menosEhMelhor",
    valor: (a) => a.atrasoChegadaMin,
    ajuda: `Entrada batida contra o começo previsto pela escala, com a tolerância da CLT já aplicada (${TOLERANCIA_MARCACAO_MIN} min por marcação, ${TOLERANCIA_DIA_MIN} no dia). NÃO é o atraso que desconta na folha.`,
  },
  {
    chave: "faltas",
    rotulo: "Faltas que descontam",
    unidade: "dias",
    // A PALAVRA QUE ACOMPANHA O NÚMERO NA LISTA, onde não há rótulo de coluna
    // para dizer o que ele é. "3 dias" ao lado de um apoio que também diz
    // "18 dias" seriam duas coisas diferentes com o mesmo nome na mesma linha.
    curto: ["falta", "faltas"],
    sentido: "menosEhMelhor",
    valor: (a) => a.faltasQueDescontam,
    ajuda: "Dias de falta injustificada LANÇADOS. Dia sem batida e sem lançamento é sem registro, não é falta.",
  },
  {
    chave: "pontualidade",
    rotulo: "Pontualidade",
    unidade: "pct",
    sentido: "maisEhMelhor",
    somavel: false,
    valor: (a) => a.pontualidadePct,
    ajuda: "Porcentagem dos dias medidos em que não havia nada a cobrar na chegada.",
  },
];

const medidaDe = (chave) => MEDIDAS.find((m) => m.chave === chave) || MEDIDAS[0];

/** O número da medida em palavras. null vira "sem registro" — nunca 0. */
function textoDaMedida(v, unidade) {
  if (v === null || v === undefined) return SEM;
  if (unidade === "horas") return duracaoTexto(v);
  if (unidade === "pct") return `${Math.round(v)}%`;
  return String(v);
}

/** O número da medida para a PLANILHA: número de verdade, nunca texto. */
function numeroDaMedida(v, unidade) {
  if (v === null || v === undefined) return null;
  if (unidade === "horas") return horasDecimais(v);
  if (unidade === "pct") return Math.round(v * 10) / 10;
  return v;
}

/**
 * A MÉDIA POR DIA, escrita na régua de cada unidade.
 *
 * Dia de falta não se arredonda para inteiro: 3 faltas em 21 dias de escala
 * viraria "0" e a coluna diria que ninguém faltou. Fração de dia se escreve
 * com casas; hora se escreve como hora.
 */
function textoPorDia(v, dias, unidade) {
  if (v === null || v === undefined || !dias) return null;
  const porDia = v / dias;
  if (unidade === "horas") return duracaoTexto(Math.round(porDia));
  return (Math.round(porDia * 100) / 100).toLocaleString("pt-BR");
}

/**
 * O total de um grupo, na régua certa de cada medida.
 *
 * PONTUALIDADE NÃO SE SOMA E NÃO É MÉDIA DE MÉDIAS: é a razão dos dias
 * juntados (pontuais ÷ medidos). Quem trabalhou 2 dias e quem trabalhou 22 não
 * pesam igual na pontualidade da casa — e a média de porcentagens faria
 * exatamente isso.
 */
function totalDaMedida(medida, agregados) {
  if (medida.chave === "pontualidade") {
    const medidos = agregados.reduce((s, a) => s + a.diasMedidos, 0);
    const pontuais = agregados.reduce((s, a) => s + (a.diasPontuais ?? 0), 0);
    return medidos > 0 ? (pontuais / medidos) * 100 : null;
  }
  return somaOuNulo(agregados.map((a) => medida.valor(a)));
}

// ---- o ranking (a lista do print, no vocabulário do ponto) ------------------

/**
 * O NÚMERO CRU DA LINHA — é ele que dá a proporção da barra.
 *
 * A barra e o valor forte saem SEMPRE do mesmo número (é isto que `n` garante):
 * barra medindo horas com "94%" escrito ao lado é a mentira mais fácil de um
 * ranking, e a mais difícil de perceber depois de pronta.
 */
const numeroDaLinha = (medida, ag) => {
  const v = medida.valor(ag);
  return Number.isFinite(v) ? v : null;
};

/**
 * O TETO DA BARRA.
 *
 * PONTUALIDADE VAI DE 0 A 100, E NÃO PELO MAIOR DO RECORTE. Com teto relativo,
 * numa semana em que o melhor tirasse 90%, quem tirou 45% desenharia METADE da
 * barra dele — e a leitura ("esse aí é a metade daquele") é falsa: são 45
 * pontos percentuais de diferença numa escala que já tem fim conhecido. Nas
 * outras medidas não existe teto acordado (não há "100% de horas"), e ali o
 * maior do recorte é a única régua honesta — por isso ela é RELATIVA e a
 * explicação em cima da lista diz isso com todas as letras.
 */
function tetoDoRanking(medida, numeros) {
  if (medida.unidade === "pct") return 100;
  let maior = 0;
  for (const n of numeros) if (Number.isFinite(n) && n > maior) maior = n;
  return maior;
}

/**
 * UM SINAL DE ESTADO POR LINHA — e só onde ele afirma alguma coisa.
 *
 * Pontualidade tem faixa conhecida, e é a MESMA do cartão do alto desta tela
 * (90 e 70): duas réguas para o mesmo número na mesma tela é como o verde de
 * cima discorda do amarelo de baixo. Horas, extras, atrasos e faltas não têm
 * limite acordado nesta casa — pintar de vermelho quem tem 3 faltas seria a
 * tela inventando uma régua que ninguém escreveu. Nelas o sinal é a ORDEM da
 * lista, que já põe em cima quem se quer olhar.
 */
function tomDoRanking(medida, v) {
  if (v === null || v === undefined) return "neutral";
  if (medida.unidade !== "pct") return "brand";
  if (v >= 90) return "ok";
  if (v >= 70) return "warn";
  return "bad";
}

/**
 * O VALOR FORTE EM PALAVRAS.
 *
 * Ausência devolve `null` de propósito: quem escreve o travessão é a
 * LinhaRanking, em um lugar só. Aqui "sem registro" por extenso ocuparia duas
 * linhas na coluna de 112px e faria a linha crescer.
 *
 * A UNIDADE VEM COLADA porque A LISTA NÃO TEM CABEÇALHO DE COLUNA. Na tabela, o
 * "3" se lia sob o rótulo "Faltas que descontam"; aqui ele fica sozinho à
 * direita de um nome, e sozinho ele não diz se são faltas, dias ou horas. Hora
 * ("151h04") e porcentagem ("94%") já trazem a sua; contagem, não.
 */
const forteOuNada = (medida, v) => {
  if (v === null || v === undefined) return null;
  if (medida.unidade === "dias") return plural(v, medida.curto?.[0] || "dia", medida.curto?.[1] || "dias");
  return textoDaMedida(v, medida.unidade);
};

/**
 * OS DOIS APOIOS DE TODA LINHA: dias com batida e dias com atraso na chegada.
 *
 * "3 atrasos" CONTA DIAS (medidos − pontuais), não minutos — e é por isso que
 * ele nunca é o valor forte: quando a medida escolhida é "Atrasos na chegada",
 * o número da direita é TEMPO ("1h12") e este apoio continua sendo QUANTOS DIAS.
 * As duas réguas convivem porque estão em colunas de peso diferente, e a faixa
 * de explicação acima da lista diz qual é qual.
 *
 * Sem dia medido não há apoio nenhum: `null` vira travessão, nunca "0 atrasos"
 * — quem esteve de férias o mês inteiro não é quem nunca se atrasou.
 */
function apoiosDoPonto(ag) {
  const dias = ag.diasComBatida;
  const atrasados = ag.diasPontuais === null || ag.diasPontuais === undefined ? null : ag.diasMedidos - ag.diasPontuais;
  return [
    dias === null || dias === undefined ? null : plural(dias, "dia", "dias"),
    atrasados === null ? null : plural(atrasados, "atraso", "atrasos"),
  ];
}

/**
 * OS APOIOS DE UM GRUPO DE MESES (a linha do ano, e a linha de total das duas
 * visões). Soma que não inventa zero: se ninguém tem dia medido, `diasPontuais`
 * sai null e o apoio some — não vira "0 atrasos".
 */
function apoiosSomados(agregados) {
  const algumMedido = agregados.some((a) => a.diasPontuais !== null && a.diasPontuais !== undefined);
  return {
    diasComBatida: somaOuNulo(agregados.map((a) => a.diasComBatida)),
    diasMedidos: agregados.reduce((s, a) => s + a.diasMedidos, 0),
    diasPontuais: algumMedido ? agregados.reduce((s, a) => s + (a.diasPontuais ?? 0), 0) : null,
  };
}

/**
 * DO MAIOR PARA O MENOR, e "não medi" SEMPRE no fim — nas duas pontas.
 * Ausência não encabeça ranking nem de melhores nem de piores; empate desempata
 * pelo nome, para a lista não dançar a cada render.
 */
function ordenarRanking(itens) {
  return [...itens].sort((a, b) => {
    if (a.n === null) return b.n === null ? norm(a.nome).localeCompare(norm(b.nome)) : 1;
    if (b.n === null) return -1;
    return b.n - a.n || norm(a.nome).localeCompare(norm(b.nome));
  });
}

/**
 * "TOTAL" NÃO SE ESCREVE EM CIMA DE UMA PORCENTAGEM. Pontualidade não é soma —
 * é a razão dos dias juntados —, e chamá-la de total convidaria a somar 94% com
 * 88% e achar 182.
 */
const rotuloDoTotal = (medida, n) =>
  medida.chave === "pontualidade"
    ? `Da casa (${plural(n, "pessoa", "pessoas")})`
    : `Total (${plural(n, "pessoa", "pessoas")})`;

/** O tamanho do recorte em palavras, para o `sub` da seção. */
function tamanhoDoRecorte(n, quadro, onde, pessoa) {
  if (pessoa) return `${pessoa.nome} — ${onde}, só esta pessoa`;
  const palavra = quadro === "ativos" ? "ativas" : quadro === "desligados" ? "desligadas" : "do quadro e desligadas";
  return `${plural(n, "pessoa", "pessoas")} ${palavra} ${onde}`;
}

// ---- a comparação ----------------------------------------------------------

/**
 * A diferença entre dois períodos, e o que se pode HONESTAMENTE dizer dela.
 *
 * Sem número em um dos lados não há diferença nenhuma a afirmar (null não é
 * zero: "não medi" menos 5 não é −5).
 *
 * BASE ZERO NÃO TEM PORCENTAGEM. Dividir por zero dá Infinity, e Infinity
 * impresso como "+∞%" ou disfarçado de "+100%" é o número que faz alguém
 * chamar a pessoa na sala. Quem foi de 0 para 3 faltas passou A TER faltas — e
 * é isso que a tela escreve.
 */
function compararValores(anterior, novo) {
  if (anterior === null || anterior === undefined || novo === null || novo === undefined) {
    return { diferenca: null, pct: null, motivo: "sem registro num dos períodos" };
  }
  const diferenca = novo - anterior;
  if (anterior === 0) return { diferenca, pct: null, motivo: "sem base para comparar" };
  return { diferenca, pct: (diferenca / Math.abs(anterior)) * 100, motivo: "" };
}

/** A palavra da variação. É ela que informa — a seta só acompanha. */
function sentidoDaVariacao(medida, diferenca) {
  if (diferenca === null || diferenca === undefined) return "sem comparação";
  if (diferenca === 0) return "sem mudança";
  const subiu = diferenca > 0;
  if (medida.sentido === "maisEhMelhor") return subiu ? "melhorou" : "piorou";
  if (medida.sentido === "menosEhMelhor") return subiu ? "piorou" : "melhorou";
  return subiu ? "subiu" : "desceu";
}

// ============================================================================
// PEÇAS DE TELA — declaradas FORA da página (componente aninhado remonta a cada
// render, perde o foco do campo, e o lint da casa reprova)
// ============================================================================

/** Ausência de dado, com a palavra escrita. Cinza na tela, palavra no papel. */
function Nada({ children }) {
  return <span className="text-slate-400">{children || SEM}</span>;
}

/**
 * O SELO DO DIA SEM JORNADA — decisão 13, copiada do "Dia de descanso" do
 * Jibble.
 *
 * ELE NÃO SUBSTITUI O TRAVESSÃO, ACOMPANHA. O travessão continua dizendo "não
 * há número aqui"; o selo diz POR QUÊ — e são duas coisas diferentes que o
 * cinza sozinho confundia: o sábado em branco lia igual à segunda-feira em
 * branco de quem faltou.
 *
 * E ELE APARECE TAMBÉM NO DIA SEM JORNADA QUE FOI TRABALHADO, que é onde ele
 * mais informa: ali a normal é 0 (a escala não previa hora nenhuma) e a folha
 * inteira é excedente — sem o selo, "normais —" ao lado de "folha 4h20" parece
 * erro de conta, e é o contrário: é a conta certa de um dia que não era de
 * trabalho.
 *
 * É `chip` (cinza), nunca `chip-warn`: dia de descanso não é pendência de
 * ninguém. No papel ele vira borda preta com a palavra dentro (index.css).
 */
function SemJornada() {
  return (
    <span
      className="chip"
      title="A escala da casa não prevê trabalho neste dia. O travessão aqui é “não era dia de trabalho”, não “não trabalhou”."
    >
      sem jornada
    </span>
  );
}

/**
 * O RANKING DO PONTO — a lista do print, uma linha por pessoa, do maior para o
 * menor. Ela é a mesma no Mês e no Ano, e por isso mora aqui: duas cópias do
 * mesmo desenho é como uma delas passa a mentir depois de um conserto.
 *
 * O DESENHO NÃO É REDESENHADO AQUI. Quem sabe medir a barra, cortar o nome,
 * pintar o tom e escrever o travessão é `LinhaRanking` (components/lista.jsx).
 * Esta peça só traduz o ponto para o vocabulário dela.
 *
 * A LINHA DE TOTAL RECEBE OS MESMOS APOIOS, mesmo sendo um total: sem eles
 * faltariam duas colunas de 64px e o total apareceria deslocado à esquerda de
 * todos os valores que ele soma — que é exatamente o número que ninguém
 * confere. Ela não recebe `medida`: barra no total mediria o total contra ele
 * mesmo, e um trilho 100% cheio ali não informa nada.
 */
function RankingDoPonto({ itens, medida, abertaId, aoAbrir, total }) {
  const teto = tetoDoRanking(medida, itens.map((i) => i.n));
  return (
    <div>
      {itens.map((i) => (
        <LinhaRanking
          key={i.pessoa.id}
          nome={i.nome}
          valor={forteOuNada(medida, i.n)}
          apoios={i.apoios}
          medida={i.n}
          teto={teto}
          tom={tomDoRanking(medida, i.n)}
          aberta={abertaId === i.pessoa.id}
          aoAbrir={() => aoAbrir(i.pessoa)}
        />
      ))}
      {/* O único traço horizontal da lista, e ele separa o que é de outra
          natureza: acima, pessoas; abaixo, a soma do que está à mostra. */}
      <div className="mt-1 border-t border-slate-200 pt-1 font-display">
        <LinhaRanking nome={total.rotulo} valor={forteOuNada(medida, total.n)} apoios={total.apoios} />
      </div>
    </div>
  );
}

/**
 * O QUE A LISTA NÃO CONSEGUE DIZER SOZINHA — e as duas ausências têm nomes
 * diferentes, como no resto desta aba.
 *
 * SEM REGISTRO: não houve um dia sequer no período (a pessoa não tinha entrado
 * na casa, ou o relógio não trouxe nada). SEM APURAÇÃO: houve dia, e aquele
 * número não foi apurado — hora extra de dia lançado à mão, chegada sem escala
 * prevista. Escrever a mesma palavra nas duas faria alguém procurar o dia que
 * existe. Ambas as linhas já estão no FIM da lista, com travessão; aqui elas
 * ganham o motivo.
 */
function RodapeDaLista({ semRegistro, semApuracao, onde }) {
  if (!semRegistro && !semApuracao) return null;
  return (
    <p className="mt-2 text-xs text-slate-500">
      {semRegistro > 0 && (
        <span>
          {plural(semRegistro, "pessoa não tem", "pessoas não têm")} nenhum dia {onde}: a linha sai com travessão, que é{" "}
          <strong>{SEM}</strong> — não é zero.{" "}
        </span>
      )}
      {semApuracao > 0 && (
        <span>
          {plural(semApuracao, "pessoa tem dia registrado", "pessoas têm dia registrado")} e nenhum número nesta medida:
          é <strong>{SEM_APURACAO}</strong> — também não é zero.
        </span>
      )}
    </p>
  );
}

/**
 * O FECHAMENTO DO MÊS, QUE ERA UMA COLUNA DA TABELA.
 *
 * A lista tem um valor forte só, e o fechamento não é número — mas ele responde
 * a pergunta que faz alguém confiar (ou não) na soma de cima: este mês já foi
 * conferido? Some da coluna, continua na tela. Vai TAMBÉM PARA O PAPEL: folha
 * de ponto que circula sem dizer que o mês ainda está em aberto é como se paga
 * por número que ainda vai mudar.
 */
function Fechamentos({ linhas }) {
  if (linhas.length === 0) return null;
  const fechados = linhas.filter((l) => l.fechado).length;
  const emAberto = linhas.filter((l) => l.temLancamento && !l.fechado).length;
  const semLancamento = linhas.length - fechados - emAberto;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className={fechados > 0 ? "chip-ok" : "chip"}>{plural(fechados, "mês fechado", "meses fechados")}</span>
      {emAberto > 0 && <span className="chip">{plural(emAberto, "lançado e em aberto", "lançados e em aberto")}</span>}
      {semLancamento > 0 && (
        <span className="chip">{plural(semLancamento, "sem lançamento", "sem lançamento")}</span>
      )}
      <span>Conferir e fechar é na aba Ponto do RH — esta aqui só lê.</span>
    </p>
  );
}

/**
 * A variação em uma célula: seta, número e A PALAVRA.
 *
 * A palavra é obrigatória porque a folha impressa sai em cinza — uma seta
 * vermelha e uma verde viram o mesmo traço, e o sentido some justamente no
 * papel que circula pela mesa dos outros.
 */
function Variacao({ medida, valorA, valorB }) {
  const { diferenca, pct, motivo } = compararValores(valorA, valorB);
  const palavra = sentidoDaVariacao(medida, diferenca);
  const tom =
    palavra === "melhorou" ? "text-ok-700" : palavra === "piorou" ? "text-bad-700" : "text-slate-600";
  const Icone = diferenca === null || diferenca === 0 ? Minus : diferenca > 0 ? ArrowUpRight : ArrowDownRight;

  if (diferenca === null) {
    return (
      <div className="leading-tight">
        <Nada>{motivo}</Nada>
      </div>
    );
  }

  const sinal = diferenca > 0 ? "+" : diferenca < 0 ? "−" : "";
  const bruto =
    medida.unidade === "horas"
      ? duracaoTexto(Math.abs(diferenca))
      : medida.unidade === "pct"
        ? `${Math.round(Math.abs(diferenca))} p.p.`
        : String(Math.abs(diferenca));

  return (
    <div className={clsx("leading-tight", tom)}>
      <span className="inline-flex items-center gap-1 font-display font-semibold tnum">
        <Icone size={14} strokeWidth={2.6} className="sem-impressao" />
        {sinal}
        {bruto}
      </span>
      <span className="ml-1.5 text-xs">{palavra}</span>
      <div className="text-xs tnum">
        {pct === null ? (
          <Nada>{motivo}</Nada>
        ) : (
          `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(Math.round(pct))}%`
        )}
      </div>
    </div>
  );
}

/**
 * O RECORTE, impresso. Só existe no papel (`apenas-impressao`).
 *
 * Quatro coisas, e nenhuma é decoração: de qual período é a folha, de qual
 * filtro ela saiu, quando foi emitida e QUANDO O RELÓGIO FOI IMPORTADO PELA
 * ÚLTIMA VEZ. Sem a última, alguém desconta um mês achando que ontem já entrou.
 */
function RecorteImpresso({ titulo, recorte, jornadaEmPalavras, emitidoEm, importadoEm }) {
  return (
    <div className="apenas-impressao mb-3">
      <p className="font-display text-sm font-bold">{titulo}</p>
      <p className="text-xs">Recorte: {recorte}</p>
      <p className="text-xs">Escala usada como previsto: {jornadaEmPalavras}</p>
      <p className="text-xs">
        Atrasos com a tolerância da CLT já aplicada ({TOLERANCIA_MARCACAO_MIN} min por marcação,{" "}
        {TOLERANCIA_DIA_MIN} no dia) — não é o atraso que desconta na folha.
      </p>
      {/* A CASCATA VAI PARA O PAPEL, e não recolhe (decisão 12). Na folha
          impressa não há title para passar o mouse nem cartão ao lado: se a
          régua não estiver escrita ali, quem lê soma folha + extras e paga a
          mesma hora duas vezes. */}
      <p className="text-xs">
        Horas da folha = normais + extra 50% + extra 100% — a folha JÁ INCLUI as extras, não as some de novo. Quem se
        compara com o previsto da escala é a coluna de horas NORMAIS.
      </p>
      <p className="text-xs">
        Emitido em {dataLonga(emitidoEm)} · Última importação do relógio:{" "}
        {importadoEm || "não sei dizer (nenhum dia com carimbo de importação)"}
      </p>
    </div>
  );
}

/** A linha de pendências: o que a tabela NÃO está contando, dito em voz alta. */
function Pendencias({ indice }) {
  const { orfaos, repetidos, semData } = indice;
  if (orfaos.length === 0 && repetidos === 0 && semData === 0) return null;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <CircleAlert size={13} className="text-warn-600" />
      {orfaos.length > 0 && (
        <span className="chip-warn">
          {plural(orfaos.length, "crachá do relógio sem ficha", "crachás do relógio sem ficha")} — os dias
          deles ficam fora deste relatório
        </span>
      )}
      {repetidos > 0 && (
        <span className="chip-warn">
          {plural(repetidos, "dia repetido", "dias repetidos")} — vale o corrigido, e nada foi somado duas vezes
        </span>
      )}
      {semData > 0 && (
        <span className="chip-warn">{plural(semData, "dia com data ilegível", "dias com data ilegível")}</span>
      )}
      {orfaos.length > 0 && <span>Vincule na aba “Pessoas do relógio” para eles entrarem.</span>}
    </p>
  );
}

// ============================================================================
// O NOME É PORTA — as peças do detalhe da pessoa
// ----------------------------------------------------------------------------
// Diagnóstico do dia 28/08/2026: nas três telas do Ponto o nome da pessoa
// aparecia 72 vezes e NENHUMA era clicável. Lia-se "ANA CLAUDIA · 08:03" e não
// havia para onde ir — nem para o dia dela, nem para o mês, nem para a ficha.
// Cada linha era um beco sem saída. Daqui para baixo mora o que desfaz isso.
// ============================================================================

/**
 * "HH:MM" → minutos desde a meia-noite. Vazio e lixo viram null, NUNCA 0:
 * 0 aqui é meia-noite, e uma batida que não existe desenhada às 00:00 põe a
 * pessoa no começo da barra como se ela tivesse dormido na fábrica.
 */
function minutosDoRelogioLocal(hhmm) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(txt(hhmm));
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 60 + Number(m[2]);
}

/** Diferença em palavra curta e com sinal: "+3 min", "−1h05", "0 min". */
function minutosComSinal(min) {
  const n = Math.round(numOuNulo(min) ?? 0);
  const abs = Math.abs(n);
  const corpo = abs < 60 ? `${abs} min` : duracaoTexto(abs);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${corpo}`;
}

/**
 * A SITUAÇÃO DO DIA EM UMA PALAVRA, na ordem em que ela manda: dia em aberto é
 * pendência mesmo com ausência lançada; ausência explica o dia sem batida; sem
 * nenhum dos dois, ou a escala não prevê trabalho, ou ninguém registrou nada —
 * e essas duas não são a mesma coisa.
 *
 * Mora FORA da tabela porque a mesma frase sai em dois lugares (a linha do Dia
 * e o painel da pessoa). Duas cópias desta escada divergem no primeiro conserto
 * feito só de um lado, e aí a mesma pessoa fica "presente" numa tela e "sem
 * registro" na outra.
 */
function situacaoDoDia({ dia, ausencia, emAberto, previstoMin }) {
  if (emAberto) return { situacao: "em aberto (entrou e não saiu)", chip: "chip-warn" };
  if (ausencia) return { situacao: ausencia.rotulo, chip: ausencia.chip };
  /* TRABALHOU NUM DIA QUE A ESCALA NÃO PREVÊ (decisão 13). "Presente" seco
     escondia justamente o dia que precisa de olho: ali a hora normal é 0 e a
     folha inteira é excedente — e descanso e feriado se pagam em DOBRO, faixa
     que a conta derivada não sabe separar (a lib conta o caso em
     `diasForaDaEscala`). Por isso `chip-warn`: não é erro, é conferência. */
  if (dia) {
    return previstoMin === 0
      ? { situacao: "trabalhou em dia sem jornada", chip: "chip-warn" }
      : { situacao: "presente", chip: "chip-ok" };
  }
  if (previstoMin === 0) return { situacao: "a escala não prevê trabalho", chip: "chip" };
  return { situacao: SEM, chip: "chip-warn" };
}

/**
 * O NOME DA PESSOA COMO BOTÃO — a porta para o painel de detalhe.
 *
 * SEM `.btn-*` DE PROPÓSITO: as classes de botão somem na impressão (ver
 * index.css, "Controle não é dado"), e um relatório de ponto impresso sem os
 * nomes é papel inútil. No papel ele volta a ser texto preto sem sublinhado
 * (`print:`), porque link impresso não leva a lugar nenhum.
 *
 * CARA DE LINK SEMPRE, NÃO SÓ NO HOVER (conserto de 28/08/2026). Antes o nome
 * era texto cinza-escuro e só se revelava clicável sob o cursor: quem lia a
 * lista via 20 nomes mortos e um sublinhado que aparecia por acidente. Descobrir
 * a porta dependia de passar o mouse por cima dela. Agora o nome nasce na cor da
 * marca com sublinhado PONTILHADO — discreto o bastante para não virar uma
 * escada de links berrando na tabela, explícito o bastante para se ler como
 * clicável — e o pontilhado vira cheio no hover e no foco do teclado.
 *
 * O TÍTULO É CURTO ("ver o ponto de Ana") porque o balão do navegador aparece
 * embaixo do cursor: o texto longo de antes tapava a linha seguinte da tabela,
 * justamente a de Total.
 */
function NomeDaPessoa({ pessoa, aoAbrir, children }) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(pessoa)}
      className="group block max-w-full text-left"
      title={`ver o ponto de ${primeiroNome(pessoa.nome)}`}
    >
      {/* O SUBLINHADO É SÓ DO NOME. Se ele morasse no <button>, escorreria para
          a frase de baixo ("sem registro no período") — e decoração de texto
          herdada não se desliga no filho. */}
      <span className="font-medium text-brand-700 underline decoration-brand-600/60 decoration-dotted underline-offset-2 group-hover:text-brand-800 group-hover:decoration-solid group-focus-visible:decoration-solid print:text-black print:no-underline">
        {pessoa.nome}
      </span>
      {children}
    </button>
  );
}

/**
 * TABELA VAZIA DIZ POR QUE ESTÁ VAZIA — e as duas razões são diferentes.
 *
 * Com uma pessoa no filtro, vazio quer dizer que ELA não tem dia no período (a
 * lista de nomes já só oferece quem cabe no recorte). Sem pessoa escolhida,
 * vazio quer dizer que o RECORTE DE QUADRO não tem ninguém ali — e aí o
 * caminho é trocar o recorte, não procurar dado que não falta.
 */
function ListaVazia({ quadro, pessoa, onde }) {
  const rotulo = QUADROS.find((q) => q.valor === quadro)?.rotulo || quadro;
  if (pessoa) {
    return (
      <>
        {pessoa.nome} não tem nenhum dia {onde}. Troque a pessoa ou o período — o recorte de quadro está em “{rotulo}”.
      </>
    );
  }
  return (
    <>
      Ninguém no recorte “{rotulo}” {onde}.
      {quadro !== "todos" && " Experimente o recorte Todos."}
    </>
  );
}

/**
 * A LINHA DO QUE FICOU DE FORA — o preço de recortar, dito em voz alta.
 *
 * Vai EMBAIXO da tabela, em letra pequena, e vai TAMBÉM PARA O PAPEL (nada de
 * `sem-impressao`): a folha que circula pela mesa dos outros é justamente onde
 * a lista curta é lida como a casa inteira.
 */
function ForaDoRelatorio({ quadro, foraDoQuadro, semPonto }) {
  if (!foraDoQuadro && !semPonto) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      {semPonto > 0 && (
        <span>
          {plural(semPonto, "pessoa não bate ponto e não entra", "pessoas não batem ponto e não entram")} neste
          relatório — a marca está na ficha do RH.
        </span>
      )}
      {foraDoQuadro > 0 && <span>{foraDoQuadroEmPalavras(quadro, foraDoQuadro)}.</span>}
    </p>
  );
}

/**
 * A ENTRADA: a hora e, EMBAIXO, o que ela quer dizer.
 *
 * Pedido do Leonardo (28/08/2026): "mostrar certinho quando entrou". "08:03"
 * sozinho não responde nada — 08:03 é chegar no horário num turno que começa
 * 08:00 e é meia hora de atraso no que começa 07:30. Por isso a comparação vem
 * colada na hora.
 *
 * E VEM COM A PALAVRA, não só com a cor: a folha impressa sai em cinza (o verde
 * e o vermelho viram o mesmo tom), e quem não distingue as duas cores lê a
 * mesma coisa nos dois casos. A cor apressa a leitura de quem enxerga; a
 * palavra é quem informa.
 *
 * "+3 min" NÃO É ATRASO por si só: até 5 min por marcação e 10 no dia a CLT não
 * deixa cobrar (art. 58 § 1º). Por isso a frase separa os três estados —
 * "antes do previsto", "dentro da tolerância" e "atraso" —, que é a mesma régua
 * da coluna Atraso ao lado.
 */
function EntradaComparada({ dia, p }) {
  const hora = txt(dia?.entrada);
  if (!hora) return <Nada>{dia ? "não bateu a entrada" : SEM}</Nada>;
  if (!p) {
    return (
      <div className="leading-tight">
        <span className="tnum font-medium text-slate-800">{hora}</span>
        <span className="block text-xs text-slate-500">sem previsto para comparar</span>
      </div>
    );
  }
  const d = p.atrasoEntradaMin;
  const palavra =
    d === 0
      ? "no horário"
      : d < 0
        ? `${minutosComSinal(d)} · antes do previsto`
        : p.pontual
          ? `${minutosComSinal(d)} · dentro da tolerância`
          : `${minutosComSinal(d)} · atraso`;
  const tom = d > 0 ? (p.pontual ? "text-warn-700" : "text-bad-700") : "text-ok-700";
  return (
    <div className="leading-tight">
      <span className="tnum font-medium text-slate-800">{hora}</span>
      <span className={clsx("block text-xs tnum", tom)} title={`A escala começa às ${p.inicioPrevisto}`}>
        {palavra}
      </span>
    </div>
  );
}

/**
 * A MINI LINHA DO TEMPO DO DIA — 90 pixels que respondem "como foi o dia".
 *
 * Em cinza, a janela que a escala previu; em cor, o pedaço que foi batido de
 * verdade. Quem entrou depois começa a barra mais à direita, quem saiu antes
 * termina mais à esquerda, quem esticou passa da faixa cinza. É o que faz a
 * tela responder de relance, sem ler número por número — e nenhum número some
 * por causa dela: as colunas ao lado continuam escrevendo tudo.
 *
 * SAI DA IMPRESSÃO (a classe fica na célula, não aqui): no papel em cinza as
 * três cores viram um traço só, e traço que não distingue nada ocupando uma
 * coluna é pior que coluna nenhuma.
 */
function LinhaDoTempoDoDia({ dia, inicioPrevisto, fimPrevisto, p, emAberto }) {
  const ini = minutosDoRelogioLocal(inicioPrevisto);
  const fim = minutosDoRelogioLocal(fimPrevisto);
  const entrada = minutosDoRelogioLocal(dia?.entrada);
  const saida = minutosDoRelogioLocal(dia?.saida);

  // Sem escala não há régua — e barra sem régua é desenho bonito que afirma
  // coisa nenhuma. Sem entrada batida não há o que desenhar.
  if (ini === null || fim === null || fim <= ini) return <Nada>fora da escala</Nada>;
  if (entrada === null) return <Nada>{dia ? "sem entrada batida" : SEM}</Nada>;

  const MARGEM = 60; // uma hora de folga de cada lado, para o que estourou caber
  const de = Math.min(ini, entrada) - MARGEM;
  const ate = Math.max(fim, saida === null ? fim : saida) + MARGEM;
  const largura = ate - de;
  const pos = (m) => Math.max(0, Math.min(100, ((m - de) / largura) * 100));

  const cor = emAberto ? "bg-warn-500" : p && !p.pontual ? "bg-bad-500" : "bg-brand-500";
  const legenda =
    `Previsto ${inicioPrevisto} às ${fimPrevisto} · batido ${dia.entrada}` +
    (saida === null ? " e sem saída" : ` às ${dia.saida}`);

  return (
    <div className="leading-none">
      <div className="relative h-2.5 w-[90px] rounded-full bg-slate-100" title={legenda}>
        <div
          className="absolute inset-y-0 rounded-full bg-slate-200"
          style={{ left: `${pos(ini)}%`, width: `${pos(fim) - pos(ini)}%` }}
        />
        {saida === null ? (
          <div className={clsx("absolute inset-y-0 w-1 rounded-full", cor)} style={{ left: `${pos(entrada)}%` }} />
        ) : (
          <div
            className={clsx("absolute inset-y-0 rounded-full", cor)}
            style={{ left: `${pos(entrada)}%`, width: `${Math.max(2, pos(saida) - pos(entrada))}%` }}
          />
        )}
      </div>
      {/* A barra é atalho para o olho; para quem lê por leitor de tela a frase
          inteira continua existindo. */}
      <span className="sr-only">{legenda}</span>
    </div>
  );
}

/**
 * AS DUAS FRASES DA CASCATA — escritas uma vez, usadas em todo lugar onde um
 * número de hora aparece (decisão 12). Duas cópias divergem no primeiro
 * conserto feito de um lado só, e aí a mesma hora tem duas explicações.
 */
const AJUDA_FOLHA =
  "A FOLHA JÁ INCLUI AS EXTRAS: folha = normais + extra 50% + extra 100%. É o payrollHours do relógio. Não some a folha com as extras ao lado — seria pagar a mesma hora duas vezes.";
const AJUDA_NORMAIS =
  "A hora comum: a folha MENOS as extras. É esta que se compara com o previsto da escala — a folha traz a extra dentro e infla o cumprimento da jornada.";

/**
 * Rótulo em cima, valor embaixo — o par que o painel repete.
 *
 * `ajuda` vai no bloco INTEIRO, não só no rótulo: quem passa o mouse está em
 * cima do número, e é sobre o número que a dúvida é ("isto aqui tem extra
 * dentro?").
 */
function Campo({ rotulo, ajuda, sub, largura, children }) {
  return (
    <div className={largura} title={ajuda}>
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <div className="text-sm text-slate-800">{children}</div>
      {sub && <p className="mt-0.5 text-xs text-slate-500 tnum">{sub}</p>}
    </div>
  );
}

/**
 * A CASCATA DE UM DIA, em quatro campos: normais, +50%, +100% e a FOLHA como
 * total. Mora aqui porque sai igual no painel da pessoa e é a mesma leitura da
 * tabela do Dia — e porque a ORDEM importa: as parcelas primeiro, o total
 * depois. Folha em primeiro lugar foi o que ensinou a tela inteira a somar
 * errado.
 *
 * O DIA EM ABERTO NÃO TEM COMPOSIÇÃO (`composicao` null): não é dia de zero
 * hora normal, é dia que não terminou. Extra em `null` é "não apurei" — dia
 * lançado à mão não sabe separar a dobra —, e isso se escreve com a palavra,
 * nunca com 0h00.
 */
function CascataDoDia({ composicao, folhaMin, emAberto, semJornada }) {
  const vazio = <Nada>{emAberto ? "dia em aberto" : SEM}</Nada>;
  const faixa = (v) =>
    composicao === null ? vazio : v === null ? <Nada>{SEM_APURACAO}</Nada> : <span className="tnum">{duracaoTexto(v)}</span>;
  return (
    <>
      <Campo rotulo="Normais" ajuda={AJUDA_NORMAIS}>
        <span className="inline-flex flex-wrap items-center gap-1">
          {composicao === null ? vazio : <span className="tnum font-medium">{duracaoTexto(composicao.normaisMin)}</span>}
          {semJornada && <SemJornada />}
        </span>
      </Campo>
      <Campo rotulo="Extra +50%">{faixa(composicao?.extraMin ?? null)}</Campo>
      <Campo rotulo="Extra +100%">{faixa(composicao?.extraDobroMin ?? null)}</Campo>
      <Campo rotulo="Folha" ajuda={AJUDA_FOLHA} sub="normais + extras">
        {folhaMin === null ? vazio : <span className="tnum font-medium">{duracaoTexto(folhaMin)}</span>}
      </Campo>
    </>
  );
}

/**
 * A saída contra o fim previsto, em palavra. Null quando falta um dos dois —
 * "saiu no horário" sem saber o horário é elogio inventado.
 */
function saidaEmPalavras(p) {
  const n = p ? numOuNulo(p.saidaAntesMin) : null;
  if (n === null) return null;
  if (n === 0) return { texto: `no horário (${p.fimPrevisto})`, tom: "text-ok-700" };
  if (n > 0) return { texto: `${minutosComSinal(-n)} · saiu antes das ${p.fimPrevisto}`, tom: "text-warn-700" };
  return { texto: `${minutosComSinal(-n)} · ficou além das ${p.fimPrevisto}`, tom: "text-slate-600" };
}

/**
 * O PAINEL DA PESSOA — o que a linha da tabela não cabia dizer.
 *
 * Abre pelo nome, em qualquer uma das quatro visões, e responde as duas
 * perguntas que vinham logo depois do nome e não tinham resposta em lugar
 * nenhum: COMO FOI ESTE DIA (a que horas entrou, contra o que a escala previa,
 * o que rendeu, o que ficou pendente) e COMO ESTÁ O MÊS DELA (o mês inteiro
 * somado e o dia a dia, clicável).
 *
 * O DIA EM FOCO É ESCOLHIDO POR QUEM ABRE, e isso é decisão: na visão Dia é o
 * dia que está na tela; nas outras é o PRIMEIRO DIA COM REGISTRO do recorte.
 * Abrir sempre no dia 1º mostraria uma ficha vazia para quem só tem batida a
 * partir do dia 12 — e ficha vazia lida como "não trabalhou".
 *
 * ESTE PAINEL NÃO GRAVA NADA, como o resto da aba. Ele leva para onde se grava:
 * o botão do rodapé abre o dia na visão Dia, e o do mês abre a visão Mês.
 */
function PessoaDetalhe({ pessoa, diaFoco, grupo, jornada, aoFechar, aoEscolherDia, aoVerNoDia, aoVerNoMes }) {
  const competencia = competenciaDe(diaFoco);
  const de = primeiroDiaDoMes(competencia);
  const ate = ultimoDiaDoMes(competencia);
  const diasDaPessoa = diasNoPeriodo(grupo, de, ate);
  const ag = agregar(diasDaPessoa, jornada);
  const previstoMes = minutosPrevistosDoMes(competencia, jornada);
  const semMedicaoNoMes = ag.diasComRegistro === 0;

  const d = grupo ? grupo.dias.get(diaFoco) || null : null;
  const p = d ? atrasoDoDia(d, jornada) : null;
  const ausencia = d ? ausenciaDoDia(d) : null;
  const min = d ? minutosTrabalhados(d) : null;
  /* A CASCATA DO DIA SAI DA LIB, nunca de uma subtração escrita aqui: é a MESMA
     `normaisDoDia` que `apurarCompetencia` soma no mês. Se a tela fizesse a
     conta por conta própria, o mês diria uma coisa e a linha outra no primeiro
     conserto feito de um lado só. */
  const composicao = d ? normaisDoDia(d, jornada) : null;
  const emAberto = !!d && min === null;
  const previstoDia = minutosPrevistosDoDia(diaFoco, jornada);
  const semJornadaDia = previstoDia === 0;
  const inicioPrev = inicioPrevistoDoDia(diaFoco, jornada);
  const fimPrev = fimPrevistoDoDia(diaFoco, jornada);
  const semana = diaDaSemanaISO(diaFoco);
  const sit = situacaoDoDia({ dia: d, ausencia, emAberto, previstoMin: previstoDia });
  const saida = saidaEmPalavras(p);

  return (
    <Modal titulo={pessoa.nome} aberto aoFechar={aoFechar} largura="max-w-3xl">
      <p className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span
          className={pessoa.ativo === false ? "chip" : "chip-ok"}
          title={`Crachá do relógio: ${txt(pessoa.jibbleId) || "sem crachá vinculado"}`}
        >
          {pessoa.ativo === false ? "fora do quadro" : "no quadro"}
        </span>
        {txt(pessoa.cargo) && <span>{txt(pessoa.cargo)}</span>}
        {txt(pessoa.setor) && <span>· {txt(pessoa.setor)}</span>}
        {/* O apelido só entra quando DIFERE do nome. Antes saía sempre, e a
            linha virava "VICTORIA MARIA BRETAS DE BRITO · chamada de VICTORIA
            MARIA BRETAS DE BRITO" — o nome inteiro duas vezes, empurrando para
            fora o que informa. */}
        {txt(pessoa.apelido) && txt(pessoa.apelido) !== txt(pessoa.nome) && (
          <span>· chamada de {txt(pessoa.apelido)}</span>
        )}
        {ehData(pessoa.admissao) && <span className="tnum">· admissão em {dataLonga(pessoa.admissao)}</span>}
        {/* O crachá do relógio é um uuid: não é informação de gente, e ocupava
            uma linha inteira do cabeçalho. Vira o title do chip — quem precisa
            conferir o vínculo passa o mouse; quem quer saber quem é a pessoa
            não tropeça nele. */}
      </p>

      {/* ---- O DIA EM FOCO ---- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-semibold text-slate-900">
            {dataLonga(diaFoco)}
            {semana === null ? "" : ` · ${NOMES_DIA_SEMANA[semana]}`}
          </h4>
          <p className="text-xs text-slate-500 tnum">
            {previstoDia === null
              ? "esta data não existe no calendário"
              : previstoDia === 0
                ? "a escala não prevê trabalho neste dia — nada aqui é atraso"
                : `previsto ${inicioPrev} às ${fimPrev} (${duracaoTexto(previstoDia)})`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Entrada">
            <EntradaComparada dia={d} p={p} />
          </Campo>
          <Campo rotulo="Saída">
            {txt(d?.saida) ? (
              <div className="leading-tight">
                <span className="tnum font-medium text-slate-800">{txt(d.saida)}</span>
                {saida && <span className={clsx("block text-xs tnum", saida.tom)}>{saida.texto}</span>}
              </div>
            ) : (
              <Nada>{emAberto ? "não bateu a saída" : SEM}</Nada>
            )}
          </Campo>
          <Campo rotulo="Intervalo">
            {numOuNulo(d?.pausaMin) === null ? <Nada /> : <span className="tnum">{duracaoTexto(d.pausaMin)}</span>}
          </Campo>
          <Campo rotulo="Atraso na chegada">
            {!p ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <Nada>{semJornadaDia ? "fora da escala" : "sem entrada batida"}</Nada>
                {semJornadaDia && <SemJornada />}
              </span>
            ) : p.pontual ? (
              <span className="text-ok-700">no horário</span>
            ) : (
              <span className="tnum font-semibold text-bad-700">{duracaoTexto(p.atrasoMin)}</span>
            )}
          </Campo>

          {/* A CASCATA NUMA LINHA SÓ, e nesta ordem: as parcelas, depois o
              total. Ver a decisão 12 — a folha ao lado de uma extra solta é o
              desenho que ensinou a somar errado. */}
          <CascataDoDia composicao={composicao} folhaMin={min} emAberto={emAberto} semJornada={semJornadaDia} />

          <Campo rotulo="Como foi o dia" largura="col-span-2 sm:col-span-4">
            <LinhaDoTempoDoDia dia={d} inicioPrevisto={inicioPrev} fimPrevisto={fimPrev} p={p} emAberto={emAberto} />
          </Campo>
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className={sit.chip}>{sit.situacao}</span>
          {ausencia?.motivo && <span>{ausencia.motivo}</span>}
          {ausencia?.documento && <span>· documento: {ausencia.documento}</span>}
          {d?.origem === "manual" && <span className="chip">lançado à mão</span>}
          {d?.corrigido === true && <span className="chip">corrigido depois da importação</span>}
        </p>
      </div>

      {/* ---- O MÊS DELA ---- */}
      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-semibold text-slate-900">{rotuloCompetencia(competencia)}</h4>
          <button
            type="button"
            onClick={() => aoVerNoMes(competencia)}
            className="inline-flex items-center gap-1 text-xs text-brand-700 underline-offset-2 hover:underline"
          >
            ver o mês inteiro na visão Mês <ArrowRight size={12} strokeWidth={2.6} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* A CASCATA DO MÊS, na ordem da decisão 12: a hora comum primeiro,
              com o PREVISTO logo embaixo — é este par que responde "cumpriu a
              jornada?". A folha fecha a linha como total, e não como referência
              de jornada: ela tem a extra dentro. */}
          <Campo
            rotulo="Horas normais"
            ajuda={AJUDA_NORMAIS}
            sub={`previsto na escala: ${horasOuNada(previstoMes)}`}
          >
            {semMedicaoNoMes ? <Nada /> : <span className="tnum font-medium">{horasOuNada(ag.normaisMin)}</span>}
          </Campo>
          <Campo rotulo="Extra +50%">
            {semMedicaoNoMes ? <Nada /> : <span className="tnum">{horasOuSemApuracao(ag.extrasMin)}</span>}
          </Campo>
          <Campo rotulo="Extra +100%">
            {semMedicaoNoMes ? <Nada /> : <span className="tnum">{horasOuSemApuracao(ag.extrasDobroMin)}</span>}
          </Campo>
          <Campo rotulo="Horas da folha" ajuda={AJUDA_FOLHA} sub="normais + extras">
            {semMedicaoNoMes ? <Nada /> : <span className="tnum font-medium">{horasOuNada(ag.folhaMin)}</span>}
          </Campo>
          <Campo rotulo="Pontualidade">
            {ag.pontualidadePct === null ? (
              <Nada />
            ) : (
              <span className="tnum">
                {Math.round(ag.pontualidadePct)}%{" "}
                <span className="text-xs text-slate-500">
                  ({ag.diasPontuais}/{ag.diasMedidos} dias medidos)
                </span>
              </span>
            )}
          </Campo>
          <Campo rotulo="Atrasos na chegada">
            {ag.atrasoChegadaMin === null ? <Nada /> : <span className="tnum">{duracaoTexto(ag.atrasoChegadaMin)}</span>}
          </Campo>
          <Campo rotulo="Faltas que descontam">
            {ag.faltasQueDescontam === null ? <Nada /> : <span className="tnum">{ag.faltasQueDescontam}</span>}
          </Campo>
          <Campo rotulo="Ausências justificadas">
            {ag.ausenciasSemDesconto === null ? <Nada /> : <span className="tnum">{ag.ausenciasSemDesconto}</span>}
          </Campo>
        </div>

        {/* A FRASE QUE FALTAVA, e ela vale para toda a aba. Sem ela, o par
            "folha 177h30 · previsto 193h00" convida à leitura errada; com ela,
            fica dito de quem é a comparação. Não recolhe: é a régua do número
            que está logo acima. */}
        <p className="mt-3 text-xs text-slate-500">
          Quem se compara com o previsto da escala é <strong>Horas normais</strong>.{" "}
          <strong>Horas da folha</strong> é o total que vai para o pagamento — e ele já inclui as extras (normais +50%
          +100%), então somá-lo com as extras ao lado pagaria a mesma hora duas vezes.
          {ag.diasExtraMaiorQueFolha > 0 && (
            <>
              {" "}
              <span className="chip-warn">
                {plural(ag.diasExtraMaiorQueFolha, "dia com extra maior que a folha", "dias com extra maior que a folha")}
              </span>{" "}
              — dado torto do relógio: a normal ficou em 0h00 nesses dias, e é preciso conferir a importação.
            </>
          )}
        </p>

        {/* O DIA A DIA, e cada linha é clicável: é daqui que se chega ao dia. */}
        {diasDaPessoa.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhum dia registrado neste mês para {pessoa.nome} — e isso não é zero hora trabalhada: é o relógio não ter
            trazido dia nenhum.
          </p>
        ) : (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-100">
            <ul className="divide-y divide-slate-100">
              {diasDaPessoa.map((dd) => {
                const pp = atrasoDoDia(dd, jornada);
                const mm = minutosTrabalhados(dd);
                const aus = ausenciaDoDia(dd);
                const s = diaDaSemanaISO(dd.data);
                const previstoDoDia = minutosPrevistosDoDia(dd.data, jornada);
                return (
                  <li key={dd.data}>
                    <button
                      type="button"
                      onClick={() => aoEscolherDia(dd.data)}
                      aria-current={dd.data === diaFoco ? "true" : undefined}
                      className={clsx(
                        "flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-left text-sm hover:bg-brand-50",
                        dd.data === diaFoco && "bg-brand-50"
                      )}
                    >
                      <span className="tnum w-24 shrink-0 text-slate-500">
                        {dataCurta(dd.data)} {s === null ? "" : NOMES_DIA_SEMANA[s].slice(0, 3)}
                      </span>
                      <span className="tnum w-28 shrink-0">
                        {txt(dd.entrada) || "—"} às {txt(dd.saida) || "—"}
                      </span>
                      {/* A BARRA MEDE O DIA CONTRA O PREVISTO DAQUELE DIA DA
                          SEMANA, não contra o maior dia do mês: a régua que
                          interessa é a escala (9h de segunda a quinta, 8h na
                          sexta). Assim uma sexta cheia aparece cheia, em vez de
                          parecer um dia fraco ao lado das quintas.
                          O que passa do previsto vira um fio na cor de extra —
                          a hora a mais não pode desaparecer dentro da barra. */}
                      <span
                        className="hidden h-2.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:flex"
                        title={
                          mm === null || !previstoDoDia
                            ? undefined
                            : `${duracaoTexto(mm)} de ${duracaoTexto(previstoDoDia)} previstos`
                        }
                        aria-hidden="true"
                      >
                        {mm !== null && previstoDoDia > 0 && (
                          <>
                            <span
                              className="block h-full rounded-full bg-brand-300"
                              style={{ width: `${Math.min(100, Math.max(3, (mm / previstoDoDia) * 100))}%` }}
                            />
                            {mm > previstoDoDia && (
                              <span
                                className="block h-full bg-warn-500"
                                style={{ width: `${Math.min(30, ((mm - previstoDoDia) / previstoDoDia) * 100)}%` }}
                              />
                            )}
                          </>
                        )}
                      </span>
                      <span className="tnum w-16 shrink-0 text-right font-medium text-slate-800">
                        {mm === null ? "—" : duracaoTexto(mm)}
                      </span>
                      {/* O SELO DO DIA SEM JORNADA VEM ANTES DE TUDO (decisão
                          13): sábado e domingo caíam em "sem medida de
                          chegada", que é verdade e não é a informação — a
                          informação é que não era dia de trabalho. E ele
                          aparece TAMBÉM no sábado trabalhado, onde a hora
                          escrita à esquerda é toda excedente. */}
                      {aus ? (
                        <span className={aus.chip}>{aus.rotulo}</span>
                      ) : previstoDoDia === 0 ? (
                        <SemJornada />
                      ) : pp ? (
                        pp.pontual ? (
                          <span className="chip-ok">no horário</span>
                        ) : (
                          <span className="chip-bad">atraso de {duracaoTexto(pp.atrasoMin)}</span>
                        )
                      ) : (
                        <span className="chip">sem medida de chegada</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-outline" onClick={() => aoVerNoDia(diaFoco)}>
          <CalendarDays size={16} strokeWidth={2.5} /> Ver {dataLonga(diaFoco)} na visão Dia
        </button>
        <button type="button" className="btn-outline" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}

// ---- as colunas do MÊS -----------------------------------------------------

/**
 * Cada coluna sabe DUAS coisas, e por isso a tabela, a ordenação e o rodapé
 * nunca discordam: `valor` (o número cru, que ordena e soma) e `tipo` (como se
 * escreve). A planilha leva as mesmas contas e MAIS colunas — lá cabe o que
 * não cabe na largura da tela (dias em aberto, dias medidos, atraso médio), e
 * é para somar que ela é baixada.
 *
 * NÃO HÁ COLUNA DE DINHEIRO AQUI, e é decisão. O dinheiro do mês tem carimbo
 * (salário, divisor, fatores) e só se confere com as parcelas ao lado — um
 * total de R$ sozinho numa tabela de 9 colunas é justamente o número que não se
 * defende. Quem paga olha o Fechamento, que mostra a conta escrita. O que esta
 * coluna responde é outra coisa, e é o que faltava: o mês já foi conferido?
 */
const COLUNAS_MES = [
  {
    chave: "dias",
    rotulo: "Dias trabalhados",
    tipo: "dias",
    valor: (l) => l.ag.diasComBatida,
    ajuda: "Dias com total apurado. Dia em aberto não entra — sai na coluna de pendência da linha.",
  },
  {
    chave: "normais",
    rotulo: "Horas normais",
    tipo: "horas",
    valor: (l) => l.ag.normaisMin,
    ajuda: "A folha menos as extras — a hora comum. É esta que se compara com o previsto da escala.",
  },
  {
    chave: "horas",
    rotulo: "Horas da folha",
    tipo: "horas",
    valor: (l) => l.ag.folhaMin,
    ajuda: "O payrollHours do relógio, somado — e ele JÁ INCLUI as extras (normais +50% +100%).",
  },
  {
    chave: "extra",
    rotulo: "Extra +50%",
    tipo: "horas",
    valor: (l) => l.ag.extrasMin,
    ajuda: "Hora extra de dia normal.",
  },
  {
    chave: "extraDobro",
    rotulo: "Extra +100%",
    tipo: "horas",
    valor: (l) => l.ag.extrasDobroMin,
    ajuda: "Extra de descanso, feriado ou dobra.",
  },
  {
    chave: "atrasos",
    rotulo: "Atrasos na chegada",
    tipo: "horas",
    valor: (l) => l.ag.atrasoChegadaMin,
    ajuda: `Soma do que a tolerância deixa cobrar (${TOLERANCIA_MARCACAO_MIN} min por marcação, ${TOLERANCIA_DIA_MIN} no dia). Não é o atraso do desconto.`,
  },
  {
    chave: "faltas",
    rotulo: "Faltas que descontam",
    tipo: "dias",
    valor: (l) => l.ag.faltasQueDescontam,
    ajuda: "Só o tipo falta desconta (1/30 do salário).",
  },
  {
    chave: "abonadas",
    rotulo: "Ausências justificadas",
    tipo: "dias",
    valor: (l) => l.ag.ausenciasSemDesconto,
    ajuda: "Atestado, justificada, férias e folga: contadas, e não descontam.",
  },
  {
    chave: "pontualidade",
    rotulo: "Pontualidade",
    tipo: "pct",
    valor: (l) => l.ag.pontualidadePct,
    ajuda: "Dias sem nada a cobrar na chegada ÷ dias medidos. Sem dia medido, é sem registro — nunca 0%.",
  },
];

/* A tabela de nove colunas do Mês saiu daqui em 29/08/2026, e com ela o
   `celulaDoMes` que escrevia cada célula. No lugar entrou a lista do print (uma
   linha por pessoa, um número forte só) — pedido do dono: "eu quero a tela
   assim, inteligente, que já sai os nomes assim, e bem mais moderno".
   NADA DO QUE A TABELA CONTAVA FOI JOGADO FORA, e é a parte que importa:
     · as nove colunas continuam INTEIRAS na planilha (ver `baixar`), que é
       onde se soma e se confere;
     · dias trabalhados e dias com atraso viraram os dois APOIOS da linha;
     · o resto (extras, faltas, ausências justificadas, pontualidade) entra pelo
       seletor "Número na tabela", que troca o valor forte E a barra juntos;
     · o fechamento do mês virou a linha de chips (`Fechamentos`);
     · a distinção entre "sem registro" e "sem apuração", que morava na célula,
       virou a linha `RodapeDaLista` embaixo da lista.
   COLUNAS_MES continua vivo: ele é quem soma os totais dos cartões do alto e
   quem desenha a planilha. */

// ============================================================================

export default function Relatorios({ pessoas, ativos, ponto, pontoDia, hojeISO, setAviso }) {
  const [visao, setVisao] = useState("dia");
  const [filtroPessoa, setFiltroPessoa] = useState(TODAS);

  /* O QUADRO ESCOLHIDO vale para as quatro visões e FICA GUARDADO. Quem abre a
     tela toda manhã para olhar a equipe não pode reencontrar as treze
     desligadas a cada visita. `mesesTodos` mora na mesma preferência: é a
     mesma decisão de "quanto eu quero ver". */
  const [prefs, setPrefs] = useState(lerPrefs);
  const { quadro, mesesTodos, medidaMes } = prefs;
  // Grava FORA do atualizador de estado: escrever em disco lá dentro faz o
  // React do modo estrito gravar duas vezes a mesma coisa.
  const salvar = (mudanca) => {
    const nova = { ...prefs, ...mudanca };
    setPrefs(nova);
    gravarPrefs(nova);
  };

  // Cada visão tem o SEU recorte, e ele não se mistura: trocar de aba e voltar
  // devolve o dia que a pessoa estava olhando.
  const [dia, setDia] = useState(hojeISO);
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const [ano, setAno] = useState(() => String(hojeISO).slice(0, 4));
  const [medidaAno, setMedidaAno] = useState("horas");
  const [medidaComp, setMedidaComp] = useState("horas");

  /* QUEM ESTÁ ABERTO, E EM QUE DIA. O nome clicado em qualquer visão abre o
     painel da pessoa; o dia em foco viaja junto porque "detalhe da pessoa" sem
     dia não existe — a mesma pessoa é pontual num dia e chega tarde no outro.
     Guarda o ID, nunca a ficha inteira: ficha copiada para dentro do estado
     envelhece calada quando o servidor traz outra. */
  const [detalhe, setDetalhe] = useState(null); // { pessoaId, dia }

  // Os dois períodos da comparação: o mês corrente até hoje, contra o MESMO
  // PEDAÇO do mês passado. Começar com dois períodos de tamanhos iguais é o
  // padrão honesto — quem quiser comparar 30 dias com 15 muda as datas e a tela
  // avisa.
  const [periodos, setPeriodos] = useState(() => {
    const bDe = primeiroDiaDoMes(competenciaDe(hojeISO));
    const tamanho = diasCorridos(bDe, hojeISO) || 1;
    const aDe = primeiroDiaDoMes(competenciaAnterior(competenciaDe(hojeISO)));
    return { aDe, aAte: somarDias(aDe, tamanho - 1), bDe, bAte: hojeISO };
  });

  // ---- configuração (jornada, divisor, fatores) ----------------------------
  // null é AINDA NÃO CARREGOU, que não é "não existe": enquanto isso vale o
  // padrão da casa, e a tela diz que está usando o padrão.
  const [config, setConfig] = useState(null);
  const [cfgFalhou, setCfgFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    lerCfg()
      .then((c) => {
        if (!vivo) return;
        setConfig(c || {});
        setCfgFalhou(false);
      })
      .catch(() => {
        if (vivo) setCfgFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, []);
  const cfg = useMemo(() => cfgDoPonto(config), [config]);
  const jornadaEmPalavras = useMemo(() => descreverJornada(cfg.jornada), [cfg.jornada]);

  const indice = useMemo(() => montarIndice(pessoas, pontoDia), [pessoas, pontoDia]);
  const importadoISO = useMemo(() => ultimaImportacaoISO(pontoDia), [pontoDia]);
  // Por extenso para o PAPEL; curta para a linha do rodapé.
  const importadoEm = useMemo(() => instanteLocal(importadoISO), [importadoISO]);
  const importadoCurto = useMemo(() => instanteCurto(importadoISO, hojeISO), [importadoISO, hojeISO]);

  /* Quem pode ser escolhido no filtro: o quadro mais quem tem dia gravado em
     qualquer época (o relatório de março precisa de quem saiu em abril) — e
     passado pelas MESMAS duas peneiras da lista. O seletor tem de oferecer
     exatamente quem a tabela mostra: nome que se escolhe e devolve tabela vazia
     é armadilha, e nome de quem não bate ponto não tem resposta nenhuma aqui. */
  const pessoasDoFiltro = useMemo(() => {
    const mapa = new Map((ativos || []).map((p) => [p.id, p]));
    for (const [id, grupo] of indice.porPessoa) {
      if (!mapa.has(id)) mapa.set(id, grupo.pessoa);
    }
    return recortarPessoas([...mapa.values()], quadro).lista;
  }, [ativos, indice, quadro]);

  /* A ESCOLHIDA SÓ VALE SE ELA ESTÁ NA LISTA. Trocar o recorte (ou o servidor
     desligar alguém) pode tirar do ar a pessoa selecionada; sem esta linha o
     <select> ficaria mostrando um valor que não existe entre as opções — em
     branco, afirmando um recorte que a tabela não está usando. */
  const pessoaEscolhida = filtroPessoa === TODAS ? null : pessoasDoFiltro.find((p) => p.id === filtroPessoa) || null;
  const valorDoFiltroPessoa = pessoaEscolhida ? pessoaEscolhida.id : TODAS;
  /* A frase do recorte é a MESMA na tela, no papel e no nome da planilha. Ela
     DIZ O QUADRO ESCOLHIDO com todas as letras: uma folha que sai com sete
     linhas onde a casa tem vinte pessoas precisa explicar a diferença no
     próprio papel, senão alguém soma sete e acha que somou a casa. */
  const quadroEmPalavras =
    quadro === "ativos"
      ? "só quem está no quadro"
      : quadro === "desligados"
        ? "só quem foi desligado"
        : "quadro e desligados";
  const recorteDePessoa = pessoaEscolhida
    ? pessoaEscolhida.nome
    : `${quadroEmPalavras} · só quem bate ponto`;
  /* O filtro de UMA pessoa vem DEPOIS do recorte, e não mexe nas contagens do
     que ficou de fora: quem não bate ponto continua fora do relatório mesmo
     quando se olha uma pessoa só, e a linha do rodapé continua dizendo isso. */
  const soAEscolhida = (recortado) => ({
    ...recortado,
    lista: pessoaEscolhida ? recortado.lista.filter((p) => p.id === pessoaEscolhida.id) : recortado.lista,
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set([Number(String(hojeISO).slice(0, 4))]);
    for (const d of pontoDia || []) {
      const a = Number(String(d.data || "").slice(0, 4));
      if (a) set.add(a);
    }
    for (const r of ponto || []) {
      const a = Number(String(r.competencia || "").slice(0, 4));
      if (a) set.add(a);
    }
    return [...set].filter(Boolean).sort((a, b) => b - a);
  }, [pontoDia, ponto, hojeISO]);

  // ==========================================================================
  // ABRIR A PESSOA, E NAVEGAR ENTRE AS VISÕES
  // --------------------------------------------------------------------------
  // O NOME É PORTA (28/08/2026). Cada visão sabe qual dia entregar ao painel:
  // na visão Dia é o dia que está na tela; nas outras é o PRIMEIRO DIA COM
  // REGISTRO do recorte — abrir sempre no dia 1º mostraria ficha vazia para
  // quem só tem batida a partir do 12, e ficha vazia lê como "não trabalhou".
  // Sem nenhum dia no recorte, vale o começo do recorte, e o painel escreve com
  // todas as letras que ali não há registro.
  // ==========================================================================
  const primeiroDiaComRegistro = (pessoaId, de, ate) => {
    const dias = diasNoPeriodo(indice.porPessoa.get(pessoaId), de, ate);
    return dias.length > 0 ? dias[0].data : null;
  };

  const diaDeFocoPara = (pessoa) => {
    if (visao === "dia") return ehData(dia) ? dia : hojeISO;
    if (visao === "mes") {
      const de = primeiroDiaDoMes(competencia);
      return primeiroDiaComRegistro(pessoa.id, de, ultimoDiaDoMes(competencia)) || de;
    }
    if (visao === "ano") {
      const de = `${ano}-01-01`;
      return primeiroDiaComRegistro(pessoa.id, de, `${ano}-12-31`) || de;
    }
    // Na comparação o período NOVO manda: é o que a pessoa está olhando agora.
    const { aDe, aAte, bDe, bAte } = periodos;
    const noNovo = ehData(bDe) && ehData(bAte) ? primeiroDiaComRegistro(pessoa.id, bDe, bAte) : null;
    const noAnterior = ehData(aDe) && ehData(aAte) ? primeiroDiaComRegistro(pessoa.id, aDe, aAte) : null;
    return noNovo || noAnterior || (ehData(bDe) ? bDe : hojeISO);
  };

  const abrirPessoa = (pessoa) => setDetalhe({ pessoaId: pessoa.id, dia: diaDeFocoPara(pessoa) });

  /* CLICAR NUM NÚMERO LEVA À VISÃO DELE, JÁ FILTRADA. Sem isto, para ver março
     a pessoa troca de visão e reencontra o filtro na mão — e é justamente aí
     que se olha o mês errado sem perceber. */
  const irParaDia = (data) => {
    if (!ehData(data)) return;
    setDia(data);
    setVisao("dia");
    setDetalhe(null);
  };

  const irParaMes = (comp, pessoa) => {
    if (!ehCompetencia(comp)) return;
    setCompetencia(comp);
    // Clicou na célula DE ALGUÉM: o mês abre com essa pessoa no filtro. Clicou
    // no rodapé (o total da casa), o filtro fica como estava.
    if (pessoa) setFiltroPessoa(pessoa.id);
    setVisao("mes");
    setDetalhe(null);
  };

  // ==========================================================================
  // VISÃO DIA
  // ==========================================================================
  const vmDia = useMemo(() => {
    const valida = ehData(dia);
    const semana = valida ? diaDaSemanaISO(dia) : null;
    const previsto = valida ? minutosPrevistosDoDia(dia, cfg.jornada) : null;
    const recortado = soAEscolhida(pessoasDoPeriodo(ativos, indice, dia, dia, quadro));
    const linhas = recortado.lista.map((pessoa) => {
      const grupo = indice.porPessoa.get(pessoa.id);
      const d = grupo ? grupo.dias.get(dia) || null : null;
      const min = d ? minutosTrabalhados(d) : null;
      /* A CASCATA DA LINHA (normais/+50%/+100%) sai de `normaisDoDia`, a MESMA
         função que `apurarCompetencia` soma no mês — antes a coluna de extra
         lia `apuracaoDoRelogio` direto e dizia "sem apuração" no dia lançado à
         mão, enquanto o total do mês já contava a extra derivada daquele mesmo
         dia. A tabela e o rodapé discordavam, e ninguém sabia qual estava
         certo. */
      const composicao = d ? normaisDoDia(d, cfg.jornada) : null;
      const ausencia = d ? ausenciaDoDia(d) : null;
      const p = d ? atrasoDoDia(d, cfg.jornada) : null;
      const emAberto = !!d && min === null;
      const temEntrada = !!txt(d?.entrada);

      // A situação em uma palavra sai de `situacaoDoDia`, lá em cima: é a MESMA
      // escada que o painel da pessoa usa. Duas cópias divergiriam no primeiro
      // conserto feito só de um lado.
      const sit = situacaoDoDia({ dia: d, ausencia, emAberto, previstoMin: previsto });

      return {
        pessoa,
        d,
        min,
        composicao,
        ausencia,
        p,
        emAberto,
        temEntrada,
        situacao: sit.situacao,
        chipSituacao: sit.chip,
      };
    });

    /* A ORDEM DIZ O QUE OLHAR PRIMEIRO, e por isso ela não é alfabética.
       Ordem alfabética enterra o atraso no meio da lista: quem abre esta tela
       de manhã quer saber quem chegou depois, não quem começa com A. Então:
       atrasados (do maior atraso para o menor), depois quem chegou no horário,
       depois quem tem dia mas não dá para medir a chegada (fim de semana,
       ausência lançada), e no fim quem não tem registro nenhum.

       SEM REGISTRO VAI SEMPRE PARA O ÚLTIMO BALDE — "não medi" não pode
       encabeçar um ranking nem de melhores nem de piores. É a mesma regra da
       ordenação do Mês. */
    const balde = (l) => (l.p && !l.p.pontual ? 0 : l.p ? 1 : l.d ? 2 : 3);
    linhas.sort((a, b) => {
      const ba = balde(a);
      const bb = balde(b);
      if (ba !== bb) return ba - bb;
      if (ba === 0 && b.p.atrasoMin !== a.p.atrasoMin) return b.p.atrasoMin - a.p.atrasoMin;
      return norm(a.pessoa.nome).localeCompare(norm(b.pessoa.nome));
    });

    const presentes = linhas.filter((l) => l.temEntrada).length;
    const atrasados = linhas.filter((l) => l.p && !l.p.pontual).length;
    const pontuais = linhas.filter((l) => l.p && l.p.pontual).length;
    const faltas = linhas.filter((l) => l.ausencia?.desconta).length;
    const abonadas = linhas.filter((l) => l.ausencia && !l.ausencia.desconta).length;
    const emAberto = linhas.filter((l) => l.emAberto).length;
    const semRegistro = linhas.filter((l) => !l.d).length;

    return {
      valida,
      semana,
      previsto,
      inicio: valida ? inicioPrevistoDoDia(dia, cfg.jornada) : null,
      fim: valida ? fimPrevistoDoDia(dia, cfg.jornada) : null,
      linhas,
      // Os cartões do alto contam A MESMA LISTA da tabela: KPI que soma um
      // conjunto e tabela que mostra outro é o jeito mais rápido de o número
      // do topo desmentir a lista de baixo sem ninguém saber qual está certo.
      kpi: { presentes, atrasados, pontuais, faltas, abonadas, emAberto, semRegistro, total: linhas.length },
      foraDoQuadro: recortado.foraDoQuadro,
      semPonto: recortado.semPonto,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, cfg.jornada, ativos, indice, pessoaEscolhida, quadro]);

  // ==========================================================================
  // VISÃO MÊS
  // ==========================================================================
  const vmMes = useMemo(() => {
    const de = primeiroDiaDoMes(competencia);
    const ate = ultimoDiaDoMes(competencia);
    const regsDoMes = new Map();
    for (const r of ponto || []) {
      if (r.competencia === competencia && !regsDoMes.has(r.pessoaId)) regsDoMes.set(r.pessoaId, r);
    }

    const recortado = soAEscolhida(pessoasDoPeriodo(ativos, indice, de, ate, quadro));
    const linhas = recortado.lista.map((pessoa) => {
      const dias = diasNoPeriodo(indice.porPessoa.get(pessoa.id), de, ate);
      const reg = regsDoMes.get(pessoa.id) || null;
      return {
        pessoa,
        nome: pessoa.nome,
        ag: agregar(dias, cfg.jornada),
        // O fechamento responde UMA pergunta aqui: este mês já foi conferido?
        fechamento: reg ? (reg.fechado ? "fechado" : "lançado, em aberto") : "sem lançamento",
        fechado: !!reg?.fechado,
        temLancamento: !!reg,
      };
    });

    const ags = linhas.map((l) => l.ag);
    /* A ORDEM BASE É POR NOME, com quem não tem um dia sequer no fim. Quem
       ordena a LISTA é `rankingMes` (do maior para o menor, na medida
       escolhida); esta ordem aqui é a que sai na PLANILHA, e planilha se ordena
       na planilha — quem baixa quer o nome achável, não a classificação de
       ontem. */
    const ordenadas = [...linhas].sort((a, b) => {
      const semA = a.ag.diasComRegistro === 0;
      const semB = b.ag.diasComRegistro === 0;
      if (semA !== semB) return semA ? 1 : -1;
      return norm(a.nome).localeCompare(norm(b.nome));
    });

    return {
      de,
      ate,
      linhas: ordenadas,
      previstoMin: minutosPrevistosDoMes(competencia, cfg.jornada),
      totais: {
        porColuna: Object.fromEntries(
          COLUNAS_MES.map((c) => [
            c.chave,
            c.chave === "pontualidade" ? totalDaMedida(medidaDe("pontualidade"), ags) : somaOuNulo(linhas.map((l) => c.valor(l))),
          ])
        ),
        diasMedidos: ags.reduce((s, a) => s + a.diasMedidos, 0),
        diasPontuais: ags.reduce((s, a) => s + (a.diasPontuais ?? 0), 0),
        // Quem não tem dia nenhum não soma nada aqui (o `?? 0` é a ausência
        // NÃO contribuindo, não virando zero na conta de outra pessoa).
        emAberto: ags.reduce((s, a) => s + (a.diasEmAberto ?? 0), 0),
        estranhas: ags.reduce((s, a) => s + (a.ausenciasDesconhecidas ?? 0), 0),
      },
      foraDoQuadro: recortado.foraDoQuadro,
      semPonto: recortado.semPonto,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, ponto, ativos, indice, cfg.jornada, pessoaEscolhida, quadro]);

  /* ==========================================================================
     O RANKING DO MÊS — a lista do print.
     --------------------------------------------------------------------------
     Sai de `vmMes.linhas` (o mesmo recorte, as mesmas pessoas, os mesmos
     agregados) e só troca a ORDEM e o número que fica em evidência. Memo
     separado de propósito: trocar "Número na tabela" não pode remontar o mês
     inteiro — a apuração de 7 pessoas × 31 dias não mudou, só a leitura dela.
     ========================================================================== */
  const rankingMes = useMemo(() => {
    const medida = medidaDe(medidaMes);
    const itens = vmMes.linhas.map((l) => ({
      pessoa: l.pessoa,
      nome: l.nome,
      ag: l.ag,
      n: numeroDaLinha(medida, l.ag),
      apoios: apoiosDoPonto(l.ag),
    }));
    const ags = vmMes.linhas.map((l) => l.ag);
    return {
      medida,
      itens: ordenarRanking(itens),
      total: {
        rotulo: rotuloDoTotal(medida, vmMes.linhas.length),
        // O MESMO total do rodapé da tabela antiga e dos cartões do alto:
        // soma para o que soma, razão juntada para a pontualidade.
        n: totalDaMedida(medida, ags),
        apoios: apoiosDoPonto(apoiosSomados(ags)),
      },
      semRegistro: itens.filter((i) => i.ag.diasComRegistro === 0).length,
      semApuracao: itens.filter((i) => i.n === null && i.ag.diasComRegistro > 0).length,
    };
  }, [vmMes.linhas, medidaMes]);

  // ==========================================================================
  // VISÃO ANO
  // ==========================================================================
  const vmAno = useMemo(() => {
    const medida = medidaDe(medidaAno);
    const de = `${ano}-01-01`;
    const ate = `${ano}-12-31`;
    const meses = MESES.map((_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);

    const recortado = soAEscolhida(pessoasDoPeriodo(ativos, indice, de, ate, quadro));
    const linhas = recortado.lista.map((pessoa) => {
      const grupo = indice.porPessoa.get(pessoa.id);
      const porMes = meses.map((c) => agregar(diasNoPeriodo(grupo, primeiroDiaDoMes(c), ultimoDiaDoMes(c)), cfg.jornada));
      return {
        pessoa,
        nome: pessoa.nome,
        porMes,
        valores: porMes.map((a) => medida.valor(a)),
        diasNoAno: porMes.reduce((s, a) => s + a.diasComRegistro, 0),
        // O total do ano na régua da medida: soma para o que soma, razão
        // juntada para a pontualidade.
        total: totalDaMedida(medida, porMes),
      };
    });

    /* QUEM BATE PONTO E NÃO TEM UM DIA NO ANO VAI PARA O FIM. No papel que o
       dono mandou, uma linha de doze travessões estava encravada no meio da
       lista e lia-se como defeito da tabela, não como o que é: uma pessoa sem
       nada importado. No fim, com a frase ao lado, ela vira notícia. */
    linhas.sort((a, b) => {
      const semA = a.diasNoAno === 0;
      const semB = b.diasNoAno === 0;
      if (semA !== semB) return semA ? 1 : -1;
      return norm(a.nome).localeCompare(norm(b.nome));
    });

    /* OS MESES QUE TÊM ALGUMA COISA. O critério é DIA REGISTRADO, não o valor
       da medida escolhida: assim as colunas não pulam quando se troca o número
       da tabela (e um mês inteiro de trabalho sem extra apurada continua
       visível, porque ali há o que conferir).
       Recolher mês vazio NÃO MUDA NENHUM TOTAL — mês sem dia não soma nada e
       não entra em nenhum denominador —, e é por isso que dá para recolher. */
    const mesesComRegistro = meses.map((_, i) => i).filter((i) => linhas.some((l) => l.porMes[i].diasComRegistro > 0));
    const vazios = meses.length - mesesComRegistro.length;

    return {
      medida,
      meses,
      linhas,
      mesesComRegistro,
      vazios,
      // O rodapé é o total DO MÊS entre todas as pessoas — a linha da tendência
      // da casa, que é para o que a visão de ano existe.
      totalPorMes: meses.map((_, i) => totalDaMedida(medida, linhas.map((l) => l.porMes[i]))),
      totalGeral: totalDaMedida(medida, linhas.flatMap((l) => l.porMes)),
      foraDoQuadro: recortado.foraDoQuadro,
      semPonto: recortado.semPonto,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, medidaAno, ativos, indice, cfg.jornada, pessoaEscolhida, quadro]);

  /* ==========================================================================
     O RANKING DO ANO — a mesma lista, com o TOTAL do ano.
     --------------------------------------------------------------------------
     Ela vem ANTES da matriz de doze meses porque a primeira pergunta diante de
     um ano é "quem trabalhou mais", e não "como foi março". A matriz continua
     logo abaixo, inteira: ali a lista não serve — doze números por pessoa não
     cabem numa linha, e a tendência só se lê lado a lado.
     ========================================================================== */
  const rankingAno = useMemo(() => {
    const medida = vmAno.medida;
    const itens = vmAno.linhas.map((l) => {
      const somado = apoiosSomados(l.porMes);
      return {
        pessoa: l.pessoa,
        nome: l.nome,
        // `diasNoAno` é dia REGISTRADO (existe a linha); `diasComBatida` é dia
        // apurado. É o primeiro que separa "não tem nada" de "tem e não fechou".
        ag: { ...somado, diasComRegistro: l.diasNoAno },
        n: Number.isFinite(l.total) ? l.total : null,
        apoios: apoiosDoPonto(somado),
      };
    });
    const todosOsMeses = vmAno.linhas.flatMap((l) => l.porMes);
    return {
      medida,
      itens: ordenarRanking(itens),
      total: {
        rotulo: rotuloDoTotal(medida, vmAno.linhas.length),
        n: vmAno.totalGeral,
        apoios: apoiosDoPonto(apoiosSomados(todosOsMeses)),
      },
      semRegistro: itens.filter((i) => i.ag.diasComRegistro === 0).length,
      semApuracao: itens.filter((i) => i.n === null && i.ag.diasComRegistro > 0).length,
    };
  }, [vmAno]);

  /* AS COLUNAS QUE A TABELA DO ANO DESENHA. Sem nenhum mês com registro (ano
     que ainda não começou a ser importado) valem os doze: tabela sem coluna
     nenhuma não é mais legível, é mais vazia. */
  const mesesVisiveis = useMemo(() => {
    if (mesesTodos || vmAno.mesesComRegistro.length === 0) return vmAno.meses.map((_, i) => i);
    return vmAno.mesesComRegistro;
  }, [mesesTodos, vmAno.mesesComRegistro, vmAno.meses]);

  /* A COLUNA DO MÊS ENCOLHE QUANDO HÁ MUITAS. Com doze meses abertos, o espaço
     que sobra para cada um é pouco e é o TOTAL que paga a conta — foi ele que
     apareceu cortado na borda direita do papel que o dono mandou. Com poucos
     meses, a coluna respira. A largura mínima é calculada, não chutada num
     `min-w-[1080px]` fixo: número fixo sobra quando há dois meses e falta
     quando há doze. */
  const mesEstreito = mesesVisiveis.length > 6;
  const larguraDaTabelaDoAno = 200 + mesesVisiveis.length * (mesEstreito ? 66 : 92) + 116;

  // ==========================================================================
  // VISÃO COMPARAR
  // ==========================================================================
  const vmComp = useMemo(() => {
    const medida = medidaDe(medidaComp);
    const { aDe, aAte, bDe, bAte } = periodos;
    const erroA = !ehData(aDe) || !ehData(aAte) ? "datas incompletas" : aDe > aAte ? "o fim vem antes do começo" : "";
    const erroB = !ehData(bDe) || !ehData(bAte) ? "datas incompletas" : bDe > bAte ? "o fim vem antes do começo" : "";
    if (erroA || erroB) return { medida, erroA, erroB, linhas: [], valido: false };

    const corridosA = diasCorridos(aDe, aAte);
    const corridosB = diasCorridos(bDe, bAte);
    const escalaA = diasDeEscala(aDe, aAte, cfg.jornada);
    const escalaB = diasDeEscala(bDe, bAte, cfg.jornada);

    /* OS DOIS PERÍODOS SE JUNTAM ANTES DE RECORTAR — e o recorte roda UMA vez
       sobre a união. Recortar duas vezes contaria duas vezes quem ficou de
       fora, e o rodapé diria "26 pessoas desligadas" onde existem 13. */
    const candidatas = new Map();
    for (const p of candidatasDoPeriodo(ativos, indice, aDe, aAte)) candidatas.set(p.id, p);
    for (const p of candidatasDoPeriodo(ativos, indice, bDe, bAte)) candidatas.set(p.id, p);
    const recortado = soAEscolhida(recortarPessoas([...candidatas.values()], quadro));

    const linhas = recortado.lista
      .map((pessoa) => {
        const grupo = indice.porPessoa.get(pessoa.id);
        const agA = agregar(diasNoPeriodo(grupo, aDe, aAte), cfg.jornada);
        const agB = agregar(diasNoPeriodo(grupo, bDe, bAte), cfg.jornada);
        return {
          pessoa,
          nome: pessoa.nome,
          agA,
          agB,
          // Sem um dia sequer NOS DOIS períodos não há o que comparar: a linha
          // vai para o fim dizendo isso, em vez de ficar no meio da lista com
          // dois travessões e uma diferença que não existe.
          semNenhumDia: agA.diasComRegistro === 0 && agB.diasComRegistro === 0,
          valorA: medida.valor(agA),
          valorB: medida.valor(agB),
        };
      })
      .sort((x, y) => {
        if (x.semNenhumDia !== y.semNenhumDia) return x.semNenhumDia ? 1 : -1;
        return norm(x.nome).localeCompare(norm(y.nome));
      });

    return {
      medida,
      valido: true,
      corridosA,
      corridosB,
      escalaA,
      escalaB,
      // O AVISO SAI DO DENOMINADOR QUE IMPORTA: dias de escala, não dias
      // corridos. Fevereiro contra março difere em dias corridos e pode ter o
      // mesmo tanto de dias úteis — aí não há o que avisar.
      tamanhosDiferentes: escalaA !== escalaB,
      linhas,
      totalA: totalDaMedida(medida, linhas.map((l) => l.agA)),
      totalB: totalDaMedida(medida, linhas.map((l) => l.agB)),
      foraDoQuadro: recortado.foraDoQuadro,
      semPonto: recortado.semPonto,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodos, medidaComp, ativos, indice, cfg.jornada, pessoaEscolhida, quadro]);

  // ==========================================================================
  // O RECORTE EM UMA FRASE — a mesma para o papel, para a planilha e para a tela
  // ==========================================================================
  const recorte = useMemo(() => {
    if (visao === "dia") {
      const semana = vmDia.semana === null ? "" : ` (${NOMES_DIA_SEMANA[vmDia.semana]})`;
      return `Dia ${ehData(dia) ? dataLonga(dia) : "não escolhido"}${semana} · ${recorteDePessoa}`;
    }
    // O NÚMERO ESCOLHIDO VAI NO PAPEL. A lista impressa mostra UM número por
    // pessoa; folha que não diz qual é sai igualzinha para horas e para faltas.
    if (visao === "mes") {
      return `Mês de ${rotuloCompetencia(competencia)} · número: ${rankingMes.medida.rotulo} · ${recorteDePessoa}`;
    }
    if (visao === "ano") return `Ano de ${ano} · número: ${vmAno.medida.rotulo} · ${recorteDePessoa}`;
    return (
      `${dataLonga(periodos.aDe)} a ${dataLonga(periodos.aAte)} (anterior) contra ` +
      `${dataLonga(periodos.bDe)} a ${dataLonga(periodos.bAte)} (novo) · ` +
      `número: ${vmComp.medida.rotulo} · ${recorteDePessoa}`
    );
  }, [visao, dia, competencia, ano, periodos, vmDia.semana, rankingMes.medida, vmAno.medida, vmComp.medida, recorteDePessoa]);

  const tituloDoPapel = `MinasLab — Relatório de ponto · ${VISOES.find((v) => v.valor === visao)?.rotulo || ""}`;

  // ==========================================================================
  // PLANILHA — o mesmo recorte que está na tela, com horas em NÚMERO
  // ==========================================================================
  const baixar = () => {
    let nome = "";
    let titulo = "";
    let colunas = [];
    let linhas = [];

    if (visao === "dia") {
      nome = `ponto-dia-${dia}`;
      titulo = `Ponto do dia — ${ehData(dia) ? dataLonga(dia) : dia}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        { chave: "data", rotulo: "Data", tipo: "data" },
        { chave: "entrada", rotulo: "Entrada" },
        { chave: "saida", rotulo: "Saída" },
        { chave: "intervaloMin", rotulo: "Intervalo (min)", tipo: "numero" },
        /* A PLANILHA LEVA A CASCATA NA MESMA ORDEM DA TELA, e o rótulo da folha
           traz a fórmula dentro: quem soma na planilha é quem mais precisa
           saber que "folha" já contém as duas colunas de extra ao lado. */
        { chave: "horasNormais", rotulo: "Horas normais (h)", tipo: "numero" },
        { chave: "extra50", rotulo: "Extra +50% (h)", tipo: "numero" },
        { chave: "extra100", rotulo: "Extra +100% (h)", tipo: "numero" },
        { chave: "horasFolha", rotulo: "Horas da folha = normais + extras (h)", tipo: "numero" },
        { chave: "atrasoCru", rotulo: "Atraso na entrada (min)", tipo: "numero" },
        { chave: "atrasoCobravel", rotulo: "Atraso cobrável (min)", tipo: "numero" },
        { chave: "situacao", rotulo: "Situação" },
        { chave: "ausencia", rotulo: "Ausência" },
        { chave: "motivo", rotulo: "Motivo" },
      ];
      linhas = vmDia.linhas.map((l) => ({
        pessoa: l.pessoa.nome,
        data: dia,
        entrada: l.d?.entrada || "",
        saida: l.d?.saida || "",
        // Célula VAZIA, nunca 0: zero em coluna que o RH soma vira desconto.
        // Number("") devolveria 0 — por isso o campo passa por numOuNulo.
        intervaloMin: numOuNulo(l.d?.pausaMin) ?? "",
        horasNormais: l.composicao === null ? "" : horasDecimais(l.composicao.normaisMin),
        extra50: l.composicao === null || l.composicao.extraMin === null ? "" : horasDecimais(l.composicao.extraMin),
        extra100:
          l.composicao === null || l.composicao.extraDobroMin === null ? "" : horasDecimais(l.composicao.extraDobroMin),
        horasFolha: l.min === null ? "" : horasDecimais(l.min),
        atrasoCru: l.p ? l.p.atrasoEntradaMin : "",
        atrasoCobravel: l.p ? l.p.atrasoMin : "",
        situacao: l.situacao,
        ausencia: l.ausencia?.curto || "",
        motivo: l.ausencia?.motivo || "",
      }));
    } else if (visao === "mes") {
      nome = `ponto-mes-${competencia}`;
      titulo = `Ponto do mês — ${rotuloCompetencia(competencia)}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        { chave: "diasTrabalhados", rotulo: "Dias trabalhados", tipo: "numero" },
        { chave: "diasEmAberto", rotulo: "Dias em aberto", tipo: "numero" },
        { chave: "horasNormais", rotulo: "Horas normais (h)", tipo: "numero" },
        { chave: "extra50", rotulo: "Extra +50% (h)", tipo: "numero" },
        { chave: "extra100", rotulo: "Extra +100% (h)", tipo: "numero" },
        { chave: "horasFolha", rotulo: "Horas da folha = normais + extras (h)", tipo: "numero" },
        { chave: "previstoMes", rotulo: "Previsto na escala (h)", tipo: "numero" },
        { chave: "atrasoChegadaMin", rotulo: "Atrasos na chegada (min)", tipo: "numero" },
        { chave: "atrasoMedioMin", rotulo: "Atraso médio por dia (min)", tipo: "numero" },
        { chave: "faltas", rotulo: "Faltas que descontam", tipo: "numero" },
        { chave: "ausenciasJustificadas", rotulo: "Ausências justificadas", tipo: "numero" },
        { chave: "diasMedidos", rotulo: "Dias medidos", tipo: "numero" },
        { chave: "diasPontuais", rotulo: "Dias pontuais", tipo: "numero" },
        { chave: "pontualidadePct", rotulo: "Pontualidade (%)", tipo: "numero" },
        { chave: "fechamento", rotulo: "Fechamento" },
      ];
      linhas = vmMes.linhas.map((l) => ({
        pessoa: l.nome,
        diasTrabalhados: l.ag.diasComBatida,
        diasEmAberto: l.ag.diasEmAberto,
        horasNormais: l.ag.normaisMin === null ? "" : horasDecimais(l.ag.normaisMin),
        extra50: l.ag.extrasMin === null ? "" : horasDecimais(l.ag.extrasMin),
        extra100: l.ag.extrasDobroMin === null ? "" : horasDecimais(l.ag.extrasDobroMin),
        horasFolha: l.ag.folhaMin === null ? "" : horasDecimais(l.ag.folhaMin),
        /* O PREVISTO VAI JUNTO na planilha do mês: é o denominador da coluna de
           normais, e sem ele quem soma fora da tela não tem contra o que
           comparar — foi exatamente a comparação que faltava na tela. */
        previstoMes: vmMes.previstoMin === null ? "" : horasDecimais(vmMes.previstoMin),
        atrasoChegadaMin: l.ag.atrasoChegadaMin === null ? "" : l.ag.atrasoChegadaMin,
        atrasoMedioMin: l.ag.atrasoMedioMin === null ? "" : l.ag.atrasoMedioMin,
        faltas: l.ag.faltasQueDescontam,
        ausenciasJustificadas: l.ag.ausenciasSemDesconto,
        diasMedidos: l.ag.diasMedidos,
        diasPontuais: l.ag.diasPontuais === null ? "" : l.ag.diasPontuais,
        pontualidadePct: l.ag.pontualidadePct === null ? "" : Math.round(l.ag.pontualidadePct * 10) / 10,
        fechamento: l.fechamento,
      }));
    } else if (visao === "ano") {
      nome = `ponto-ano-${ano}-${vmAno.medida.chave}`;
      titulo = `Ponto do ano — ${ano} · ${vmAno.medida.rotulo}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        ...MESES.map((m, i) => ({ chave: `m${i}`, rotulo: m, tipo: "numero" })),
        { chave: "total", rotulo: vmAno.medida.chave === "pontualidade" ? "Ano (%)" : "Total do ano", tipo: "numero" },
      ];
      linhas = vmAno.linhas.map((l) => {
        const linha = { pessoa: l.nome };
        l.valores.forEach((v, i) => {
          const n = numeroDaMedida(v, vmAno.medida.unidade);
          linha[`m${i}`] = n === null ? "" : n;
        });
        const t = numeroDaMedida(l.total, vmAno.medida.unidade);
        linha.total = t === null ? "" : t;
        return linha;
      });
    } else {
      nome = `ponto-comparacao-${periodos.aDe}-x-${periodos.bDe}`;
      titulo = `Comparação de períodos — ${vmComp.medida.rotulo}`;
      colunas = [
        { chave: "pessoa", rotulo: "Pessoa" },
        { chave: "anterior", rotulo: `Anterior (${dataLonga(periodos.aDe)} a ${dataLonga(periodos.aAte)})`, tipo: "numero" },
        { chave: "anteriorDia", rotulo: "Anterior por dia de escala", tipo: "numero" },
        { chave: "novo", rotulo: `Novo (${dataLonga(periodos.bDe)} a ${dataLonga(periodos.bAte)})`, tipo: "numero" },
        { chave: "novoDia", rotulo: "Novo por dia de escala", tipo: "numero" },
        { chave: "diferenca", rotulo: "Diferença", tipo: "numero" },
        { chave: "variacaoPct", rotulo: "Variação (%)", tipo: "numero" },
        { chave: "sentido", rotulo: "Leitura" },
      ];
      linhas = vmComp.linhas.map((l) => {
        const { diferenca, pct, motivo } = compararValores(l.valorA, l.valorB);
        const porDia = (v, dias) =>
          v === null || v === undefined || !dias || vmComp.medida.somavel === false
            ? ""
            : Math.round(numeroDaMedida(v, vmComp.medida.unidade) / dias * 100) / 100;
        return {
          pessoa: l.nome,
          anterior: numeroDaMedida(l.valorA, vmComp.medida.unidade) ?? "",
          anteriorDia: porDia(l.valorA, vmComp.escalaA),
          novo: numeroDaMedida(l.valorB, vmComp.medida.unidade) ?? "",
          novoDia: porDia(l.valorB, vmComp.escalaB),
          diferenca: diferenca === null ? "" : numeroDaMedida(diferenca, vmComp.medida.unidade),
          variacaoPct: pct === null ? "" : Math.round(pct * 10) / 10,
          sentido: motivo || sentidoDaVariacao(vmComp.medida, diferenca),
        };
      });
    }

    if (linhas.length === 0) {
      return setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
    }
    try {
      const arquivo = baixarPlanilha({ nome, titulo: `${titulo} — ${recorteDePessoa}`, colunas, linhas });
      setAviso({
        tipo: "ok",
        texto: `Planilha baixada: ${arquivo} (${plural(linhas.length, "linha", "linhas")}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  /* ==========================================================================
     AS PÍLULAS DO RECORTE.
     --------------------------------------------------------------------------
     PÍLULA É PARA O RECORTE (que mês, que ano); o Segmented lá em cima é para a
     VISÃO (Dia, Mês, Ano, Comparar). Misturar os dois formatos faria a pessoa
     não saber mais o que muda o quê — e trocar de visão achando que trocou de
     mês é como se olha o número errado sem perceber.
     Os anos sobem da esquerda para a direita, como no painel da Impresilk: a
     linha do tempo se lê para a frente, e o ano corrente fica na ponta.
     ========================================================================== */
  const pilulasDeAno = useMemo(
    () => [...anosDisponiveis].sort((a, b) => a - b).map((a) => ({ valor: String(a), rotulo: String(a) })),
    [anosDisponiveis]
  );

  /* TROCAR O QUADRO PODE TIRAR DO AR A PESSOA ESCOLHIDA. Sair de "Todos" com
     uma desligada no filtro deixaria o seletor apontando para quem o novo
     quadro não mostra, e a tabela sairia vazia sem dizer por quê. Aqui a
     escolha volta para "todas", explicitamente — e o aviso conta o que houve,
     porque filtro que muda sozinho e calado é filtro em que não se confia. */
  const trocarQuadro = (valor) => {
    salvar({ quadro: valor });
    if (pessoaEscolhida && !cabeNoQuadro(pessoaEscolhida, valor)) {
      const nome = pessoaEscolhida.nome;
      setFiltroPessoa(TODAS);
      setAviso({
        tipo: "ok",
        texto: `${nome} não entra no recorte “${QUADROS.find((q) => q.valor === valor)?.rotulo}” — o filtro voltou para todas as pessoas.`,
      });
    }
  };

  /* A FICHA DO PAINEL SAI DA LISTA VIVA, e o estado só guarda o id: copiar a
     ficha para dentro do estado faria o painel continuar mostrando o cargo
     antigo depois de o servidor trazer o novo. Quem foi desligada continua
     achável — o relatório de março precisa de quem saiu em abril. */
  const pessoaDoDetalhe = useMemo(() => {
    if (!detalhe) return null;
    return (
      pessoasDoFiltro.find((p) => p.id === detalhe.pessoaId) ||
      indice.porPessoa.get(detalhe.pessoaId)?.pessoa ||
      null
    );
  }, [detalhe, pessoasDoFiltro, indice]);

  // ==========================================================================
  // TELA
  // ==========================================================================
  /* "NÃO HÁ NINGUÉM" É SÓ QUANDO NÃO HÁ MESMO. Depois do recorte, uma lista
     vazia pode ser escolha (nenhum desligado, ninguém que bata ponto) e não
     ausência de cadastro — e mandar cadastrar no RH quem já está cadastrado é
     mandar procurar defeito onde não tem. As duas frases são diferentes. */
  const semNinguemNaCasa = (pessoas || []).length === 0 && indice.porPessoa.size === 0;
  const semNinguem = pessoasDoFiltro.length === 0;

  return (
    <>
      <Card className="mb-4">
        {/* O TÍTULO E O SUB NA MESMA LINHA (o SectionTitle da casa os empilha).
            Duas linhas de cabeçalho antes do primeiro número, numa tela cuja
            queixa era "rolei tudo e não vi um dado", é uma linha a mais do que
            a tela pode pagar. O sub continua escrito — só menor e ao lado. */}
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <h2 className="font-display text-lg font-semibold text-slate-900">Relatórios do ponto</h2>
            <p className="min-w-0 text-xs text-slate-500">
              o mesmo dado das outras abas, somado por dia, mês, ano e entre períodos · esta aba não grava nada
            </p>
          </div>
          <div className="sem-impressao flex flex-wrap items-center gap-2">
            {/* O PDF É A IMPRESSÃO: no destino da impressão, "Salvar como PDF".
                Não há segunda geração de documento — se houvesse, a folha e a
                tela discordariam no dia em que uma das duas mudasse. */}
            <button
              type="button"
              className="btn-outline"
              onClick={() => window.print()}
              title="Imprime esta tela; no destino da impressão escolha Salvar como PDF"
            >
              <Printer size={16} strokeWidth={2.5} /> Baixar PDF
            </button>
            <button type="button" className="btn-outline" onClick={baixar}>
              <Download size={16} strokeWidth={2.5} /> Baixar planilha
            </button>
          </div>
        </div>

        <div className="sem-impressao mb-3 flex max-w-full flex-wrap items-center gap-3 overflow-x-auto pb-1">
          <Segmented opcoes={VISOES} valor={visao} onChange={setVisao} />
          {/* O QUADRO VALE PARA AS QUATRO VISÕES, e por isso ele fica aqui em
              cima, ao lado delas — e não escondido entre os campos de data de
              uma visão só. Sete pessoas no quadro contra treze desligadas: sem
              este botão, toda lista da tela sai com o triplo de linhas do que a
              pergunta pedia. */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Quadro</span>
            <Segmented opcoes={QUADROS} valor={quadro} onChange={(v) => trocarQuadro(v)} />
          </div>
        </div>

        {/* OS CONTROLES DO RECORTE. Todos em `sem-impressao`: no papel um
            seletor sairia como se fosse um rótulo afirmando um mês. Quem diz o
            recorte na folha é o bloco RecorteImpresso. */}
        <div className="sem-impressao space-y-3">
          {/* O MÊS E O ANO EM PÍLULAS — o recorte inteiro à vista, sem abrir
              lista nenhuma. Doze meses cabem numa fileira; os anos são os que
              têm dia importado (ou lançamento), nunca uma faixa inventada. */}
          {visao === "mes" && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="label mb-0 w-9 shrink-0">Mês</span>
                <Pilulas
                  opcoes={PILULAS_MES}
                  valor={competencia.split("-")[1] || ""}
                  aoEscolher={(v) => setCompetencia(`${competencia.split("-")[0]}-${v}`)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="label mb-0 w-9 shrink-0">Ano</span>
                <Pilulas
                  opcoes={pilulasDeAno}
                  valor={competencia.split("-")[0] || ""}
                  aoEscolher={(v) => setCompetencia(`${v}-${competencia.split("-")[1]}`)}
                />
              </div>
            </div>
          )}

          {visao === "ano" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="label mb-0 w-9 shrink-0">Ano</span>
              <Pilulas opcoes={pilulasDeAno} valor={ano} aoEscolher={(v) => setAno(String(v))} />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            {visao === "dia" && (
              <div>
                <label className="label" htmlFor="rel-dia">Dia</label>
                <input
                  id="rel-dia"
                  type="date"
                  className="input w-44"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
              </div>
            )}

            {/* O NÚMERO DA LISTA — e ele NÃO vira pílula. Pílula é o recorte
                (que mês, que ano); isto é a régua do número. Dois formatos para
                duas naturezas diferentes é o que deixa claro o que muda o quê. */}
            {visao === "mes" && (
              <div>
                <label className="label" htmlFor="rel-medida-mes">Número na tabela</label>
                <select
                  id="rel-medida-mes"
                  className="select w-56"
                  value={medidaMes}
                  onChange={(e) => salvar({ medidaMes: e.target.value })}
                >
                  {MEDIDAS.map((m) => (
                    <option key={m.chave} value={m.chave}>{m.rotulo}</option>
                  ))}
                </select>
              </div>
            )}

            {visao === "ano" && (
              <div>
                <label className="label" htmlFor="rel-medida-ano">Número na tabela</label>
                <select
                  id="rel-medida-ano"
                  className="select w-56"
                  value={medidaAno}
                  onChange={(e) => setMedidaAno(e.target.value)}
                >
                  {MEDIDAS.map((m) => (
                    <option key={m.chave} value={m.chave}>{m.rotulo}</option>
                  ))}
                </select>
              </div>
            )}

            {visao === "comparar" && (
              <>
              <div>
                <label className="label" htmlFor="rel-a-de">Período anterior — de</label>
                <input
                  id="rel-a-de"
                  type="date"
                  className="input w-44"
                  value={periodos.aDe}
                  onChange={(e) => setPeriodos((p) => ({ ...p, aDe: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-a-ate">até</label>
                <input
                  id="rel-a-ate"
                  type="date"
                  className="input w-44"
                  value={periodos.aAte}
                  onChange={(e) => setPeriodos((p) => ({ ...p, aAte: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-b-de">Período novo — de</label>
                <input
                  id="rel-b-de"
                  type="date"
                  className="input w-44"
                  value={periodos.bDe}
                  onChange={(e) => setPeriodos((p) => ({ ...p, bDe: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-b-ate">até</label>
                <input
                  id="rel-b-ate"
                  type="date"
                  className="input w-44"
                  value={periodos.bAte}
                  onChange={(e) => setPeriodos((p) => ({ ...p, bAte: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="rel-medida-comp">Número comparado</label>
                <select
                  id="rel-medida-comp"
                  className="select w-56"
                  value={medidaComp}
                  onChange={(e) => setMedidaComp(e.target.value)}
                >
                  {MEDIDAS.map((m) => (
                    <option key={m.chave} value={m.chave}>{m.rotulo}</option>
                  ))}
                </select>
              </div>
              </>
            )}

            <div className="ml-auto">
              <label className="label" htmlFor="rel-pessoa">Pessoa</label>
              <select
                id="rel-pessoa"
                className="select w-60"
                value={valorDoFiltroPessoa}
                onChange={(e) => setFiltroPessoa(e.target.value)}
              >
                {/* "Todas" é todas AS DESTE RECORTE, e a palavra diz qual: um
                    seletor escrito "todas as pessoas" sobre uma lista de sete
                    onde a casa tem vinte é uma promessa que a tabela não cumpre. */}
                <option value={TODAS}>Todas as pessoas ({pessoasDoFiltro.length})</option>
                {pessoasDoFiltro.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* A RÉGUA EM UMA LINHA (30/08/2026). Eram quatro linhas de texto —
            escala, tolerância da CLT em parágrafo e o carimbo do relógio por
            extenso — e elas ficavam entre os seletores e o primeiro cartão: o
            dono rolou a tela e não viu um dado sequer.

            O QUE FICA: os fatos curtos, que cabem numa linha, e TODO AVISO. Os
            chips (escala padrão, configuração que não carregou, turno não
            entendido, divisor que não bate) NÃO recolhem — aviso escondido é
            aviso apagado, e é ele que muda a leitura do número.

            O QUE RECOLHE: o texto que EXPLICA a régua, atrás de "entender os
            números". Ele não some do sistema — é o que evita alguém confundir
            este atraso com o desconto da folha —, só deixa de ocupar a primeira
            dobra. E no papel o RecorteImpresso o leva inteiro, sempre.

            O CARIMBO DO RELÓGIO APARECIA DUAS VEZES na mesma tela: aqui e na
            faixa "Puxar do relógio", logo acima. Ficou o de cima, que é onde a
            ação de importar mora; aqui sobrou a marca curta ("relógio hoje
            21:45"), porque um relatório também não pode calar de quando é. */}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Clock size={13} className="shrink-0 text-slate-400" />
          <span className="tnum">Jornada: {jornadaEmPalavras}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>tolerância da CLT aplicada</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          {/* SEM CARIMBO NÃO É "AGORA" nem é 0: a linha diz que não sabe. */}
          <span>
            {importadoCurto ? (
              <>
                relógio lido <strong className="tnum">{importadoCurto}</strong>
              </>
            ) : (
              <Nada>não sei quando o relógio foi lido</Nada>
            )}
          </span>
          {!cfg.jornadaDefinida && <span className="chip">escala padrão da casa</span>}
          {config === null && !cfgFalhou && <span className="chip">carregando a configuração — vale o padrão</span>}
          {cfgFalhou && <span className="chip-warn">não consegui ler a configuração — usando o padrão da casa</span>}
          {cfg.jornada.ignorados > 0 && (
            <span className="chip-warn">
              {plural(cfg.jornada.ignorados, "turno gravado não foi entendido", "turnos gravados não foram entendidos")}
            </span>
          )}
          {divisorDaJornada(cfg.jornada) !== cfg.divisor && (
            <span className="chip-warn">
              a escala sustenta o divisor {divisorDaJornada(cfg.jornada)}, e o configurado é {cfg.divisor}
            </span>
          )}
          <button
            type="button"
            onClick={() => salvar({ explicacao: !prefs.explicacao })}
            aria-expanded={prefs.explicacao}
            className="sem-impressao inline-flex shrink-0 items-center gap-1 font-medium text-brand underline-offset-2 hover:underline"
          >
            <ChevronDown size={13} strokeWidth={2.5} className={prefs.explicacao ? undefined : "-rotate-90"} />
            entender os números
          </button>
        </p>

        {prefs.explicacao && (
          <div className="sem-impressao mt-2 space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
            <p className="flex items-start gap-2">
              <Settings2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                Atraso já com a <strong>tolerância da CLT aplicada</strong> ({TOLERANCIA_MARCACAO_MIN} min por
                marcação, {TOLERANCIA_DIA_MIN} no dia, art. 58 § 1º): dentro do limite não conta nada; passando dele,
                conta o tempo inteiro. Este atraso mede a <strong>chegada</strong> contra a escala — não é o atraso que
                desconta na folha, que fica no Fechamento.
              </span>
            </p>
            {/* A CASCATA DO JIBBLE, escrita como ele a mostra (decisão 12).
                Ela mora aqui porque é a régua de TODA hora desta aba, não de
                uma visão só — e recolhida, porque quem já sabe não a lê todo
                dia. Recolher não é apagar: o RecorteImpresso a leva ao papel
                sem depender deste botão. */}
            <p className="flex items-start gap-2">
              <Clock size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                <strong>A folha já inclui as extras.</strong> O relógio entrega{" "}
                <em>horas registradas</em> − pausa não remunerada − deduções da escala ={" "}
                <strong>horas de folha</strong>, e a folha se abre em <strong>normais + extra 50% + extra 100%</strong>{" "}
                (no 28/08 da Ana: 8h00 + 1h15 = 9h15 de folha). Por isso quem se compara com o previsto da escala é{" "}
                <strong>horas normais</strong> — a folha traz o excedente dentro e faria a hora extra tapar o buraco da
                jornada.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <CalendarDays size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                O previsto de cada dia sai da escala acima; onde ela não prevê minuto nenhum o dia vem com o selo{" "}
                <span className="chip">sem jornada</span>, que é diferente de não ter trabalhado. A última importação
                do relógio, por extenso, fica na faixa “Puxar do relógio” no alto da tela — e sai impressa em toda
                folha que esta aba gera.
              </span>
            </p>
          </div>
        )}
      </Card>

      <RecorteImpresso
        titulo={tituloDoPapel}
        recorte={recorte}
        jornadaEmPalavras={jornadaEmPalavras}
        emitidoEm={hojeISO}
        importadoEm={importadoEm}
      />

      {semNinguem ? (
        <Card>
          <Empty>
            {semNinguemNaCasa ? (
              <>
                Não há ninguém no quadro nem dia importado. Cadastre as pessoas no RH e traga as batidas na aba
                “Pessoas do relógio”.
              </>
            ) : (
              <>
                Ninguém no recorte “{QUADROS.find((q) => q.valor === quadro)?.rotulo}” que bata ponto no relógio. As
                pessoas existem — troque o recorte aqui em cima, ou confira na ficha do RH quem está marcado como quem
                não bate ponto.
              </>
            )}
          </Empty>
        </Card>
      ) : (
        <>
          {/* ================================================================
              DIA
              ================================================================ */}
          {visao === "dia" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  rotulo="Presentes"
                  valor={`${vmDia.kpi.presentes}/${vmDia.kpi.total}`}
                  tom={vmDia.kpi.presentes > 0 ? "ok" : "neutral"}
                  sub={
                    vmDia.kpi.semRegistro > 0
                      ? `${plural(vmDia.kpi.semRegistro, "pessoa sem registro", "pessoas sem registro")}`
                      : "todo mundo com registro no dia"
                  }
                  icone={Users}
                />
                <StatCard
                  rotulo="Atrasados"
                  // Sem dia medido não há "0 atrasados": não houve o que medir.
                  valor={vmDia.kpi.presentes === 0 ? "—" : String(vmDia.kpi.atrasados)}
                  tom={vmDia.kpi.atrasados > 0 ? "bad" : "ok"}
                  sub={
                    vmDia.kpi.presentes === 0
                      ? "ninguém bateu entrada neste dia"
                      : `${vmDia.kpi.pontuais} no horário · tolerância aplicada`
                  }
                  icone={AlarmClock}
                />
                <StatCard
                  rotulo="Faltas"
                  valor={String(vmDia.kpi.faltas)}
                  tom={vmDia.kpi.faltas > 0 ? "bad" : "ok"}
                  sub={
                    vmDia.kpi.abonadas > 0
                      ? `${plural(vmDia.kpi.abonadas, "ausência justificada", "ausências justificadas")} (não descontam)`
                      : "só a falta injustificada desconta"
                  }
                  icone={CalendarOff}
                />
                <StatCard
                  rotulo="Em aberto"
                  valor={String(vmDia.kpi.emAberto)}
                  tom={vmDia.kpi.emAberto > 0 ? "warn" : "ok"}
                  sub={vmDia.kpi.emAberto > 0 ? "entrou e não saiu — dia sem total" : "nenhum dia pendente"}
                  icone={Clock}
                />
              </div>

              <Card>
                <SectionTitle
                  titulo={
                    ehData(dia)
                      ? `${dataLonga(dia)}${vmDia.semana === null ? "" : ` · ${NOMES_DIA_SEMANA[vmDia.semana]}`}`
                      : "Escolha um dia"
                  }
                  sub={
                    !ehData(dia)
                      ? "A data não foi entendida."
                      : /* 31/02 passa no formato e não existe no calendário: a
                           escala devolve null, e null aqui vira frase, nunca
                           "previsto null às null". */
                        vmDia.previsto === null
                        ? "Esta data não existe no calendário — escolha outro dia."
                        : vmDia.previsto === 0
                          ? "A escala da casa não prevê trabalho neste dia — nada aqui é atraso."
                          : `Previsto pela escala: ${vmDia.inicio} às ${vmDia.fim} (${duracaoTexto(vmDia.previsto)}). A lista vem ordenada por atraso: quem chegou depois aparece primeiro, e quem não tem registro fica no fim. Clique no nome para ver a pessoa por dentro.`
                  }
                />
                <Pendencias indice={indice} />
                {vmDia.linhas.length === 0 ? (
                  <Empty>
                    <ListaVazia quadro={quadro} pessoa={pessoaEscolhida} onde="neste dia" />
                  </Empty>
                ) : (
                  <div className="max-w-full overflow-x-auto">
                    <table className="w-full min-w-[1260px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="px-3 py-2">Pessoa</th>
                          {/* A COLUNA DA BARRA NÃO VAI PARA O PAPEL — `sem-impressao`
                              no cabeçalho E em cada célula, para a tabela impressa não
                              ficar com uma coluna a mais no corpo do que no topo. Em
                              cinza as três cores viram o mesmo traço, e traço que não
                              distingue nada ocupando coluna é pior que coluna nenhuma:
                              quem informa no papel são as colunas escritas. */}
                          <th
                            scope="col"
                            className="sem-impressao px-3 py-2"
                            title="A barra do dia: em cinza a janela prevista pela escala, em cor o que foi batido"
                          >
                            O dia
                          </th>
                          <th scope="col" className="px-3 py-2">Entrada</th>
                          <th scope="col" className="px-3 py-2">Saída</th>
                          <th scope="col" className="px-3 py-2" title="Intervalo não pago (o almoço)">Intervalo</th>
                          {/* A CASCATA EM QUATRO COLUNAS, e nesta ordem: as
                              parcelas primeiro, o TOTAL depois (decisão 12).
                              "Horas da folha" sozinha ao lado de "Extra +50%"
                              era o desenho que convidava a somar as duas. */}
                          <th scope="col" className="px-3 py-2" title={AJUDA_NORMAIS}>Normais</th>
                          <th scope="col" className="px-3 py-2">Extra +50%</th>
                          <th scope="col" className="px-3 py-2">Extra +100%</th>
                          <th scope="col" className="px-3 py-2" title={AJUDA_FOLHA}>
                            Folha <span className="normal-case tracking-normal">(normais + extras)</span>
                          </th>
                          <th scope="col" className="px-3 py-2" title="Chegada contra a escala, com a tolerância já aplicada">
                            Atraso
                          </th>
                          <th scope="col" className="px-3 py-2">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vmDia.linhas.map((l) => (
                          <tr key={l.pessoa.id} className="align-top">
                            <td className="px-3 py-2">
                              <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa} />
                            </td>
                            <td className="sem-impressao px-3 py-2">
                              <LinhaDoTempoDoDia
                                dia={l.d}
                                inicioPrevisto={vmDia.inicio}
                                fimPrevisto={vmDia.fim}
                                p={l.p}
                                emAberto={l.emAberto}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <EntradaComparada dia={l.d} p={l.p} />
                            </td>
                            <td className="px-3 py-2 tnum">
                              {l.d?.saida || (l.emAberto ? <Nada>não bateu a saída</Nada> : <Nada />)}
                            </td>
                            <td className="px-3 py-2 tnum">
                              {numOuNulo(l.d?.pausaMin) === null ? <Nada /> : duracaoTexto(l.d.pausaMin)}
                            </td>
                            {/* NORMAIS — a hora comum, e é ela que se compara
                                com o previsto do dia escrito no subtítulo da
                                seção. O selo `sem jornada` acompanha o número
                                (não o substitui) no dia que a escala não prevê:
                                ali a normal é 0h00 de direito, e a folha ao
                                lado é toda excedente. */}
                            <td className="px-3 py-2 tnum font-medium">
                              <span className="inline-flex flex-wrap items-center gap-1">
                                {l.composicao === null ? (
                                  <Nada>{l.emAberto ? "dia em aberto" : SEM}</Nada>
                                ) : (
                                  duracaoTexto(l.composicao.normaisMin)
                                )}
                                {vmDia.previsto === 0 && <SemJornada />}
                              </span>
                            </td>
                            {/* Sem dia nenhum é "sem registro"; dia que existe e
                                não tem a faixa apurada é "sem apuração" — a
                                palavra diz onde procurar. */}
                            <td className="px-3 py-2 tnum">
                              {l.composicao === null ? (
                                <Nada>{l.emAberto ? "dia em aberto" : SEM}</Nada>
                              ) : l.composicao.extraMin === null ? (
                                <Nada>{SEM_APURACAO}</Nada>
                              ) : (
                                duracaoTexto(l.composicao.extraMin)
                              )}
                            </td>
                            <td className="px-3 py-2 tnum">
                              {l.composicao === null ? (
                                <Nada>{l.emAberto ? "dia em aberto" : SEM}</Nada>
                              ) : l.composicao.extraDobroMin === null ? (
                                <Nada>{SEM_APURACAO}</Nada>
                              ) : (
                                duracaoTexto(l.composicao.extraDobroMin)
                              )}
                            </td>
                            {/* A FOLHA FECHA A CASCATA — total, não referência
                                de jornada. O title repete em voz alta o que o
                                cabeçalho diz, porque é aqui que o olho para. */}
                            <td className="px-3 py-2 tnum font-medium" title={AJUDA_FOLHA}>
                              {l.min === null ? <Nada>{l.emAberto ? "dia em aberto" : SEM}</Nada> : duracaoTexto(l.min)}
                            </td>
                            <td className="px-3 py-2">
                              {!l.p ? (
                                <Nada>{vmDia.previsto === 0 ? "fora da escala" : "sem entrada batida"}</Nada>
                              ) : l.p.pontual ? (
                                <span className="text-ok-700">
                                  no horário
                                  {l.p.atrasoBrutoMin > 0 && (
                                    <span className="block text-xs text-slate-500">
                                      {duracaoTexto(l.p.atrasoBrutoMin)} dentro da tolerância
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-bad-700">
                                  <span className="tnum font-semibold">{duracaoTexto(l.p.atrasoMin)}</span>
                                  {/* SÓ O QUE ENCURTOU O DIA é dito. Quem chegou
                                      ANTES tem atraso de entrada negativo, e
                                      escrever "entrou −0h20 depois das 08:00"
                                      transformaria em acusação o dia de quem
                                      madrugou. */}
                                  <span className="block text-xs text-slate-500 tnum">
                                    {[
                                      l.p.atrasoEntradaMin > 0
                                        ? `entrou ${duracaoTexto(l.p.atrasoEntradaMin)} depois das ${l.p.inicioPrevisto}`
                                        : "",
                                      l.p.saidaAntesMin > 0
                                        ? `saiu ${duracaoTexto(l.p.saidaAntesMin)} antes das ${l.p.fimPrevisto}`
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={l.chipSituacao}>{l.situacao}</span>
                              {l.ausencia?.motivo && (
                                <span className="block text-xs text-slate-500">{l.ausencia.motivo}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ForaDoRelatorio quadro={quadro} foraDoQuadro={vmDia.foraDoQuadro} semPonto={vmDia.semPonto} />
              </Card>
            </>
          )}

          {/* ================================================================
              MÊS
              ================================================================ */}
          {visao === "mes" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {/* O CARTÃO QUE MUDOU DE NÚMERO (decisão 12). Ele mostrava a
                    FOLHA com o previsto embaixo, e esse par não se compara: a
                    folha tem a extra dentro, e a extra tapava justamente o
                    déficit que o previsto deveria denunciar (a VICTORIA de
                    janeiro: 163h normais contra 193h previstas, lidas como
                    177h30). Agora o número forte é a HORA COMUM, o previsto
                    continua embaixo — agora comparável — e a folha vai ao lado,
                    dita como total. */}
                <StatCard
                  rotulo="Horas normais"
                  valor={horasOuNada(vmMes.totais.porColuna.normais)}
                  tom="brand"
                  sub={`previsto na escala: ${horasOuNada(vmMes.previstoMin)} por pessoa · folha (com extras): ${horasOuNada(
                    vmMes.totais.porColuna.horas
                  )}`}
                  icone={Clock}
                />
                <StatCard
                  rotulo="Horas extras"
                  valor={horasOuSemApuracao(somaOuNulo([vmMes.totais.porColuna.extra, vmMes.totais.porColuna.extraDobro]))}
                  tom="neutral"
                  sub={`+50%: ${horasOuSemApuracao(vmMes.totais.porColuna.extra)} · +100%: ${horasOuSemApuracao(
                    vmMes.totais.porColuna.extraDobro
                  )} · já contadas dentro da folha`}
                  icone={AlarmClock}
                />
                <StatCard
                  rotulo="Faltas que descontam"
                  valor={vmMes.totais.porColuna.faltas === null ? SEM : String(vmMes.totais.porColuna.faltas)}
                  tom={
                    vmMes.totais.porColuna.faltas === null ? "neutral" : vmMes.totais.porColuna.faltas > 0 ? "bad" : "ok"
                  }
                  sub={
                    vmMes.totais.porColuna.abonadas === null
                      ? "ninguém com dia apurado neste mês"
                      : vmMes.totais.porColuna.abonadas > 0
                        ? `${plural(vmMes.totais.porColuna.abonadas, "ausência justificada", "ausências justificadas")}`
                        : "nenhuma ausência justificada lançada"
                  }
                  icone={CalendarOff}
                />
                <StatCard
                  rotulo="Pontualidade média"
                  // NUNCA 0%: sem dia medido é "sem registro", que é o oposto de
                  // "nunca chega no horário".
                  valor={
                    vmMes.totais.porColuna.pontualidade === null
                      ? SEM
                      : `${Math.round(vmMes.totais.porColuna.pontualidade)}%`
                  }
                  tom={
                    vmMes.totais.porColuna.pontualidade === null
                      ? "neutral"
                      : vmMes.totais.porColuna.pontualidade >= 90
                        ? "ok"
                        : vmMes.totais.porColuna.pontualidade >= 70
                          ? "warn"
                          : "bad"
                  }
                  sub={
                    vmMes.totais.diasMedidos === 0
                      ? "nenhum dia medido neste mês"
                      : `${vmMes.totais.diasPontuais} de ${vmMes.totais.diasMedidos} dias medidos`
                  }
                  icone={Percent}
                />
              </div>

              {/* A CASCATA ESCRITA, embaixo dos cartões que ela explica. Não
                  recolhe e não é `Explicacao`: é a régua dos dois primeiros
                  cartões, e sem ela o par "normais / horas extras" volta a ser
                  somado por quem lê depressa. */}
              <p className="mb-4 text-xs text-slate-500">
                <strong>Horas normais</strong> é a hora comum, e é ela que se compara com o previsto da escala.{" "}
                <strong>Horas da folha</strong> (o <em>payrollHours</em> do relógio) é o total do pagamento e{" "}
                <strong>já inclui as extras</strong> — folha = normais + 50% + 100%. Somar a folha com as extras ao lado
                pagaria a mesma hora duas vezes.{" "}
                {/* O PREVISTO SAI POR PESSOA, NUNCA MULTIPLICADO PELO GRUPO.
                    Quem foi admitido no dia 12, quem saiu no dia 20 e quem
                    esteve de férias não devem o mês inteiro — um "previsto do
                    grupo" seria um denominador inventado, e o número que ele
                    produziria (um déficit coletivo) é exatamente o tipo de
                    total que ninguém consegue conferir. A comparação honesta é
                    linha a linha, no painel de cada pessoa. */}
                O previsto é <strong>por pessoa</strong> ({horasOuNada(vmMes.previstoMin)} neste mês): quem entrou,
                saiu ou esteve de férias no meio do mês não deve o mês inteiro, então a comparação se faz pessoa a
                pessoa — toque num nome para ver a dela.
              </p>

              {/* A SEÇÃO RECOLHÍVEL, no padrão do print: título grande, e
                  embaixo o TAMANHO DO RECORTE — porque a primeira dúvida diante
                  de um ranking é "isso aqui é tudo?". Aberta ou fechada fica
                  guardada no aparelho. */}
              <Secao
                titulo={`Mês de ${rotuloCompetencia(competencia)}`}
                sub={tamanhoDoRecorte(vmMes.linhas.length, quadro, "neste mês", pessoaEscolhida)}
                aberta={prefs.rankMes}
                aoAlternar={() => salvar({ rankMes: !prefs.rankMes })}
              >
                <Explicacao>
                  Os números vêm <strong>direto do relógio Jibble</strong>, já apurados pela escala da casa (atraso com
                  a tolerância da CLT aplicada). O valor da direita e a barra medem sempre{" "}
                  <strong>{rankingMes.medida.rotulo.toLowerCase()}</strong>
                  {rankingMes.medida.unidade === "pct"
                    ? " numa régua fixa de 0 a 100%"
                    : " em proporção a quem tem mais no mês"}
                  ; em cinza, os dias com batida e os dias com atraso na chegada.{" "}
                  <strong>Toque numa pessoa para ver o dia a dia dela.</strong>
                </Explicacao>
                <Pendencias indice={indice} />
                {vmMes.totais.emAberto > 0 && (
                  <p className="text-xs text-slate-500">
                    <span className="chip-warn">
                      {plural(vmMes.totais.emAberto, "dia em aberto", "dias em aberto")}
                    </span>{" "}
                    ficam fora de toda soma — dia que não terminou não tem total.
                    {vmMes.totais.estranhas > 0 &&
                      ` E há ${plural(vmMes.totais.estranhas, "ausência de tipo desconhecido", "ausências de tipo desconhecido")}: confira na aba Faltas.`}
                  </p>
                )}
                {vmMes.linhas.length === 0 ? (
                  <Empty>
                    <ListaVazia quadro={quadro} pessoa={pessoaEscolhida} onde="neste mês" />
                  </Empty>
                ) : (
                  <div>
                    {/* A LINHA INTEIRA É A PORTA — não só o nome. O mês não tem
                        um dia para onde levar (ele tem trinta), então ela abre o
                        painel da pessoa, onde o dia a dia está listado e cada
                        dia leva à visão Dia. */}
                    <RankingDoPonto
                      itens={rankingMes.itens}
                      medida={rankingMes.medida}
                      abertaId={detalhe?.pessoaId}
                      aoAbrir={abrirPessoa}
                      total={rankingMes.total}
                    />
                    <RodapeDaLista
                      semRegistro={rankingMes.semRegistro}
                      semApuracao={rankingMes.semApuracao}
                      onde="neste mês"
                    />
                    <Fechamentos linhas={vmMes.linhas} />
                  </div>
                )}
                <ForaDoRelatorio quadro={quadro} foraDoQuadro={vmMes.foraDoQuadro} semPonto={vmMes.semPonto} />
              </Secao>
            </>
          )}

          {/* ================================================================
              ANO
              ================================================================ */}
          {visao === "ano" && (
            <>
            {/* PRIMEIRO QUEM, DEPOIS COMO FOI O ANO. A lista responde "quem
                trabalhou mais no ano" numa olhada; a matriz de doze colunas,
                logo abaixo, é a TENDÊNCIA — e ali a lista não serve, porque
                doze números por pessoa não cabem numa linha. */}
            <Secao
              titulo={`Ano de ${ano} — ${vmAno.medida.rotulo.toLowerCase()}`}
              sub={tamanhoDoRecorte(vmAno.linhas.length, quadro, "neste ano", pessoaEscolhida)}
              aberta={prefs.rankAno}
              aoAlternar={() => salvar({ rankAno: !prefs.rankAno })}
            >
              <Explicacao>
                O mesmo dado do <strong>relógio Jibble</strong>, já apurado pela escala da casa, somado o ano inteiro —
                pontualidade não soma: é a razão dos dias juntados.{" "}
                <strong>Toque numa pessoa para ver o dia a dia dela.</strong> A tendência mês a mês está na tabela logo
                abaixo.
              </Explicacao>
              {vmAno.linhas.length === 0 ? (
                <Empty>
                  <ListaVazia quadro={quadro} pessoa={pessoaEscolhida} onde="neste ano" />
                </Empty>
              ) : (
                <div>
                  <RankingDoPonto
                    itens={rankingAno.itens}
                    medida={rankingAno.medida}
                    abertaId={detalhe?.pessoaId}
                    aoAbrir={abrirPessoa}
                    total={rankingAno.total}
                  />
                  <RodapeDaLista
                    semRegistro={rankingAno.semRegistro}
                    semApuracao={rankingAno.semApuracao}
                    onde="neste ano"
                  />
                </div>
              )}
            </Secao>

            <Card className="mt-4">
              <SectionTitle
                titulo={`Mês a mês — ${ano}`}
                sub={`${vmAno.medida.ajuda} Esta tabela é a TENDÊNCIA: uma coluna por mês, com o nome e o total presos nas pontas. A planilha sai sempre com os doze meses.`}
              />
              <Pendencias indice={indice} />
              <p className="mb-3 text-xs text-slate-500">
                Célula com <Nada>—</Nada> é <strong>sem registro</strong>, e não zero: naquele mês não houve o que
                medir (ninguém tinha entrado na casa, ou o relógio não trouxe o dia).
                {vmAno.medida.chave === "pontualidade" &&
                  " A linha de total é a razão dos dias juntados (pontuais ÷ medidos), nunca a média das porcentagens — quem trabalhou 2 dias não pode pesar como quem trabalhou 22."}
              </p>

              {/* OS MESES VAZIOS FICAM RECOLHIDOS, E A FRASE VAI PARA O PAPEL.
                  O botão some na impressão (`.btn-ghost`), a frase não: folha
                  com sete colunas de mês precisa dizer que as outras cinco
                  existem e estão vazias, senão o ano lido no papel é outro. */}
              {vmAno.vazios > 0 && vmAno.mesesComRegistro.length > 0 && (
                <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    {mesesTodos
                      ? `Os 12 meses estão à mostra — ${plural(vmAno.vazios, "mês não tem", "meses não têm")} nenhum registro neste recorte.`
                      : `${plural(vmAno.vazios, "mês sem nenhum registro está recolhido", "meses sem nenhum registro estão recolhidos")} — mês vazio não soma nada, então nenhum total muda por isso.`}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => salvar({ mesesTodos: !mesesTodos })}
                  >
                    {mesesTodos ? "esconder os meses sem registro" : "mostrar os 12 meses"}
                  </button>
                </p>
              )}

              {vmAno.linhas.length === 0 ? (
                <Empty>
                  <ListaVazia quadro={quadro} pessoa={pessoaEscolhida} onde="neste ano" />
                </Empty>
              ) : (
                <div className="max-w-full overflow-x-auto">
                  {/* AS DUAS PONTAS FICAM PRESAS (`sticky`): o nome à esquerda e
                      o TOTAL à direita. Na folha que o dono mandou, o total —
                      justamente o número que resume a linha — aparecia cortado
                      na borda, e rolar para o lado para vê-lo fazia o nome
                      sumir do outro lado. Impresso não há rolagem, e sticky no
                      papel só atrapalha: `print:static` devolve a coluna ao
                      lugar dela. */}
                  <table className="w-full text-left text-sm" style={{ minWidth: `${larguraDaTabelaDoAno}px` }}>
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th
                          scope="col"
                          className="sticky left-0 z-20 bg-slate-50 px-3 py-2 print:static"
                          style={FIO_DIREITA}
                        >
                          Pessoa
                        </th>
                        {mesesVisiveis.map((i) => (
                          <th
                            key={vmAno.meses[i]}
                            scope="col"
                            className={clsx("py-2 text-right", mesEstreito ? "px-1.5" : "px-3")}
                            title={`${MESES_LONGOS[i]} de ${ano}`}
                          >
                            {MESES[i]}
                          </th>
                        ))}
                        <th
                          scope="col"
                          className="sticky right-0 z-20 bg-slate-50 px-3 py-2 text-right print:static"
                          style={FIO_ESQUERDA}
                        >
                          {vmAno.medida.chave === "pontualidade" ? "Ano" : "Total"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vmAno.linhas.map((l) => (
                        <tr key={l.pessoa.id}>
                          <td className="sticky left-0 z-10 bg-white px-3 py-2 print:static" style={FIO_DIREITA}>
                            <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa}>
                              {/* Ela bate ponto e não tem um dia no ano: a linha
                                  já está no FIM da lista, e aqui diz por quê. */}
                              {l.diasNoAno === 0 && (
                                <span className="block text-xs font-normal text-slate-400">{SEM_PERIODO}</span>
                              )}
                            </NomeDaPessoa>
                          </td>
                          {/* CLICAR EM MARÇO ABRE MARÇO. A célula do mês leva à visão
                              Mês já no mês clicado e já com esta pessoa no filtro —
                              sem isso, para ver março a pessoa troca de visão e
                              reencontra o recorte na mão. Célula vazia também abre: o
                              mês sem registro é justamente o que se quer conferir. */}
                          {mesesVisiveis.map((i) => {
                            const v = l.valores[i];
                            return (
                              <td
                                key={vmAno.meses[i]}
                                className={clsx("py-2 text-right tnum", mesEstreito ? "px-1.5" : "px-3")}
                              >
                                <button
                                  type="button"
                                  onClick={() => irParaMes(vmAno.meses[i], l.pessoa)}
                                  className="w-full text-right underline-offset-2 hover:text-brand-700 hover:underline"
                                  title={
                                    v === null || v === undefined
                                      ? `${MESES_LONGOS[i]}: sem registro — abrir o mês de ${primeiroNome(l.nome)}`
                                      : `${MESES_LONGOS[i]}: ${textoDaMedida(v, vmAno.medida.unidade)} — abrir o mês de ${primeiroNome(l.nome)}`
                                  }
                                >
                                  {v === null || v === undefined ? <Nada>—</Nada> : textoDaMedida(v, vmAno.medida.unidade)}
                                </button>
                              </td>
                            );
                          })}
                          <td
                            className="sticky right-0 z-10 bg-white px-3 py-2 text-right tnum font-semibold print:static"
                            style={FIO_ESQUERDA}
                          >
                            {l.total === null ? <Nada>—</Nada> : textoDaMedida(l.total, vmAno.medida.unidade)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-display text-sm font-semibold">
                      <tr>
                        <td className="sticky left-0 z-20 bg-slate-50 px-3 py-2 print:static" style={FIO_DIREITA}>
                          {vmAno.medida.chave === "pontualidade" ? "Da casa" : "Total do mês"}
                        </td>
                        {mesesVisiveis.map((i) => {
                          const v = vmAno.totalPorMes[i];
                          return (
                            <td
                              key={vmAno.meses[i]}
                              className={clsx("py-2 text-right tnum", mesEstreito ? "px-1.5" : "px-3")}
                            >
                              {/* O rodapé é o total da casa: abre o mês SEM mexer no
                                  filtro de pessoa, que é o recorte que ele soma. */}
                              <button
                                type="button"
                                onClick={() => irParaMes(vmAno.meses[i], null)}
                                className="w-full text-right underline-offset-2 hover:text-brand-700 hover:underline"
                                title={`abrir ${MESES_LONGOS[i]} de ${ano}`}
                              >
                                {v === null ? <Nada>—</Nada> : textoDaMedida(v, vmAno.medida.unidade)}
                              </button>
                            </td>
                          );
                        })}
                        {/* O TOTAL DO ANO É DO ANO INTEIRO, com meses recolhidos
                            ou não: mês vazio não entra em soma nem em razão. */}
                        <td
                          className="sticky right-0 z-20 bg-slate-50 px-3 py-2 text-right tnum print:static"
                          style={FIO_ESQUERDA}
                        >
                          {vmAno.totalGeral === null ? <Nada>—</Nada> : textoDaMedida(vmAno.totalGeral, vmAno.medida.unidade)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <ForaDoRelatorio quadro={quadro} foraDoQuadro={vmAno.foraDoQuadro} semPonto={vmAno.semPonto} />
            </Card>
            </>
          )}

          {/* ================================================================
              COMPARAR
              ================================================================ */}
          {visao === "comparar" && (
            <Card>
              <SectionTitle
                titulo={`Comparação — ${vmComp.medida.rotulo}`}
                sub={vmComp.medida.ajuda}
              />
              {!vmComp.valido ? (
                <Empty>
                  Período inválido: {vmComp.erroA ? `período anterior com ${vmComp.erroA}` : ""}
                  {vmComp.erroA && vmComp.erroB ? " e " : ""}
                  {vmComp.erroB ? `período novo com ${vmComp.erroB}` : ""}. Corrija as datas para a tela poder comparar.
                </Empty>
              ) : (
                <>
                  <Pendencias indice={indice} />
                  <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <CalendarDays size={13} className="text-slate-400" />
                    <span className="tnum">
                      Anterior: {dataLonga(periodos.aDe)} a {dataLonga(periodos.aAte)} ({vmComp.corridosA} dias corridos,{" "}
                      {vmComp.escalaA === null ? "período longo demais para contar os dias de escala" : `${vmComp.escalaA} de escala`})
                    </span>
                    <span className="tnum">
                      · Novo: {dataLonga(periodos.bDe)} a {dataLonga(periodos.bAte)} ({vmComp.corridosB} dias corridos,{" "}
                      {vmComp.escalaB === null ? "período longo demais para contar os dias de escala" : `${vmComp.escalaB} de escala`})
                    </span>
                    {vmComp.tamanhosDiferentes && (
                      <span className="chip-warn">
                        os períodos têm tamanhos diferentes ({vmComp.escalaA ?? "?"} × {vmComp.escalaB ?? "?"} dias de
                        escala) — o total não se compara; olhe a coluna “por dia”
                      </span>
                    )}
                  </p>
                  {vmComp.linhas.length === 0 ? (
                    <Empty>
                      <ListaVazia quadro={quadro} pessoa={pessoaEscolhida} onde="nos dois períodos" />
                    </Empty>
                  ) : (
                    <div className="max-w-full overflow-x-auto">
                      <table className="w-full min-w-[1040px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="px-3 py-2">Pessoa</th>
                            <th scope="col" className="px-3 py-2 text-right">Anterior</th>
                            <th scope="col" className="px-3 py-2 text-right" title="Total ÷ dias que a escala prevê no período">
                              por dia
                            </th>
                            <th scope="col" className="px-3 py-2 text-right">Novo</th>
                            <th scope="col" className="px-3 py-2 text-right" title="Total ÷ dias que a escala prevê no período">
                              por dia
                            </th>
                            <th scope="col" className="px-3 py-2">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {vmComp.linhas.map((l) => {
                            // A MÉDIA DIÁRIA não existe para porcentagem: 92% ÷
                            // 21 dias não é número nenhum. A coluna escreve "—"
                            // em vez de inventar uma divisão.
                            const porDia = (v, dias) =>
                              vmComp.medida.somavel === false ? null : textoPorDia(v, dias, vmComp.medida.unidade);
                            const pdA = porDia(l.valorA, vmComp.escalaA);
                            const pdB = porDia(l.valorB, vmComp.escalaB);
                            return (
                              <tr key={l.pessoa.id} className="align-top">
                                <td className="px-3 py-2">
                                  <NomeDaPessoa pessoa={l.pessoa} aoAbrir={abrirPessoa}>
                                    {l.semNenhumDia && (
                                      <span className="block text-xs font-normal text-slate-400">{SEM_PERIODO}</span>
                                    )}
                                  </NomeDaPessoa>
                                </td>
                                <td className="px-3 py-2 text-right tnum">
                                  {l.valorA === null ? <Nada /> : textoDaMedida(l.valorA, vmComp.medida.unidade)}
                                </td>
                                <td className="px-3 py-2 text-right tnum text-slate-500">
                                  {pdA === null ? <Nada>—</Nada> : pdA}
                                </td>
                                <td className="px-3 py-2 text-right tnum">
                                  {l.valorB === null ? <Nada /> : textoDaMedida(l.valorB, vmComp.medida.unidade)}
                                </td>
                                <td className="px-3 py-2 text-right tnum text-slate-500">
                                  {pdB === null ? <Nada>—</Nada> : pdB}
                                </td>
                                <td className="px-3 py-2">
                                  <Variacao medida={vmComp.medida} valorA={l.valorA} valorB={l.valorB} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-display text-sm font-semibold">
                          <tr>
                            <td className="px-3 py-2">Total ({plural(vmComp.linhas.length, "pessoa", "pessoas")})</td>
                            <td className="px-3 py-2 text-right tnum">
                              {vmComp.totalA === null ? <Nada /> : textoDaMedida(vmComp.totalA, vmComp.medida.unidade)}
                            </td>
                            <td className="px-3 py-2 text-right tnum text-slate-500">
                              {vmComp.medida.somavel === false ? (
                                <Nada>—</Nada>
                              ) : (
                                textoPorDia(vmComp.totalA, vmComp.escalaA, vmComp.medida.unidade) || <Nada>—</Nada>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tnum">
                              {vmComp.totalB === null ? <Nada /> : textoDaMedida(vmComp.totalB, vmComp.medida.unidade)}
                            </td>
                            <td className="px-3 py-2 text-right tnum text-slate-500">
                              {vmComp.medida.somavel === false ? (
                                <Nada>—</Nada>
                              ) : (
                                textoPorDia(vmComp.totalB, vmComp.escalaB, vmComp.medida.unidade) || <Nada>—</Nada>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Variacao medida={vmComp.medida} valorA={vmComp.totalA} valorB={vmComp.totalB} />
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  <ForaDoRelatorio quadro={quadro} foraDoQuadro={vmComp.foraDoQuadro} semPonto={vmComp.semPonto} />
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* A ASSINATURA DO SISTEMA, como no painel que o dono mandou. Ela diz o
          que esta tela é E O QUE ELA NÃO É: a aba não grava nada, e quem lê um
          número aqui precisa saber onde ele se conserta. Fica fora do papel
          (`sem-impressao`) porque a folha já sai assinada em cima, pelo bloco
          RecorteImpresso — e uma assinatura repetida é uma a menos que se lê. */}
      <p className="sem-impressao mt-6 text-center text-xs text-slate-400">
        Painel MinasLab · Ponto → Relatórios · dado do relógio Jibble, apurado pela escala da casa · esta aba só lê:
        quem lança e corrige é a aba Ponto do RH
      </p>

      {/* O PAINEL DA PESSOA — fora da folha impressa (`sem-impressao`): a
          janela cobre a tela inteira, e um relatório impresso com ela aberta
          sairia com o detalhe de uma pessoa por cima da tabela de todas. */}
      {pessoaDoDetalhe && detalhe && (
        <div className="sem-impressao">
          <PessoaDetalhe
            pessoa={pessoaDoDetalhe}
            diaFoco={detalhe.dia}
            grupo={indice.porPessoa.get(pessoaDoDetalhe.id) || null}
            jornada={cfg.jornada}
            aoFechar={() => setDetalhe(null)}
            aoEscolherDia={(d) => setDetalhe((v) => (v ? { ...v, dia: d } : v))}
            aoVerNoDia={irParaDia}
            aoVerNoMes={(c) => irParaMes(c, pessoaDoDetalhe)}
          />
        </div>
      )}
    </>
  );
}
