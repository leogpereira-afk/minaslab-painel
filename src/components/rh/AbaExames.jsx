// Aba Exames do RH — saúde ocupacional (NR-07/PCMSO e NR-09). Num laboratório
// de análises ambientais isto não é papelada: é exposição a reagente e é
// obrigação legal. O exame vencido para o trabalho, não a burocracia.
//
// ============================================================================
// CONTRATO — props que esta aba recebe da casca (pages/RH.jsx)
// ----------------------------------------------------------------------------
//   pessoas    Object[]  todas as fichas (rh_pessoas), ativas e desligadas.
//   ativos     Object[]  só quem está no quadro, já ordenado por nome.
//   exames     Object[]  coleção "rh_exames" CRUA — todos os exames, inclusive
//                        os antigos já substituídos por um mais novo.
//   radar      Object    resultado de radarExames() (components/rh/uteis.js):
//                        { vigentes, emRisco, vencidos, semData }. É a MESMA
//                        conta do cartão "Exames vencendo (60 dias)" lá em cima
//                        — use esta, não refaça: duas réguas para a mesma
//                        pergunta fazem o cartão brigar com a lista.
//   hojeISO    string    "AAAA-MM-DD" LOCAL, de ymdLocal(new Date()). É estado
//                        da casca, atualizado no visibilitychange.
//   editavel   boolean   podeEditar(getSessao()): esconde os botões de escrita.
//   gravar     (colecao, registro, fraseOk, fechar?) => Promise<void>
//   apagarReg  (colecao, id, fraseOk) => Promise<void>
//   setAviso   (aviso|null) => void   { tipo: "ok" | "erro", texto }.
// ============================================================================
//
// CONTRATO DO REGISTRO (coleção "rh_exames") — o que ESTA tela grava:
//   { id, pessoaId, pessoaNome (CARIMBO),
//     tipo: "admissional" | "periodico" | "retorno" | "mudanca_funcao"
//         | "demissional" | "complementar",
//     exame: texto livre (audiometria, hemograma, espirometria...),
//     data: "AAAA-MM-DD" (quando foi feito),
//     validadeMeses: número (ou "" — ausente não é zero),
//     vence: "AAAA-MM-DD" GRAVADO,
//     validade: "AAAA-MM-DD" — ESPELHO de `vence`, ver abaixo,
//     resultado: "apto" | "apto_com_restricao" | "inapto" | "aguardando" | "",
//     restricao, clinica, medico, obs }
//
// POR QUE `vence` E `validade` GUARDAM A MESMA DATA: o radar de uteis.js — que
// alimenta o cartão do topo do RH e que esta aba não pode reescrever — lê
// `validade`. O nome do campo em toda a casa é `vence` (rh_vencimentos usa
// esse). Gravar os dois no MESMO ponto (gravarExame) é feio, mas o cartão
// dizendo "nenhum exame cadastrado" com trinta exames na lista embaixo é pior.
// Quem um dia mexer em uteis.js apaga o espelho aqui.
//
// AS CINCO REGRAS DESTA TELA (cada uma com o preço já pago):
// 1. O alerta é de 60 DIAS — prazo da casa para SST: dá tempo de agendar a
//    clínica sem parar a escala.
// 2. Pessoa ATIVA SEM NENHUM EXAME sai em seção própria, com a frase "sem exame
//    registrado" e NUNCA "vencido". Na Impresilk, 12 de 32 alertas eram falsos
//    por essa confusão — e alarme falso em obrigação legal ensina a ignorar o
//    alarme verdadeiro.
// 3. Inapto ou apto com restrição mostram a RESTRIÇÃO em destaque na linha: é o
//    dado que muda a escala de trabalho, e ninguém pode descobrir depois.
// 4. `vence` é GRAVADO, não deduzido na hora de exibir — o médico pode dar
//    validade diferente da regra. O formulário SUGERE a data (e mostra a
//    sugestão), mas quem manda é o que está gravado.
// 5. "aguardando" (fez e o laudo não voltou) não é apto e não é falta de exame:
//    tem chip próprio e contagem própria. Preparar não é concluir.
//
// LGPD, art. 11: resultado de exame é dado de saúde. O que aparece aqui é a
// RESTRIÇÃO DE TRABALHO (o que a pessoa não pode fazer), nunca o diagnóstico —
// e a planilha baixada, que circula por e-mail, não leva nem restrição nem
// observações; a tela desta rota já é só da direção.

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle, CalendarClock, ChevronDown, ChevronRight, ClipboardList,
  Download, Hourglass, Pencil, Plus, ShieldAlert, Trash2,
} from "lucide-react";
import { dataLonga, diasEntre, paraNumero, ymdLocal } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { SectionTitle, Empty, Modal, Card, StatCard } from "../ui.jsx";
import { anoRuim, chipVenc } from "./uteis.js";

const txt = (v) => String(v ?? "").trim();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* LEITURA TOLERANTE, ESCRITA CANÔNICA. Registro gravado antes desta tela usava
   outros nomes (realizadoEm/validade/restricoes). Ler os dois lados é barato;
   descartar em silêncio o que não se reconhece é como se esconde problema —
   lição paga na Impresilk com um filtro que jogava fora o desconhecido. */
