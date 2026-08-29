// PONTO → FALTAS. O lugar onde a ausência é LANÇADA, e o único lugar em que
// uma falta passa a existir.
//
// Pedido do Leonardo (28/08/2026): "quando falta eu posso colocar falta ou
// então justificada por atestado ou outra coisa". A tela é um CALENDÁRIO do
// mês — uma linha por pessoa, uma coluna por dia — e cada quadradinho abre o
// lançamento daquele dia para aquela pessoa.
//
// ============================================================================
// AS TRÊS COISAS QUE ESTA TELA NÃO FAZ
//
// 1. NÃO DEDUZ FALTA. Dia sem batida e sem ausência lançada aparece escrito
//    "sem registro", e nunca como falta. A MinasLab acabou de ligar o relógio:
//    dia que não veio pode ser esquecimento de bater, relógio fora do ar,
//    trabalho externo — deduzir falta daí seria inventar desconto na folha de
//    quem estava trabalhando. Quem afirma falta é o RH, aqui, no clique.
//
// 2. NÃO ESCREVE A PRÓPRIA LISTA DE TIPOS. Os tipos, o rótulo, a cor e o efeito
//    no dinheiro vêm de TIPOS_AUSENCIA (lib/rh/ponto.js), e as contagens vêm de
//    apurarCompetencia. Lista copiada envelhece calada: bastava o motor ganhar
//    um sexto tipo para esta tela deixar de mostrá-lo, sem erro nenhum.
//    Até as LETRAS da grade saem dos tipos do motor (ver LETRA_POR_TIPO).
//
// 3. NÃO FECHA A FOLHA. O desconto que aparece no resumo é SUGESTÃO — a mesma
//    conta do motor (1/30 do salário por dia de falta), arredondada a cada
//    passo em centavos, para a conta que a tela mostra ser a conta que o
//    sistema faz. Quem lança de fato é a aba Fechamento, em "rh_ponto".
//
// ----------------------------------------------------------------------------
// O QUE SE GRAVA, E ONDE. A ausência mora no DIA, na coleção "rh_ponto_dia",
// no campo `ausencia: { tipo, motivo, documento }`, com `corrigido: true` —
// esse carimbo é o que impede a importação seguinte do Jibble de apagar em
// silêncio o que o RH lançou. Dia que nasce aqui (o comum: o relógio não grava
// dia sem movimento) leva `origem: "manual"`.
//
// AUSÊNCIA NÃO APAGA BATIDA. Quando o dia já tem batida — atestado da tarde, o
// caso real — a tela avisa antes, exige confirmação e grava POR CIMA DO
// REGISTRO INTEIRO (`...base`): entrada, saída, pausa, trabalhado, tracked e a
// apuração do relógio continuam exatamente onde estavam. A ausência acrescenta
// uma EXPLICAÇÃO, não é um apagador — e o motor conta esse dia à parte
// (`ausenciasComTrabalho`), porque descontar 1/30 de um dia parcialmente
// trabalhado seria cobrar duas vezes.
//
// POR QUE NÃO CARIMBO `relogioEntrada`/`relogioSaida` AQUI: esse carimbo é o
// sinal de "alguém corrigiu a batida", e é ele que o removedor de ausência lê
// para decidir se o dia volta a ser do relógio (ver `removerAusencia`, aqui e
// em components/rh/AbaPonto.jsx). Carimbá-lo num lançamento que não encostou na
// batida congelaria o dia contra toda importação futura por causa de um
// lançamento que depois deixou de existir — congelado em silêncio, que é o pior
// jeito de congelar. O dado do relógio já está preservado: são os campos dele
// mesmo, intactos.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/Ponto.jsx)
// ----------------------------------------------------------------------------
//   pessoas    Object[]  todas as fichas (rh_pessoas), ativas e desligadas.
//   ativos     Object[]  só o quadro, JÁ ordenado por nome.
//   pontoDia   Object[]  "rh_ponto_dia" INTEIRA; o recorte do mês é desta aba.
//   hojeISO    string    "AAAA-MM-DD" LOCAL (ymdLocal).
//   editavel   boolean   podeEditar(getSessao()).
//   salvando   boolean   true enquanto uma gravação da casca está em voo.
//   gravar     (colecao, registro, fraseOk, fechar?) => Promise<void>
//   apagarReg  (colecao, id, fraseOk) => Promise<void>
//   setAviso   (aviso|null) => void   { tipo: "ok" | "erro", texto }
//   recarregar () => void
//
// A COMPETÊNCIA é estado desta aba (a casca não guarda o mês), começando em
// competenciaDe(hojeISO).

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { CalendarOff, CircleAlert, Clock, Download, Search, Trash2 } from "lucide-react";
import { lerCfg } from "../../services/dados.js";
import { dataLonga, moedaCheia, MESES_LONGOS } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import {
  apurarCompetencia, ausenciaDoDia, calcularFechamento, cfgDoPonto, competenciaDe,
  descreverJornada, diaDaSemanaISO, diasDoMes, duracaoTexto, horasDecimais,
  minutosPrevistosDoDia, minutosTrabalhados, NOMES_DIA_SEMANA, TIPOS_AUSENCIA,
} from "../../lib/rh/ponto.js";
import { Card, SectionTitle, Empty, Modal } from "../ui.jsx";
import PessoaDetalhe from "./PessoaDetalhe.jsx";
import { anoRuim } from "../rh/uteis.js";

const COL_DIA = "rh_ponto_dia";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * "2 faltas justificadas", "1 férias", "3 atestados".
 *
 * O rótulo curto vem do MOTOR, e pode ganhar palavra nova a qualquer momento —
 * por isso a flexão é uma regra, não um par de textos escrito à mão. Grudar um
 * "s" no fim do rótulo inteiro daria "fériass" e "falta justificadas", e texto
 * torto na tela do RH tira a credibilidade do número que está ao lado.
 */
function pluralDoTipo(n, curto) {
  if (n === 1) return `1 ${curto}`;
  const flexionado = String(curto)
    .split(" ")
    .map((w) => {
      if (/s$/i.test(w)) return w; // "férias" já é plural
      if (/[rzn]$/i.test(w)) return `${w}es`;
      return `${w}s`;
    })
    .join(" ");
  return `${n} ${flexionado}`;
}
const txt = (v) => String(v ?? "").trim();
const norm = (s) => String(s || "").toLowerCase();

