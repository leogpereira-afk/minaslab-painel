// Laboratório › Qualidade. "Início" resume o que pede atenção e leva a cada função da Qualidade:
// Pesquisa de satisfação (mesmos dados do CRM), Documentos e POPs, Equipamentos, Não conformidades,
// Auditorias e proficiência e Indicadores. Tudo pelo crachá do painel (Edge Function ml-qualidade).
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardCheck, FileText, Gauge, SearchCheck, Smile, Wrench } from "lucide-react";
import { lerQualidade, lerSatisfacao } from "../../services/qualidade.js";
import { StatCard, CarregandoModulo, ErroModulo, Aviso } from "../ui.jsx";
import PesquisaSatisfacao from "./PesquisaSatisfacao.jsx";
import Documentos from "./qualidade/Documentos.jsx";
import Equipamentos, { situacaoEquip } from "./qualidade/Equipamentos.jsx";
import NaoConformidades from "./qualidade/NaoConformidades.jsx";
import Auditorias from "./qualidade/Auditorias.jsx";
import Indicadores from "./qualidade/Indicadores.jsx";
import { hojeYmd } from "./qualidade/comum.jsx";

const FUNCOES = [
  { valor: "satisfacao", rotulo: "Pesquisa de satisfação", icone: Smile, cor: "bg-emerald-50 text-emerald-700", texto: "Envio do link ao cliente, NPS, médias por pergunta, insatisfações (prazo 5 dias) e melhorias." },
  { valor: "documentos", rotulo: "Documentos e POPs", icone: FileText, cor: "bg-sky-50 text-sky-700", texto: "Lista mestra com revisão, vigência, quem elaborou e aprovou e leitura confirmada." },
  { valor: "equipamentos", rotulo: "Equipamentos", icone: Wrench, cor: "bg-amber-50 text-amber-700", texto: "Calibração, verificação intermediária e diária com alerta de vencimento e certificados." },
  { valor: "nc", rotulo: "Não conformidades", icone: ClipboardCheck, cor: "bg-rose-50 text-rose-700", texto: "Registro, análise de causa, ação corretiva com responsável, prazo e eficácia." },
  { valor: "auditorias", rotulo: "Auditorias e proficiência", icone: SearchCheck, cor: "bg-violet-50 text-violet-700", texto: "Programa anual de auditoria interna e ensaios de proficiência com z-score." },
  { valor: "indicadores", rotulo: "Indicadores", icone: Gauge, cor: "bg-slate-100 text-slate-700", texto: "Prazo de liberação, reclamações, NPS, NC e proficiência com metas; pauta da análise crítica." },
];
const PAGINAS = { documentos: Documentos, equipamentos: Equipamentos, nc: NaoConformidades, auditorias: Auditorias, indicadores: Indicadores };

export default function QualidadeLaboratorio({ aba, ir }) {
  const [q, setQ] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const recarregar = useCallback(async () => {
    try { setQ(await lerQualidade()); setErro(""); } catch (e) { setErro(e.message || "Não foi possível carregar a Qualidade."); }
  }, []);
  useEffect(() => { if (aba !== "satisfacao" && aba !== "satisfacao-enviar") recarregar(); }, [aba, recarregar]);
  const voltar = () => ir("qualidade");

  if (aba === "satisfacao" || aba === "satisfacao-enviar") return <PesquisaSatisfacao voltar={voltar} abrirEnvio={aba === "satisfacao-enviar"} />;
  const Pagina = PAGINAS[aba];
  if (Pagina) {
    if (!q && !erro) return <CarregandoModulo />;
    if (!q) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
    return <><Aviso aviso={aviso} aoFechar={() => setAviso(null)} /><Pagina q={q} voltar={voltar} recarregar={recarregar} avisar={setAviso} /></>;
  }
  return <InicioQualidade q={q} erro={erro} abrir={(f) => ir("qualidade", f)} />;
}

function InicioQualidade({ q, erro, abrir }) {
  const [sat, setSat] = useState(null);
  useEffect(() => { lerSatisfacao().then(setSat).catch(() => {}); }, []);
  const hoje = hojeYmd();
  const umAno = new Date(); umAno.setFullYear(umAno.getFullYear() - 1);
  const rs = sat ? sat.respostas.filter((x) => new Date(x.respondido_em) >= umAno) : [];
  const nps = rs.length ? Math.round(((rs.filter((x) => x.nps >= 9).length - rs.filter((x) => x.nps <= 6).length) / rs.length) * 100) : null;
  const insat = sat ? sat.tratativas.filter((t) => t.status !== "CONCLUIDA") : [];
  const ncAbertas = q ? q.ncs.filter((n) => n.etapa !== "ENCERRADA") : [];
  const ncVencidas = ncAbertas.filter((n) => n.prazo && n.prazo < hoje);
  const eqVencidos = q ? q.equipamentos.filter((e) => e.situacao !== "INATIVO" && situacaoEquip(e)[1] === "bad") : [];
  const docVencidos = q ? q.documentos.filter((d) => d.status === "VIGENTE" && d.proxima_revisao && d.proxima_revisao < hoje) : [];
  const n = (pronto, v) => (pronto ? v : "…");

  return (
    <div className="space-y-5">
      <section aria-labelledby="qual-atencao">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="qual-atencao" className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">Pede atenção</h2>
          {erro ? <span className="text-xs text-bad-700">{erro}</span> : <span className="text-xs text-slate-400">Clique num número para abrir</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard rotulo="Insatisfações de clientes" valor={n(sat, insat.length)} sub="tratativas abertas · prazo 5 dias" tom={insat.length ? "bad" : "neutral"} icone={AlertTriangle} onClick={() => abrir("satisfacao")} />
          <StatCard rotulo="Não conformidades abertas" valor={n(q, ncAbertas.length)} sub={ncVencidas.length ? `${ncVencidas.length} com prazo vencido` : "dentro do prazo"} tom={ncVencidas.length ? "bad" : ncAbertas.length ? "warn" : "neutral"} icone={ClipboardCheck} onClick={() => abrir("nc")} />
          <StatCard rotulo="Equipamentos vencidos" valor={n(q, eqVencidos.length)} sub={eqVencidos.map((e) => e.codigo).slice(0, 2).join(", ") || "calibrações em dia"} tom={eqVencidos.length ? "bad" : "ok"} icone={Wrench} onClick={() => abrir("equipamentos")} />
          <StatCard rotulo="Documentos a revisar" valor={n(q, docVencidos.length)} sub="revisão vencida" tom={docVencidos.length ? "warn" : "ok"} icone={FileText} onClick={() => abrir("documentos")} />
          <StatCard rotulo="NPS (12 meses)" valor={n(sat, nps == null ? "—" : `${nps > 0 ? "+" : ""}${nps}`)} sub={`${rs.length} resposta(s) da pesquisa`} tom="brand" icone={Smile} onClick={() => abrir("satisfacao")} />
        </div>
      </section>

      <section aria-labelledby="qual-funcoes">
        <h2 id="qual-funcoes" className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">Funções da Qualidade</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FUNCOES.map((f) => {
            const Icone = f.icone;
            return (
              <button key={f.valor} type="button" onClick={() => abrir(f.valor)} className="card card-hover group flex flex-col gap-3 p-4 text-left">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${f.cor}`}><Icone className="h-5 w-5" aria-hidden /></span>
                <div><p className="font-display text-base font-semibold text-slate-900">{f.rotulo}</p><p className="mt-0.5 text-sm text-slate-500">{f.texto}</p></div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand">Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
