// Aba Ponto do RH — o relógio da MinasLab, que é o JIBBLE, e o fechamento do
// mês que sai dele.
//
// A tela funciona nos DOIS MUNDOS, de propósito: com as batidas importadas pela
// ponte (Edge Function ml-ponto → coleção "rh_ponto_dia") e sem nenhuma batida,
// lançando as horas à mão no fechamento. Sem isso, o mês em que o relógio ficar
// fora do ar viraria um mês sem folha.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/RH.jsx)
// ----------------------------------------------------------------------------
//   pessoas    Object[]  todas as fichas (rh_pessoas), ativas e desligadas.
//   ativos     Object[]  só quem está no quadro, já ordenado por nome.
//   ponto      Object[]  coleção "rh_ponto" — o FECHAMENTO por pessoa/mês.
//   pontoDia   Object[]  coleção "rh_ponto_dia" — o dia, batida a batida.
//   hojeISO    string    "AAAA-MM-DD" LOCAL, vindo de ymdLocal(new Date()).
//   editavel   boolean   podeEditar(getSessao()): esconde os botões de escrita.
//   gravar     (colecao, registro, fraseOk, fechar?) => Promise<void>
//   apagarReg  (colecao, id, fraseOk) => Promise<void>
//   setAviso   (aviso|null) => void   { tipo: "ok" | "erro", texto }.
//
// ----------------------------------------------------------------------------
// CONTRATO DAS COLEÇÕES (o que esta aba lê e grava)
//
// "rh_ponto_dia" — o dia. A ponte já grava em produção:
//   { id: "pd_<jibbleId>_<AAAA-MM-DD>", jibbleId, pessoaNome, data,
//     entrada, saida ("HH:MM"), pausaMin, trabalhadoMin (null = EM ABERTO),
//     origem: "jibble", corrigido: false, batidas: [{hora, tipo}] }
//   Esta tela ACRESCENTA, ao corrigir ou lançar à mão:
//     pessoaId          — o id da ficha (a ponte só conhece o jibbleId)
//     origem: "manual"  — dia que nasceu aqui, não no relógio
//     corrigido: true   — PROTEGE o dia: a importação seguinte não sobrescreve
//     relogioEntrada / relogioSaida / relogioPausaMin
//                       — o que o relógio tinha trazido, carimbado na PRIMEIRA
//                         correção; é o que deixa saber depois o que veio da
//                         máquina e o que o RH ajustou.
//
// "rh_ponto" — o fechamento de uma pessoa num mês:
//   { id: "pt_<pessoaId>_<AAAA-MM>", pessoaId, pessoaNome (carimbo),
//     competencia, horasExtrasMin, faltas (dias), atrasosMin,
//     adicionalNoturnoMin, valorHoraExtra, valorFaltas, valorCalculado,
//     valorLancado, obs, fechado, fechadoEm }
//   Acrescentados aqui, e todos CARIMBO DOS PARÂMETROS DA CONTA:
//     salarioBase, divisor, fatorHoraExtra, percentualNoturno, valorNoturno
//   Por quê: sem eles, reabrir janeiro depois de um aumento (ou depois de o
//   acordo coletivo mudar o divisor) reescreveria a conta de janeiro com os
//   números de hoje. O que foi conferido e fechado tem de continuar dizendo a
//   mesma coisa daqui a dois anos.
//   ATENÇÃO ao nome herdado: `valorHoraExtra` é o TOTAL em R$ das horas extras
//   (irmão de `valorFaltas`), não o preço da hora — o preço da hora se refaz do
//   carimbo e aparece na conta escrita.
//
// "rh_pessoas" ganha um campo: `jibbleId` — o de-para entre a ficha e o
//   relógio. Mora na FICHA (e não numa coleção de-para) porque é atributo da
//   pessoa, como a matrícula: uma pessoa, um crachá no relógio.
//
// ----------------------------------------------------------------------------
// DECISÕES QUE NÃO SE DISCUTEM (as regras de dinheiro estão em lib/rh/ponto.js,
// com o porquê de cada uma; aqui ficam as da TELA)
//
// - ID MANDA, NOME SÓ EXIBE: a batida casa com a ficha por `pessoaId` ou por
//   `jibbleId`, nunca por nome. Casar por nome cria sósia e some com gente.
// - Batida sem vínculo NÃO SOME da tela: aparece como "pessoa não vinculada",
//   com o nome que o relógio mandou, e entra na conta de pendências. Sumir
//   esconderia trabalho de gente real.
// - Dia sem batida NÃO é falta e NÃO é zero hora: é "em aberto". Falta é
//   afirmação trabalhista (pode ser feriado, folga ou atestado) e quem afirma é
//   o RH, no lançamento — por isso o campo Faltas nunca vem preenchido das
//   batidas.
// - Sem `horasSemanais` na ficha não há saldo: a tela diz isso, em vez de
//   mostrar hora extra ou atraso inventados.
// - Sem salário na ficha não há conta: a linha vira pendência escrita, nunca
//   R$ 0,00 mudo.
// - A diferença entre o valor lançado e o calculado é DERIVADA dos dois valores
//   gravados e aparece na linha, no modal e na planilha. Não é escrita dentro
//   de `obs`: texto copiado para dentro de um campo envelhece no primeiro
//   reajuste e passa a mentir; derivada, ela nunca desmente os números.

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlarmClock, CalendarClock, CircleAlert, Clock, Download, Link2, Lock, LockOpen,
  Pencil, Plus, RefreshCw, Settings2, Trash2, Unlink, Wallet,
} from "lucide-react";
import { lerCfg, salvarCfg } from "../../services/dados.js";
import { importarPeriodo } from "../../services/ponto.js";
import { dataLonga, moedaCheia, paraNumero, MESES_LONGOS } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import {
  ADICIONAIS_HE, apurarCompetencia, calcularFechamento, cfgDoPonto, competenciaDe,
  diferencaDoCalculo, duracaoCampo, duracaoTexto, horasDecimais, minutosDaDuracao,
  minutosDoDia, minutosEntre, minutosPrevistosPorDia, minutosTrabalhados,
} from "../../lib/rh/ponto.js";
import { SectionTitle, Empty, Modal, Card, StatCard, Segmented } from "../ui.jsx";
import { anoRuim } from "./uteis.js";

const COL_DIA = "rh_ponto_dia";
const COL_FECHAMENTO = "rh_ponto";

// O grupo das batidas que não casaram com ficha nenhuma.
const SEM_VINCULO = "__sem_vinculo__";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const txt = (v) => String(v ?? "").trim();

// Dinheiro que pode não existir. null é "não dá para calcular", e a frase diz
// isso — R$ 0,00 aqui seria uma afirmação falsa sobre a folha de alguém.
const dinheiro = (v) => (v === null || v === undefined || v === "" ? "sem valor" : moedaCheia(v));
const horasOuNada = (min) => duracaoTexto(min) || "sem registro";