function rotuloCompetencia(c) {
  const [ano, mes] = String(c || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(c || "");
}

/**
 * A LETRA de cada tipo na grade, DERIVADA dos tipos do motor.
 *
 * Um mapa escrito à mão ("falta" → "F", "atestado" → "A"…) ficaria mudo no dia
 * em que o motor ganhasse um sexto tipo: a coluna mostraria um quadrado sem
 * letra e ninguém saberia o que foi lançado ali. Aqui a letra sai do próprio
 * nome do tipo, e o empate ganha uma letra a mais — com os cinco de hoje dá
 * F (falta), A (atestado), J (justificada), FE (férias) e FO (folga).
 */
function letrasDosTipos(tipos) {
  const usadas = new Set();
  const mapa = new Map();
  for (const t of tipos) {
    const base = String(t.tipo || "?").toUpperCase();
    let letra = base.slice(0, 1) || "?";
    let n = 1;
    while (usadas.has(letra) && n < base.length) {
      n += 1;
      letra = base.slice(0, n);
    }
    if (usadas.has(letra)) letra = base; // dois tipos de mesmo nome: cai no nome inteiro
    usadas.add(letra);
    mapa.set(t.tipo, letra);
  }
  return mapa;
}

const LETRA_POR_TIPO = letrasDosTipos(TIPOS_AUSENCIA);
/** Tipo que ESTA versão não conhece não some da grade: aparece como "?" em tom de aviso. */
const letraDaAusencia = (a) => (a?.conhecido ? LETRA_POR_TIPO.get(a.tipo) || "?" : "?");

/* A cor da célula sai do `chip` que o motor já decidiu para cada tipo — assim
   a grade, a lista e a planilha dizem a mesma coisa sobre o mesmo dia. Só a
   falta (chip-bad) fica vermelha, porque só ela custa dinheiro; cor demais faz
   o RH parar de olhar justamente para a que importa.
   As classes vão ESCRITAS POR INTEIRO: o Tailwind varre o texto do arquivo e
   descarta sem erro a classe que só existe montada em tempo de execução. */
const CELULA_POR_CHIP = {
  "chip-bad": "border-bad-200 bg-bad-50 text-bad-700",
  "chip-warn": "border-warn-200 bg-warn-50 text-warn-700",
  "chip-ok": "border-ok-200 bg-ok-50 text-ok-700",
  "chip-brand": "border-brand-200 bg-brand-50 text-brand-700",
  chip: "border-slate-200 bg-slate-100 text-slate-700",
};

/**
 * Qual registro VALE quando o mesmo dia aparece mais de uma vez.
 *
 * Acontece de verdade: alguém lançou o dia à mão ANTES de a pessoa ser
 * vinculada ao relógio e a importação trouxe o mesmo dia depois — os ids são
 * diferentes (pdm_… e pd_…), então nenhum sobrescreve o outro. A régua é a
 * MESMA de porDiaUnico em components/rh/AbaPonto.jsx: vale o que alguém
 * conferiu (`corrigido`), e entre dois conferidos vale o que já tem ausência —
 * regravar noutro criaria dois lançamentos para o mesmo dia.
 *
 * A MESMA escolha alimenta a célula da grade E a contagem do resumo. Escolher
 * de um jeito para desenhar e de outro para contar é como a tela passa a dizer
 * um número que a grade não mostra.
 */
function registroQueVale(lista) {
  let melhor = null;
  let melhorNota = -1;
  for (const d of lista) {
    const nota = (d.corrigido === true ? 2 : 0) + (ausenciaDoDia(d) ? 1 : 0);
    if (nota > melhorNota) {
      melhor = d;
      melhorNota = nota;
    }
  }
  return melhor;
}

/** A batida do dia em uma frase, para o aviso de contradição. "" quando não há batida. */
function fraseDaBatida(reg) {
  if (!reg) return "";
  if (reg.emAberto === true) return "entrou e não saiu (dia em aberto)";
  const entrada = txt(reg.entrada);
  const saida = txt(reg.saida);
  const min = minutosTrabalhados(reg);
  if (!entrada && !saida) return min === null ? "" : `${duracaoTexto(min)} lançadas para a folha`;
  const janela = `das ${entrada || "—"} às ${saida || "—"}`;
  return min === null ? janela : `${janela} (${duracaoTexto(min)} para a folha)`;
}

/**
 * O ESTADO de um dia de uma pessoa: o que a célula mostra e o que ela diz.
 *
 * A ordem das perguntas é a decisão. A ausência lançada vem ANTES da batida
 * porque é a palavra do RH sobre aquele dia; "sem registro" vem por ÚLTIMO e só
 * para dia que a escala prevê, que já passou e que está dentro do vínculo —
 * fora disso não há nada a registrar, e um "sem registro" ali seria cobrança de
 * uma linha que ninguém devia.
 */
function estadoDoDia({ dia, reg, ausencia, iso, hojeISO, admissao, desligadoEm }) {
  if (admissao && iso < admissao) {
    return { chave: "fora-vinculo", letra: "", classe: "border-slate-100 bg-slate-50 text-slate-300", titulo: "antes da admissão" };
  }
  if (desligadoEm && iso > desligadoEm) {
    return { chave: "fora-vinculo", letra: "", classe: "border-slate-100 bg-slate-50 text-slate-300", titulo: "depois do desligamento" };
  }
  if (ausencia) {
    const trabalho = minutosTrabalhados(reg);
    const comTrabalho = trabalho !== null && trabalho > 0;
    return {
      chave: "ausencia",
      letra: letraDaAusencia(ausencia),
      classe: clsx(CELULA_POR_CHIP[ausencia.chip] || CELULA_POR_CHIP.chip, comTrabalho && "ring-1 ring-inset ring-slate-400"),
      titulo:
        `${ausencia.rotulo}${ausencia.motivo ? ` · ${ausencia.motivo}` : ""}` +
        (comTrabalho ? ` · ATENÇÃO: este dia também tem ${duracaoTexto(trabalho)} trabalhadas` : ""),
    };
  }
  if (reg) {
    const trabalho = minutosTrabalhados(reg);
    if (reg.emAberto === true || (trabalho === null && (txt(reg.entrada) || txt(reg.saida)))) {
      return { chave: "aberto", letra: "!", classe: "border-warn-200 bg-warn-50 text-warn-700", titulo: "dia em aberto: entrou e não saiu" };
    }
    if (trabalho === null) {
      /* Existe registro, e ele não diz nada: sem batida, sem total e sem
         ausência — sobra de um lançamento removido, ou importação incompleta.
         Não vira "0h00" nem "sem registro": as duas frases seriam falsas, e a
         segunda esconderia uma linha que está lá e trava a importação do dia. */
      return {
        chave: "registro-vazio",
        letra: "?",
        classe: "border-dashed border-warn-300 bg-white text-warn-700",
        titulo: "há um registro deste dia, mas ele não traz batida nem ausência — confira em Fechamento e Batidas",
      };
    }
    return {
      chave: "trabalhado",
      letra: "•",
      classe: "border-ok-200 bg-ok-50 text-ok-700",
      titulo: `${duracaoTexto(trabalho)} para a folha${fraseDaBatida(reg) ? ` · ${fraseDaBatida(reg)}` : ""}`,
    };
  }
  if (dia.previstoMin === 0) {
    return { chave: "sem-jornada", letra: "", classe: "border-slate-100 bg-slate-50 text-slate-300", titulo: `${NOMES_DIA_SEMANA[dia.semana]}: a escala não prevê trabalho` };
  }
  if (iso > hojeISO) {
    return { chave: "futuro", letra: "", classe: "border-slate-100 bg-white text-slate-300", titulo: "este dia ainda não chegou" };
  }
  return {
    chave: "sem-registro",
    letra: "?",
    classe: "border-dashed border-slate-300 bg-white text-slate-400",
    titulo: "sem registro: nenhuma batida e nenhuma ausência lançada. NÃO é falta.",
  };
}

// ============================================================================
// Componentes auxiliares — todos FORA da página (declarado dentro, o componente
// remonta a cada render e o campo perde o foco a cada letra digitada).
// ============================================================================

function CelulaDia({ celula, editavel, aoAbrir }) {
  const conteudo = celula.estado.letra;
  const classe = clsx(
    "flex h-7 w-full items-center justify-center rounded border text-[10px] font-semibold leading-none tnum",
    celula.estado.classe,
    editavel && "cursor-pointer hover:opacity-75"
  );
  const titulo = `${dataLonga(celula.iso)} — ${celula.estado.titulo}${celula.repetidos > 1 ? ` · ${celula.repetidos} registros neste dia` : ""}`;
  if (!editavel) {
    return (
      <td className="p-0.5 align-middle">
        <span className={classe} title={titulo} aria-label={titulo}>{conteudo}</span>
      </td>
    );
  }
  return (
    <td className="p-0.5 align-middle">
      <button type="button" className={classe} title={titulo} aria-label={titulo} onClick={aoAbrir}>
        {conteudo}
      </button>
    </td>
  );
}

function Legenda() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <span className="font-medium text-slate-600">Legenda:</span>
      {TIPOS_AUSENCIA.map((t) => (
        <span key={t.tipo} className="inline-flex items-center gap-1" title={t.ajuda}>
          <span className={clsx("inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-semibold", CELULA_POR_CHIP[t.chip] || CELULA_POR_CHIP.chip)}>
            {LETRA_POR_TIPO.get(t.tipo)}
          </span>
          {t.rotulo}
          {t.desconta ? " (desconta)" : ""}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-ok-200 bg-ok-50 text-[10px] font-semibold text-ok-700">•</span>
        trabalhado
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-warn-200 bg-warn-50 text-[10px] font-semibold text-warn-700">!</span>
        em aberto
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-dashed border-slate-300 bg-white text-[10px] font-semibold text-slate-400">?</span>
        sem registro — não é falta
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-dashed border-warn-300 bg-white text-[10px] font-semibold text-warn-700">?</span>
        registro sem batida e sem ausência
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-slate-100 bg-slate-50" />
        sem jornada / fora do vínculo
      </span>
    </div>
  );
}

/* O resumo de UMA pessoa no mês. Cada grupo com o seu total, e o dinheiro só no
   grupo que custa dinheiro. Salário ausente da ficha vira PENDÊNCIA ESCRITA,
   nunca R$ 0,00 — zero afirmaria "não há nada a descontar". */
/**
 * O NOME DA PESSOA COMO PORTA.
 *
 * Diagnóstico do Leonardo (28/08/2026): nas três telas do Ponto o nome da
 * pessoa aparecia 72 vezes e NENHUMA era clicável — lia-se "ANA CLAUDIA · 08:03"
 * e a linha acabava ali, sem caminho para o dia, para o mês nem para a ficha.
 * Aqui o nome vira botão e abre o detalhe da pessoa, com o dia daquela linha
 * (quando a linha tem um dia) já em foco.
 *
 * É um <button> DE VERDADE, e não uma <span onClick>: o teclado chega nele, o
 * leitor de tela o anuncia como botão e o foco fica visível. Nome clicável que
 * só responde a mouse troca um beco sem saída por outro.
 *
 * O CLIQUE DA CÉLULA CONTINUA SENDO O DA CÉLULA. Este botão vive na coluna do
 * nome; quadradinho de dia continua abrindo o lançamento da ausência, que é a
 * função desta tela. Roubar aquele clique consertaria a navegação quebrando o
 * trabalho.
 */
function BotaoPessoa({ nome, aoAbrir, className }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      title={`Ver o ponto de ${nome}`}
      className={clsx(
        "max-w-full truncate rounded text-left underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        className
      )}
    >
      {nome}
    </button>
  );
}

function ResumoPessoa({ linha, aoAbrir }) {
  const { pessoa, apuracao, conta, semRegistro, repetidos, foraDaGrade } = linha;
  const grupos = TIPOS_AUSENCIA.filter((t) => apuracao.ausencias[t.tipo] > 0);
  const nada =
    grupos.length === 0 && apuracao.ausenciasDesconhecidas === 0 && semRegistro === 0 &&
    repetidos === 0 && foraDaGrade === 0;
  return (
    <div className="nao-quebrar border-t py-2 first:border-t-0 first:pt-0" style={{ borderColor: "var(--hairline)" }}>
      <p className="text-sm font-medium text-slate-800">
        <BotaoPessoa nome={pessoa.nome} aoAbrir={aoAbrir} />
      </p>
      {nada ? (
        <p className="mt-0.5 text-xs text-slate-400">Nenhuma ausência lançada neste mês.</p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {grupos.map((t) => (
            <span key={t.tipo} className={t.chip} title={t.ajuda}>
              {pluralDoTipo(apuracao.ausencias[t.tipo], t.curto)}
            </span>
          ))}
          {apuracao.ausenciasDesconhecidas > 0 && (
            <span className="chip-warn">
              {plural(apuracao.ausenciasDesconhecidas, "lançamento de tipo não reconhecido", "lançamentos de tipo não reconhecido")}
            </span>
          )}
          {apuracao.ausenciasComTrabalho > 0 && (
            <span className="chip-warn">
              {plural(apuracao.ausenciasComTrabalho, "dia com ausência E hora trabalhada", "dias com ausência E hora trabalhada")}
            </span>
          )}
          {repetidos > 0 && (
            <span className="chip-warn">{plural(repetidos, "dia com registro repetido", "dias com registro repetido")}</span>
          )}
          {foraDaGrade > 0 && (
            <span className="chip-warn" title="A data gravada não é um dia deste mês — o registro existe, mas não tem coluna na grade.">
              {plural(foraDaGrade, "registro com data que não é dia deste mês", "registros com data que não é dia deste mês")}
            </span>
          )}
        </div>
      )}

      {/* O dinheiro da falta: a conta INTEIRA escrita, com os mesmos números que
          o motor somou. Total sem as parcelas não se confere. */}
      {apuracao.faltasQueDescontam > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {conta.semSalario ? (
            <span className="text-warn-700">
              {plural(apuracao.faltasQueDescontam, "falta", "faltas")} — sem salário na ficha, não dá para calcular o desconto.
            </span>
          ) : (
            <span className="tnum">
              {moedaCheia(conta.salarioBase)} ÷ {conta.divisorDiario} = {moedaCheia(conta.valorDia)}/dia ×{" "}
              {apuracao.faltasQueDescontam} = <strong className="text-bad-700">{moedaCheia(conta.valorFaltasDias)}</strong>
            </span>
          )}
        </p>
      )}

      {semRegistro > 0 && (
        <p className="mt-1 text-xs text-slate-400">
          {plural(semRegistro, "dia útil sem registro", "dias úteis sem registro")} — sem batida e sem ausência lançada. Não é falta.
        </p>
      )}
    </div>
  );
}

