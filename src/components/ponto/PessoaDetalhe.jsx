// PONTO → PAINEL DE DETALHE DA PESSOA.
//
// Diagnóstico do Leonardo (28/08/2026): "os nomes têm que ser clicáveis e
// mostrar certinho quando entrou; preciso de mais detalhes, não tá legal".
// Nas três telas do Ponto o nome da pessoa aparecia 72 vezes e nenhuma delas
// levava a lugar nenhum: lia-se "ANA CLAUDIA · 08:03" e acabava ali. Este é o
// lugar para onde o nome passa a levar.
//
// O QUE ELE MOSTRA, e por que nesta ordem:
//   1. QUEM — cargo, setor, admissão, relógio. A ficha, para saber de quem se
//      está falando antes de olhar número nenhum.
//   2. O MÊS — a apuração do motor (apurarCompetencia), do jeito que a folha vai
//      ler: dias com batida, horas para a folha, extras, atrasos, ausências.
//   3. O DIA A DIA — uma linha por dia do mês, com a ENTRADA em destaque ao lado
//      do começo previsto pela escala. É o "mostrar certinho quando entrou".
//
// ============================================================================
// AS TRÊS COISAS QUE ESTE PAINEL NÃO FAZ
//
// 1. NÃO GRAVA NADA. É leitura. Quem lança ausência é a tela de Faltas, quem
//    corrige batida e fecha mês é a aba Ponto do RH. Um painel que também
//    gravasse criaria um segundo caminho para o mesmo dado, e dois caminhos
//    para o mesmo dado é como um deles passa a mentir.
//
// 2. NÃO DEDUZ FALTA e NÃO INVENTA ZERO. Dia sem registro aparece escrito "sem
//    registro". Mês sem batida nenhuma mostra "sem registro" na hora, não
//    "0h00" — zero é uma AFIRMAÇÃO (trabalhou nada) e aqui não se mediu nada.
//    Pelo mesmo motivo a pontualidade some da linha quando `atrasoDoDia`
//    devolve null: sem escala prevista ou sem entrada batida não há o que
//    afirmar, e "na hora" seria um elogio inventado.
//
// 3. NÃO ESCREVE A PRÓPRIA CONTA. Todo número sai do motor (lib/rh/ponto.js):
//    apurarCompetencia, minutosTrabalhados, minutosPrevistosDoDia/DoMes,
//    atrasoDoDia, ausenciaDoDia. Recontar aqui faria o painel divergir da folha
//    no dia em que o motor mudasse — e divergir calado.
//
// A RÉGUA DO DIA REPETIDO é a MESMA das outras telas (`registroQueVale`, gêmea
// de `porDiaUnico` em rh/AbaPonto.jsx): vale o dia que alguém conferiu
// (`corrigido`), e entre dois conferidos vale o que tem ausência. Somar os dois
// inflaria hora extra, e hora extra é dinheiro. O repetido não some: sai dito
// em voz alta no rodapé do resumo.
//
// ----------------------------------------------------------------------------
// CONTRATO — props
//   pessoa       Object|null  ficha de rh_pessoas. null FECHA o painel (é o
//                             estado "ninguém aberto" das telas). Para batida
//                             sem ficha, mande { id: "", nome, jibbleId }.
//   pontoDia     Object[]     "rh_ponto_dia" INTEIRA; o recorte é daqui.
//   competencia  string       "AAAA-MM" — o mês em foco ao abrir.
//   diaFoco      string|null  "AAAA-MM-DD" — a linha que se destaca e para a
//                             qual o painel rola sozinho. null = mês inteiro.
//   jornada      Object       a escala da casa (cfg.jornada de cfgDoPonto).
//   hojeISO      string       "AAAA-MM-DD" LOCAL.
//   aoFechar     () => void
//
// A COMPETÊNCIA é estado DESTE painel depois de aberto (as setas ‹ ›), semeada
// pela prop e ressemeada quando a prop ou a pessoa mudam. Assim a tela que
// abriu guarda só duas coisas — quem está aberto e qual dia — e quem quiser
// andar pelos meses anda aqui dentro, sem mexer no mês da tela de trás.

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dataLonga, MESES_LONGOS } from "../../lib/format.js";
import {
  apurarCompetencia, atrasoDoDia, ausenciaDoDia, competenciaDe, diaDaSemanaISO,
  diasDoMes, duracaoTexto, fimPrevistoDoDia, inicioPrevistoDoDia,
  minutosPrevistosDoDia, minutosPrevistosDoMes, minutosTrabalhados,
  NOMES_DIA_SEMANA, TOLERANCIA_DIA_MIN, TOLERANCIA_MARCACAO_MIN,
} from "../../lib/rh/ponto.js";
import { Modal } from "../ui.jsx";

