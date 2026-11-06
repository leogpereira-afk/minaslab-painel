// Laboratório › Qualidade. "Início" resume o que pede atenção e leva a cada função da Qualidade.
// Em uso: Pesquisa de satisfação de clientes (PG 012 · PSC), com os mesmos dados do CRM, pelo crachá do painel.
// As demais funções aparecem como "Em breve" para a equipe validar o escopo antes de construir.
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, ClipboardCheck, FileText, Gauge, SearchCheck, Send, Smile, Star, Wrench } from "lucide-react";
import { lerSatisfacao } from "../../services/qualidade.js";
import { StatCard } from "../ui.jsx";
import PesquisaSatisfacao from "./PesquisaSatisfacao.jsx";

const FUNCOES = [
  { valor: "satisfacao", rotulo: "Pesquisa de satisfação", icone: Smile, cor: "bg-emerald-50 text-emerald-700", pronta: true,
    texto: "Envio do link ao cliente, NPS, médias por pergunta, insatisfações (prazo 5 dias) e melhorias." },
  { valor: "documentos", rotulo: "Documentos e POPs", icone: FileText, cor: "bg-sky-50 text-sky-700",
    texto: "Versão, vigência, quem elaborou e quem aprovou; lista mestra." },
  { valor: "equipamentos", rotulo: "Equipamentos", icone: Wrench, cor: "bg-amber-50 text-amber-700",
    texto: "Calibração, verificação intermediária e manutenção com alerta de vencimento." },
  { valor: "nc", rotulo: "Não conformidades", icone: ClipboardCheck, cor: "bg-rose-50 text-rose-700",
    texto: "Registro, análise de causa, ação corretiva com responsável, prazo e eficácia." },
  { valor: "auditorias", rotulo: "Auditorias e proficiência", icone: SearchCheck, cor: "bg-violet-50 text-violet-700",
    texto: "Auditorias internas, ensaios de proficiência e interlaboratoriais." },
  { valor: "indicadores", rotulo: "Indicadores", icone: Gauge, cor: "bg-slate-100 text-slate-700",
    texto: "Prazo de liberação, retrabalho, reclamações e satisfação para a análise crítica." },
];

export default function QualidadeLaboratorio({ aba, ir }) {
  if (aba === "satisfacao" || aba === "satisfacao-enviar") return <PesquisaSatisfacao voltar={() => ir("qualidade")} abrirEnvio={aba === "satisfacao-enviar"} />;
  return <InicioQualidade abrir={(f) => ir("qualidade", f)} />;
}

function InicioQualidade({ abrir }) {
  const [r, setR] = useState(null);
  const [erro, setErro] = useState("");
  const [breve, setBreve] = useState(null);
  useEffect(() => { lerSatisfacao().then(setR).catch((e) => setErro(e.message || "Não carregou.")); }, []);

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const umAno = new Date(); umAno.setFullYear(umAno.getFullYear() - 1);
  const rs = r ? r.respostas.filter((x) => new Date(x.respondido_em) >= umAno) : [];
  const nps = rs.length ? Math.round(((rs.filter((x) => x.nps >= 9).length - rs.filter((x) => x.nps <= 6).length) / rs.length) * 100) : null;
  const gerais = rs.map((x) => x.notas?.satisfacao_geral).filter((x) => typeof x === "number");
  const geral = gerais.length ? gerais.reduce((a, b) => a + b, 0) / gerais.length : null;
  const abertas = r ? r.tratativas.filter((t) => t.status !== "CONCLUIDA") : [];
  const atrasadas = abertas.filter((t) => t.prazo < hoje);
  const aguardando = r ? r.envios.filter((e) => !e.respondido_em && !e.cancelado_em && new Date(e.expira_em) > new Date()).length : 0;
  const n = (v) => (r ? v : "…");

  return (
    <div className="space-y-5">
      <section aria-labelledby="qual-atencao">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="qual-atencao" className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">Pede atenção</h2>
          {erro ? <span className="text-xs text-bad-700">{erro}</span> : <span className="text-xs text-slate-400">Clique num número para abrir</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard rotulo="Insatisfações abertas" valor={n(abertas.length)} sub={atrasadas.length ? `${atrasadas.length} com prazo vencido` : "prazo de 5 dias"} tom={abertas.length ? "bad" : "neutral"} icone={AlertTriangle} onClick={() => abrir("satisfacao")} />
          <StatCard rotulo="NPS (12 meses)" valor={r ? (nps == null ? "—" : `${nps > 0 ? "+" : ""}${nps}`) : "…"} sub={`${rs.length} resposta(s)`} tom="brand" icone={Smile} onClick={() => abrir("satisfacao")} />
          <StatCard rotulo="Satisfação geral" valor={r ? (geral == null ? "—" : geral.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })) : "…"} sub="1 a 5 · meta ≥ 4,5" tom={geral != null && geral < 4.5 ? "warn" : "ok"} icone={Star} onClick={() => abrir("satisfacao")} />
          <StatCard rotulo="Pesquisas aguardando" valor={n(aguardando)} sub="links enviados sem resposta" icone={Send} onClick={() => abrir("satisfacao")} />
          <StatCard rotulo="Enviar pesquisa" valor="+" sub="gerar link para um cliente" icone={BarChart3} onClick={() => abrir("satisfacao-enviar")} />
        </div>
      </section>

      <section aria-labelledby="qual-funcoes">
        <h2 id="qual-funcoes" className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">Funções da Qualidade</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FUNCOES.map((f) => {
            const Icone = f.icone;
            return (
              <button key={f.valor} type="button" onClick={() => (f.pronta ? abrir(f.valor) : setBreve(breve === f.valor ? null : f.valor))} className="card card-hover group flex flex-col gap-3 p-4 text-left">
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${f.cor}`}><Icone className="h-5 w-5" aria-hidden /></span>
                  {f.pronta
                    ? <span className="rounded-full bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700">Em uso</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Em breve</span>}
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-slate-900">{f.rotulo}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{f.texto}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand">
                  {f.pronta ? "Abrir" : breve === f.valor ? "Ainda em desenvolvimento — quer priorizar? É só pedir." : "Ver o que vai ter"}
                  {f.pronta && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