const venceDe = (e) => txt(e.vence) || txt(e.validade);
const dataDe = (e) => txt(e.data) || txt(e.realizadoEm);
const restricaoDe = (e) => txt(e.restricao) || txt(e.restricoes);

// Hífen e sublinhado do mesmo valor são o MESMO resultado: normalizar na
// leitura evita que "apto-com-restricao" apareça como resultado desconhecido e
// perca o destaque da restrição, que é justamente o que não pode sumir.
const resultadoDe = (e) => txt(e.resultado).toLowerCase().replace(/-/g, "_");

const TIPOS = [
  { valor: "admissional", rotulo: "Admissional" },
  { valor: "periodico", rotulo: "Periódico" },
  { valor: "retorno", rotulo: "Retorno ao trabalho" },
  { valor: "mudanca_funcao", rotulo: "Mudança de função" },
  { valor: "demissional", rotulo: "Demissional" },
  { valor: "complementar", rotulo: "Complementar" },
];

// Mesma normalização do resultado, mais os dois nomes longos que já circularam.
const tipoDe = (e) => {
  const t = txt(e.tipo).toLowerCase().replace(/-/g, "_");
  if (t === "retorno_trabalho") return "retorno";
  if (t === "mudanca_de_funcao") return "mudanca_funcao";
  return t;
};

// Tipo fora da lista aparece CRU, não some: a lista da tela é uma escolha de
// hoje, o banco pode ter o que veio de antes.
const rotuloTipo = (t) => TIPOS.find((x) => x.valor === t)?.rotulo || t || "tipo sem registro";

const RESULTADOS = {
  apto: { rotulo: "Apto", chip: "chip-ok" },
  apto_com_restricao: { rotulo: "Apto com restrição", chip: "chip-warn" },
  inapto: { rotulo: "Inapto", chip: "chip-bad" },
  // Chip PRÓPRIO: laudo que não voltou não pode se parecer com apto.
  aguardando: { rotulo: "Aguardando laudo", chip: "chip-brand" },
};

const metaResultado = (r) =>
  RESULTADOS[r] || { rotulo: r ? `${r} (fora da lista)` : "resultado sem registro", chip: "chip" };

// O resultado que obriga a mostrar a restrição na linha.
const mudaEscala = (r) => r === "inapto" || r === "apto_com_restricao";

/* Os grupos, na ordem da urgência. Cada um é recolhível e a escolha fica
   guardada no navegador (pedido do Léo para telas de análise).
   Um exame cai no PRIMEIRO grupo em que serve — por isso as contagens somam a
   lista inteira, sem ninguém aparecer duas vezes. */
const GRUPOS = [
  {
    id: "vencidos",
    titulo: "Vencidos",
    sub: "Prazo estourado. Exame vencido é pendência legal (NR-07), não atraso administrativo.",
    ponto: "bg-bad-600",
  },
  {
    id: "vencendo",
    titulo: "Vencem em 60 dias",
    sub: "O alerta da casa acende a 60 dias — dá tempo de agendar a clínica sem parar a escala.",
    ponto: "bg-warn-600",
  },
  {
    id: "aguardando",
    titulo: "Aguardando laudo",
    sub: "O exame foi feito e o laudo não voltou. Não é apto e não é falta de exame.",
    ponto: "bg-brand",
  },
  {
    id: "semPrazo",
    titulo: "Sem prazo registrado",
    sub: "Exame registrado sem data de vencimento — sem prazo não há o que cobrar. Abra e complete.",
    ponto: "bg-slate-400",
  },
  {
    id: "emDia",
    titulo: "Em dia",
    sub: "Prazo em dia. O resultado de cada um está na própria linha.",
    ponto: "bg-ok-600",
  },
];

const K_GRUPOS = "minaslab.rh.exames.grupos";
// "Em dia" nasce fechado: é a lista longa e é a que não pede nada.
const GRUPOS_PADRAO = ["vencidos", "vencendo", "aguardando", "semPrazo", "semRegistro"];

function lerGrupos() {
  try {
    const salvo = JSON.parse(localStorage.getItem(K_GRUPOS) || "null");
    return Array.isArray(salvo) ? salvo : GRUPOS_PADRAO;
  } catch {
    // Sem localStorage (ou JSON estragado) vale o padrão.
    return GRUPOS_PADRAO;
  }
}

/* A planilha do recorte: sem restrição e sem observações. Planilha baixada
   circula por e-mail e dado de saúde não viaja em anexo — o mesmo critério que
   deixou banco, endereço e perfil fora da planilha do quadro. */
const COLUNAS = [
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "situacao", rotulo: "Situação" },
  { chave: "tipo", rotulo: "Tipo" },
  { chave: "exame", rotulo: "Exame" },
  { chave: "data", rotulo: "Feito em", tipo: "data" },
  { chave: "validadeMeses", rotulo: "Validade (meses)", tipo: "numero" },
  { chave: "vence", rotulo: "Vence em", tipo: "data" },
  { chave: "dias", rotulo: "Dias para vencer", tipo: "numero" },
  { chave: "resultado", rotulo: "Resultado" },
  { chave: "clinica", rotulo: "Clínica" },
  { chave: "medico", rotulo: "Médico" },
];