/* O lançamento. Um formulário só, com os três campos que o Leonardo pediu
   (o que houve, por quê e qual documento) e a CONTRADIÇÃO dita em voz alta. */
function ModalAusencia({ form, onMudar, aoFechar, aoGravar, aoRemover, salvando, editavel }) {
  if (!form) return null;
  const escolhido = TIPOS_AUSENCIA.find((t) => t.tipo === form.tipo) || null;
  const precisaConfirmar = !!form.fraseBatida || form.futuro;
  const podeGravar = editavel && !salvando && !!escolhido && (!precisaConfirmar || form.confirmado);

  return (
    <Modal
      titulo={`Ausência de ${form.pessoaNome} — ${dataLonga(form.data)}`}
      aberto
      aoFechar={aoFechar}
      largura="max-w-xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          {NOMES_DIA_SEMANA[form.semana]} · {form.previstoMin > 0 ? `${duracaoTexto(form.previstoMin)} previstas pela escala` : "a escala não prevê trabalho neste dia"}
        </p>

        {/* A CONTRADIÇÃO, antes de qualquer campo: quem vai lançar precisa ver
            que o dia já tem batida ANTES de escolher o tipo. */}
        {(form.fraseBatida || form.futuro || form.repetidos > 1) && (
          <div className="rounded-xl border border-warn-200 bg-warn-50 p-3 text-xs text-warn-800">
            <p className="flex items-center gap-1.5 font-semibold">
              <CircleAlert size={14} strokeWidth={2.5} /> Confira antes de lançar
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {form.fraseBatida && (
                <li>
                  Este dia TEM batida — {form.fraseBatida}. Lançar ausência aqui é dizer que a pessoa
                  faltou num dia em que o relógio a registrou. A batida NÃO será apagada: fica como está,
                  e a ausência entra ao lado dela.
                </li>
              )}
              {form.futuro && <li>Este dia ainda não chegou. Férias e folgas combinadas se lançam adiantadas; falta e atestado, não.</li>}
              {form.repetidos > 1 && (
                <li>
                  Há {form.repetidos} registros deste dia para esta pessoa. A ausência vai no registro
                  que está na tela — confira os outros na aba Fechamento e Batidas.
                </li>
              )}
              {form.duplicataSuspeita && (
                <li>
                  Há um registro deste dia AINDA NÃO VINCULADO a ficha nenhuma, com o nome
                  &ldquo;{form.duplicataSuspeita}&rdquo; no relógio. Se for a mesma pessoa, vincule antes
                  em &ldquo;Pessoas do relógio&rdquo; — senão o dia fica com dois registros.
                </li>
              )}
            </ul>
          </div>
        )}

        <div>
          <label className="label" htmlFor="au-tipo">O que houve neste dia</label>
          <select
            id="au-tipo"
            className="select"
            value={form.tipo}
            onChange={(e) => onMudar({ ...form, tipo: e.target.value, confirmado: false })}
          >
            {TIPOS_AUSENCIA.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.rotulo} — {t.desconta ? "DESCONTA" : "não desconta"}
              </option>
            ))}
          </select>
          {escolhido && (
            <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5 text-xs text-slate-500">
              {/* O efeito no dinheiro dito em UMA palavra, antes da explicação:
                  é a única coisa que quem lança precisa ver sem ler. */}
              <span className={escolhido.desconta ? "chip-bad" : "chip"}>
                {escolhido.desconta ? "desconta" : "não desconta"}
              </span>
              <span>{escolhido.ajuda}</span>
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="au-motivo">Motivo (o que aconteceu)</label>
          <input
            id="au-motivo"
            type="text"
            className="input"
            value={form.motivo}
            placeholder="consulta no ortopedista, falecimento do avô, folga combinada…"
            onChange={(e) => onMudar({ ...form, motivo: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">
            Texto livre de propósito: &ldquo;atestado&rdquo; diz o que a empresa faz com o dia, o motivo diz o que
            aconteceu com a pessoa.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="au-doc">Documento (atestado, protocolo)</label>
          <input
            id="au-doc"
            type="text"
            className="input"
            value={form.documento}
            placeholder="nº do atestado, CID, protocolo — o que se procura na gaveta depois"
            onChange={(e) => onMudar({ ...form, documento: e.target.value })}
          />
        </div>

        {precisaConfirmar && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm text-slate-700" style={{ borderColor: "var(--hairline)" }}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.confirmado}
              onChange={(e) => onMudar({ ...form, confirmado: e.target.checked })}
            />
            <span>
              Conferi e quero lançar assim mesmo
              {form.fraseBatida ? " — a batida deste dia fica preservada" : ""}.
            </span>
          </label>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {form.jaTinha && editavel && (
            <button type="button" className="btn-outline mr-auto text-bad-700" onClick={aoRemover} disabled={salvando}>
              <Trash2 size={16} strokeWidth={2.5} /> Remover a ausência
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={aoGravar} disabled={!podeGravar}>
            {salvando ? "Gravando..." : form.jaTinha ? "Regravar" : "Lançar ausência"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- planilha --------------------------------------------------------------

/* Uma linha por LANÇAMENTO, não por pessoa: é do lançamento que se confere o
   motivo e o documento seis meses depois. O resumo por pessoa sai de uma
   dinâmica em cima disto — e a coluna de desconto SOMA para exatamente o mesmo
   total que a tela mostra, porque o motor calcula o desconto do mês como
   (valor do dia, em centavos inteiros) × (dias de falta). */
const COLUNAS = [
  { chave: "data", rotulo: "Dia", tipo: "data" },
  { chave: "diaSemana", rotulo: "Dia da semana" },
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "cargo", rotulo: "Cargo" },
  { chave: "tipo", rotulo: "O que houve" },
  { chave: "desconta", rotulo: "Desconta" },
  { chave: "motivo", rotulo: "Motivo" },
  { chave: "documento", rotulo: "Documento" },
  { chave: "descontoSugerido", rotulo: "Desconto sugerido (R$)", tipo: "dinheiro" },
  { chave: "temBatida", rotulo: "Tem batida" },
  { chave: "entrada", rotulo: "Entrada" },
  { chave: "saida", rotulo: "Saída" },
  { chave: "trabalhado", rotulo: "Trabalhado no dia (h)", tipo: "numero" },
  { chave: "previsto", rotulo: "Previsto pela escala (h)", tipo: "numero" },
  { chave: "origem", rotulo: "Origem" },
  { chave: "corrigido", rotulo: "Corrigido" },
  { chave: "jibbleId", rotulo: "Id no relógio" },
];

// ============================================================================

export default function Faltas({
  pessoas, ativos, pontoDia, hojeISO, editavel, salvando, gravar, apagarReg, setAviso, recarregar,
}) {
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  /* QUEM ESTÁ ABERTO NO DETALHE, e qual dia está em foco lá dentro.
     { pessoa, diaFoco } — diaFoco null quando o clique veio de um lugar que não
     é de um dia só (a coluna do nome na grade, o resumo do mês). */
  const [detalhe, setDetalhe] = useState(null);
  // A configuração global. null = AINDA NÃO CARREGOU (ou falhou), que não é o
  // mesmo que "não existe": até lá a escala é a padrão da casa, e a tela diz.
  const [config, setConfig] = useState(null);
  const [cfgFalhou, setCfgFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerCfg()
      .then((c) => { if (vivo) { setConfig(c); setCfgFalhou(false); } })
      .catch(() => { if (vivo) setCfgFalhou(true); });
    return () => { vivo = false; };
  }, []);

  const cfg = useMemo(() => cfgDoPonto(config), [config]);

  /* Os dias do mês, com o previsto que a ESCALA da casa manda para cada um.
     É daqui que sai "fim de semana (sem jornada)": o 0 do sábado é RESULTADO
     (a escala foi consultada), não ausência de medida. */
  const dias = useMemo(
    () =>
      diasDoMes(competencia).map((iso) => ({
        iso,
        numero: Number(iso.slice(8, 10)),
        semana: diaDaSemanaISO(iso) ?? 0,
        previstoMin: minutosPrevistosDoDia(iso, cfg.jornada) ?? 0,
      })),
    [competencia, cfg]
  );

  const vm = useMemo(() => {
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    const porJibble = new Map();
    for (const p of pessoas) {
      const j = txt(p.jibbleId);
      if (j) porJibble.set(j, p);
    }

    const doMes = (pontoDia || []).filter((d) => competenciaDe(d.data) === competencia);

    // ID MANDA, nome só exibe: o dia casa com a ficha por pessoaId ou por
    // jibbleId. Casar por nome cria sósia e some com gente.
    const semVinculoPorDia = new Map(); // "AAAA-MM-DD" → [nome que veio do relógio]
    const semVinculoNomes = new Set();
    let semVinculoRegistros = 0;
    let semVinculoAusencias = 0;
    const porPessoa = new Map(); // pessoaId → Map(data → registro[])
    for (const d of doMes) {
      const pessoa = (d.pessoaId && porId.get(d.pessoaId)) || (txt(d.jibbleId) && porJibble.get(txt(d.jibbleId))) || null;
      if (!pessoa) {
        /* REGISTRO SEM FICHA NÃO SOME EM SILÊNCIO. A grade tem uma linha por
           PESSOA, então o dia que não casou com ficha nenhuma não tem onde
           aparecer — e some junto com a ausência que porventura esteja nele.
           Fica contado, e a tela diz em voz alta que existe. */
        const lista = semVinculoPorDia.get(d.data) || [];
        lista.push(txt(d.pessoaNome));
        semVinculoPorDia.set(d.data, lista);
        semVinculoRegistros += 1;
        if (ausenciaDoDia(d)) semVinculoAusencias += 1;
        if (txt(d.pessoaNome)) semVinculoNomes.add(txt(d.pessoaNome));
        continue;
      }
      if (!porPessoa.has(pessoa.id)) porPessoa.set(pessoa.id, new Map());
      const porData = porPessoa.get(pessoa.id);
      const lista = porData.get(d.data) || [];
      lista.push(d);
      porData.set(d.data, lista);
    }

    /* Quem entra na grade: o quadro de HOJE mais quem tem registro no mês.
       Desligada no dia 15 ainda tem meio mês de ponto — sumir da lista faria
       sumir da conferência a ausência que ela lançou no dia 10. */
    const daGrade = [...ativos];
    const jaTem = new Set(daGrade.map((p) => p.id));
    for (const id of porPessoa.keys()) {
      if (!id || jaTem.has(id)) continue;
      const p = porId.get(id);
      if (!p) continue;
      jaTem.add(id);
      daGrade.push(p);
    }
    daGrade.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    const naGrade = new Set(dias.map((d) => d.iso));

    const linhas = daGrade.map((pessoa) => {
      const porData = porPessoa.get(pessoa.id) || new Map();
      const admissao = txt(pessoa.admissao);
      const desligadoEm = txt(pessoa.desligadoEm);
      let repetidos = 0;
      let semRegistro = 0;
      const queValem = [];

      const celulas = dias.map((dia) => {
        const lista = porData.get(dia.iso) || [];
        if (lista.length > 1) repetidos += 1;
        const reg = registroQueVale(lista);
        if (reg) queValem.push(reg);
        const ausencia = ausenciaDoDia(reg);
        const estado = estadoDoDia({ dia, reg, ausencia, iso: dia.iso, hojeISO, admissao, desligadoEm });
        if (estado.chave === "sem-registro") semRegistro += 1;
        return { iso: dia.iso, dia, reg, ausencia, estado, repetidos: lista.length };
      });

      /* O QUE A GRADE NÃO ALCANÇOU NÃO SOME. Um registro com data que não é um
         dia deste mês ("2026-08-32" passa pelo recorte, que só olha os sete
         primeiros caracteres) não tem coluna onde aparecer. Descartá-lo aqui
         faria o lançamento de alguém desaparecer sem erro nenhum — então ele
         entra na contagem e a linha diz que ele existe, para o RH ir consertar. */
      const foraDaGrade = [];
      for (const [data, lista] of porData) {
        if (naGrade.has(data)) continue;
        const reg = registroQueVale(lista);
        if (reg) foraDaGrade.push(reg);
      }
      /* A CONTAGEM É DO MOTOR, não deste laço: apurarCompetencia separa o que
         desconta do que não desconta, e conta à parte o tipo que esta versão
         não conhece, em vez de descartá-lo em silêncio. Entram os registros QUE
         VALEM — os mesmos que a grade desenhou. Somar também a linha repetida
         contaria duas faltas onde houve uma, e isso é dinheiro. */
      const apuracao = apurarCompetencia([...queValem, ...foraDaGrade], cfg.jornada);
      // A conta do desconto, com a régua do motor (1/30, arredondando em
      // centavos a cada passo). Sem salário na ficha ela devolve null em TODO
      // campo de dinheiro, e o resumo escreve a pendência.
      const conta = calcularFechamento({ salario: pessoa.salario, faltas: apuracao.faltasQueDescontam });

      return { pessoa, celulas, apuracao, conta, semRegistro, repetidos, foraDaGrade: foraDaGrade.length };
    });

    // Os anos que o seletor oferece: os que têm dado mais o de hoje. Nunca uma
    // lista cravada, que envelheceria virando o ano.
    const anos = new Set([Number(hojeISO.slice(0, 4)), Number(competencia.slice(0, 4))]);
    for (const d of pontoDia || []) {
      const a = Number(String(d.data || "").slice(0, 4));
      if (a >= 2000 && a <= 2100) anos.add(a);
    }

    return {
      linhas,
      semVinculoPorDia,
      semVinculo: {
        registros: semVinculoRegistros,
        ausencias: semVinculoAusencias,
        nomes: [...semVinculoNomes].sort((a, b) => norm(a).localeCompare(norm(b))),
      },
      anos: [...anos].sort((a, b) => b - a),
    };
  }, [pessoas, ativos, pontoDia, competencia, dias, cfg, hojeISO]);

  const linhasVisiveis = useMemo(() => {
    const q = norm(busca).trim();
    if (!q) return vm.linhas;
    return vm.linhas.filter((l) => norm(l.pessoa.nome).includes(q));
  }, [vm, busca]);

  /* Os lançamentos do mês, um por linha — é aqui que motivo e documento ficam
     LEGÍVEIS. Na grade eles só existem no título do quadradinho, e título de
     elemento não sai no papel nem no PDF.
     SEGUEM O FILTRO, como a lista e os totais: uma tela que mostra uma pessoa e
     soma sete diz um número que não se confere com o que está à vista. */
  const lancamentos = useMemo(() => {
    const out = [];
    for (const l of linhasVisiveis) {
      for (const c of l.celulas) {
        if (!c.ausencia) continue;
        // A linha inteira vai junto: é por ela que o botão Editar reabre
        // EXATAMENTE a mesma célula, sem procurar de novo por id e data.
        out.push({ linha: l, pessoa: l.pessoa, conta: l.conta, celula: c, ...c });
      }
    }
    return out.sort(
      (a, b) => String(a.iso).localeCompare(String(b.iso)) || norm(a.pessoa.nome).localeCompare(norm(b.pessoa.nome))
    );
  }, [linhasVisiveis]);

  /* Os totais do recorte que está à vista. O desconto só soma quem TEM salário
     na ficha, e quem não tem sai contado à parte: somar null como 0 faria o
     total parecer completo quando falta gente na conta.
     A SOMA É EM CENTAVOS INTEIROS, como a do motor. Somando reais em ponto
     flutuante, três descontos de R$ 73,33 dariam 219,98999999999998 — e o
     centavo perdido é a diferença entre a tela e a folha. */
  const totais = useMemo(() => {
    let faltas = 0;
    let abonadas = 0;
    let desconhecidas = 0;
    let semSalario = 0;
    let centavos = 0;
    let temDesconto = false;
    for (const l of linhasVisiveis) {
      faltas += l.apuracao.faltasQueDescontam;
      abonadas += l.apuracao.ausenciasSemDesconto;
      desconhecidas += l.apuracao.ausenciasDesconhecidas;
      if (l.apuracao.faltasQueDescontam === 0) continue;
      if (l.conta.semSalario || l.conta.valorFaltasDias === null) {
        semSalario += 1;
        continue;
      }
      centavos += Math.round(l.conta.valorFaltasDias * 100);
      temDesconto = true;
    }
    return { faltas, abonadas, desconhecidas, semSalario, desconto: temDesconto ? centavos / 100 : null };
  }, [linhasVisiveis]);

  // ---- lançamento ----------------------------------------------------------

  const abrirCelula = (linha, celula) => {
    if (!editavel) return;
    const suspeitas = vm.semVinculoPorDia.get(celula.iso) || [];
    const nomeParecido = suspeitas.find((n) => n && norm(n) === norm(linha.pessoa.nome)) || "";
    setForm({
      pessoaId: linha.pessoa.id,
      pessoaNome: linha.pessoa.nome,
      data: celula.iso,
      semana: celula.dia.semana,
      previstoMin: celula.dia.previstoMin,
      base: celula.reg || null,
      jaTinha: !!celula.ausencia,
      repetidos: celula.repetidos,
      // A contradição, medida agora: dia com batida, dia no futuro, registro
      // repetido, registro homônimo ainda sem vínculo.
      fraseBatida: celula.reg ? fraseDaBatida(celula.reg) : "",
      futuro: celula.iso > hojeISO,
      duplicataSuspeita: celula.reg ? "" : nomeParecido,
      tipo: celula.ausencia?.tipo || TIPOS_AUSENCIA[0].tipo,
      motivo: celula.ausencia?.motivo || "",
      documento: celula.ausencia?.documento || "",
      confirmado: false,
    });
  };

  const gravarAusencia = () => {
    if (!form) return;
    const ano = anoRuim(form.data);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano do dia: ${ano}` });
    const escolhido = TIPOS_AUSENCIA.find((t) => t.tipo === form.tipo);
    if (!escolhido) return setAviso({ tipo: "erro", texto: "Escolha o que houve neste dia." });
    const pessoa = pessoas.find((p) => p.id === form.pessoaId);
    if (!pessoa) {
      return setAviso({ tipo: "erro", texto: "Não achei a ficha desta pessoa. Recarregue e tente de novo." });
    }

    const base = form.base || null;
    const jibbleId = txt(pessoa.jibbleId) || txt(base?.jibbleId);
    const id = base?.id || (jibbleId ? `pd_${jibbleId}_${form.data}` : `pdm_${pessoa.id}_${form.data}`);

    /* PRESERVA O DIA INTEIRO. O `...base` leva junto entrada, saída, pausa,
       trabalhado, tracked e a apuração do relógio — a ausência ACRESCENTA uma
       explicação, não apaga a batida de quem trabalhou meio dia e depois trouxe
       atestado. Dia que nasce aqui não tem base, e o spread não inventa campo
       que não existe. */
    return gravar(
      COL_DIA,
      {
        ...(base || {}),
        id,
        pessoaId: pessoa.id,
        pessoaNome: pessoa.nome,
        jibbleId,
        data: form.data,
        ausencia: { tipo: form.tipo, motivo: txt(form.motivo), documento: txt(form.documento) },
        origem: base?.origem || "manual",
        // PROTEGE o lançamento: sem este carimbo a importação de amanhã
        // apagaria, em silêncio, a ausência lançada hoje.
        corrigido: true,
      },
      `${escolhido.rotulo} de ${pessoa.nome} em ${dataLonga(form.data)}: ${
        escolhido.desconta
          ? "conta como falta e sugere desconto de 1/30 do salário."
          : "não desconta."
      }`,
      () => setForm(null)
    );
  };

  const removerAusencia = () => {
    const base = form?.base;
    if (!base) return;
    const pessoaNome = form.pessoaNome;

    /* DUAS SAÍDAS, e a diferença importa.
       (a) O registro só existe POR CAUSA da ausência (nasceu à mão, sem batida
           nenhuma): some inteiro. Deixá-lo vazio com `corrigido: true` travaria
           aquele dia contra toda importação futura do relógio — por causa de um
           lançamento que acabou de deixar de existir, e sem ninguém ver.
       (b) O registro tem batida: fica, e só a ausência sai (`ausencia: null`,
           nunca a chave removida — a porta grava o registro INTEIRO, e é o null
           que faz ausenciaDoDia voltar a dizer "não há ausência aqui").
           O `corrigido` volta a false se ninguém tinha mexido nas batidas; o
           sinal de que mexeram é o carimbo `relogioEntrada`, que a correção da
           aba Batidas grava na primeira vez. */
    const temBatida =
      !!txt(base.entrada) || !!txt(base.saida) || base.emAberto === true ||
      minutosTrabalhados(base) !== null || base.trackedMin != null || base.pausaMin != null;

    if (!temBatida) {
      if (!window.confirm(`Remover a ausência de ${pessoaNome} em ${dataLonga(form.data)}? O dia volta a não ter registro nenhum.`)) return;
      return apagarReg(COL_DIA, base.id, `Ausência de ${pessoaNome} em ${dataLonga(form.data)} removida.`)
        .then(() => setForm(null));
    }

    if (!window.confirm(`Remover a ausência de ${pessoaNome} em ${dataLonga(form.data)}? A batida do dia continua como está.`)) return;
    const houveCorrecaoDeBatida = Object.prototype.hasOwnProperty.call(base, "relogioEntrada");
    return gravar(
      COL_DIA,
      {
        ...base,
        ausencia: null,
        corrigido: base.origem === "jibble" ? houveCorrecaoDeBatida : true,
      },
      `Ausência de ${pessoaNome} em ${dataLonga(form.data)} removida. A batida do dia continua como estava.`,
      () => setForm(null)
    );
  };

  // ---- planilha ------------------------------------------------------------

  const baixar = () => {
    const linhas = lancamentos.map((l) => {
      const trabalho = minutosTrabalhados(l.reg);
      return {
        data: l.iso,
        diaSemana: NOMES_DIA_SEMANA[l.dia.semana],
        pessoa: l.pessoa.nome,
        cargo: l.pessoa.cargo || "",
        tipo: l.ausencia.rotulo,
        desconta: l.ausencia.desconta ? "sim" : "não",
        motivo: l.ausencia.motivo || "",
        documento: l.ausencia.documento || "",
        // Dinheiro em NÚMERO, e VAZIO onde não há conta: R$ 0,00 numa linha de
        // atestado somaria zero na coluna de desconto e leria como "conferido".
        // Sem salário na ficha também sai vazio — a conta não existe.
        descontoSugerido: l.ausencia.desconta && !l.conta.semSalario ? l.conta.valorDia : "",
        temBatida: l.reg && fraseDaBatida(l.reg) ? "sim" : "",
        entrada: l.reg?.entrada || "",
        saida: l.reg?.saida || "",
        // Dia sem total sai VAZIO, nunca 0: zero aqui viraria desconto.
        trabalhado: trabalho === null ? "" : horasDecimais(trabalho),
        previsto: horasDecimais(l.dia.previstoMin),
        origem: l.reg?.origem === "jibble" ? "relógio" : "à mão",
        corrigido: l.reg?.corrigido ? "sim" : "não",
        jibbleId: l.reg?.jibbleId || "",
      };
    });

    if (linhas.length === 0) {
      // Zero não é resultado: a planilha vazia não prova mês sem falta, prova
      // que não há o que baixar NESTE recorte — e o recorte é dito por extenso.
      return setAviso({
        tipo: "erro",
        texto:
          `Nenhuma ausência lançada em ${rotuloCompetencia(competencia)}` +
          (busca.trim() ? ` para “${busca.trim()}”` : "") +
          " — não há o que baixar.",
      });
    }
    try {
      const arquivo = baixarPlanilha({
        nome: `ponto-ausencias-${competencia}`,
        titulo: `Ausências — ${rotuloCompetencia(competencia)}`,
        colunas: COLUNAS,
        linhas,
      });
      setAviso({ tipo: "ok", texto: `Planilha baixada: ${arquivo} (${plural(linhas.length, "lançamento", "lançamentos")}).` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  // ---- render --------------------------------------------------------------

  const [ano, mes] = competencia.split("-");

  return (
    <>
      <Card className="mb-4">
        <SectionTitle
          titulo={`Ausências — ${rotuloCompetencia(competencia)}`}
          sub="Falta, atestado, justificada, férias e folga. Clique no dia da pessoa para lançar. Dia sem batida e sem ausência lançada é “sem registro”, nunca falta."
          acao={
            <div className="sem-impressao flex flex-wrap items-center gap-2">
              {/* Baixar não é escrita: quem só consulta também precisa da planilha. */}
              <button type="button" className="btn-outline" onClick={baixar}>
                <Download size={16} strokeWidth={2.5} /> Baixar planilha
              </button>
              <button type="button" className="btn-ghost" onClick={() => recarregar?.()}>
                Atualizar
              </button>
            </div>
          }
        />

        <div className="sem-impressao flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="fl-mes">Mês</label>
            <select id="fl-mes" className="select w-40" value={mes} onChange={(e) => setCompetencia(`${ano}-${e.target.value}`)}>
              {MESES_LONGOS.map((nome, i) => (
                <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fl-ano">Ano</label>
            <select id="fl-ano" className="select w-28" value={ano} onChange={(e) => setCompetencia(`${e.target.value}-${mes}`)}>
              {vm.anos.map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="label" htmlFor="fl-busca">Pessoa</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="fl-busca"
                type="text"
                className="input pl-9"
                placeholder="filtrar por nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* A ESCALA À VISTA: é dela que sai qual dia é "sem jornada" na grade.
            Régua que não se lê na tela vira número sem dono na conferência. */}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Clock size={13} className="text-slate-400" />
          <span className="tnum">Jornada: {descreverJornada(cfg.jornada)}</span>
          {!cfg.jornadaDefinida && <span className="chip">escala padrão da casa</span>}
          {cfgFalhou && <span className="chip-warn">não consegui ler a configuração — usando a escala padrão</span>}
          {cfg.jornada.ignorados > 0 && (
            <span className="chip-warn">
              {plural(cfg.jornada.ignorados, "turno gravado não foi entendido", "turnos gravados não foram entendidos")}
            </span>
          )}
        </p>
        {!editavel && (
          <p className="mt-1 text-xs text-slate-400">Seu acesso é de leitura: dá para conferir e baixar, não para lançar.</p>
        )}
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {/* ---- a grade ---- */}
        <Card className="lg:col-span-2">
          <SectionTitle titulo="O mês, dia a dia" sub={`${plural(linhasVisiveis.length, "pessoa", "pessoas")} · ${plural(dias.length, "dia", "dias")}`} />
          {/* O que a grade não consegue desenhar, dito por escrito. Uma grade
              tem uma linha por PESSOA: o registro que não casou com ficha
              nenhuma não tem linha, e sumiria calado — junto com a ausência
              que pode estar dentro dele. */}
          {vm.semVinculo.registros > 0 && (
            <p className="mb-3 rounded-xl border border-warn-200 bg-warn-50 p-2.5 text-xs text-warn-800">
              {plural(vm.semVinculo.registros, "registro deste mês não está vinculado", "registros deste mês não estão vinculados")} a
              ficha nenhuma e por isso não aparecem na grade
              {vm.semVinculo.ausencias > 0 && (
                <strong> — {plural(vm.semVinculo.ausencias, "deles tem ausência lançada", "deles têm ausência lançada")}</strong>
              )}
              . {vm.semVinculo.nomes.length > 0 && <>No relógio: {vm.semVinculo.nomes.join(", ")}. </>}
              Vincule em &ldquo;Pessoas do relógio&rdquo;.
            </p>
          )}

          {linhasVisiveis.length === 0 ? (
            <Empty>{busca ? "Nenhuma pessoa com esse nome." : "Nenhuma pessoa no quadro."}</Empty>
          ) : (
            <>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 bg-white p-1 text-left font-display text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pessoa
                      </th>
                      {dias.map((d) => (
                        <th key={d.iso} scope="col" title={dataLonga(d.iso)} className="p-0.5 text-center font-display font-semibold text-slate-400">
                          <span className="block tnum text-[11px] text-slate-600">{d.numero}</span>
                          <span className={clsx("block text-[9px] uppercase", d.previstoMin === 0 && "text-slate-300")}>
                            {NOMES_DIA_SEMANA[d.semana].charAt(0).toUpperCase()}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasVisiveis.map((l) => (
                      <tr key={l.pessoa.id}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 max-w-[10rem] bg-white p-1 text-left text-xs font-medium text-slate-700"
                        >
                          <BotaoPessoa
                            nome={l.pessoa.nome}
                            aoAbrir={() => setDetalhe({ pessoa: l.pessoa, diaFoco: null })}
                            className="block w-full"
                          />
                        </th>
                        {l.celulas.map((c) => (
                          <CelulaDia key={c.iso} celula={c} editavel={editavel} aoAbrir={() => abrirCelula(l, c)} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Legenda />
            </>
          )}
        </Card>

        {/* ---- o resumo do mês, por pessoa ---- */}
        <Card>
          <SectionTitle titulo="Resumo do mês" sub="O que foi lançado, por pessoa" />

          <div className="mb-3 space-y-1 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--hairline)" }}>
            <p className="flex items-center justify-between">
              <span className="text-slate-500">Faltas que descontam</span>
              <span className="tnum font-semibold text-bad-700">{totais.faltas}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-slate-500">Ausências abonadas</span>
              <span className="tnum font-semibold text-slate-700">{totais.abonadas}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-slate-500">Desconto sugerido</span>
              {/* null é "não dá para calcular", e a frase diz isso. R$ 0,00 aqui
                  afirmaria que não há nada a descontar. */}
              <span className="tnum font-semibold text-bad-700">
                {totais.desconto === null ? "sem conta" : moedaCheia(totais.desconto)}
              </span>
            </p>
            {totais.semSalario > 0 && (
              <p className="text-warn-700">
                {plural(totais.semSalario, "pessoa com falta e sem salário na ficha", "pessoas com falta e sem salário na ficha")} —
                fora do total acima.
              </p>
            )}
            {totais.desconhecidas > 0 && (
              <p className="text-warn-700">
                {plural(totais.desconhecidas, "lançamento de tipo não reconhecido", "lançamentos de tipo não reconhecido")} — confira na lista.
              </p>
            )}
            {/* Total que não bate com a lista embaixo é total em que ninguém
                confia: com filtro ligado, a soma é a do recorte, e a tela diz. */}
            {busca.trim() && (
              <p className="text-warn-700">
                Filtrando por &ldquo;{busca.trim()}&rdquo;: estes totais são só de quem está na lista.
              </p>
            )}
            <p className="pt-1 text-slate-400">
              É SUGESTÃO. O desconto entra na folha quando alguém o lançar em Fechamento — nada aqui fecha o mês.
            </p>
          </div>

          {linhasVisiveis.length === 0 ? (
            <Empty>Nada a resumir.</Empty>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto pr-1">
              {linhasVisiveis.map((l) => (
                <ResumoPessoa
                  key={l.pessoa.id}
                  linha={l}
                  aoAbrir={() => setDetalhe({ pessoa: l.pessoa, diaFoco: null })}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ---- os lançamentos, um por linha ---- */}
      <Card>
        <SectionTitle
          titulo="Lançamentos do mês"
          sub="Motivo e documento por extenso — na grade eles só existem no rótulo do quadradinho, que não sai no papel."
        />
        {lancamentos.length === 0 ? (
          <Empty>
            Nenhuma ausência lançada em {rotuloCompetencia(competencia)}
            {busca.trim() ? ` para “${busca.trim()}”` : ""}. Isso NÃO quer dizer que ninguém faltou: quer
            dizer que ninguém lançou.
          </Empty>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left font-display text-xs uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--hairline)" }}>
                  <th scope="col" className="py-2 pr-3 font-semibold">Dia</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Pessoa</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">O que houve</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Motivo</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Documento</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">No dia</th>
                  <th scope="col" className="sem-impressao py-2 font-semibold" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => {
                  const trabalho = minutosTrabalhados(l.reg);
                  return (
                    <tr key={`${l.pessoa.id}-${l.iso}`} className="border-b align-top" style={{ borderColor: "var(--hairline)" }}>
                      <td className="whitespace-nowrap py-2 pr-3 tnum text-slate-700">
                        {dataLonga(l.iso)}
                        <span className="block text-xs text-slate-400">{NOMES_DIA_SEMANA[l.dia.semana]}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        <BotaoPessoa
                          nome={l.pessoa.nome}
                          aoAbrir={() => setDetalhe({ pessoa: l.pessoa, diaFoco: l.iso })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <span className={l.ausencia.chip}>{l.ausencia.rotulo}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {l.ausencia.desconta ? "desconta 1/30" : "não desconta"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{l.ausencia.motivo || <span className="text-slate-300">sem motivo escrito</span>}</td>
                      <td className="py-2 pr-3 text-slate-600">{l.ausencia.documento || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {/* Ausência com hora trabalhada no mesmo dia GRITA: é o
                            caso em que descontar 1/30 cobraria duas vezes. */}
                        {trabalho !== null && trabalho > 0 ? (
                          <span className="chip-warn">também trabalhou {duracaoTexto(trabalho)}</span>
                        ) : fraseDaBatida(l.reg) ? (
                          fraseDaBatida(l.reg)
                        ) : (
                          <span className="text-slate-300">sem batida</span>
                        )}
                      </td>
                      <td className="sem-impressao py-2 text-right">
                        {editavel && (
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => abrirCelula(l.linha, l.celula)}
                          >
                            <CalendarOff size={15} strokeWidth={2.5} /> Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalAusencia
        form={form}
        onMudar={setForm}
        aoFechar={() => setForm(null)}
        aoGravar={gravarAusencia}
        aoRemover={removerAusencia}
        salvando={salvando}
        editavel={editavel}
      />

      {/* O DETALHE DA PESSOA. Só leitura: quem lança ausência continua sendo o
          clique na célula, acima. `pontoDia` vai INTEIRA de propósito — o painel
          anda pelos meses por conta própria, e recortar aqui o mês da grade
          faria as setas ‹ › mostrarem meses vazios que têm dado. */}
      {detalhe && (
        <PessoaDetalhe
          pessoa={detalhe.pessoa}
          pontoDia={pontoDia}
          competencia={detalhe.diaFoco ? competenciaDe(detalhe.diaFoco) : competencia}
          diaFoco={detalhe.diaFoco}
          jornada={cfg.jornada}
          hojeISO={hojeISO}
          aoFechar={() => setDetalhe(null)}
        />
      )}
    </>
  );
}