const txt = (v) => String(v ?? "").trim();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** "agosto de 2026". */
function rotuloCompetencia(c) {
  const [ano, mes] = String(c || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(c || "");
}

/** "AAAA-MM" ± n meses, pela aritmética do Date (que vira o ano sozinha). */
function mesVizinho(c, passo) {
  const [a, m] = String(c || "").split("-").map(Number);
  if (!a || !m) return c;
  const d = new Date(a, m - 1 + passo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * O dia que vale, quando o mesmo dia aparece duas vezes.
 *
 * A MESMA régua de ponto/Faltas.jsx e rh/AbaPonto.jsx. Escolher aqui de um
 * jeito e lá de outro faria este painel mostrar uma entrada que a lista de trás
 * não mostra — e o painel existe justamente para explicar aquela linha.
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

/**
 * Os dias da pessoa dentro da coleção inteira.
 *
 * O ID MANDA, o nome só exibe (lição da Impresilk): casa por pessoaId e, para
 * quem veio do relógio, por jibbleId. O nome só entra quando NÃO HÁ id nenhum —
 * a batida que ainda não foi vinculada a ficha, cujo nome do relógio é tudo o
 * que existe. Casar por nome tendo id disponível é o caminho curto para juntar
 * dois homônimos na mesma conta.
 */
function diasDaPessoa(pontoDia, pessoa) {
  const id = txt(pessoa?.id);
  const jib = txt(pessoa?.jibbleId);
  const nome = txt(pessoa?.nome).toLowerCase();
  return (pontoDia || []).filter((d) => {
    if (id && txt(d.pessoaId) === id) return true;
    if (jib && txt(d.jibbleId) === jib) return true;
    if (!id && !jib && nome) return txt(d.pessoaNome).toLowerCase() === nome;
    return false;
  });
}

/**
 * A pontualidade do dia em uma frase, ou "" quando não há nada a dizer.
 *
 * Mesma leitura de rh/AbaPonto.jsx: só fala quando a batida ENCURTOU o dia, e
 * quando fala diz os DOIS números que o motor separou — o atraso cru e o que a
 * tolerância do art. 58 § 1º deixa cobrar. Dizer só um esconde metade do fato.
 */
function textoDaPontualidade(p) {
  if (!p || p.atrasoBrutoMin === 0) return "";
  const partes = [];
  if (p.atrasoEntradaMin > 0) partes.push(`entrou ${duracaoTexto(p.atrasoEntradaMin)} depois`);
  if (p.saidaAntesMin > 0) partes.push(`saiu ${duracaoTexto(p.saidaAntesMin)} antes`);
  return `${partes.join(" · ")} — ${
    p.tolerado
      ? `dentro da tolerância da CLT (${TOLERANCIA_MARCACAO_MIN} min por marcação, ${TOLERANCIA_DIA_MIN} no dia)`
      : `${duracaoTexto(p.atrasoMin)} de atraso fora da tolerância`
  }`;
}

/** "sem registro" — a frase que substitui o zero que ninguém mediu. */
function Sem({ children = "sem registro" }) {
  return <span className="text-slate-300">{children}</span>;
}

/** Um número do resumo. `min` null vira "sem registro", nunca "0h00". */
function Numero({ rotulo, min, sub, tom }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--hairline)" }}>
      <p className="font-display text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={clsx("mt-0.5 font-display text-base font-semibold tnum", tom || "text-slate-900")}>
        {min === null || min === undefined ? <Sem /> : duracaoTexto(min)}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

/** Uma linha do dia a dia. Fora do componente da página, como manda a casa. */
function LinhaDia({ l, emFoco, refFoco }) {
  const { iso, reg, semana, previstoMin, inicioPrevisto, fimPrevisto, trabalhadoMin, ausencia, pontualidade } = l;
  const semJornada = previstoMin === 0;
  const emAberto = reg?.emAberto === true;
  const frase = textoDaPontualidade(pontualidade);

  return (
    <tr
      ref={refFoco}
      className={clsx("border-b align-top", emFoco && "bg-brand-50")}
      style={{ borderColor: "var(--hairline)" }}
    >
      <td className="whitespace-nowrap py-2 pl-3 pr-3">
        <span className={clsx("block tnum text-xs font-medium", semJornada ? "text-slate-400" : "text-slate-700")}>
          {dataLonga(iso)}
        </span>
        <span className="block text-[11px] text-slate-400">
          {NOMES_DIA_SEMANA[semana]}
          {emFoco && <span className="ml-1 chip-brand">dia em foco</span>}
        </span>
      </td>

      {/* A ENTRADA em destaque, com o começo previsto logo abaixo: é o pedido
          do Leonardo ("mostrar certinho quando entrou"). O previsto ao lado é o
          que transforma "08:03" em informação — sozinho, 08:03 não diz nada. */}
      <td className="whitespace-nowrap py-2 pr-3">
        <span className="block font-display text-sm font-semibold tnum text-slate-900">
          {txt(reg?.entrada) || <Sem>—</Sem>}
        </span>
        <span className="block text-[11px] text-slate-400">
          {inicioPrevisto ? `previsto ${inicioPrevisto}` : "sem jornada prevista"}
        </span>
      </td>

      <td className="whitespace-nowrap py-2 pr-3">
        <span className="block font-display text-sm tnum text-slate-700">
          {emAberto ? <span className="chip-warn">em aberto</span> : txt(reg?.saida) || <Sem>—</Sem>}
        </span>
        <span className="block text-[11px] text-slate-400">
          {fimPrevisto ? `previsto ${fimPrevisto}` : "—"}
        </span>
      </td>

      {/* INTERVALO: 0 e "não sei" são coisas diferentes. Dia com pausa gravada
          em 0 é "não parou" — um FATO do relógio. Dia sem o campo é medida que
          não existe. Escrever "0h00" nos dois casos afirmaria que ninguém parou
          num dia em que ninguém mediu. */}
      <td className="whitespace-nowrap py-2 pr-3 text-xs tnum text-slate-600">
        {!reg || reg.pausaMin === null || reg.pausaMin === undefined || reg.pausaMin === "" ? (
          <Sem>—</Sem>
        ) : Number(reg.pausaMin) > 0 ? (
          duracaoTexto(reg.pausaMin)
        ) : (
          <span className="text-slate-400">sem intervalo</span>
        )}
      </td>

      <td className="whitespace-nowrap py-2 pr-3">
        <span className="block font-display text-sm font-medium tnum text-slate-900">
          {trabalhadoMin === null ? <Sem /> : duracaoTexto(trabalhadoMin)}
        </span>
        <span className="block text-[11px] text-slate-400">
          {previstoMin === null
            ? "previsto não medido"
            : semJornada
              ? "fora da escala"
              : `previsto ${duracaoTexto(previstoMin)}`}
        </span>
      </td>

      <td className="py-2 text-xs">
        {ausencia && <span className={clsx(ausencia.chip, "mr-1")}>{ausencia.rotulo}</span>}
        {ausencia?.motivo && <span className="block text-slate-500">{ausencia.motivo}</span>}
        {!reg && !ausencia && (
          <Sem>{semJornada ? "fim de semana (sem jornada)" : "sem registro"}</Sem>
        )}
        {frase && (
          <span className={clsx("block", pontualidade.atrasoMin > 0 ? "text-warn-700" : "text-slate-500")}>
            {frase}
          </span>
        )}
        {reg && (
          <span className="mt-0.5 block text-[11px] text-slate-400">
            {reg.origem === "jibble" ? "veio do relógio" : "lançado à mão"}
            {reg.corrigido === true && " · corrigido"}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function PessoaDetalhe({
  pessoa, pontoDia, competencia, diaFoco, jornada, hojeISO, aoFechar,
}) {
  const [mes, setMes] = useState(() => txt(competencia) || competenciaDe(diaFoco || hojeISO));
  const linhaFoco = useRef(null);

  /* Reabrir noutra pessoa (ou noutro mês) resseme o painel. Sem isto, clicar no
     nome de outra pessoa mostraria o mês em que o painel tinha parado, e não o
     mês da linha que a pessoa acabou de clicar. */
  useEffect(() => {
    setMes(txt(competencia) || competenciaDe(diaFoco || hojeISO));
  }, [pessoa?.id, pessoa?.jibbleId, pessoa?.nome, competencia, diaFoco, hojeISO]);

  const vm = useMemo(() => {
    if (!pessoa) return null;
    const meus = diasDaPessoa(pontoDia, pessoa);

    const porData = new Map();
    for (const d of meus) {
      const lista = porData.get(d.data) || [];
      lista.push(d);
      porData.set(d.data, lista);
    }

    let repetidos = 0;
    const linhas = diasDoMes(mes).map((iso) => {
      const lista = porData.get(iso) || [];
      if (lista.length > 1) repetidos += lista.length - 1;
      const reg = registroQueVale(lista);
      return {
        iso,
        reg,
        semana: diaDaSemanaISO(iso) ?? 0,
        previstoMin: minutosPrevistosDoDia(iso, jornada),
        inicioPrevisto: inicioPrevistoDoDia(iso, jornada),
        fimPrevisto: fimPrevistoDoDia(iso, jornada),
        trabalhadoMin: reg ? minutosTrabalhados(reg) : null,
        ausencia: reg ? ausenciaDoDia(reg) : null,
        pontualidade: reg ? atrasoDoDia(reg, jornada) : null,
      };
    });

    const doMes = linhas.map((l) => l.reg).filter(Boolean);
    /* Registro da pessoa que cai FORA do mês aberto não some: fica contado, e o
       rodapé diz que existe. Sumir calado é como um mês inteiro de batida
       lançada na competência errada passa despercebido. */
    const foraDoMes = meus.filter((d) => competenciaDe(d.data) !== mes).length;

    return {
      linhas,
      apuracao: apurarCompetencia(doMes, jornada),
      previstoMesMin: minutosPrevistosDoMes(mes, jornada),
      repetidos,
      foraDoMes,
    };
  }, [pessoa, pontoDia, mes, jornada]);

  /* Rolar até o dia clicado. Sem isto, quem clica no nome de uma linha do dia 27
     cai no topo do mês e tem de procurar de novo a linha de onde veio. */
  useEffect(() => {
    if (!vm || !diaFoco) return;
    linhaFoco.current?.scrollIntoView({ block: "center" });
  }, [vm, diaFoco, mes]);

  /* ESCAPE FECHA, E O FUNDO NÃO ROLA ENQUANTO O PAINEL ESTÁ ABERTO.
     Sem o Escape, quem abre pelo teclado fica preso — o painel cobre a tela e
     o único jeito de sair é achar o X com o mouse. E sem travar a rolagem do
     corpo, girar a roda dentro do painel rola a página ATRÁS dele: some a
     linha de onde a pessoa veio, e ela volta perdida. `aoFechar` vai por ref
     para não recriar o efeito a cada render do pai. */
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === "Escape") fecharRef.current?.();
    };
    document.addEventListener("keydown", aoTeclar);
    const rolagemAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagemAntes;
    };
  }, []);

  if (!pessoa || !vm) return null;

  const { linhas, apuracao, previstoMesMin, repetidos, foraDoMes } = vm;
  const a = apuracao;
  const semFicha = !txt(pessoa.id);
  const rodape = [
    repetidos > 0 && plural(repetidos, "dia repetido no mês", "dias repetidos no mês"),
    foraDoMes > 0 && `${plural(foraDoMes, "registro desta pessoa", "registros desta pessoa")} fora deste mês`,
    a.ausenciasDesconhecidas > 0 &&
      plural(a.ausenciasDesconhecidas, "ausência de tipo não reconhecido", "ausências de tipo não reconhecido"),
    a.ausenciasComTrabalho > 0 &&
      `${plural(a.ausenciasComTrabalho, "dia tem ausência E hora trabalhada", "dias têm ausência E hora trabalhada")}`,
  ].filter(Boolean);

  return (
    <Modal titulo={pessoa.nome || "pessoa não identificada"} aberto aoFechar={aoFechar} largura="max-w-4xl">
      {/* ---- QUEM ---- */}
      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        {semFicha ? (
          <span className="chip-warn">batida sem ficha vinculada</span>
        ) : (
          <>
            <span>{pessoa.cargo || "cargo sem registro"}</span>
            {pessoa.setor && <span>· {pessoa.setor}</span>}
            {pessoa.admissao && <span>· admissão {dataLonga(pessoa.admissao)}</span>}
            {pessoa.ativo === false && <span className="chip">desligado</span>}
          </>
        )}
        {txt(pessoa.jibbleId) && <span className="chip">relógio {pessoa.jibbleId}</span>}
      </div>

      {/* ---- O MÊS ---- */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-outline px-2 py-1" onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior">
            <ChevronLeft size={15} strokeWidth={2.5} />
          </button>
          <span className="font-display text-sm font-semibold text-slate-800">{rotuloCompetencia(mes)}</span>
          <button type="button" className="btn-outline px-2 py-1" onClick={() => setMes(mesVizinho(mes, 1))} aria-label="Próximo mês">
            <ChevronRight size={15} strokeWidth={2.5} />
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {a.diasComBatida > 0
            ? plural(a.diasComBatida, "dia com batida", "dias com batida")
            : "nenhum dia com batida neste mês"}
          {a.diasEmAberto > 0 && ` · ${plural(a.diasEmAberto, "dia em aberto", "dias em aberto")}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Para a folha" min={a.trabalhadoMin} sub="soma das horas trabalhadas" />
        <Numero rotulo="Previsto no mês" min={previstoMesMin} sub="pela escala da casa" />
        <Numero
          rotulo="Horas extras"
          min={a.extrasMin}
          sub={a.fonteExtras === "sem" ? "não apurado" : `fonte: ${a.fonteExtras}`}
        />
        <Numero rotulo="Atrasos" min={a.atrasosMin} sub="trabalhado abaixo do previsto" tom={a.atrasosMin ? "text-warn-700" : undefined} />
      </div>

      {a.ausenciasTotal > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {plural(a.ausenciasTotal, "ausência lançada", "ausências lançadas")} —{" "}
          {a.faltasQueDescontam > 0
            ? `${plural(a.faltasQueDescontam, "desconta 1/30", "descontam 1/30")}`
            : "nenhuma desconta"}
          {a.ausenciasSemDesconto > 0 && ` · ${plural(a.ausenciasSemDesconto, "abonada", "abonadas")}`}
        </p>
      )}

      {rodape.length > 0 && (
        <p className="mt-2 text-xs text-warn-700">{rodape.join(" · ")}.</p>
      )}

      {/* ---- O DIA A DIA ---- */}
      <div className="mt-3 max-h-[52vh] overflow-auto rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b text-left font-display text-[11px] uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--hairline)" }}>
              <th scope="col" className="py-2 pl-3 pr-3 font-semibold">Dia</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Entrou</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Saiu</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Intervalo</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Para a folha</th>
              <th scope="col" className="py-2 pr-3 font-semibold">O que houve</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <LinhaDia
                key={l.iso}
                l={l}
                emFoco={l.iso === diaFoco}
                refFoco={l.iso === diaFoco ? linhaFoco : null}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