// Número ausente fica VAZIO na planilha. Number("") é 0, e zero mês de validade
// seria uma afirmação que ninguém fez.
const numeroOuVazio = (v) => (v === "" || v === null || v === undefined ? "" : Number(v));

const VAZIO_EXAME = {
  id: "", pessoaId: "", pessoaNome: "", tipo: "periodico", exame: "",
  // 12 meses é a periodicidade anual da NR-07: nasce PREENCHIDO e à vista, para
  // ser confirmado ou trocado na hora do cadastro — não é dedução silenciosa.
  data: "", validadeMeses: "12", vence: "",
  // O padrão honesto de um exame recém-lançado: quem tem o ASO na mão troca.
  resultado: "aguardando",
  restricao: "", clinica: "", medico: "", obs: "",
};

/* Soma meses a um dia LOCAL, sem passar por Date de string ISO (que seria
   meia-noite UTC e voltaria um dia no Brasil). 31/01 + 1 mês é 28/02, não
   03/03: o dia encolhe para o último do mês de destino. */
function somarMeses(iso, meses) {
  const [a, m, d] = String(iso).split("-").map(Number);
  if (!a || !m || !d) return "";
  const total = m - 1 + meses;
  const ano = a + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  return ymdLocal(new Date(ano, mes, Math.min(d, ultimoDia)));
}

// A SUGESTÃO do vencimento — nunca o valor exibido na lista. O que a lista lê é
// o campo gravado; aqui é só o que a regra daria.
function sugestaoVence(data, mesesTexto) {
  const dia = txt(data);
  if (!dia || anoRuim(dia)) return "";
  const n = txt(mesesTexto) ? Math.trunc(paraNumero(mesesTexto)) : 0;
  if (!n || n <= 0) return "";
  return somarMeses(dia, n);
}

// ---- Pedaços da tela (FORA do componente da página: dentro, o React remonta a
// subárvore a cada render e o campo perde o foco a cada letra) ---------------

function DestaqueRestricao({ resultado, restricao }) {
  const inapto = resultado === "inapto";
  return (
    <div
      className={clsx(
        "mx-3 mb-3 flex items-start gap-2 rounded-lg border px-3 py-2",
        inapto ? "border-bad-200 bg-bad-50" : "border-warn-200 bg-warn-50"
      )}
    >
      <ShieldAlert size={15} className={clsx("mt-0.5 shrink-0", inapto ? "text-bad-600" : "text-warn-600")} />
      <p className={clsx("text-sm font-medium", inapto ? "text-bad-800" : "text-warn-800")}>
        {inapto ? "Inapto — " : "Restrição de trabalho — "}
        {restricao || (
          <span className="font-normal">
            restrição não registrada: sem ela ninguém sabe o que muda na escala. Abra o exame e escreva.
          </span>
        )}
      </p>
    </div>
  );
}