function rotuloCompetencia(c) {
  const [ano, mes] = String(c || "").split("-");
  const nome = MESES_LONGOS[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : String(c || "");
}

function rotuloFator(f) {
  const achado = ADICIONAIS_HE.find((a) => a.fator === Number(f));
  if (achado) return achado.curto;
  return `+${Math.round((Number(f) - 1) * 100)}%`;
}

// Número de dias/minutos que veio de campo de texto. Campo em branco no
// formulário de lançamento é "não houve" — 0 — e não "não sei": quem preenche
// está olhando o mês inteiro e decidindo.
function inteiroDoCampo(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Um dia, uma apuração.
 *
 * O mesmo dia pode aparecer duas vezes quando alguém lançou à mão ANTES de a
 * pessoa ser vinculada ao relógio e a importação trouxe o mesmo dia depois — os
 * ids são diferentes (pdm_… e pd_…), então nenhum sobrescreve o outro. Vale a
 * batida corrigida/lançada à mão, que é a que alguém conferiu.
 *
 * Nada some: as duas linhas continuam no extrato e a linha do fechamento diz
 * que há dia repetido. Somar as duas inflaria hora extra — e isso é dinheiro.
 */
function porDiaUnico(dias) {
  const mapa = new Map();
  for (const d of dias) {
    const atual = mapa.get(d.data);
    if (!atual || (d.corrigido === true && atual.corrigido !== true)) mapa.set(d.data, d);
  }
  return { unicos: [...mapa.values()], repetidos: dias.length - mapa.size };
}

/**
 * A CONTA ESCRITA PASSO A PASSO.
 *
 * Cada passo é composto dos MESMOS números que a lib devolveu — é isso que faz
 * a conta da tela ser a conta do sistema. Quem conferir na calculadora tem que
 * chegar no mesmo lugar, senão o RH volta para a planilha.
 */
function passosDaConta(c) {
  if (!c || c.semSalario) return [];
  const passos = [];
  if (c.horasExtrasMin > 0) {
    passos.push(
      `Hora extra: ${moedaCheia(c.salarioBase)} ÷ ${c.divisor} = ${moedaCheia(c.valorHora)}/h` +
        ` · com ${rotuloFator(c.fator)} = ${moedaCheia(c.valorHoraExtra)}/h` +
        ` · × ${duracaoTexto(c.horasExtrasMin)} = ${moedaCheia(c.valorExtras)}`
    );
  }
  if (c.adicionalNoturnoMin > 0) {
    passos.push(
      `Adicional noturno: ${c.percentualNoturno}% de ${moedaCheia(c.valorHora)}/h = ${moedaCheia(c.valorAdicionalNoturnoHora)}/h` +
        ` · × ${duracaoTexto(c.adicionalNoturnoMin)} = ${moedaCheia(c.valorNoturno)}`
    );
  }
  if (c.faltas > 0) {
    passos.push(
      `Falta: ${moedaCheia(c.salarioBase)} ÷ ${c.divisorDiario} = ${moedaCheia(c.valorDia)}/dia` +
        ` · × ${plural(c.faltas, "dia", "dias")} = −${moedaCheia(c.valorFaltasDias)}`
    );
  }
  if (c.atrasosMin > 0) {
    passos.push(
      `Atraso: ${moedaCheia(c.valorHora)}/h × ${duracaoTexto(c.atrasosMin)} = −${moedaCheia(c.valorAtrasos)}`
    );
  }
  if (passos.length > 1) passos.push(`Total: ${moedaCheia(c.valorCalculado)}`);
  return passos;
}

/**
 * Qual salário vale para a conta deste mês.
 *
 * Registro gravado manda pelo CARIMBO: é o que faz março continuar dizendo o
 * que dizia depois do aumento de abril. Mas carimbo VAZIO não é salário — é a
 * marca de que a ficha estava sem salário na hora da gravação; se hoje tem, a
 * conta volta a existir e a tela pede que se grave de novo.
 */
function salarioDaConta(reg, pessoa) {
  if (!reg) return pessoa.salario;
  const carimbo = Object.prototype.hasOwnProperty.call(reg, "salarioBase") ? reg.salarioBase : undefined;
  if (carimbo === undefined || carimbo === null || carimbo === "") return pessoa.salario;
  return carimbo;
}

// A frase da diferença (regra 8): valor alterado que se parece com valor
// calculado é armadilha seis meses depois.
function fraseDaDiferenca(dif) {
  if (!dif) return "";
  return `${moedaCheia(Math.abs(dif))} ${dif > 0 ? "acima" : "abaixo"} do calculado`;
}

// ---- linhas ----------------------------------------------------------------

function LinhaFechamento({ l, editavel, acoes }) {
  const { pessoa, reg, conta, apuracao, repetidos, dif, valorFinal, divergente, semSalarioPendente } = l;
  const passos = passosDaConta(conta);
  const travado = !!reg?.fechado;

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 basis-52">
          <span className="block truncate font-display text-sm font-medium text-slate-900">
            {pessoa.nome}
            {pessoa.ativo === false && <span className="ml-2 chip">desligado</span>}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {[pessoa.cargo || "cargo sem registro", pessoa.setor].filter(Boolean).join(" · ")}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {apuracao.diasComBatida > 0
              ? `${plural(apuracao.diasComBatida, "dia com batida", "dias com batida")} · ${horasOuNada(apuracao.trabalhadoMin)} no mês` +
                (apuracao.diasEmAberto ? ` · ${plural(apuracao.diasEmAberto, "dia em aberto", "dias em aberto")}` : "")
              : "sem batida importada neste mês"}
          </span>
        </span>

        {/* As quantidades do que está LANÇADO. Sem lançamento, a linha diz que
            não há lançamento — não mostra as sugestões como se fossem apuração. */}
        <span className="shrink-0 text-xs text-slate-600">
          {reg ? (
            <>
              <span className="block tnum">
                extras {horasOuNada(reg.horasExtrasMin)} ({rotuloFator(conta.fator)})
              </span>
              <span className="block tnum">
                faltas {reg.faltas ? plural(reg.faltas, "dia", "dias") : "nenhuma"} · atrasos {horasOuNada(reg.atrasosMin)}
              </span>
              {conta.adicionalNoturnoMin > 0 && (
                <span className="block tnum">noturno {duracaoTexto(conta.adicionalNoturnoMin)}</span>
              )}
            </>
          ) : (
            <span className="block text-slate-400">nada lançado neste mês</span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className="block font-display text-sm font-semibold tnum text-slate-900">
            {dinheiro(valorFinal)}
          </span>
          {semSalarioPendente ? (
            <span className="chip-bad mt-0.5 whitespace-nowrap">sem salário na ficha</span>
          ) : (
            dif !== 0 && <span className="chip-warn mt-0.5 whitespace-nowrap">{fraseDaDiferenca(dif)}</span>
          )}
          {travado && (
            <span className="mt-0.5 block text-xs text-slate-400">
              fechado em {dataLonga(reg.fechadoEm)}
            </span>
          )}
        </span>

        {editavel && (
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {!travado && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.lancar(l)}>
                <Pencil size={13} /> {reg ? "Editar" : "Lançar"}
              </button>
            )}
            {reg && !travado && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.fechar(l)}>
                <Lock size={13} /> Fechar
              </button>
            )}
            {travado && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.reabrir(l)}>
                <LockOpen size={13} /> Reabrir
              </button>
            )}
          </span>
        )}
      </div>

      {/* A conta escrita: é ela que faz o número ser conferível na calculadora. */}
      {passos.length > 0 && (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {passos.map((p) => (
            <p key={p} className="tnum">{p}</p>
          ))}
        </div>
      )}

      {semSalarioPendente && (
        <p className="mt-2 text-xs text-bad-700">
          Sem salário na ficha — não dá para calcular. As horas ficam registradas; o valor entra quando a ficha
          de {pessoa.nome} tiver salário.
        </p>
      )}

      {divergente && (
        <p className="mt-2 text-xs text-warn-700">
          O valor gravado ({dinheiro(reg.valorCalculado)}) não bate com a conta acima. Abra e grave de novo para acertar.
        </p>
      )}

      {!reg && !apuracao.semJornada && apuracao.diasComBatida > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Sugestão das batidas: extras {horasOuNada(apuracao.extrasMin)} · atrasos {horasOuNada(apuracao.atrasosMin)}
          {" "}(previsto {duracaoTexto(apuracao.previstoPorDia)}/dia). Faltas não saem das batidas — quem afirma falta é o RH.
        </p>
      )}
      {!reg && apuracao.semJornada && apuracao.diasComBatida > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          Sem jornada na ficha (horas semanais) não dá para saber o que é hora extra e o que é atraso — a tela não
          inventa saldo. Preencha as horas semanais na ficha ou lance as horas à mão.
        </p>
      )}
      {repetidos > 0 && (
        <p className="mt-2 text-xs text-warn-700">
          {plural(repetidos, "dia aparece", "dias aparecem")} mais de uma vez no extrato (lançamento à mão e
          importação do mesmo dia). Vale a batida corrigida — confira em Batidas.
        </p>
      )}
      {reg?.obs && <p className="mt-2 text-xs text-slate-500">{reg.obs}</p>}
    </div>
  );
}

