// Colunas da tabela de Entradas de amostras: cabeçalho, filtro e célula de
// cada uma num lugar só. Com isso a tabela monta só as colunas que a pessoa
// escolheu ver (o resto fica oculto só no navegador dela).

import { Filter } from "lucide-react";
import PeriodoFiltro from "../PeriodoFiltro.jsx";
import {
  ETAPAS, TIPOS_ANALISE, ORIGENS, atrasada, dataHora, diasAtendimento, etapa, etapaAutomatica, prazoDescarte, corTipo, corOrigem,
  FINALIZACAO, situacaoArea,
} from "../../lib/laboratorioEntradas.js";

export const filtroInput = "h-7 w-full min-w-[78px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-normal text-slate-700 outline-none focus:border-blue-400";
const sn = (v) => (v === true ? "SIM" : v === false ? "NÃO" : "—");

export function Chips({ v, cor, rotulo = (x) => x, dica = (x) => x }) {
  if (!v?.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {v.map((x) => <span key={x} title={dica(x)} className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cor(x)}`}>{rotulo(x)}</span>)}
    </span>
  );
}
const ChipsPessoas = ({ v, pessoas }) => (
  <Chips v={v} cor={pessoas.cor} rotulo={pessoas.curto} dica={(n) => `${n}${pessoas.desligado(n) ? " (sem conta ativa no sistema)" : ""}`} />
);
export const Pill = ({ et }) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ETAPAS[et].classe}`}>{ETAPAS[et].rotulo}</span>;

function FiltroTexto({ valor, onChange, placeholder }) {
  return <div className="relative"><Filter size={11} className="absolute left-2 top-2 text-slate-400" aria-hidden="true" /><input className={`${filtroInput} pl-6`} aria-label={`Filtrar ${placeholder}`} placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} /></div>;
}
function FiltroSelect({ valor, onChange, opcoes, rotulo }) {
  return <select className={filtroInput} aria-label={`Filtrar ${rotulo}`} value={valor} onChange={(e) => onChange(e.target.value)}><option value="">Todos</option>{opcoes.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}</select>;
}
const SIM_NAO = [["SIM", "Sim"], ["NAO", "Não"]];
const data = (v) => dataHora(v) || <span className="text-slate-400">—</span>;

const SITUACOES = [...FINALIZACAO, ["VAZIO", "Não informado"]];
const COR_SITUACAO = { SIM: "bg-emerald-100 text-emerald-800", NAO: "bg-slate-200 text-slate-700", NA: "bg-slate-100 text-slate-500" };
const ROTULO_SITUACAO = { SIM: "Sim", NAO: "Não", NA: "N/A" };
const parar = (ev) => ev.stopPropagation();

// Finalizado MB / FQ: quem é do Laboratório muda direto na tabela (Sim / Não / Não se aplica).
function SituacaoArea({ e, area, c }) {
  const v = situacaoArea(e, area);
  if (!c.podeLab || ["DESCARTADA", "CANCELADA"].includes(etapa(e, c.hoje))) {
    return v ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${COR_SITUACAO[v]}`}>{ROTULO_SITUACAO[v]}</span> : <span className="text-slate-400">—</span>;
  }
  return (
    <select value={v} disabled={c.gravando} onClick={parar} onChange={(ev) => c.mudarArea(e, area, ev.target.value)} aria-label={`Finalizado ${area.toUpperCase()} da OS ${e.os}`}
      className={`h-6 rounded-full border-0 px-1.5 text-[10px] font-semibold outline-none ring-1 ring-slate-200 ${v ? COR_SITUACAO[v] : "bg-white text-slate-400"}`}>
      <option value="">—</option>
      {FINALIZACAO.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  );
}

// Etapa: calculada pelas datas; quem está nos DOIS setores (ou a direção) pode fixar à mão.
function CelulaEtapa({ e, c }) {
  const et = etapa(e, c.hoje);
  const auto = etapaAutomatica(e, c.hoje);
  if (!c.podeEtapa) return <span className="inline-flex items-center gap-1"><Pill et={et} />{e.etapaManual && <span className="text-[9px] text-slate-400" title="Etapa definida à mão">manual</span>}</span>;
  return (
    <span className="inline-flex items-center gap-1" onClick={parar}>
      <select value={e.etapaManual || ""} disabled={c.gravando} onChange={(ev) => c.mudarEtapa(e, ev.target.value)} aria-label={`Etapa da OS ${e.os}`}
        title={e.etapaManual ? `Definida à mão. Pelas datas seria: ${ETAPAS[auto].rotulo}` : "Calculada pelas datas. Escolha para fixar à mão."}
        className={`h-6 rounded-full border-0 px-2 text-[10px] font-semibold outline-none ${ETAPAS[et].classe} ${e.etapaManual ? "ring-2 ring-amber-400" : "ring-1 ring-slate-200"}`}>
        <option value="">{`Automática: ${ETAPAS[auto].rotulo}`}</option>
        {Object.entries(ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
      </select>
      {e.etapaManual && <span className="text-[9px] font-semibold text-amber-700" title="Etapa definida à mão">manual</span>}
    </span>
  );
}

/* setor: administrativo | laboratorio | acompanhamento (calculado) | ambos.
   fixa: sempre visível (é a âncora da linha). */
export const COLUNAS = [
  { id: "os", rotulo: "OS", setor: "administrativo", fixa: true,
    filtro: (c) => <FiltroTexto valor={c.filtros.os} onChange={c.setF("os")} placeholder="OS" />,
    celula: (e) => (
      <span className="whitespace-nowrap font-semibold text-slate-800">
        {e.os || "—"}
        {e.parametroImediato && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700" title="Possui parâmetro imediato">Imed.</span>}
        {!!e.pendencias?.length && <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700" title={e.pendencias.join("\n")}>Revisar</span>}
      </span>
    ) },
  { id: "amostras", rotulo: "Nº amostra(s)", setor: "administrativo", classe: "max-w-[180px] truncate",
    filtro: (c) => <FiltroTexto valor={c.filtros.amostras} onChange={c.setF("amostras")} placeholder="Amostra" />,
    celula: (e) => <span title={e.amostras}>{e.amostras || "—"}{e.qtdAmostras > 1 && <span className="ml-1 text-[9px] text-slate-400">({e.qtdAmostras})</span>}</span> },
  { id: "recebidoEm", rotulo: "Recebimento", setor: "administrativo", classe: "whitespace-nowrap",
    filtro: (c) => <PeriodoFiltro label="Recebimento" {...c.periodo("recebidoDe", "recebidoAte")} />,
    celula: (e) => data(e.recebidoEm) },
  { id: "recebidoPor", rotulo: "Recebido por", setor: "administrativo", classe: "min-w-[110px]",
    filtro: (c) => <FiltroSelect rotulo="recebido por" valor={c.filtros.recebidoPor} onChange={c.setF("recebidoPor")} opcoes={c.optReceb} />,
    celula: (e, c) => <ChipsPessoas v={e.recebidoPor} pessoas={c.pessoas} /> },
  { id: "tipos", rotulo: "Tipo", setor: "administrativo",
    filtro: (c) => <FiltroSelect rotulo="tipo" valor={c.filtros.tipo} onChange={c.setF("tipo")} opcoes={TIPOS_ANALISE} />,
    celula: (e) => <Chips v={e.tipos} cor={corTipo} /> },
  { id: "imediato", rotulo: "Imediato", setor: "administrativo",
    filtro: (c) => <FiltroSelect rotulo="parâmetro imediato" valor={c.filtros.imediato} onChange={c.setF("imediato")} opcoes={SIM_NAO} />,
    celula: (e) => <span className={e.parametroImediato ? "font-semibold text-amber-700" : ""}>{sn(e.parametroImediato)}</span> },
  { id: "origem", rotulo: "Interno / provedor", setor: "administrativo", classe: "whitespace-nowrap",
    filtro: (c) => <FiltroSelect rotulo="interno ou provedor" valor={c.filtros.origem} onChange={c.setF("origem")} opcoes={ORIGENS} />,
    celula: (e) => <Chips v={e.origem} cor={corOrigem} /> },
  { id: "retiradoPor", rotulo: "Retirado por", setor: "administrativo", classe: "min-w-[110px]",
    filtro: (c) => <FiltroSelect rotulo="retirado por" valor={c.filtros.retiradoPor} onChange={c.setF("retiradoPor")} opcoes={c.optRetir} />,
    celula: (e, c) => <ChipsPessoas v={e.retiradoPor} pessoas={c.pessoas} /> },
  { id: "retiradaLabEm", rotulo: "Retirada lab.", setor: "laboratorio", classe: "whitespace-nowrap",
    filtro: (c) => <PeriodoFiltro label="Retirada lab." {...c.periodo("retiradaDe", "retiradaAte")} />,
    celula: (e) => data(e.retiradaLabEm) },
  { id: "retiradaComercialEm", rotulo: "Retirada comercial", setor: "laboratorio", classe: "whitespace-nowrap",
    filtro: (c) => <PeriodoFiltro label="Comercial" {...c.periodo("comercialDe", "comercialAte")} />,
    celula: (e) => data(e.retiradaComercialEm) },
  { id: "finalizadoLab", rotulo: "Finalizado", setor: "laboratorio",
    filtro: (c) => <FiltroSelect rotulo="finalizado" valor={c.filtros.finalizado} onChange={c.setF("finalizado")} opcoes={SIM_NAO} />,
    celula: (e) => sn(e.finalizadoLab) },
  { id: "finalizadoMb", rotulo: "Finalizado MB", setor: "laboratorio",
    filtro: (c) => <FiltroSelect rotulo="finalizado MB" valor={c.filtros.mb} onChange={c.setF("mb")} opcoes={SITUACOES} />,
    celula: (e, c) => <SituacaoArea e={e} area="mb" c={c} /> },
  { id: "finalizadoMbEm", rotulo: "Final. MB", setor: "laboratorio", classe: "whitespace-nowrap",
    filtro: (c) => <PeriodoFiltro label="Final. MB" {...c.periodo("mbDe", "mbAte")} />,
    celula: (e) => data(e.finalizadoMbEm) },
  { id: "finalizadoFq", rotulo: "Finalizado FQ", setor: "laboratorio",
    filtro: (c) => <FiltroSelect rotulo="finalizado FQ" valor={c.filtros.fq} onChange={c.setF("fq")} opcoes={SITUACOES} />,
    celula: (e, c) => <SituacaoArea e={e} area="fq" c={c} /> },
  { id: "finalizadoFqEm", rotulo: "Final. FQ", setor: "laboratorio", classe: "whitespace-nowrap",
    filtro: (c) => <PeriodoFiltro label="Final. FQ" {...c.periodo("fqDe", "fqAte")} />,
    celula: (e) => data(e.finalizadoFqEm) },
  { id: "liberado", rotulo: "Liberado", setor: "laboratorio",
    filtro: (c) => <FiltroSelect rotulo="liberado" valor={c.filtros.liberado} onChange={c.setF("liberado")} opcoes={SIM_NAO} />,
    celula: (e) => sn(e.liberadoEm ? true : e.liberadoCliente) },
  { id: "liberadoEm", rotulo: "Liberação", setor: "laboratorio", classe: "whitespace-nowrap",
    filtro: (c) => <PeriodoFiltro label="Liberação" {...c.periodo("liberadoDe", "liberadoAte")} />,
    celula: (e) => data(e.liberadoEm) },
  { id: "descarte", rotulo: "Descarte", setor: "laboratorio", classe: "whitespace-nowrap",
    celula: (e, c) => {
      if (e.descartado) return <span className="text-slate-500">Feito{e.descartadoEm ? ` ${dataHora(e.descartadoEm)}` : ""}</span>;
      const p = prazoDescarte(e);
      return p ? <span className={etapa(e, c.hoje) === "DESCARTE_PENDENTE" ? "font-semibold text-red-700" : ""} title="Prazo: 5 dias após a liberação">{dataHora(p)}</span> : "—";
    } },
  { id: "etapa", rotulo: "Etapa", setor: "acompanhamento",
    filtro: (c) => <FiltroSelect rotulo="etapa" valor={c.filtros.etapa} onChange={c.setF("etapa")} opcoes={Object.entries(ETAPAS).map(([k, v]) => [k, v.rotulo])} />,
    celula: (e, c) => <CelulaEtapa e={e} c={c} /> },
  { id: "dias", rotulo: "Dias", setor: "acompanhamento", classe: "text-right tabular-nums",
    celula: (e, c) => <span className={atrasada(e, c.hoje) ? "font-semibold text-red-700" : ""}>{diasAtendimento(e, c.hoje) ?? "—"}</span> },
  { id: "observacao", rotulo: "Observação", setor: "ambos", classe: "max-w-[280px] truncate text-[10px] text-slate-600",
    filtro: (c) => <FiltroTexto valor={c.filtros.observacao} onChange={c.setF("observacao")} placeholder="Observação" />,
    celula: (e) => <span title={e.observacao}>{e.observacao || "—"}</span> },
];

export const GRUPOS = {
  administrativo: { rotulo: "Administrativo", classe: "bg-sky-100 text-sky-800" },
  laboratorio: { rotulo: "Laboratório", classe: "bg-teal-100 text-teal-800" },
  acompanhamento: { rotulo: "Acompanhamento", classe: "bg-slate-100 text-slate-600" },
  ambos: { rotulo: "Os dois setores", classe: "bg-amber-50 text-amber-800" },
};