function ItemHistorico({ h, atual, editavel, aoEditar, aoApagar }) {
  const r = metaResultado(resultadoDe(h));
  const restricao = restricaoDe(h);
  const vence = venceDe(h);
  const data = dataDe(h);
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
      <span className="min-w-0 flex-1 basis-52 text-sm text-slate-700">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {data ? dataLonga(data) : "data do exame sem registro"}
          </span>
          <span className="font-display text-sm font-medium text-slate-900">{rotuloTipo(tipoDe(h))}</span>
          <span className={clsx(r.chip, "whitespace-nowrap")}>{r.rotulo}</span>
          {atual && (
            <span className="chip-brand whitespace-nowrap" title="É este que a lista está cobrando.">
              vale hoje
            </span>
          )}
        </span>
        {h.exame && <span className="block">{h.exame}</span>}
        <span className="block text-xs text-slate-500">
          {vence ? `vence em ${dataLonga(vence)}` : "sem data de vencimento"}
          {h.clinica ? ` · ${h.clinica}` : ""}
          {h.medico ? ` · ${h.medico}` : ""}
        </span>
        {restricao && <span className="block text-xs font-medium text-warn-700">Restrição: {restricao}</span>}
        {h.obs && <span className="block text-xs text-slate-500">{h.obs}</span>}
      </span>
      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={aoEditar}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar este exame"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={aoApagar}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
            title="Apagar este exame"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

function LinhaExame({ l, aberta, aoAlternar, historico, editavel, aoEditar, aoApagar }) {
  const Seta = aberta ? ChevronDown : ChevronRight;
  const r = metaResultado(l.resultado);
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          className="flex min-w-0 flex-1 basis-52 items-center gap-3 text-left"
        >
          <Seta size={16} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-sm font-medium text-slate-900">{l.nome}</span>
            <span className="block truncate text-xs text-slate-500">
              {rotuloTipo(l.tipo)}
              {l.exame ? ` · ${l.exame}` : ""}
              {l.data ? ` · feito em ${dataLonga(l.data)}` : " · data do exame sem registro"}
            </span>
            {/* Id manda, nome só exibe: o exame que aponta para uma ficha que
                não resolve FICA na tela, dizendo que ficou órfão. */}
            {l.foraDoQuadro && (
              <span className="block truncate text-xs text-warn-700">
                ficha não encontrada — este nome é o que ficou gravado no exame
              </span>
            )}
          </span>
        </button>

        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className={clsx(r.chip, "whitespace-nowrap")}>{r.rotulo}</span>
          <span className={clsx(l.cv.chip, "whitespace-nowrap")}>{l.cv.texto}</span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-slate-500">
          {l.vence ? dataLonga(l.vence) : "sem data"}
        </span>

        {editavel && (
          <span className="flex shrink-0 items-center gap-0.5">
            {/* Sempre com o exame explícito: onClick={aoEditar} entregaria o
                EVENTO do clique como se fosse o registro. */}
            <button
              type="button"
              onClick={() => aoEditar(l.e)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => aoApagar(l.e)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
              title="Apagar"
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>

      {/* Fora do recolhível DE PROPÓSITO: a restrição muda a escala de trabalho
          e não pode depender de alguém abrir a linha para aparecer. */}
      {mudaEscala(l.resultado) && <DestaqueRestricao resultado={l.resultado} restricao={l.restricao} />}

      {aberta && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: "var(--hairline)" }}>
          <p className="text-xs text-slate-500">
            Todos os exames de {l.nome} — inclusive os já substituídos por um mais novo.
          </p>
          {historico.map((h) => (
            <ItemHistorico
              key={h.id}
              h={h}
              atual={h.id === l.e.id}
              editavel={editavel}
              aoEditar={() => aoEditar(h)}
              aoApagar={() => aoApagar(h)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaSemExame({ p, editavel, aoRegistrar }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">{p.nome}</span>
        <span className="block truncate text-xs text-slate-500">
          {[p.cargo || "cargo sem registro", p.setor].filter(Boolean).join(" · ")}
        </span>
      </span>
      {/* A frase é ESTA. Nunca "vencido": não ter registro é diferente de estar
          vencido, e alarme falso em obrigação legal ensina a ignorar o
          alarme verdadeiro. */}
      <span className="chip whitespace-nowrap">sem exame registrado</span>
      {editavel && (
        <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={aoRegistrar}>
          <Plus size={13} /> Registrar exame
        </button>
      )}
    </div>
  );
}

function Grupo({ titulo, sub, ponto, contagem, aberta, aoAlternar, children }) {
  const Seta = aberta ? ChevronDown : ChevronRight;
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <Seta size={16} className="shrink-0 text-slate-400" />
        <span className={clsx("h-2 w-2 shrink-0 rounded-full", ponto)} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-slate-900">
            {titulo} <span className="tabular-nums font-normal text-slate-400">({contagem})</span>
          </span>
          <span className="block text-xs text-slate-500">{sub}</span>
        </span>
      </button>
      {aberta && (
        <div className="space-y-2 border-t p-3" style={{ borderColor: "var(--hairline)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FormExame({ form, setForm, ativos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const sugestao = sugestaoVence(form.data, form.validadeMeses);

  /* Mudou a data do exame ou a validade: a sugestão é recalculada e ENTRA no
     campo — mas só quando o campo está vazio ou ainda tem a sugestão anterior.
     Data digitada à mão (o médico deu outro prazo) não pode ser sobrescrita
     porque alguém corrigiu um mês na linha de cima. */
  const mudarBase = (campo) => (e) => {
    const novo = { ...form, [campo]: e.target.value };
    const antes = sugestaoVence(form.data, form.validadeMeses);
    const agora = sugestaoVence(novo.data, novo.validadeMeses);
    if (agora && (!txt(form.vence) || form.vence === antes)) novo.vence = agora;
    setForm(novo);
  };

  const foraDoQuadro = form.pessoaId && !ativos.some((x) => x.id === form.pessoaId);
  const tipoForaDaLista = form.tipo && !TIPOS.some((t) => t.valor === form.tipo);
  const resultadoForaDaLista = form.resultado && !RESULTADOS[form.resultado];

  return (
    <Modal titulo={form.id ? "Editar exame" : "Registrar exame"} aberto={!!form} aoFechar={aoFechar} largura="max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="ex-pessoa">Pessoa</label>
          <select id="ex-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
            <option value="" disabled>— escolha —</option>
            {/* Ficha que não resolve continua selecionável: trocar por outra
                pessoa no meio de uma edição seria falsificar o exame. */}
            {foraDoQuadro && (
              <option value={form.pessoaId}>{form.pessoaNome || "pessoa sem registro"} (fora do quadro)</option>
            )}
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ex-tipo">Tipo do exame</label>
            <select id="ex-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
              {tipoForaDaLista && <option value={form.tipo}>{form.tipo} (fora da lista)</option>}
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ex-exame">Exame</label>
            <input
              id="ex-exame"
              type="text"
              className="input"
              placeholder="ex.: audiometria, hemograma, espirometria"
              value={form.exame}
              onChange={setCampo("exame")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="ex-data">Feito em</label>
            <input id="ex-data" type="date" className="input" value={form.data} onChange={mudarBase("data")} required />
          </div>
          <div>
            <label className="label" htmlFor="ex-meses">Validade (meses)</label>
            <input
              id="ex-meses"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.validadeMeses}
              onChange={mudarBase("validadeMeses")}
            />
          </div>
          <div>
            <label className="label" htmlFor="ex-vence">Vence em</label>
            <input id="ex-vence" type="date" className="input" value={form.vence} onChange={setCampo("vence")} />
          </div>
        </div>

        {sugestao ? (
          form.vence === sugestao ? (
            <p className="text-xs text-slate-500">
              Pela validade registrada, vence em {dataLonga(sugestao)} — troque a data se o médico deu outro prazo.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              A regra daria {dataLonga(sugestao)}.{" "}
              <button
                type="button"
                className="font-display font-semibold text-brand-700 underline"
                onClick={() => setForm({ ...form, vence: sugestao })}
              >
                usar esta data
              </button>
            </p>
          )
        ) : (
          <p className="text-xs text-slate-500">
            Sem laudo ainda? Deixe o vencimento em branco e marque o resultado como Aguardando laudo — a lista cobra o
            prazo depois, sem contar como exame em dia.
          </p>
        )}

        <div>
          <label className="label" htmlFor="ex-resultado">Resultado</label>
          <select id="ex-resultado" className="select" value={form.resultado} onChange={setCampo("resultado")}>
            {/* Registro antigo sem resultado continua sem resultado: a tela não
                inventa um apto que ninguém assinou. */}
            <option value="">sem resultado registrado</option>
            {resultadoForaDaLista && <option value={form.resultado}>{form.resultado} (fora da lista)</option>}
            {Object.entries(RESULTADOS).map(([valor, meta]) => (
              <option key={valor} value={valor}>{meta.rotulo}</option>
            ))}
          </select>
        </div>

        {/* O campo fica SEMPRE à vista, mesmo com resultado apto: escondê-lo
            conforme o resultado deixaria um texto gravado que ninguém consegue
            mais ler nem apagar pela tela. */}
        <div>
          <label className="label" htmlFor="ex-restricao">Restrição de trabalho</label>
          <textarea
            id="ex-restricao"
            className="input"
            rows={2}
            placeholder="O que a pessoa não pode fazer — ex.: sem coleta em campo, sem esforço acima de 10 kg."
            value={form.restricao}
            onChange={setCampo("restricao")}
          />
          {mudaEscala(form.resultado) && !txt(form.restricao) ? (
            /* Aviso, não trava: o exame é o fato e precisa ser registrado hoje.
               A linha da lista cobra a restrição que faltou, em vermelho. */
            <p className="mt-1 text-xs font-medium text-bad-700">
              Resultado com restrição e nenhuma restrição escrita — sem ela ninguém sabe o que muda na escala.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Escreva a restrição de TRABALHO, não o diagnóstico: diagnóstico é dado de saúde (LGPD, art. 11) e o que a
              escala precisa saber é o que a pessoa não pode fazer.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ex-clinica">Clínica</label>
            <input id="ex-clinica" type="text" className="input" value={form.clinica} onChange={setCampo("clinica")} />
          </div>
          <div>
            <label className="label" htmlFor="ex-medico">Médico</label>
            <input id="ex-medico" type="text" className="input" value={form.medico} onChange={setCampo("medico")} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ex-obs">Observações</label>
          <textarea id="ex-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.pessoaId || !form.data}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- A aba ------------------------------------------------------------------

export default function AbaExames({
  pessoas, ativos, exames, radar, hojeISO, editavel, gravar, apagarReg, setAviso,
}) {
  const [abertos, setAbertos] = useState(lerGrupos);
  const [expandida, setExpandida] = useState(null);
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const vista = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const porId = new Map((pessoas || []).map((p) => [p.id, p]));

    // Quem tem ALGUM exame. Vale a coleção crua: um exame vencido de 2019 ainda
    // é um exame registrado, e a seção "Sem exame registrado" fala de ausência
    // de registro, não de prazo.
    const comExame = new Set((exames || []).map((e) => e.pessoaId).filter(Boolean));

    // O histórico por pessoa sai da coleção CRUA — o radar guarda só o exame que
    // vale hoje de cada pessoa+tipo.
    const historico = new Map();
    for (const e of exames || []) {
      const chave = e.pessoaId || "?";
      if (!historico.has(chave)) historico.set(chave, []);
      historico.get(chave).push(e);
    }
    for (const lista of historico.values()) {
      lista.sort(
        (a, b) =>
          String(dataDe(b)).localeCompare(String(dataDe(a))) ||
          String(venceDe(b)).localeCompare(String(venceDe(a)))
      );
    }

    /* Quem está na lista é o radar (mesma régua do cartão do topo). O prazo é
       recalculado aqui com as MESMAS funções de uteis.js (diasEntre + chipVenc);
       o que muda é só a tolerância na leitura do campo — registro gravado com
       `vence` e sem o espelho `validade` apareceria como "sem prazo" e sumiria
       da cobrança. */
    const linhas = (radar?.vigentes || []).map((e) => {
      const vence = venceDe(e);
      const dias = vence ? diasEntre(hojeISO, vence) : null;
      const resultado = resultadoDe(e);
      const grupo =
        dias !== null && dias < 0
          ? "vencidos"
          : dias !== null && dias <= 60
            ? "vencendo"
            : resultado === "aguardando"
              ? "aguardando"
              : dias === null
                ? "semPrazo"
                : "emDia";
      return {
        e,
        vence,
        dias,
        cv: chipVenc(dias),
        resultado,
        grupo,
        tipo: tipoDe(e),
        data: dataDe(e),
        exame: txt(e.exame),
        restricao: restricaoDe(e),
        // Id manda, nome só exibe: o nome vem da ficha; sem ficha, vale o
        // CARIMBO gravado no exame — desligar alguém não apaga o histórico.
        nome: porId.get(e.pessoaId)?.nome || txt(e.pessoaNome) || "pessoa sem registro",
        foraDoQuadro: !porId.has(e.pessoaId),
      };
    });

    const filtradas = linhas
      .filter((l) => (!filtroPessoa || l.e.pessoaId === filtroPessoa) && (!filtroTipo || l.tipo === filtroTipo))
      .sort(
        (a, b) =>
          String(a.vence || "9999-99-99").localeCompare(String(b.vence || "9999-99-99")) ||
          norm(a.nome).localeCompare(norm(b.nome))
      );

    const grupos = { vencidos: [], vencendo: [], aguardando: [], semPrazo: [], emDia: [] };
    for (const l of filtradas) grupos[l.grupo].push(l);

    /* O filtro de TIPO não mexe em quem não tem exame nenhum: com ele ligado a
       frase teria de virar "sem periódico registrado", que é outra afirmação.
       Trocar a frase escondida atrás de um filtro é exatamente como nasce
       alarme falso. */
    const ativosRecorte = (ativos || []).filter((p) => !filtroPessoa || p.id === filtroPessoa);
    const semRegistro = ativosRecorte.filter((p) => !comExame.has(p.id));

    /* O seletor de pessoa lista SEMPRE o quadro inteiro, mais quem só aparece
       nos exames (ficha que não resolve). Montá-lo a partir do recorte prenderia
       quem filtrou: escolhida a pessoa, ela seria a única opção da lista e não
       haveria como voltar. */
    const pessoasFiltro = (ativos || []).map((p) => ({ id: p.id, nome: p.nome }));
    const vistos = new Set(pessoasFiltro.map((p) => p.id));
    for (const l of linhas) {
      if (l.e.pessoaId && !vistos.has(l.e.pessoaId)) {
        vistos.add(l.e.pessoaId);
        pessoasFiltro.push({ id: l.e.pessoaId, nome: `${l.nome} (fora do quadro)` });
      }
    }
    pessoasFiltro.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    // Aguardando que caiu em Vencidos/Vencendo: o prazo grita mais alto que o
    // laudo, mas o cartão precisa dizer que eles existem.
    const aguardandoNoPrazo = filtradas.filter((l) => l.resultado === "aguardando" && l.grupo !== "aguardando").length;

    return { linhas, filtradas, grupos, semRegistro, pessoasFiltro, historico, ativosRecorte, aguardandoNoPrazo };
  }, [pessoas, ativos, exames, radar, hojeISO, filtroPessoa, filtroTipo]);

  const alternarGrupo = (id) =>
    setAbertos((atual) => {
      const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      try {
        localStorage.setItem(K_GRUPOS, JSON.stringify(nova));
      } catch {
        // Sem localStorage a escolha só não persiste.
      }
      return nova;
    });

  const abrirExame = (e, pessoaId) =>
    setForm(
      e
        ? {
            ...VAZIO_EXAME,
            ...e,
            // O campo canônico já chega resolvido: o formulário mostra UM valor,
            // não o novo e o antigo brigando.
            data: dataDe(e),
            vence: venceDe(e),
            restricao: restricaoDe(e),
            resultado: resultadoDe(e),
            tipo: tipoDe(e),
            // 0 gravado tem que voltar como "0" no campo — paraCampo(0) devolve
            // "" e o próximo Gravar apagaria o zero em silêncio.
            validadeMeses:
              e.validadeMeses === null || e.validadeMeses === undefined || e.validadeMeses === ""
                ? ""
                : String(e.validadeMeses),
          }
        : { ...VAZIO_EXAME, pessoaId: pessoaId || "" }
    );

  const gravarExame = async () => {
    const f = form;
    if (!f.pessoaId) return setAviso({ tipo: "erro", texto: "Escolha de quem é este exame." });

    const anoData = anoRuim(f.data);
    if (anoData) return setAviso({ tipo: "erro", texto: `Confira o ano da data do exame: ${anoData}` });
    const anoVence = anoRuim(f.vence);
    if (anoVence) return setAviso({ tipo: "erro", texto: `Confira o ano da data de vencimento: ${anoVence}` });
    if (f.data && f.data > hojeISO) {
      return setAviso({ tipo: "erro", texto: "A data do exame está no futuro — este campo é o dia em que ele foi feito." });
    }
    if (f.data && f.vence && f.vence < f.data) {
      return setAviso({ tipo: "erro", texto: "O vencimento está antes da data do exame. Confira os dois campos." });
    }

    // CARIMBO: o nome vai gravado junto e, se o id não resolver, fica o que já
    // estava lá — pessoa desligada não pode apagar o histórico de exames.
    const pessoa = (ativos || []).find((x) => x.id === f.pessoaId);
    const pessoaNome = pessoa?.nome || txt(f.pessoaNome);

    /* Só dado CRU vai ao banco. `dias` e `cv` são do render (o radar os cola em
       cada item de vigentes) e voltariam gravados junto do exame.
       Os nomes antigos (realizadoEm/restricoes) também saem: com o campo
       canônico preenchido ao lado, dois nomes para o mesmo dado envelhecem em
       silêncio. A limpeza acontece quando alguém EDITA e confirma — nunca
       sozinha ao abrir a tela (migração que roda no carregar vira apagador
       calado). */
    const { dias: _dias, cv: _cv, realizadoEm: _realizadoEm, restricoes: _restricoes, ...cru } = f;
    const vence = txt(f.vence);
    const registro = {
      ...cru,
      pessoaNome,
      tipo: txt(f.tipo),
      exame: txt(f.exame),
      data: txt(f.data),
      // Ausente é ausente: sem validade informada não são zero meses.
      validadeMeses: txt(f.validadeMeses) ? Math.max(0, Math.trunc(paraNumero(f.validadeMeses))) : "",
      vence,
      // ESPELHO para o radar de uteis.js (ver o cabeçalho do arquivo).
      validade: vence,
      resultado: txt(f.resultado),
      // O que a pessoa escreveu fica. Apagar a restrição por conta própria
      // porque o resultado mudou seria perder, numa edição de outro campo, o
      // dado que muda a escala.
      restricao: txt(f.restricao),
      clinica: txt(f.clinica),
      medico: txt(f.medico),
      obs: txt(f.obs),
    };

    const quando = vence ? `vence em ${dataLonga(vence)}` : "sem prazo de vencimento — a lista vai cobrar";
    setSalvando(true);
    try {
      await gravar(
        "rh_exames",
        registro,
        f.id ? `Exame atualizado — ${quando}.` : `Exame registrado para ${pessoaNome || "a pessoa"} — ${quando}.`,
        () => setForm(null)
      );
    } finally {
      setSalvando(false);
    }
  };

  const apagarExame = (h, nome) => {
    const quando = dataDe(h) ? ` de ${dataLonga(dataDe(h))}` : "";
    if (!window.confirm(`Apagar o exame ${rotuloTipo(tipoDe(h))}${quando} de ${nome}? O histórico não terá mais este registro.`)) {
      return;
    }
    apagarReg("rh_exames", h.id, "Exame apagado.");
  };

  const nomeFiltrado = vista.pessoasFiltro.find((p) => p.id === filtroPessoa)?.nome || "";
  const recorte = [
    filtroPessoa ? `pessoa: ${nomeFiltrado}` : "",
    filtroTipo ? `tipo: ${rotuloTipo(filtroTipo)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  /* A planilha leva o RECORTE VISÍVEL: o que os filtros deixaram na tela, na
     mesma ordem dos grupos. Recolher um grupo é conveniência de leitura, não
     filtro — quem fechou "Em dia" não quis excluí-lo do arquivo. */
  const baixar = () => {
    const linhas = [];
    for (const grupo of GRUPOS) {
      for (const l of vista.grupos[grupo.id]) {
        linhas.push({
          pessoa: l.nome,
          situacao: grupo.titulo,
          tipo: rotuloTipo(l.tipo),
          exame: l.exame,
          data: l.data,
          validadeMeses: numeroOuVazio(l.e.validadeMeses),
          vence: l.vence,
          dias: l.dias === null ? "" : l.dias,
          resultado: RESULTADOS[l.resultado]?.rotulo || txt(l.e.resultado),
          clinica: txt(l.e.clinica),
          medico: txt(l.e.medico),
        });
      }
    }
    // Quem não tem exame entra na planilha com as colunas de exame VAZIAS —
    // célula vazia é ausência; escrever 0 ou uma data afirmaria o que não há.
    for (const p of vista.semRegistro) {
      linhas.push({
        pessoa: p.nome,
        situacao: "Sem exame registrado",
        tipo: "", exame: "", data: "", validadeMeses: "", vence: "", dias: "", resultado: "", clinica: "", medico: "",
      });
    }

    if (linhas.length === 0) {
      setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
      return;
    }
    try {
      const arquivo = baixarPlanilha({
        nome: "rh-exames",
        titulo: `Exames ocupacionais — MinasLab${recorte ? ` (${recorte})` : ""}`,
        colunas: COLUNAS,
        linhas,
      });
      setAviso({
        tipo: "ok",
        texto: `Planilha baixada: ${arquivo} (${plural(linhas.length, "linha", "linhas")}) — sem a coluna de restrição: dado de saúde não viaja em anexo.`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  const grupos = vista.grupos;
  // ZERO NÃO É RESULTADO: sem nenhum exame no recorte, "0 vencidos" se lê como
  // "está tudo em dia", e a verdade é que ninguém sabe.
  const semExame = vista.filtradas.length === 0;
  const semNinguem = vista.ativosRecorte.length === 0;
  const nada = semExame && vista.semRegistro.length === 0;

  return (
    <>
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            rotulo="Vencidos"
            valor={semExame ? "—" : String(grupos.vencidos.length)}
            tom={grupos.vencidos.length > 0 ? "bad" : semExame ? "neutral" : "ok"}
            sub={semExame ? "nenhum exame registrado neste recorte" : undefined}
            icone={AlertTriangle}
          />
          <StatCard
            rotulo="Vencem em 60 dias"
            valor={semExame ? "—" : String(grupos.vencendo.length)}
            tom={grupos.vencendo.length > 0 ? "warn" : semExame ? "neutral" : "ok"}
            sub={semExame ? undefined : "sem contar os já vencidos, no cartão ao lado"}
            icone={CalendarClock}
          />
          <StatCard
            rotulo="Sem exame registrado"
            valor={semNinguem ? "—" : String(vista.semRegistro.length)}
            tom={semNinguem ? "neutral" : vista.semRegistro.length > 0 ? "warn" : "ok"}
            sub={
              semNinguem
                ? "ninguém no quadro neste recorte"
                : vista.semRegistro.length > 0
                  ? "pessoa ativa sem nenhum exame — ausência de registro, não vencimento"
                  : "todo mundo do quadro tem exame registrado"
            }
            icone={ClipboardList}
          />
          <StatCard
            rotulo="Aguardando laudo"
            valor={semExame ? "—" : String(grupos.aguardando.length)}
            tom="neutral"
            sub={
              semExame
                ? undefined
                : vista.aguardandoNoPrazo > 0
                  ? `+${vista.aguardandoNoPrazo} com o prazo estourando, contados acima`
                  : "laudo não voltou — não é apto nem falta de exame"
            }
            icone={Hourglass}
          />
        </div>
        {recorte && (
          <p className="mt-2 text-xs text-slate-500">
            Os quatro números contam só o recorte na tela ({recorte}). O cartão do topo do RH conta o quadro inteiro.
          </p>
        )}
      </div>

      <Card>
        <SectionTitle
          titulo="Exames ocupacionais"
          sub="ASO admissional, periódico, de retorno, de mudança de função e demissional — o alerta acende a 60 dias (NR-07)."
          acao={
            <div className="flex flex-wrap items-center gap-2">
              {/* Baixar não é escrita: quem só consulta também precisa da planilha. */}
              <button type="button" className="btn-outline" onClick={baixar}>
                <Download size={16} strokeWidth={2.5} /> Baixar planilha
              </button>
              {editavel && (
                <button type="button" className="btn-primary" onClick={() => abrirExame(null)}>
                  <Plus size={16} strokeWidth={2.5} /> Registrar exame
                </button>
              )}
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ex-filtro-pessoa">Filtrar por pessoa</label>
          <select
            id="ex-filtro-pessoa"
            className="select h-9 w-56"
            value={filtroPessoa}
            onChange={(e) => setFiltroPessoa(e.target.value)}
          >
            <option value="">Todas as pessoas</option>
            {vista.pessoasFiltro.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="ex-filtro-tipo">Filtrar por tipo</label>
          <select
            id="ex-filtro-tipo"
            className="select h-9 w-56"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
          {filtroTipo && vista.semRegistro.length > 0 && (
            <span className="text-xs text-slate-500">
              O filtro de tipo não muda a seção de quem não tem exame nenhum.
            </span>
          )}
        </div>

        {nada && (
          <Empty>
            {recorte
              ? "Nada neste recorte. Tire os filtros para ver o quadro inteiro."
              : "Nenhum exame registrado e ninguém no quadro — a lista nasce das pessoas ativas."}
          </Empty>
        )}

        <div className="space-y-2">
          {GRUPOS.map((grupo) => {
            const lista = grupos[grupo.id];
            // Grupo vazio não aparece: "Vencidos (0)" numa coleção vazia se lê
            // como garantia de que está tudo em dia.
            if (lista.length === 0) return null;
            return (
              <Grupo
                key={grupo.id}
                titulo={grupo.titulo}
                sub={grupo.sub}
                ponto={grupo.ponto}
                contagem={lista.length}
                aberta={abertos.includes(grupo.id)}
                aoAlternar={() => alternarGrupo(grupo.id)}
              >
                {lista.map((l) => (
                  <LinhaExame
                    key={l.e.id}
                    l={l}
                    aberta={expandida === l.e.id}
                    aoAlternar={() => setExpandida(expandida === l.e.id ? null : l.e.id)}
                    historico={vista.historico.get(l.e.pessoaId || "?") || []}
                    editavel={editavel}
                    aoEditar={(h) => abrirExame(h)}
                    aoApagar={(h) => apagarExame(h, l.nome)}
                  />
                ))}
              </Grupo>
            );
          })}

          {vista.semRegistro.length > 0 && (
            <Grupo
              titulo="Sem exame registrado"
              sub="Pessoa ativa sem nenhum exame na coleção. Não é exame vencido: é exame que ninguém lançou ainda."
              ponto="bg-slate-300"
              contagem={vista.semRegistro.length}
              aberta={abertos.includes("semRegistro")}
              aoAlternar={() => alternarGrupo("semRegistro")}
            >
              {vista.semRegistro.map((p) => (
                <LinhaSemExame
                  key={p.id}
                  p={p}
                  editavel={editavel}
                  aoRegistrar={() => abrirExame(null, p.id)}
                />
              ))}
            </Grupo>
          )}
        </div>
      </Card>

      <FormExame
        form={form}
        setForm={setForm}
        ativos={ativos || []}
        salvando={salvando}
        aoSalvar={gravarExame}
        aoFechar={() => setForm(null)}
      />
    </>
  );
}