function LinhaBatida({ b, editavel, acoes }) {
  const { d, pessoa, min } = b;
  const veioDoRelogio = d.origem === "jibble";
  const corrigido = d.corrigido === true;
  const original =
    corrigido && (d.relogioEntrada || d.relogioSaida || d.relogioPausaMin !== undefined)
      ? `relógio: ${d.relogioEntrada || "—"} → ${d.relogioSaida || "—"}` +
        (d.relogioPausaMin ? ` (pausa ${d.relogioPausaMin} min)` : "")
      : "";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <span className="w-24 shrink-0 font-display text-xs font-semibold tnum text-slate-700">
        {dataLonga(d.data)}
      </span>

      <span className="min-w-0 flex-1 basis-44">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {pessoa ? pessoa.nome : d.pessoaNome || "pessoa não identificada"}
        </span>
        {!pessoa && (
          <span className="block truncate text-xs text-bad-700">
            pessoa não vinculada{d.jibbleId ? ` — relógio ${d.jibbleId}` : " — a batida veio sem id do relógio"}
          </span>
        )}
        {d.obs && <span className="block truncate text-xs text-slate-500">{d.obs}</span>}
      </span>

      <span className="shrink-0 text-xs tabular-nums text-slate-600">
        <span className="block">
          {d.entrada || "—"} → {d.saida || "—"}
          {d.pausaMin ? ` · pausa ${d.pausaMin} min` : ""}
        </span>
        {original && <span className="block text-slate-400">{original}</span>}
      </span>

      <span className="w-20 shrink-0 text-right font-display text-sm font-semibold tnum text-slate-900">
        {/* trabalhadoMin null é dia EM ABERTO, não dia de zero hora. */}
        {min === null ? <span className="text-xs font-medium text-warn-700">em aberto</span> : duracaoTexto(min)}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <span className={clsx("chip whitespace-nowrap", veioDoRelogio && "chip-brand")}>
          {veioDoRelogio ? "relógio" : "à mão"}
        </span>
        {corrigido && veioDoRelogio && <span className="chip-warn whitespace-nowrap">corrigido</span>}
        {editavel && (
          <>
            <button
              type="button"
              onClick={() => acoes.corrigir(b)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Corrigir esta batida"
            >
              <Pencil size={14} />
            </button>
            {/* Só o que nasceu aqui pode ser apagado: apagar um dia do relógio
                não apaga o dia — a próxima importação o traz de volta. */}
            {d.origem !== "jibble" && (
              <button
                type="button"
                onClick={() => acoes.apagar(b)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
                title="Apagar esta batida"
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

// ---- vínculo pessoa ↔ relógio ---------------------------------------------

function PainelVinculo({ semVinculo, vinculados, ativos, editavel, escolhas, setEscolhas, acoes }) {
  if (semVinculo.length === 0 && vinculados.length === 0) return null;
  return (
    <Card className="mb-4">
      <SectionTitle
        titulo="Vincular ao relógio"
        sub="A batida chega com o id do Jibble; a ficha é escolhida por id, nunca por nome. Sem vínculo, o dia aparece como 'pessoa não vinculada' — e continua aparecendo."
      />

      {semVinculo.length === 0 ? (
        <p className="mb-3 text-sm text-ok-700">Todo id do relógio deste mês já tem ficha.</p>
      ) : (
        <div className="mb-3 space-y-2">
          {semVinculo.map((s) => (
            <div
              key={s.jibbleId || "sem-id"}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
              style={{ borderColor: "var(--hairline)" }}
            >
              <span className="min-w-0 flex-1 basis-52">
                <span className="block truncate font-display text-sm font-medium text-slate-900">
                  {s.nomeNoRelogio || "sem nome no relógio"}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {s.jibbleId ? `relógio ${s.jibbleId}` : "a batida veio sem id do relógio — não dá para vincular"}
                  {" · "}
                  {plural(s.dias, "dia", "dias")} neste mês
                </span>
              </span>
              {editavel && s.jibbleId && (
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`vinc-${s.jibbleId}`}>
                    Ficha de {s.nomeNoRelogio || s.jibbleId}
                  </label>
                  <select
                    id={`vinc-${s.jibbleId}`}
                    className="select h-9 w-56 py-0 text-xs"
                    value={escolhas[s.jibbleId] || ""}
                    onChange={(e) => setEscolhas({ ...escolhas, [s.jibbleId]: e.target.value })}
                  >
                    <option value="">— escolher a pessoa —</option>
                    {ativos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-xs"
                    disabled={!escolhas[s.jibbleId]}
                    onClick={() => acoes.vincular(s.jibbleId, escolhas[s.jibbleId])}
                  >
                    <Link2 size={13} /> Vincular
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {vinculados.length > 0 && (
        <p className="text-xs text-slate-500">
          Já vinculados:{" "}
          {vinculados.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " · "}
              {p.nome} <span className="text-slate-400">({p.jibbleId})</span>
              {editavel && (
                <button
                  type="button"
                  onClick={() => acoes.desvincular(p)}
                  className="ml-1 align-middle text-slate-400 hover:text-bad-700"
                  title={`Desvincular ${p.nome} do relógio`}
                >
                  <Unlink size={12} />
                </button>
              )}
            </span>
          ))}
        </p>
      )}
    </Card>
  );
}

// ---- formulários (FORA da aba: componente dentro de componente remonta a
//      subárvore a cada render e o campo perde o foco a cada letra) ----------

function FormFechamento({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  // A conta refeita a CADA tecla, com os mesmos números que serão gravados: o
  // RH decide olhando o resultado, não depois de gravar.
  const conta = calcularFechamento({
    salario: form.salario,
    divisor: form.divisor,
    fator: Number(form.fator),
    percentualNoturno: form.percentualNoturno,
    horasExtrasMin: minutosDaDuracao(form.horasExtras) ?? 0,
    faltas: inteiroDoCampo(form.faltas),
    atrasosMin: minutosDaDuracao(form.atrasos) ?? 0,
    adicionalNoturnoMin: minutosDaDuracao(form.noturno) ?? 0,
  });
  const passos = passosDaConta(conta);
  const lancado = txt(form.valorLancado) ? paraNumero(form.valorLancado) : null;
  const dif = lancado === null ? 0 : diferencaDoCalculo(lancado, conta.valorCalculado);

  // Duração que não foi entendida trava o Gravar: 0 minuto viraria R$ 0,00 e o
  // lançamento sairia zerado sem ninguém ver o erro de digitação.
  const ruins = [
    ["horas extras", form.horasExtras],
    ["atrasos", form.atrasos],
    ["adicional noturno", form.noturno],
  ].filter(([, v]) => txt(v) && minutosDaDuracao(v) === null);

  return (
    <Modal
      titulo={`Fechamento de ${form.pessoaNome} — ${rotuloCompetencia(form.competencia)}`}
      aberto={!!form}
      aoFechar={aoFechar}
      largura="max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {form.sugestao && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-slate-700">
            <span>
              Batidas do mês: extras {horasOuNada(form.sugestao.extrasMin)} · atrasos {horasOuNada(form.sugestao.atrasosMin)}
              {" "}({plural(form.sugestao.diasComBatida, "dia", "dias")}, previsto {duracaoTexto(form.sugestao.previstoPorDia)}/dia)
            </span>
            <button
              type="button"
              className="btn-outline px-3 py-1.5 text-xs"
              onClick={() =>
                setForm({
                  ...form,
                  horasExtras: duracaoCampo(form.sugestao.extrasMin),
                  atrasos: duracaoCampo(form.sugestao.atrasosMin),
                })
              }
            >
              Usar o apurado
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pt-extras">Horas extras</label>
            <input
              id="pt-extras"
              type="text"
              className="input"
              placeholder="02:30"
              autoFocus
              value={form.horasExtras}
              onChange={setCampo("horasExtras")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-fator">Adicional</label>
            <select id="pt-fator" className="select" value={String(form.fator)} onChange={setCampo("fator")}>
              {ADICIONAIS_HE.map((a) => (
                <option key={a.fator} value={String(a.fator)}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pt-faltas">Faltas (dias)</label>
            <input
              id="pt-faltas"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.faltas}
              onChange={setCampo("faltas")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-atrasos">Atrasos</label>
            <input
              id="pt-atrasos"
              type="text"
              className="input"
              placeholder="00:45"
              value={form.atrasos}
              onChange={setCampo("atrasos")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-noturno">Adicional noturno (horas)</label>
            <input
              id="pt-noturno"
              type="text"
              className="input"
              placeholder="02:00"
              value={form.noturno}
              onChange={setCampo("noturno")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pt-lancado">Valor lançado</label>
            <input
              id="pt-lancado"
              type="text"
              inputMode="decimal"
              className="input"
              placeholder={conta.semSalario ? "R$" : moedaCheia(conta.valorCalculado)}
              value={form.valorLancado}
              onChange={setCampo("valorLancado")}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Duração como <strong>02:30</strong> (ou 2,5 para duas horas e meia). Campo em branco é
          &quot;não houve&quot;. Deixe o valor lançado em branco para usar o calculado.
        </p>

        {ruins.length > 0 && (
          <p className="text-sm font-medium text-bad-700">
            Não entendi a duração de {ruins.map(([nome]) => nome).join(", ")}. Escreva como 02:30 — &quot;2.50&quot; com
            ponto seria 2h30 ou 2,5h, e adivinhar aqui erra em dinheiro.
          </p>
        )}

        <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
          {conta.semSalario ? (
            <p className="font-medium text-bad-700">
              {form.pessoaNome} está sem salário na ficha — não dá para calcular. As horas ficam registradas do
              mesmo jeito, e o valor entra quando a ficha tiver salário.
            </p>
          ) : (
            <>
              {passos.length === 0 ? (
                <p className="text-slate-500">Nada lançado ainda — a conta aparece quando houver hora, falta ou atraso.</p>
              ) : (
                passos.map((p) => (
                  <p key={p} className="tnum text-slate-600">{p}</p>
                ))
              )}
              <p className="mt-1.5 font-display font-semibold tnum text-slate-900">
                Calculado: {moedaCheia(conta.valorCalculado)}
              </p>
              {dif !== 0 && (
                <p className="mt-0.5 font-medium tnum text-warn-700">
                  Lançado {moedaCheia(lancado)} — {fraseDaDiferenca(dif)}.
                </p>
              )}
            </>
          )}
          <p className="mt-1.5 text-xs text-slate-400">
            Base: {conta.semSalario ? "sem salário" : moedaCheia(conta.salarioBase)} ÷ {conta.divisor} h/mês · falta = 1/{conta.divisorDiario}.
            Sem reflexo de DSR — esse cálculo é do escritório contábil.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="pt-obs">Observação</label>
          <textarea id="pt-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || ruins.length > 0}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormBatida({ form, setForm, ativos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const corrigindo = !!form.id;

  const bruto = minutosEntre(form.entrada, form.saida);
  const pausa = inteiroDoCampo(form.pausa);
  const pausaDemais = bruto !== null && pausa > bruto;
  const trabalhado = minutosDoDia({ entrada: form.entrada, saida: form.saida, pausaMin: pausa });

  return (
    <Modal
      titulo={corrigindo ? "Corrigir batida" : "Lançar batida à mão"}
      aberto={!!form}
      aoFechar={aoFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {corrigindo ? (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
            <span className="label mb-0.5">Pessoa e dia</span>
            <p className="font-medium text-slate-900">
              {form.pessoaNome || "pessoa não vinculada"} — {dataLonga(form.data)}
            </p>
            {form.origem === "jibble" && (
              <p className="mt-0.5 text-xs">
                Veio do relógio: {form.relogioEntrada || "—"} → {form.relogioSaida || "—"}
                {form.relogioPausaMin ? ` (pausa ${form.relogioPausaMin} min)` : ""}. A correção fica marcada e a
                próxima importação não a desfaz.
              </p>
            )}
            {/* A data identifica o dia no relógio (o id da ponte é
                pd_<jibbleId>_<dia>): mudar a data aqui deixaria um dia órfão e a
                importação seguinte recriaria o antigo. */}
            <p className="mt-0.5 text-xs text-slate-400">
              O dia não se muda por aqui — se a data está errada, lance o dia certo e apague o errado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="bt-pessoa">Pessoa</label>
              <select id="bt-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
                <option value="">— escolher —</option>
                {ativos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="bt-data">Dia</label>
              <input id="bt-data" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="bt-entrada">Entrada</label>
            <input id="bt-entrada" type="time" className="input" value={form.entrada} onChange={setCampo("entrada")} />
          </div>
          <div>
            <label className="label" htmlFor="bt-saida">Saída</label>
            <input id="bt-saida" type="time" className="input" value={form.saida} onChange={setCampo("saida")} />
          </div>
          <div>
            <label className="label" htmlFor="bt-pausa">Pausa (min)</label>
            <input id="bt-pausa" type="number" min="0" step="5" className="input" value={form.pausa} onChange={setCampo("pausa")} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="bt-obs">Observação</label>
          <input id="bt-obs" type="text" className="input" placeholder="Esqueceu de bater a saída, atestado da tarde..." value={form.obs} onChange={setCampo("obs")} />
        </div>

        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
          {pausaDemais ? (
            <p className="font-medium text-bad-700">
              A pausa ({pausa} min) é maior que o intervalo entre a entrada e a saída ({duracaoTexto(bruto)}). Confira
              os três campos.
            </p>
          ) : trabalhado === null ? (
            <p className="text-warn-700">
              Dia <strong>em aberto</strong>: falta a batida de {form.entrada ? "saída" : "entrada"}. Fica registrado
              assim — em aberto não é dia de zero hora.
            </p>
          ) : (
            <p className="tnum text-slate-700">
              Trabalhado: <strong>{duracaoTexto(trabalhado)}</strong>
              {bruto !== null && ` (${duracaoTexto(bruto)} entre as batidas − ${pausa} min de pausa)`}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={salvando || pausaDemais || (!corrigindo && (!form.pessoaId || !form.data))}
          >
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormParametros({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const divisor = inteiroDoCampo(form.divisor);
  return (
    <Modal titulo="Parâmetros do ponto" aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="cf-divisor">Divisor mensal (horas)</label>
          <input id="cf-divisor" type="number" min="1" step="1" className="input" value={form.divisor} onChange={setCampo("divisor")} autoFocus />
          <p className="mt-1 text-xs text-slate-500">
            220 é o divisor da jornada de 44h por semana. Fica aqui porque acordo coletivo muda.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="cf-fator">Adicional padrão de hora extra</label>
          <select id="cf-fator" className="select" value={String(form.fatorHoraExtra)} onChange={setCampo("fatorHoraExtra")}>
            {ADICIONAIS_HE.map((a) => (
              <option key={a.fator} value={String(a.fator)}>{a.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            +50% é o piso da CF (art. 7º XVI). Cada lançamento ainda escolhe o dele.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="cf-noturno">Adicional noturno (%)</label>
          <input id="cf-noturno" type="number" min="0" step="1" className="input" value={form.percentualNoturno} onChange={setCampo("percentualNoturno")} />
          <p className="mt-1 text-xs text-slate-500">
            20% é o piso urbano (CLT art. 73). A redução da hora noturna é conversão do escritório contábil — aqui o
            adicional incide sobre os minutos lançados.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Isto muda a conta dos meses AINDA ABERTOS. O que já foi fechado guarda os parâmetros com que foi calculado
          e continua dizendo a mesma coisa.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || divisor <= 0}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- planilhas -------------------------------------------------------------

const COLUNAS_FECHAMENTO = [
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "cargo", rotulo: "Cargo" },
  { chave: "competencia", rotulo: "Competência" },
  { chave: "situacao", rotulo: "Situação" },
  { chave: "horasExtras", rotulo: "Horas extras (h)", tipo: "numero" },
  { chave: "adicional", rotulo: "Adicional" },
  { chave: "faltas", rotulo: "Faltas (dias)", tipo: "numero" },
  { chave: "atrasos", rotulo: "Atrasos (h)", tipo: "numero" },
  { chave: "noturno", rotulo: "Ad. noturno (h)", tipo: "numero" },
  { chave: "salarioBase", rotulo: "Salário base", tipo: "dinheiro" },
  { chave: "divisor", rotulo: "Divisor", tipo: "numero" },
  { chave: "valorHora", rotulo: "Valor hora", tipo: "dinheiro" },
  { chave: "valorHoraExtra", rotulo: "Valor hora extra", tipo: "dinheiro" },
  { chave: "valorExtras", rotulo: "Horas extras (R$)", tipo: "dinheiro" },
  { chave: "valorNoturno", rotulo: "Ad. noturno (R$)", tipo: "dinheiro" },
  { chave: "valorFaltas", rotulo: "Descontos (R$)", tipo: "dinheiro" },
  { chave: "valorCalculado", rotulo: "Calculado (R$)", tipo: "dinheiro" },
  { chave: "valorLancado", rotulo: "Lançado (R$)", tipo: "dinheiro" },
  { chave: "diferenca", rotulo: "Diferença (R$)", tipo: "dinheiro" },
  { chave: "diasComBatida", rotulo: "Dias com batida", tipo: "numero" },
  { chave: "diasEmAberto", rotulo: "Dias em aberto", tipo: "numero" },
  { chave: "obs", rotulo: "Observação" },
];

const COLUNAS_BATIDAS = [
  { chave: "data", rotulo: "Dia", tipo: "data" },
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "entrada", rotulo: "Entrada" },
  { chave: "saida", rotulo: "Saída" },
  { chave: "pausaMin", rotulo: "Pausa (min)", tipo: "numero" },
  { chave: "trabalhado", rotulo: "Trabalhado (h)", tipo: "numero" },
  { chave: "origem", rotulo: "Origem" },
  { chave: "corrigido", rotulo: "Corrigido" },
  { chave: "relogio", rotulo: "Veio do relógio" },
  { chave: "jibbleId", rotulo: "Id no relógio" },
  { chave: "obs", rotulo: "Observação" },
];

// ============================================================================

export default function AbaPonto({
  pessoas, ativos, ponto, pontoDia, hojeISO, editavel, gravar, apagarReg, setAviso, recarregar,
}) {
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const [visao, setVisao] = useState("fechamento");
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [formFechamento, setFormFechamento] = useState(null);
  const [formBatida, setFormBatida] = useState(null);
  const [formParametros, setFormParametros] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [escolhasVinculo, setEscolhasVinculo] = useState({});
  // A configuração global. null = AINDA NÃO CARREGOU (ou falhou), que não é o
  // mesmo que "não existe": enquanto isso a conta usa o padrão da casa e a tela
  // diz que está usando o padrão.
  const [config, setConfig] = useState(null);
  const [cfgFalhou, setCfgFalhou] = useState(false);

  /* PUXAR DO RELÓGIO — o texto do botão é o próprio progresso, porque a
     importação de um mês leva janelas e um botão parado parece travado.
     A ponte preserva o dia corrigido à mão; o número de preservados é dito em
     voz alta, senão o RH acharia que a correção dele se perdeu. */
  const [importando, setImportando] = useState("");

  const puxarDoRelogio = async () => {
    if (importando) return;
    const [a, m] = competencia.split("-").map(Number);
    const de = `${competencia}-01`;
    const ate = `${competencia}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
    setImportando("Puxando...");
    try {
      const r = await importarPeriodo(de, ate, ({ lidos }) => setImportando(`${lidos} batidas...`));
      setAviso({
        tipo: "ok",
        texto: r.lidos === 0
          // Zero não é resultado: pode ser mês sem batida ou fonte sem resposta.
          ? "O relógio não devolveu batida nenhuma neste mês. Confira o período no Jibble."
          : `${r.gravados} dia(s) atualizados do relógio.` +
            (r.preservados ? ` ${r.preservados} corrigido(s) à mão foram preservados.` : ""),
      });
      recarregar?.();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setImportando("");
    }
  };

  const carregarCfg = useCallback(() => {
    lerCfg()
      .then((c) => {
        setConfig(c || {});
        setCfgFalhou(false);
      })
      .catch(() => setCfgFalhou(true));
  }, []);

  useEffect(() => {
    carregarCfg();
  }, [carregarCfg]);

  const cfg = useMemo(() => cfgDoPonto(config), [config]);

  const vm = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    const porJibble = new Map();
    for (const p of pessoas) {
      const j = txt(p.jibbleId);
      if (j) porJibble.set(j, p);
    }

    // ID MANDA: a batida casa por pessoaId ou por jibbleId. Nome nunca — nome
    // igual entre duas pessoas cria sósia, e nome que mudou some com o dia.
    const doMes = (pontoDia || []).filter((d) => competenciaDe(d.data) === competencia);
    const batidas = doMes
      .map((d) => {
        const pessoa =
          (d.pessoaId && porId.get(d.pessoaId)) ||
          (txt(d.jibbleId) && porJibble.get(txt(d.jibbleId))) ||
          null;
        return { d, pessoa, min: minutosTrabalhados(d) };
      })
      .sort(
        (a, b) =>
          String(b.d.data).localeCompare(String(a.d.data)) ||
          norm(a.pessoa?.nome || a.d.pessoaNome).localeCompare(norm(b.pessoa?.nome || b.d.pessoaNome))
      );

    const diasPorPessoa = new Map();
    const semVinculoMap = new Map();
    for (const b of batidas) {
      if (b.pessoa) {
        if (!diasPorPessoa.has(b.pessoa.id)) diasPorPessoa.set(b.pessoa.id, []);
        diasPorPessoa.get(b.pessoa.id).push(b.d);
        continue;
      }
      // Batida órfã NÃO some: vira pendência com o nome que o relógio mandou.
      const chave = txt(b.d.jibbleId);
      const g = semVinculoMap.get(chave) || { jibbleId: chave, nomeNoRelogio: "", dias: 0 };
      g.dias += 1;
      if (!g.nomeNoRelogio && b.d.pessoaNome) g.nomeNoRelogio = b.d.pessoaNome;
      semVinculoMap.set(chave, g);
    }
    const semVinculo = [...semVinculoMap.values()].sort((a, b) =>
      norm(a.nomeNoRelogio).localeCompare(norm(b.nomeNoRelogio))
    );

    const regsMes = (ponto || []).filter((r) => r.competencia === competencia);
    const regPorPessoa = new Map();
    for (const r of regsMes) {
      if (!regPorPessoa.has(r.pessoaId)) regPorPessoa.set(r.pessoaId, r);
    }

    // Quem entra no fechamento: o quadro de hoje MAIS quem tem batida ou
    // lançamento no mês. Desligada no dia 15 ainda recebe pela primeira
    // quinzena — some da lista e some da folha.
    const daLinha = [...ativos];
    const jaTem = new Set(daLinha.map((p) => p.id));
    for (const id of new Set([...diasPorPessoa.keys(), ...regsMes.map((r) => r.pessoaId)])) {
      if (!id || jaTem.has(id)) continue;
      jaTem.add(id);
      const p = porId.get(id);
      // Ficha que não resolve não é descartada em silêncio: entra com o nome
      // carimbado no lançamento, para o RH ver que existe e ir atrás.
      daLinha.push(p || { id, nome: regPorPessoa.get(id)?.pessoaNome || "(ficha não encontrada)", ausente: true });
    }
    daLinha.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    const linhas = daLinha.map((pessoa) => {
      const dias = diasPorPessoa.get(pessoa.id) || [];
      const { unicos, repetidos } = porDiaUnico(dias);
      const apuracao = apurarCompetencia(unicos, minutosPrevistosPorDia(pessoa.horasSemanais));
      const reg = regPorPessoa.get(pessoa.id) || null;

      // Registro gravado: manda o CARIMBO dos parâmetros. Sem carimbo (registro
      // antigo), cai no que a ficha e a configuração dizem hoje.
      const conta = reg
        ? calcularFechamento({
            salario: salarioDaConta(reg, pessoa),
            divisor: reg.divisor || cfg.divisor,
            fator: reg.fatorHoraExtra || cfg.fatorHoraExtra,
            percentualNoturno:
              reg.percentualNoturno === undefined || reg.percentualNoturno === null
                ? cfg.percentualNoturno
                : reg.percentualNoturno,
            horasExtrasMin: reg.horasExtrasMin,
            faltas: reg.faltas,
            atrasosMin: reg.atrasosMin,
            adicionalNoturnoMin: reg.adicionalNoturnoMin,
          })
        : calcularFechamento({
            salario: pessoa.salario,
            divisor: cfg.divisor,
            fator: cfg.fatorHoraExtra,
            percentualNoturno: cfg.percentualNoturno,
            horasExtrasMin: apuracao.extrasMin || 0,
            atrasosMin: apuracao.atrasosMin || 0,
          });

      // Texto ilegível no campo de dinheiro não vira R$ 0,00: sem número válido,
      // vale o calculado, e a divergência aparece na conferência.
      const bruto =
        reg && reg.valorLancado !== "" && reg.valorLancado !== null && reg.valorLancado !== undefined
          ? Number(reg.valorLancado)
          : null;
      const temLancado = bruto !== null && Number.isFinite(bruto);
      const valorFinal = temLancado ? bruto : reg ? conta.valorCalculado : null;
      const dif = temLancado ? diferencaDoCalculo(bruto, conta.valorCalculado) : 0;
      // Controle: o valor gravado tem que ser o que esta conta produz. Se não
      // for (registro de outra versão, gravado por outro cliente, ou gravado
      // quando a ficha ainda não tinha salário), a tela avisa em vez de mostrar
      // dois números como se fossem um.
      const gravadoSemValor =
        !!reg && (reg.valorCalculado === "" || reg.valorCalculado === null || reg.valorCalculado === undefined);
      const divergente =
        !!reg &&
        !conta.semSalario &&
        (gravadoSemValor || diferencaDoCalculo(reg.valorCalculado, conta.valorCalculado) !== 0);
      // Falta de salário só é PENDÊNCIA de quem tem mês para fechar: cobrar a
      // ficha de quem não trabalhou nem lançou nada faria o número nunca zerar,
      // e número que nunca zera deixa de ser lido.
      const semSalarioPendente = conta.semSalario && (!!reg || apuracao.diasComBatida > 0);

      return { pessoa, dias, repetidos, apuracao, reg, conta, dif, valorFinal, divergente, semSalarioPendente };
    });

    const lancadas = linhas.filter((l) => l.reg);
    const extrasLancadasMin = lancadas.reduce((s, l) => s + (Number(l.reg.horasExtrasMin) || 0), 0);
    const extrasApuradasMin = linhas.reduce((s, l) => s + (l.apuracao.extrasMin || 0), 0);
    const comValor = lancadas.filter((l) => l.valorFinal !== null && l.valorFinal !== undefined);
    const semSalario = linhas.filter((l) => l.semSalarioPendente);

    const anos = new Set([Number(String(hojeISO).slice(0, 4)), Number(String(hojeISO).slice(0, 4)) - 1]);
    for (const d of pontoDia || []) {
      const a = Number(String(d.data || "").slice(0, 4));
      if (a) anos.add(a);
    }
    for (const r of ponto || []) {
      const a = Number(String(r.competencia || "").slice(0, 4));
      if (a) anos.add(a);
    }

    return {
      batidas,
      linhas,
      semVinculo,
      vinculados: pessoas.filter((p) => txt(p.jibbleId)).sort((a, b) => norm(a.nome).localeCompare(norm(b.nome))),
      anos: [...anos].filter(Boolean).sort((a, b) => b - a),
      kpi: {
        lancadas: lancadas.length,
        total: linhas.length,
        semLancamento: linhas.length - lancadas.length,
        extrasLancadasMin: lancadas.length ? extrasLancadasMin : null,
        extrasApuradasMin,
        totalRS: comValor.length ? comValor.reduce((s, l) => s + l.valorFinal, 0) : null,
        semSalario: semSalario.length,
        pendencias: semSalario.length + semVinculo.length,
        fechadas: lancadas.filter((l) => l.reg.fechado).length,
      },
    };
  }, [pessoas, ativos, ponto, pontoDia, competencia, cfg, hojeISO]);

  // O recorte visível da aba Batidas — é ele que a planilha leva.
  const batidasVisiveis = useMemo(() => {
    if (!filtroPessoa) return vm.batidas;
    if (filtroPessoa === SEM_VINCULO) return vm.batidas.filter((b) => !b.pessoa);
    return vm.batidas.filter((b) => b.pessoa?.id === filtroPessoa);
  }, [vm.batidas, filtroPessoa]);

  const disparar = async (colecao, registro, fraseOk, fechar) => {
    setSalvando(true);
    try {
      await gravar(colecao, registro, fraseOk, fechar);
    } finally {
      setSalvando(false);
    }
  };

  // ---- vínculo -------------------------------------------------------------

  const vincular = (jibbleId, pessoaId) => {
    const p = pessoas.find((x) => x.id === pessoaId);
    if (!p) return setAviso({ tipo: "erro", texto: "Não encontrei essa ficha. Recarregue a tela." });
    // Um crachá, uma pessoa: dois vínculos no mesmo id fariam o mesmo dia
    // aparecer para duas pessoas, e a folha pagaria duas vezes.
    const outro = pessoas.find((x) => x.id !== pessoaId && txt(x.jibbleId) === txt(jibbleId));
    if (outro) {
      return setAviso({
        tipo: "erro",
        texto: `O relógio ${jibbleId} já está vinculado a ${outro.nome}. Desvincule antes de trocar.`,
      });
    }
    return disparar("rh_pessoas", { ...p, jibbleId: txt(jibbleId) }, `${p.nome} vinculado ao relógio ${jibbleId}.`, () =>
      setEscolhasVinculo({})
    );
  };

  const desvincular = (p) => {
    if (!window.confirm(`Desvincular ${p.nome} do relógio ${p.jibbleId}? As batidas dela voltam a aparecer como "pessoa não vinculada".`)) return;
    disparar("rh_pessoas", { ...p, jibbleId: "" }, `${p.nome} desvinculado do relógio.`);
  };

  // ---- fechamento ----------------------------------------------------------

  const abrirFechamento = (l) => {
    const reg = l.reg;
    setFormFechamento({
      id: reg?.id || "",
      pessoaId: l.pessoa.id,
      pessoaNome: l.pessoa.nome,
      competencia,
      // O salário do MOMENTO da conta: registro gravado mantém o que foi
      // carimbado; lançamento novo pega o da ficha.
      salario: salarioDaConta(reg, l.pessoa),
      divisor: reg?.divisor || cfg.divisor,
      percentualNoturno:
        reg?.percentualNoturno === undefined || reg?.percentualNoturno === null
          ? cfg.percentualNoturno
          : reg.percentualNoturno,
      fator: reg?.fatorHoraExtra || cfg.fatorHoraExtra,
      // duracaoCampo(0) devolve "00:00": zero gravado tem que voltar como zero,
      // senão o próximo Gravar apaga o zero em silêncio.
      horasExtras: reg ? duracaoCampo(reg.horasExtrasMin) : "",
      faltas: reg && reg.faltas !== "" && reg.faltas !== null && reg.faltas !== undefined ? String(reg.faltas) : "",
      atrasos: reg ? duracaoCampo(reg.atrasosMin) : "",
      noturno: reg ? duracaoCampo(reg.adicionalNoturnoMin) : "",
      // Mesmo desenho para o dinheiro: paraCampo(0) devolveria "" e apagaria o
      // zero lançado de propósito ("este mês não tem nada a receber").
      valorLancado:
        reg && reg.valorLancado !== "" && reg.valorLancado !== null && reg.valorLancado !== undefined
          ? String(reg.valorLancado).replace(".", ",")
          : "",
      obs: reg?.obs || "",
      fechado: !!reg?.fechado,
      fechadoEm: reg?.fechadoEm || "",
      sugestao: l.apuracao.diasComBatida > 0 && !l.apuracao.semJornada ? l.apuracao : null,
    });
  };

  const gravarFechamento = () => {
    const f = formFechamento;
    if (!f) return;
    const extras = txt(f.horasExtras) ? minutosDaDuracao(f.horasExtras) : 0;
    const atrasos = txt(f.atrasos) ? minutosDaDuracao(f.atrasos) : 0;
    const noturno = txt(f.noturno) ? minutosDaDuracao(f.noturno) : 0;
    if (extras === null || atrasos === null || noturno === null) {
      // Nunca gravar 0 no lugar do que não foi entendido: o mês sairia zerado e
      // ninguém veria o erro de digitação.
      return setAviso({
        tipo: "erro",
        texto: "Não entendi uma das durações. Escreva como 02:30 (ou 2,5 para duas horas e meia).",
      });
    }
    const faltas = inteiroDoCampo(f.faltas);
    const conta = calcularFechamento({
      salario: f.salario,
      divisor: f.divisor,
      fator: Number(f.fator),
      percentualNoturno: f.percentualNoturno,
      horasExtrasMin: extras,
      faltas,
      atrasosMin: atrasos,
      adicionalNoturnoMin: noturno,
    });

    return disparar(
      COL_FECHAMENTO,
      {
        // Id determinístico: um fechamento por pessoa e mês. Sem isso, dois
        // cliques criavam dois fechamentos do mesmo mês e a folha somava dobrado.
        id: f.id || `pt_${f.pessoaId}_${f.competencia}`,
        pessoaId: f.pessoaId,
        pessoaNome: f.pessoaNome, // carimbo: a linha continua legível depois do desligamento
        competencia: f.competencia,
        horasExtrasMin: extras,
        faltas,
        atrasosMin: atrasos,
        adicionalNoturnoMin: noturno,
        // Carimbo dos parâmetros: é o que faz este mês continuar dizendo a mesma
        // coisa depois de um aumento ou de o acordo coletivo mudar o divisor.
        salarioBase: conta.semSalario ? "" : conta.salarioBase,
        divisor: conta.divisor,
        fatorHoraExtra: conta.fator,
        percentualNoturno: conta.percentualNoturno,
        // Sem salário, dinheiro vai VAZIO — nunca 0, que afirmaria "nada a receber".
        valorHoraExtra: conta.valorExtras === null ? "" : conta.valorExtras,
        valorNoturno: conta.valorNoturno === null ? "" : conta.valorNoturno,
        valorFaltas: conta.valorFaltas === null ? "" : conta.valorFaltas,
        valorCalculado: conta.valorCalculado === null ? "" : conta.valorCalculado,
        valorLancado: txt(f.valorLancado) ? paraNumero(f.valorLancado) : "",
        obs: txt(f.obs),
        fechado: !!f.fechado,
        fechadoEm: f.fechadoEm || "",
      },
      conta.semSalario
        ? `Horas de ${f.pessoaNome} registradas. Sem salário na ficha, o valor fica pendente.`
        : `Fechamento de ${f.pessoaNome} gravado: ${moedaCheia(
            txt(f.valorLancado) ? paraNumero(f.valorLancado) : conta.valorCalculado
          )}.`,
      () => setFormFechamento(null)
    );
  };

  const fecharLinha = (l) => {
    if (!l.reg) return;
    disparar(
      COL_FECHAMENTO,
      { ...l.reg, fechado: true, fechadoEm: new Date().toISOString() },
      `${l.pessoa.nome} fechado em ${rotuloCompetencia(competencia)}.`
    );
  };

  const reabrirLinha = (l) => {
    if (!l.reg) return;
    // Reabrir exige confirmação: mês fechado é mês conferido, e reabrir sem
    // querer deixaria a folha mudar debaixo de quem já assinou.
    if (!window.confirm(`Reabrir o fechamento de ${l.pessoa.nome} em ${rotuloCompetencia(competencia)}? A edição volta a ser permitida.`)) return;
    disparar(COL_FECHAMENTO, { ...l.reg, fechado: false, fechadoEm: "" }, `${l.pessoa.nome} reaberto.`);
  };

  const fecharCompetencia = async () => {
    const abertos = vm.linhas.filter((l) => l.reg && !l.reg.fechado);
    if (abertos.length === 0) {
      return setAviso({
        tipo: "erro",
        texto: "Não há lançamento aberto neste mês para fechar. Lance as horas primeiro.",
      });
    }
    if (
      !window.confirm(
        `Fechar ${plural(abertos.length, "lançamento", "lançamentos")} de ${rotuloCompetencia(competencia)}? A edição fica travada até alguém reabrir.`
      )
    ) {
      return;
    }
    const agora = new Date().toISOString();
    setSalvando(true);
    try {
      // Um pedido por registro (ids diferentes, sem corrida entre eles). A porta
      // de gravação da casca não devolve o resultado, então a frase final não
      // afirma quantos deram certo: quem diz isso é a coluna "fechado" da lista,
      // que vem recarregada do servidor.
      for (const l of abertos) {
        await gravar(COL_FECHAMENTO, { ...l.reg, fechado: true, fechadoEm: agora }, `${l.pessoa.nome} fechado.`);
      }
      setAviso({
        tipo: "ok",
        texto: `Terminei de fechar ${rotuloCompetencia(competencia)}. Confira na lista quem ficou fechado — o que falhar continua aberto.`,
      });
    } finally {
      setSalvando(false);
    }
  };

  // ---- batidas -------------------------------------------------------------

  const abrirBatidaNova = () =>
    setFormBatida({
      id: "",
      pessoaId: "",
      pessoaNome: "",
      // Nasce no mês que está na tela, não em "hoje": quem está lançando
      // fevereiro não quer um dia de março.
      data: competenciaDe(hojeISO) === competencia ? hojeISO : `${competencia}-01`,
      entrada: "",
      saida: "",
      pausa: "",
      obs: "",
      origem: "manual",
    });

  const abrirCorrecao = (b) =>
    setFormBatida({
      id: b.d.id,
      pessoaId: b.pessoa?.id || b.d.pessoaId || "",
      pessoaNome: b.pessoa?.nome || b.d.pessoaNome || "",
      data: b.d.data,
      entrada: b.d.entrada || "",
      saida: b.d.saida || "",
      pausa:
        b.d.pausaMin === "" || b.d.pausaMin === null || b.d.pausaMin === undefined ? "" : String(b.d.pausaMin),
      obs: b.d.obs || "",
      origem: b.d.origem || "manual",
      base: b.d,
      relogioEntrada: b.d.relogioEntrada ?? b.d.entrada ?? "",
      relogioSaida: b.d.relogioSaida ?? b.d.saida ?? "",
      relogioPausaMin: b.d.relogioPausaMin ?? b.d.pausaMin ?? "",
    });

  const gravarBatida = () => {
    const f = formBatida;
    if (!f) return;
    const ano = anoRuim(f.data);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano do dia: ${ano}` });

    const pausa = inteiroDoCampo(f.pausa);
    const bruto = minutosEntre(f.entrada, f.saida);
    if (bruto !== null && pausa > bruto) {
      return setAviso({ tipo: "erro", texto: "A pausa é maior que o intervalo entre a entrada e a saída." });
    }

    const base = f.base || null;
    const pessoa = pessoas.find((x) => x.id === f.pessoaId) || null;
    if (!base && !pessoa) return setAviso({ tipo: "erro", texto: "Escolha a pessoa." });

    if (!base) {
      // Um dia, um registro: se já existe batida dessa pessoa nesse dia, o
      // caminho é corrigir a que está lá — gravar por cima criaria dois dias.
      const jaTem = (pontoDia || []).find((d) => {
        if (d.data !== f.data) return false;
        if (d.pessoaId && d.pessoaId === pessoa.id) return true;
        return txt(d.jibbleId) && txt(d.jibbleId) === txt(pessoa.jibbleId);
      });
      if (jaTem) {
        return setAviso({
          tipo: "erro",
          texto: `Já existe batida de ${pessoa.nome} em ${dataLonga(f.data)}. Corrija a que está na lista.`,
        });
      }
    }

    const jibbleId = txt(pessoa?.jibbleId) || txt(base?.jibbleId);
    // Id determinístico e IGUAL ao da ponte (pd_<jibbleId>_<dia>) quando a
    // pessoa tem relógio: assim o lançamento à mão ocupa o mesmo dia em vez de
    // virar um segundo registro do mesmo dia. Sem relógio, id próprio.
    const id =
      base?.id ||
      (jibbleId ? `pd_${jibbleId}_${f.data}` : `pdm_${pessoa.id}_${f.data}`);

    // O que o relógio trouxe, carimbado na PRIMEIRA correção — depois disso ele
    // não se mexe, senão a "origem" viraria a correção anterior.
    const primeira =
      base &&
      base.origem === "jibble" &&
      base.corrigido !== true &&
      !Object.prototype.hasOwnProperty.call(base, "relogioEntrada");
    const carimboRelogio = primeira
      ? {
          relogioEntrada: base.entrada || "",
          relogioSaida: base.saida || "",
          relogioPausaMin: base.pausaMin ?? "",
        }
      : {};

    const trabalhado = minutosDoDia({ entrada: f.entrada, saida: f.saida, pausaMin: pausa });

    return disparar(
      COL_DIA,
      {
        ...(base || {}),
        ...carimboRelogio,
        id,
        pessoaId: pessoa?.id || base?.pessoaId || "",
        // Nome é carimbo: se o id não resolver, fica o que já estava gravado.
        pessoaNome: pessoa?.nome || base?.pessoaNome || "",
        jibbleId,
        data: f.data,
        entrada: txt(f.entrada),
        saida: txt(f.saida),
        pausaMin: pausa,
        // null é DIA EM ABERTO, e não zero hora — a apuração conta à parte.
        trabalhadoMin: trabalhado,
        origem: base?.origem || "manual",
        // Marca a correção E protege o dia: sem isso, a importação de amanhã
        // apagaria o ajuste de hoje, em silêncio.
        corrigido: true,
        obs: txt(f.obs),
      },
      base
        ? `Batida de ${dataLonga(f.data)} corrigida.`
        : `Batida de ${pessoa.nome} em ${dataLonga(f.data)} lançada.`,
      () => setFormBatida(null)
    );
  };

  const apagarBatida = (b) => {
    const quem = b.pessoa?.nome || b.d.pessoaNome || "pessoa não vinculada";
    if (!window.confirm(`Apagar a batida de ${quem} em ${dataLonga(b.d.data)}?`)) return;
    apagarReg(COL_DIA, b.d.id, "Batida apagada.");
  };

  // ---- parâmetros ----------------------------------------------------------

  const abrirParametros = () =>
    setFormParametros({
      divisor: String(cfg.divisor),
      fatorHoraExtra: cfg.fatorHoraExtra,
      percentualNoturno: String(cfg.percentualNoturno),
    });

  const gravarParametros = async () => {
    const f = formParametros;
    if (!f) return;
    const divisor = inteiroDoCampo(f.divisor);
    if (divisor <= 0) return setAviso({ tipo: "erro", texto: "O divisor mensal precisa ser maior que zero." });
    setSalvando(true);
    try {
      // A porta de configuração grava o documento INTEIRO. Releio agora, na
      // hora de gravar, para não apagar a chave de outra tela com o que li
      // quando esta aba abriu. Continua sendo ler-calcular-gravar: duas pessoas
      // mexendo no mesmo minuto, a última vence.
      const atual = await lerCfg();
      const ponto = {
        divisor,
        fatorHoraExtra: Number(f.fatorHoraExtra) || 1.5,
        percentualNoturno: inteiroDoCampo(f.percentualNoturno),
      };
      await salvarCfg({ ...(atual || {}), ponto });
      setConfig({ ...(atual || {}), ponto });
      setCfgFalhou(false);
      setFormParametros(null);
      setAviso({
        tipo: "ok",
        texto: `Parâmetros gravados: ${ponto.divisor} h/mês, hora extra ${rotuloFator(ponto.fatorHoraExtra)}, noturno ${ponto.percentualNoturno}%.`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // ---- planilha ------------------------------------------------------------

  const baixar = () => {
    const ehFechamento = visao === "fechamento";
    const linhas = ehFechamento
      ? vm.linhas.map((l) => ({
          pessoa: l.pessoa.nome,
          cargo: l.pessoa.cargo || "",
          competencia: rotuloCompetencia(competencia),
          situacao: !l.reg ? "sem lançamento" : l.reg.fechado ? "fechado" : "aberto",
          // Hora vai em DECIMAL: coluna de texto não soma, e somar é a primeira
          // coisa que se faz com a planilha baixada.
          horasExtras: l.reg ? horasDecimais(l.reg.horasExtrasMin) : "",
          adicional: l.reg ? rotuloFator(l.conta.fator) : "",
          faltas: l.reg ? l.conta.faltas : "",
          atrasos: l.reg ? horasDecimais(l.reg.atrasosMin) : "",
          noturno: l.reg ? horasDecimais(l.reg.adicionalNoturnoMin) : "",
          // Dinheiro em NÚMERO, e vazio quando não há conta — a planilha não
          // inventa R$ 0,00 para quem está sem salário na ficha.
          // Sem LANÇAMENTO não há conta nenhuma: para essas linhas a `conta` é
          // só a SUGESTÃO das batidas (ou zero, para quem não tem nada). Levá-la
          // para a planilha punha "Calculado (R$) 84" numa linha que a tela diz
          // "sem valor" — e somar a coluna inflava a folha com o que ninguém
          // lançou. Por isso a mesma condição das colunas de hora: `l.reg`.
          salarioBase: l.reg && !l.conta.semSalario ? l.conta.salarioBase : "",
          divisor: l.reg ? l.conta.divisor : "",
          valorHora: l.reg ? (l.conta.valorHora ?? "") : "",
          valorHoraExtra: l.reg ? (l.conta.valorHoraExtra ?? "") : "",
          valorExtras: l.reg ? (l.conta.valorExtras ?? "") : "",
          valorNoturno: l.reg ? (l.conta.valorNoturno ?? "") : "",
          valorFaltas: l.reg ? (l.conta.valorFaltas ?? "") : "",
          valorCalculado: l.reg ? (l.conta.valorCalculado ?? "") : "",
          valorLancado: l.reg && l.reg.valorLancado !== "" ? l.reg.valorLancado : "",
          diferenca: l.dif || "",
          diasComBatida: l.apuracao.diasComBatida,
          diasEmAberto: l.apuracao.diasEmAberto,
          obs: l.reg?.obs || "",
        }))
      : batidasVisiveis.map((b) => ({
          data: b.d.data,
          pessoa: b.pessoa?.nome || `${b.d.pessoaNome || "sem nome"} (não vinculada)`,
          entrada: b.d.entrada || "",
          saida: b.d.saida || "",
          pausaMin: b.d.pausaMin === "" || b.d.pausaMin === null || b.d.pausaMin === undefined ? "" : Number(b.d.pausaMin),
          // Dia em aberto sai VAZIO, nunca 0: zero na planilha vira desconto.
          trabalhado: b.min === null ? "" : horasDecimais(b.min),
          origem: b.d.origem === "jibble" ? "relógio" : "à mão",
          corrigido: b.d.corrigido ? "sim" : "não",
          relogio:
            b.d.relogioEntrada || b.d.relogioSaida
              ? `${b.d.relogioEntrada || "—"} → ${b.d.relogioSaida || "—"}`
              : "",
          jibbleId: b.d.jibbleId || "",
          obs: b.d.obs || "",
        }));

    if (linhas.length === 0) {
      return setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
    }
    try {
      const arquivo = baixarPlanilha({
        nome: ehFechamento ? `ponto-fechamento-${competencia}` : `ponto-batidas-${competencia}`,
        titulo: `${ehFechamento ? "Fechamento do ponto" : "Batidas"} — ${rotuloCompetencia(competencia)}`,
        colunas: ehFechamento ? COLUNAS_FECHAMENTO : COLUNAS_BATIDAS,
        linhas,
      });
      setAviso({ tipo: "ok", texto: `Planilha baixada: ${arquivo} (${plural(linhas.length, "linha", "linhas")}).` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  // ---- render --------------------------------------------------------------

  const [ano, mes] = competencia.split("-");
  const semBatidaNoMes = vm.batidas.length === 0;

  return (
    <>
      <Card className="mb-4">
        <SectionTitle
          titulo={`Relógio de ponto — ${rotuloCompetencia(competencia)}`}
          sub="As batidas do Jibble e o fechamento por pessoa. Sem batida importada, as horas se lançam à mão."
          acao={
            <div className="flex flex-wrap items-center gap-2">
              {/* Baixar não é escrita: quem só consulta também precisa da planilha. */}
              <button type="button" className="btn-outline" onClick={baixar}>
                <Download size={16} strokeWidth={2.5} /> Baixar planilha
              </button>
              {editavel && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={puxarDoRelogio}
                  disabled={!!importando}
                  title="Busca no Jibble as batidas desta competência"
                >
                  <RefreshCw size={16} strokeWidth={2.5} className={importando ? "animate-spin" : undefined} />
                  {importando || "Puxar do relógio"}
                </button>
              )}
              {editavel && visao === "batidas" && (
                <button type="button" className="btn-primary" onClick={abrirBatidaNova}>
                  <Plus size={16} strokeWidth={2.5} /> Lançar batida
                </button>
              )}
              {editavel && visao === "fechamento" && (
                <button type="button" className="btn-primary" onClick={fecharCompetencia} disabled={salvando}>
                  <Lock size={16} strokeWidth={2.5} /> Fechar competência
                </button>
              )}
            </div>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="pt-mes">Mês</label>
            <select
              id="pt-mes"
              className="select w-40"
              value={mes}
              onChange={(e) => setCompetencia(`${ano}-${e.target.value}`)}
            >
              {MESES_LONGOS.map((nome, i) => (
                <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pt-ano">Ano</label>
            <select
              id="pt-ano"
              className="select w-28"
              value={ano}
              onChange={(e) => setCompetencia(`${e.target.value}-${mes}`)}
            >
              {vm.anos.map((a) => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <Segmented
              opcoes={[
                { valor: "fechamento", rotulo: "Fechamento" },
                { valor: "batidas", rotulo: "Batidas" },
              ]}
              valor={visao}
              onChange={setVisao}
            />
          </div>
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Settings2 size={13} className="text-slate-400" />
          <span className="tnum">
            {cfg.divisor} h/mês · hora extra {rotuloFator(cfg.fatorHoraExtra)} · adicional noturno {cfg.percentualNoturno}%
            {" · "}falta = 1/30 do salário
          </span>
          {/* Zero não é resultado, e padrão não é escolha: enquanto ninguém
              tiver configurado, a tela diz que está usando o padrão da casa. */}
          {!cfg.definida && <span className="chip">padrão da casa</span>}
          {cfgFalhou && <span className="chip-warn">não consegui ler a configuração — usando o padrão</span>}
          {editavel && (
            <button type="button" className="font-medium text-brand-700 underline hover:opacity-75" onClick={abrirParametros}>
              Ajustar
            </button>
          )}
        </p>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Fechamentos lançados"
          valor={`${vm.kpi.lancadas}/${vm.kpi.total}`}
          tom={vm.kpi.total === 0 ? "neutral" : vm.kpi.lancadas === vm.kpi.total ? "ok" : "warn"}
          sub={
            vm.kpi.semLancamento
              ? `${plural(vm.kpi.semLancamento, "pessoa", "pessoas")} sem lançamento`
              : vm.kpi.fechadas
                ? `${plural(vm.kpi.fechadas, "fechado", "fechados")}`
                : undefined
          }
          icone={CalendarClock}
          onClick={() => setVisao("fechamento")}
          ativo={visao === "fechamento"}
        />
        <StatCard
          rotulo="Horas extras do mês"
          // Nada lançado não é "zero hora extra": é ninguém ter apurado ainda.
          valor={vm.kpi.extrasLancadasMin === null ? "—" : duracaoTexto(vm.kpi.extrasLancadasMin)}
          tom="neutral"
          sub={
            vm.kpi.extrasApuradasMin
              ? `batidas apontam ${duracaoTexto(vm.kpi.extrasApuradasMin)}`
              : vm.kpi.extrasLancadasMin === null
                ? "nada lançado ainda"
                : undefined
          }
          icone={AlarmClock}
        />
        <StatCard
          rotulo="Total em R$"
          valor={vm.kpi.totalRS === null ? "—" : moedaCheia(vm.kpi.totalRS)}
          tom={vm.kpi.totalRS === null ? "neutral" : vm.kpi.totalRS < 0 ? "bad" : "brand"}
          sub={
            vm.kpi.totalRS === null
              ? "nada lançado ainda"
              : vm.kpi.semSalario
                ? `${plural(vm.kpi.semSalario, "pessoa fora da conta", "pessoas fora da conta")} (sem salário)`
                : undefined
          }
          icone={Wallet}
        />
        <StatCard
          rotulo="Pendências"
          valor={String(vm.kpi.pendencias)}
          tom={vm.kpi.pendencias > 0 ? "bad" : "ok"}
          sub={
            vm.kpi.pendencias
              ? [
                  vm.kpi.semSalario ? `${vm.kpi.semSalario} sem salário` : "",
                  vm.semVinculo.length ? `${vm.semVinculo.length} sem vínculo no relógio` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "nada pendente"
          }
          icone={CircleAlert}
        />
      </div>

      <PainelVinculo
        semVinculo={vm.semVinculo}
        vinculados={vm.vinculados}
        ativos={ativos}
        editavel={editavel}
        escolhas={escolhasVinculo}
        setEscolhas={setEscolhasVinculo}
        acoes={{ vincular, desvincular }}
      />

      {visao === "fechamento" ? (
        <Card>
          <SectionTitle
            titulo="Fechamento por pessoa"
            sub="A conta escrita ao lado é a mesma que o sistema faz — dá para conferir na calculadora."
          />
          {/* Nunca mostrar zeros como se fossem apuração. */}
          {semBatidaNoMes && (
            <div className="mb-3 rounded-xl bg-warn-50 px-3.5 py-2.5 text-sm text-warn-700">
              Nenhuma batida importada para este mês. Você pode lançar as horas à mão no Fechamento, ou importar do
              relógio na tela de configuração.
            </div>
          )}
          {vm.linhas.length === 0 ? (
            <Empty>Ninguém no quadro ainda — o fechamento do ponto nasce das pessoas ativas.</Empty>
          ) : (
            <div className="space-y-2">
              {vm.linhas.map((l) => (
                <LinhaFechamento
                  key={l.pessoa.id}
                  l={l}
                  editavel={editavel}
                  acoes={{ lancar: abrirFechamento, fechar: fecharLinha, reabrir: reabrirLinha }}
                />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <SectionTitle
            titulo="Batidas do mês"
            sub="O extrato dia a dia. Correção fica marcada e o que veio do relógio continua à vista."
            acao={
              <div>
                <label className="sr-only" htmlFor="pt-filtro">Pessoa</label>
                <select
                  id="pt-filtro"
                  className="select w-56"
                  value={filtroPessoa}
                  onChange={(e) => setFiltroPessoa(e.target.value)}
                >
                  <option value="">Todas as pessoas</option>
                  {vm.semVinculo.length > 0 && <option value={SEM_VINCULO}>Pessoa não vinculada</option>}
                  {ativos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            }
          />
          {semBatidaNoMes ? (
            <Empty>
              Nenhuma batida importada para este mês. Você pode lançar as horas à mão no Fechamento, ou importar do
              relógio na tela de configuração.
            </Empty>
          ) : batidasVisiveis.length === 0 ? (
            <Empty>Nada neste recorte. Escolha outra pessoa no filtro.</Empty>
          ) : (
            <div className="space-y-2">
              {batidasVisiveis.map((b) => (
                <LinhaBatida
                  key={b.d.id}
                  b={b}
                  editavel={editavel}
                  acoes={{ corrigir: abrirCorrecao, apagar: apagarBatida }}
                />
              ))}
            </div>
          )}
          {batidasVisiveis.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              {plural(batidasVisiveis.length, "dia", "dias")} nesta lista. Dia em aberto não é dia de zero hora — pode
              ser esquecimento de bater, folga ou o relógio fora do ar.
            </p>
          )}
        </Card>
      )}

      <FormFechamento
        form={formFechamento}
        setForm={setFormFechamento}
        salvando={salvando}
        aoSalvar={gravarFechamento}
        aoFechar={() => setFormFechamento(null)}
      />
      <FormBatida
        form={formBatida}
        setForm={setFormBatida}
        ativos={ativos}
        salvando={salvando}
        aoSalvar={gravarBatida}
        aoFechar={() => setFormBatida(null)}
      />
      <FormParametros
        form={formParametros}
        setForm={setFormParametros}
        salvando={salvando}
        aoSalvar={gravarParametros}
        aoFechar={() => setFormParametros(null)}
      />
    </>
  );
}
