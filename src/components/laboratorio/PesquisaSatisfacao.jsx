// Laboratório › Qualidade › Pesquisa de satisfação (PG 012 · PSC).
// Mesma tela e mesmos dados do CRM (Pós-venda › Pesquisa de satisfação), mas pelo crachá do painel:
// a Qualidade envia o link, acompanha NPS e médias, trata insatisfações (prazo 5 dias) e registra melhorias.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ClipboardCheck, Copy, Download, EyeOff, ListChecks, Mail, MessageCircle, Pencil, Plus, RefreshCw, RotateCcw, Send, Smile, Star, ThumbsUp } from "lucide-react";
import { lerSatisfacao, vinculosCliente, enviarPesquisa, trocarCanal, cancelarEnvio, salvarMelhoria, salvarTratativa, salvarPergunta, ordenarPerguntas, salvarRevisao, linkPesquisa, mensagemPesquisa } from "../../services/qualidade.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { StatCard, Modal, CarregandoModulo, ErroModulo, Aviso, Segmented } from "../ui.jsx";

// Perguntas de nota 1–5 de antes do editor (reserva para respostas antigas, se a lista do servidor não vier).
const ITENS_PADRAO = [
  ["atendimento_inicial", "Facilidade no atendimento inicial"], ["clareza_orcamentos", "Clareza das informações e orçamentos"],
  ["agilidade_prazos", "Agilidade e cumprimento de prazos"], ["equipe", "Competência e cordialidade da equipe"],
  ["confiabilidade", "Confiabilidade dos resultados"], ["relatorios", "Qualidade dos relatórios emitidos"],
  ["requisitos", "Requisitos técnicos e normativos"], ["custo_beneficio", "Custo-benefício dos serviços"],
  ["satisfacao_geral", "Satisfação geral com o laboratório"], ["coleta", "Processo de coleta/amostragem"],
];
const nota = (r, k) => { const v = r.notas?.[k] ?? (k === "coleta" ? r.nota_coleta : null); return typeof v === "number" ? v : null; };
const textosDe = (r) => ({ ...Object.fromEntries([["gostou", r.gostou], ["mudaria", r.mudaria], ["melhorar", r.melhorar]].filter(([, v]) => v)), ...(r.textos || {}) });
const comentario = (r) => Object.values(textosDe(r)).find(Boolean) || r.explicacao_nps || "";
const sugestao = (r) => Object.entries(textosDe(r)).filter(([k, v]) => k !== "gostou" && v).map(([, v]) => v).join(" · ");
const MELHORIA = [["AVALIAR", "Avaliar"], ["EM ANDAMENTO", "Em andamento"], ["IMPLEMENTADA", "Implementada"], ["DESCARTADA", "Descartada"], ["SEM SUGESTAO", "Sem sugestão"]];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIODOS = [{ valor: "12m", rotulo: "Últimos 12 meses" }, { valor: "ano", rotulo: "Este ano" }, { valor: "mes", rotulo: "Este mês" }, { valor: "tudo", rotulo: "Tudo" }];
const ABAS = [{ valor: "geral", rotulo: "Visão geral" }, { valor: "respostas", rotulo: "Respostas" }, { valor: "tratativas", rotulo: "Tratativas" }, { valor: "envios", rotulo: "Envios" }, { valor: "perguntas", rotulo: "Perguntas" }];

const fmtData = (v) => (v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("pt-BR") : "—");
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const dec = (n) => (n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const hojeYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const npsDe = (rs) => (rs.length ? Math.round(((rs.filter((r) => r.nps >= 9).length - rs.filter((r) => r.nps <= 6).length) / rs.length) * 100) : null);
const sinal = (n) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n}`);
function noPeriodo(data, periodo) {
  if (!data || periodo === "tudo") return true;
  const d = new Date(data), agora = new Date();
  if (periodo === "mes") return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
  if (periodo === "ano") return d.getFullYear() === agora.getFullYear();
  const lim = new Date(agora); lim.setFullYear(lim.getFullYear() - 1); return d >= lim;
}

function Nps({ n }) {
  const cor = n >= 9 ? "bg-ok-50 text-ok-700" : n >= 7 ? "bg-warn-50 text-warn-700" : "bg-bad-50 text-bad-700";
  return <span className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold ${cor}`}>{n}</span>;
}

export default function PesquisaSatisfacao({ voltar, abrirEnvio = false }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [aba, setAba] = useState("geral");
  const [periodo, setPeriodo] = useState("12m");
  const [ver, setVer] = useState(null);
  const [trat, setTrat] = useState(null);
  const [enviar, setEnviar] = useState(abrirEnvio);
  const [soSugestoes, setSoSugestoes] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try { setDados(await lerSatisfacao()); } catch (e) { setErro(e.message || "Não foi possível carregar a pesquisa."); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const d = dados || { envios: [], respostas: [], tratativas: [], clientes: [], contratos: {}, os: {}, perfis: {}, contas: {}, perguntas: [] };
  const pergs = d.perguntas?.length ? d.perguntas : ITENS_PADRAO.map(([chave, texto], i) => ({ id: chave, chave, texto, tipo: "ESCALA", ativa: true, ordem: i }));
  const escalaQs = pergs.filter((p) => p.tipo === "ESCALA");
  const textoQs = pergs.filter((p) => p.tipo === "TEXTO");
  const cliMap = useMemo(() => Object.fromEntries(d.clientes.map((c) => [c.id, c])), [d.clientes]);
  const nome = (x) => cliMap[x.cliente_id]?.nome || x.empresa_nome || "Cliente";
  const vinculo = (x) => [x.contrato_id && d.contratos[x.contrato_id] ? `Contrato ${d.contratos[x.contrato_id]}` : "", x.ordem_servico_id && d.os[x.ordem_servico_id] ? d.os[x.ordem_servico_id] : ""].filter(Boolean).join(" · ") || "Sem vínculo";
  const pessoa = (perfil, painel) => (painel && d.contas[painel]) || (perfil && d.perfis[perfil]) || painel || "—";

  const rPer = useMemo(() => d.respostas.filter((r) => noPeriodo(r.respondido_em, periodo)), [d.respostas, periodo]);
  const ePer = useMemo(() => d.envios.filter((e) => !e.cancelado_em && noPeriodo(e.enviado_em, periodo)), [d.envios, periodo]);
  const hoje = hojeYmd();
  const abertas = d.tratativas.filter((t) => t.status !== "CONCLUIDA");
  const atrasadas = abertas.filter((t) => t.prazo < hoje);
  const geral = media(rPer.map((r) => nota(r, "satisfacao_geral")).filter((x) => x != null));
  const taxa = ePer.length ? Math.round((ePer.filter((e) => e.respondido_em).length / ePer.length) * 100) : null;
  const agora = new Date();
  const doMes = d.respostas.filter((r) => { const x = new Date(r.respondido_em); return x.getFullYear() === agora.getFullYear() && x.getMonth() === agora.getMonth(); }).length;
  const porItem = escalaQs.map((q) => ({ k: q.chave, l: q.ativa ? q.texto : `${q.texto} (retirada)`, ativa: q.ativa, m: media(rPer.map((r) => nota(r, q.chave)).filter((x) => x != null)) })).filter((i) => i.ativa || i.m != null);
  const npsMes = Array.from({ length: 6 }, (_, i) => {
    const m = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1);
    const rs = d.respostas.filter((r) => { const x = new Date(r.respondido_em); return x.getFullYear() === m.getFullYear() && x.getMonth() === m.getMonth(); });
    return { k: `${m.getFullYear()}-${m.getMonth()}`, rot: MESES[m.getMonth()], nps: npsDe(rs), n: rs.length, atual: i === 5 };
  });
  const sugestoesAbertas = rPer.filter((r) => r.melhoria_status === "AVALIAR" || r.melhoria_status === "EM ANDAMENTO").length;
  const rLista = soSugestoes ? rPer.filter((r) => r.melhoria_status !== "SEM SUGESTAO") : rPer;
  const rotPeriodo = PERIODOS.find((p) => p.valor === periodo)?.rotulo.toLowerCase();

  async function mudarMelhoria(r, status) {
    try { await salvarMelhoria(r.id, status); setDados((x) => ({ ...x, respostas: x.respostas.map((y) => (y.id === r.id ? { ...y, melhoria_status: status } : y)) })); }
    catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  }
  async function cancelar(e) {
    if (!window.confirm("Cancelar este link? O cliente não conseguirá mais responder por ele.")) return;
    try { await cancelarEnvio(e.id); await carregar(); } catch (er) { setAviso({ tipo: "erro", texto: er.message }); }
  }
  function exportar() {
    const colunas = [
      { chave: "data", rotulo: "Data" }, { chave: "cliente", rotulo: "Cliente" }, { chave: "vinculo", rotulo: "Contrato/OS" }, { chave: "nps", rotulo: "NPS (0–10)", tipo: "numero" },
      ...escalaQs.map((q) => ({ chave: `n_${q.chave}`, rotulo: q.texto, tipo: "numero" })),
      ...textoQs.map((q) => ({ chave: `t_${q.chave}`, rotulo: q.texto })), { chave: "explicacao", rotulo: "Explicação 0–6" },
      { chave: "melhoria", rotulo: "Status da melhoria" }, { chave: "tratativa", rotulo: "Tratativa" }, { chave: "causa", rotulo: "Causa" }, { chave: "acao", rotulo: "Ação" }, { chave: "retorno", rotulo: "Retorno ao cliente" },
    ];
    const linhas = rPer.map((r) => {
      const t = d.tratativas.find((x) => x.resposta_id === r.id);
      const tx = textosDe(r);
      return { data: fmtData(r.respondido_em), cliente: nome(r), vinculo: vinculo(r), nps: r.nps, ...Object.fromEntries(escalaQs.map((q) => [`n_${q.chave}`, nota(r, q.chave) ?? ""])),
        ...Object.fromEntries(textoQs.map((q) => [`t_${q.chave}`, tx[q.chave] || ""])), explicacao: r.explicacao_nps || "", melhoria: MELHORIA.find((m) => m[0] === r.melhoria_status)?.[1] || "",
        tratativa: t ? `${t.status} · prazo ${fmtData(t.prazo)}` : "", causa: t?.causa || "", acao: t?.acao || "", retorno: t?.retorno_cliente || "" };
    });
    baixarPlanilha({ nome: "pesquisa-satisfacao", colunas, linhas,
      titulo: `Pesquisa de satisfação (PG 012) — ${rotPeriodo} · NPS ${sinal(npsDe(rPer))} · satisfação geral ${dec(geral)} · ${rPer.length} resposta(s) · taxa de resposta ${taxa ?? "—"}% · tratativas abertas ${abertas.length}` });
  }

  if (!dados && !erro) return <CarregandoModulo />;
  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={carregar} />;

  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <div className="flex flex-wrap items-center gap-2">
        {voltar && <button type="button" onClick={voltar} className="btn-ghost inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" aria-hidden /> Qualidade</button>}
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Pesquisa de satisfação de clientes</h2>
          <p className="text-sm text-slate-500">PG 012 · PSC. Mesmos dados do CRM (Pós-venda › Pesquisa de satisfação).</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={carregar} className="btn-ghost" title="Atualizar"><RefreshCw className="h-4 w-4" aria-hidden /></button>
          {dados.podeEscrever && <button type="button" onClick={() => setEnviar(true)} className="btn-primary inline-flex items-center gap-2"><Send className="h-4 w-4" aria-hidden /> Enviar pesquisa</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented opcoes={ABAS.map((a) => ({ ...a, rotulo: a.valor === "tratativas" && abertas.length ? `Tratativas (${abertas.length})` : a.rotulo }))} valor={aba} onChange={setAba} />
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input ml-auto w-auto" aria-label="Período">{PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select>
      </div>

      {aba === "geral" && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard rotulo={`NPS (${rotPeriodo})`} valor={sinal(npsDe(rPer))} sub={`${rPer.length} resposta(s)`} icone={Smile} tom="brand" />
          <StatCard rotulo="Satisfação geral (1–5)" valor={dec(geral)} sub="meta ≥ 4,5" icone={Star} tom={geral != null && geral < 4.5 ? "warn" : "ok"} />
          <StatCard rotulo="Taxa de resposta" valor={taxa == null ? "—" : `${taxa}%`} sub={`${ePer.filter((e) => e.respondido_em).length} de ${ePer.length} enviadas`} icone={Send} />
          <StatCard rotulo="Respostas no mês" valor={doMes} sub={`${MESES[agora.getMonth()]}/${agora.getFullYear()}`} icone={ThumbsUp} />
          <StatCard rotulo="Insatisfações abertas" valor={abertas.length} sub={atrasadas.length ? `${atrasadas.length} atrasada(s)` : "aguardando tratativa"} icone={AlertTriangle} tom={abertas.length ? "bad" : "neutral"} onClick={() => setAba("tratativas")} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold text-slate-900">Média por pergunta (1–5)</h3>
            {porItem.map((i) => (
              <div key={i.k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_40px] items-center gap-3 py-1.5 text-sm">
                <span className="truncate text-slate-700">{i.l}</span>
                <div className="h-2.5 rounded-full bg-slate-100"><div className={`h-2.5 rounded-full ${i.m != null && i.m < 4.5 ? "bg-warn-600" : "bg-brand"}`} style={{ width: `${((i.m ?? 0) / 5) * 100}%` }} /></div>
                <b className="text-right tnum">{dec(i.m)}</b>
              </div>
            ))}
            <p className="mt-2 text-xs text-slate-400">Em laranja: abaixo da meta de 4,5.</p>
          </div>
          <div className="card p-5">
            <h3 className="mb-2 font-display font-semibold text-slate-900">Últimas respostas</h3>
            {rPer.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhuma resposta no período.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500"><tr><th className="py-2 pr-2">Data</th><th className="py-2 pr-2">Cliente</th><th className="py-2 pr-2">NPS</th><th className="py-2">Comentário</th></tr></thead>
                <tbody>{rPer.slice(0, 4).map((r) => {
                  const aberta = d.tratativas.some((t) => t.resposta_id === r.id && t.status !== "CONCLUIDA");
                  return (
                    <tr key={r.id} onClick={() => setVer(r)} className="cursor-pointer border-t align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap py-2.5 pr-2">{fmtData(r.respondido_em).slice(0, 5)}</td>
                      <td className="py-2.5 pr-2"><b className="block text-slate-900">{nome(r)}</b><span className="text-xs text-slate-500">{vinculo(r)}</span></td>
                      <td className="py-2.5 pr-2"><Nps n={r.nps} /></td>
                      <td className="py-2.5 text-slate-600"><span className="line-clamp-2">{comentario(r) || "—"}</span>{aberta && <b className="text-xs text-bad-700">→ tratativa aberta</b>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
            <h3 className="mb-1 mt-4 font-display font-semibold text-slate-900">NPS por mês</h3>
            <div className="flex h-32 items-end gap-2 pb-5">
              {npsMes.map((m) => (
                <div key={m.k} className="relative flex h-full flex-1 flex-col justify-end">
                  <span className="mb-1 text-center text-[11px] font-semibold text-slate-600">{m.nps == null ? "" : sinal(m.nps)}</span>
                  <div title={`${m.n} resposta(s)`} className={`rounded-t-md ${m.atual ? "bg-brand" : "bg-brand-50"}`} style={{ height: `${m.nps == null ? 3 : Math.max(6, (m.nps + 100) / 2)}%` }} />
                  <span className="absolute -bottom-5 left-0 right-0 text-center text-[11px] text-slate-500">{m.rot}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <button type="button" onClick={() => setAba("tratativas")} className="rounded-2xl border border-bad-100 bg-bad-50 p-4 text-left text-sm leading-relaxed text-bad-700 hover:border-bad-300">
            <b className="block text-slate-900">Insatisfeito (NPS 0–6 ou item ≤ 2)</b>Abre tratativa para a Qualidade com prazo de 5 dias: análise da causa, ação e retorno ao cliente.
            <span className="mt-2 block font-semibold">{abertas.length} aberta(s){atrasadas.length ? ` · ${atrasadas.length} atrasada(s)` : ""} →</span>
          </button>
          <button type="button" onClick={() => { setSoSugestoes(true); setAba("respostas"); }} className="rounded-2xl border border-warn-100 bg-warn-50 p-4 text-left text-sm leading-relaxed text-warn-700 hover:border-warn-300">
            <b className="block text-slate-900">Sugestões de melhoria</b>Comentários de “o que mudaria / o que melhorar” viram oportunidades com status (avaliar · em andamento · implementada).
            <span className="mt-2 block font-semibold">{sugestoesAbertas} para avaliar/em andamento →</span>
          </button>
          <button type="button" onClick={exportar} className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-left text-sm leading-relaxed text-brand-700 hover:border-brand-300">
            <b className="block text-slate-900">Validação e análise crítica</b>Planilha do período ({rotPeriodo}) com NPS, notas, comentários e tratativas, para a análise crítica pela direção.
            <span className="mt-2 inline-flex items-center gap-1 font-semibold"><Download className="h-4 w-4" aria-hidden /> Exportar planilha (Excel)</span>
          </button>
        </div>
      </>}

      {aba === "respostas" && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={soSugestoes} onChange={(e) => setSoSugestoes(e.target.checked)} /> Só respostas com sugestão de melhoria</label>
            <span className="ml-auto text-xs text-slate-500">{rLista.length} resposta(s)</span>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">NPS</th><th className="px-4 py-3">Geral</th><th className="px-4 py-3">Sugestão de melhoria</th><th className="px-4 py-3">Status da melhoria</th></tr></thead>
            <tbody>{rLista.map((r) => (
              <tr key={r.id} className="border-t align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">{fmtData(r.respondido_em)}{r.origem !== "LINK" && <span className="block text-xs text-slate-400">{r.origem === "GOOGLE_FORMS" ? "Google Forms" : "Manual"}</span>}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => setVer(r)} className="text-left font-semibold text-brand-700 hover:underline">{nome(r)}</button><span className="block text-xs text-slate-500">{vinculo(r)}</span></td>
                <td className="px-4 py-3"><Nps n={r.nps} />{r.insatisfeito && <span className="mt-1 block text-xs font-semibold text-bad-700">insatisfação</span>}</td>
                <td className="px-4 py-3">{nota(r, "satisfacao_geral") ?? "—"}</td>
                <td className="max-w-md px-4 py-3 text-slate-600">{sugestao(r) || "—"}</td>
                <td className="px-4 py-3"><select disabled={!dados.podeEscrever} value={r.melhoria_status} onChange={(e) => mudarMelhoria(r, e.target.value)} className="input py-1.5 text-xs">{MELHORIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
              </tr>
            ))}</tbody>
          </table>{rLista.length === 0 && <p className="p-10 text-center text-slate-500">Nenhuma resposta no período.</p>}</div>
        </div>
      )}

      {aba === "tratativas" && (
        <div className="card overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Prazo</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead>
          <tbody>{d.tratativas.map((t) => {
            const atrasada = t.status !== "CONCLUIDA" && t.prazo < hoje;
            const r = d.respostas.find((x) => x.id === t.resposta_id);
            return (
              <tr key={t.id} className="border-t align-top">
                <td className={`whitespace-nowrap px-4 py-3 ${atrasada ? "font-semibold text-bad-700" : ""}`}>{fmtData(t.prazo)}{atrasada && <span className="block text-xs">atrasada</span>}</td>
                <td className="px-4 py-3 font-medium">{r ? nome(r) : "—"}</td>
                <td className="max-w-md px-4 py-3 text-slate-600">{t.motivo}</td>
                <td className="px-4 py-3">{pessoa(t.responsavel_id, t.responsavel_painel)}</td>
                <td className="px-4 py-3"><StatusTrat s={t.status} /></td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => setTrat(t)} className="btn-outline px-3 py-1.5 text-xs">{t.status === "CONCLUIDA" || !dados.podeEscrever ? "Ver" : "Tratar"}</button></td>
              </tr>
            );
          })}</tbody>
        </table>{d.tratativas.length === 0 && <p className="p-10 text-center text-slate-500">Nenhuma insatisfação registrada.</p>}</div>
      )}

      {aba === "envios" && (
        <div className="card overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Enviado em</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Por</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
          <tbody>{ePer.map((e) => {
            const sit = e.respondido_em ? "Respondida" : new Date(e.expira_em) < new Date() ? "Expirada" : "Aguardando";
            return (
              <tr key={e.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-3">{fmtData(e.enviado_em)}</td>
                <td className="px-4 py-3"><b>{nome(e)}</b><span className="block text-xs text-slate-500">{vinculo(e)}</span></td>
                <td className="px-4 py-3">{e.canal === "WHATSAPP" ? "WhatsApp" : e.canal === "EMAIL" ? "E-mail" : "Link"}{e.destino && <span className="block text-xs text-slate-500">{e.destino}</span>}</td>
                <td className="px-4 py-3">{pessoa(e.enviado_por, e.enviado_por_painel)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sit === "Respondida" ? "bg-ok-50 text-ok-700" : sit === "Expirada" ? "bg-slate-100 text-slate-500" : "bg-warn-50 text-warn-700"}`}>{sit}</span>{e.respondido_em && <span className="block text-xs text-slate-500">{fmtData(e.respondido_em)}</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{sit === "Aguardando" && <>
                  <button type="button" onClick={() => navigator.clipboard.writeText(mensagemPesquisa(linkPesquisa(e.token))).then(() => setAviso({ tipo: "ok", texto: "Mensagem com o link copiada." }))} title="Copiar mensagem com o link" className="btn-ghost"><Copy className="h-4 w-4" aria-hidden /></button>
                  {dados.podeEscrever && <button type="button" onClick={() => cancelar(e)} className="btn-ghost text-xs text-bad-700">Cancelar</button>}
                </>}</td>
              </tr>
            );
          })}</tbody>
        </table>{ePer.length === 0 && <p className="p-10 text-center text-slate-500">Nenhum envio no período.</p>}</div>
      )}

      {aba === "perguntas" && <EditorPerguntas perguntas={d.perguntas || []} revisao={d.revisao || "01"} podeEscrever={dados.podeEscrever} aoMudar={carregar} avisar={setAviso} />}

      <EnviarPesquisa aberto={enviar} clientes={d.clientes} aoFechar={() => setEnviar(false)} aoEnviar={carregar} />
      <Modal titulo={ver ? `Resposta — ${nome(ver)}` : ""} aberto={!!ver} aoFechar={() => setVer(null)} largura="max-w-2xl">{ver && <Detalhe r={ver} vinculo={vinculo(ver)} escalaQs={escalaQs} textoQs={textoQs} />}</Modal>
      <Tratativa t={trat} resposta={trat && d.respostas.find((x) => x.id === trat.resposta_id)} vinculo={vinculo} escalaQs={escalaQs} textoQs={textoQs} podeEscrever={dados.podeEscrever} aoFechar={() => setTrat(null)} aoSalvar={async () => { setTrat(null); await carregar(); setAviso({ tipo: "ok", texto: "Tratativa salva." }); }} />
    </div>
  );
}

function StatusTrat({ s }) {
  const [cor, rot] = s === "CONCLUIDA" ? ["bg-ok-50 text-ok-700", "Concluída"] : s === "EM ANDAMENTO" ? ["bg-brand-50 text-brand-700", "Em andamento"] : ["bg-bad-50 text-bad-700", "Aberta"];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cor}`}>{rot}</span>;
}

function Detalhe({ r, vinculo, escalaQs, textoQs }) {
  const tx = textosDe(r);
  const rotTexto = (k) => textoQs.find((q) => q.chave === k)?.texto || ({ gostou: "O que mais gostou", mudaria: "O que mudaria", melhorar: "O que podemos melhorar" }[k] || k);
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600"><span>Respondida em <b>{fmtData(r.respondido_em)}</b></span><span>Vínculo: <b>{vinculo}</b></span><span>Serviços: <b>{r.servicos?.join(", ") || "—"}</b></span></div>
      <div className="grid gap-1.5 rounded-2xl border p-3">
        {escalaQs.filter((q) => q.ativa || nota(r, q.chave) != null).map((q) => { const n = nota(r, q.chave); return <div key={q.chave} className="flex justify-between gap-4"><span>{q.texto}</span><b className={n != null && n <= 2 ? "text-bad-700" : ""}>{n ?? "N/A"}</b></div>; })}
      </div>
      <div className="flex items-center gap-2">Recomendação: <Nps n={r.nps} /></div>
      {Object.entries(tx).map(([k, v]) => <div key={k}><span className="label">{rotTexto(k)}</span><p className="mt-0.5 whitespace-pre-line">{v}</p></div>)}
      {r.explicacao_nps && <div><span className="label">Explicação da nota 0–6</span><p className="mt-0.5 whitespace-pre-line">{r.explicacao_nps}</p></div>}
      <p className="text-xs text-slate-500">{r.autoriza_anonimo ? "Autorizou o uso anônimo dos comentários para divulgação." : "Não autorizou o uso dos comentários para divulgação."}</p>
    </div>
  );
}

function Tratativa({ t, resposta, vinculo, escalaQs, textoQs, podeEscrever, aoFechar, aoSalvar }) {
  const [f, setF] = useState({ status: "ABERTA", causa: "", acao_tomada: "", retorno_cliente: "" });
  const [erro, setErro] = useState(""); const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (t) { setF({ status: t.status, causa: t.causa || "", acao_tomada: t.acao || "", retorno_cliente: t.retorno_cliente || "" }); setErro(""); } }, [t]);
  const ro = !podeEscrever || t?.status === "CONCLUIDA";
  async function salvar(e) {
    e.preventDefault(); setErro("");
    if (f.status === "CONCLUIDA" && (!f.causa.trim() || !f.acao_tomada.trim() || !f.retorno_cliente.trim())) { setErro("Para concluir, preencha causa, ação e retorno ao cliente."); return; }
    setSalvando(true);
    try { await salvarTratativa(t.id, f); await aoSalvar(); } catch (er) { setErro(er.message); } finally { setSalvando(false); }
  }
  return (
    <Modal titulo="Tratativa de insatisfação" aberto={!!t} aoFechar={aoFechar} largura="max-w-2xl">
      {t && <form onSubmit={salvar} className="grid gap-4 text-sm">
        <div className="rounded-2xl bg-bad-50 p-3 text-bad-700"><b className="block">Motivo</b>{t.motivo}<span className="mt-1 block text-xs">Prazo: {fmtData(t.prazo)}</span></div>
        {resposta && <details className="rounded-2xl border p-3"><summary className="cursor-pointer font-semibold">Ver resposta completa</summary><div className="mt-3"><Detalhe r={resposta} vinculo={vinculo(resposta)} escalaQs={escalaQs} textoQs={textoQs} /></div></details>}
        <label><span className="label">Status</span><select disabled={ro} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="input"><option value="ABERTA">Aberta</option><option value="EM ANDAMENTO">Em andamento</option><option value="CONCLUIDA">Concluída</option></select></label>
        <label><span className="label">Análise da causa</span><textarea disabled={ro} value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })} rows={3} className="input" /></label>
        <label><span className="label">Ação tomada</span><textarea disabled={ro} value={f.acao_tomada} onChange={(e) => setF({ ...f, acao_tomada: e.target.value })} rows={3} className="input" /></label>
        <label><span className="label">Retorno ao cliente</span><textarea disabled={ro} value={f.retorno_cliente} onChange={(e) => setF({ ...f, retorno_cliente: e.target.value })} rows={2} placeholder="Quando e como o cliente foi informado" className="input" /></label>
        {erro && <p className="rounded-xl bg-bad-50 p-3 text-bad-700">{erro}</p>}
        {!ro && <button disabled={salvando} className="btn-primary inline-flex items-center justify-center gap-2"><ClipboardCheck className="h-4 w-4" aria-hidden />{salvando ? "Salvando..." : "Salvar tratativa"}</button>}
      </form>}
    </Modal>
  );
}

function EnviarPesquisa({ aberto, clientes, aoFechar, aoEnviar }) {
  const [busca, setBusca] = useState(""); const [clienteId, setClienteId] = useState("");
  const [v, setV] = useState({ contratos: [], os: [], contatos: [] });
  const [contratoId, setContratoId] = useState(""); const [osId, setOsId] = useState(""); const [contatoId, setContatoId] = useState("");
  const [envio, setEnvio] = useState(null); const [erro, setErro] = useState(""); const [salvando, setSalvando] = useState(false); const [copiado, setCopiado] = useState(false);
  const rotulo = (c) => `${c.nome}${c.razao && c.razao !== c.nome ? ` — ${c.razao}` : ""}`;
  useEffect(() => { if (!aberto) { setBusca(""); setClienteId(""); setEnvio(null); setErro(""); } }, [aberto]);
  useEffect(() => {
    setContratoId(""); setOsId(""); setContatoId(""); setEnvio(null); setV({ contratos: [], os: [], contatos: [] });
    if (clienteId) vinculosCliente(clienteId).then(setV).catch((e) => setErro(e.message));
  }, [clienteId]);
  useEffect(() => { setEnvio(null); }, [contratoId, osId, contatoId]);
  const contato = v.contatos.find((c) => c.id === contatoId);
  function escolher(texto) { setBusca(texto); const c = clientes.find((x) => rotulo(x).toLowerCase() === texto.trim().toLowerCase()); setClienteId(c?.id || ""); }
  async function gerar(canal) {
    setErro("");
    if (!clienteId) { setErro("Escolha o cliente."); return null; }
    const destino = canal === "WHATSAPP" ? contato?.whatsapp_e164 || contato?.telefone_e164 || "" : canal === "EMAIL" ? contato?.email || "" : "";
    if (envio) { await trocarCanal(envio.id, canal, destino).catch(() => {}); return linkPesquisa(envio.token); }
    setSalvando(true);
    try {
      const r = await enviarPesquisa({ cliente_id: clienteId, contrato_id: contratoId || null, ordem_servico_id: osId || null, contato_id: contatoId || null, canal });
      setEnvio(r); aoEnviar(); return linkPesquisa(r.token);
    } catch (e) { setErro(e.message); return null; } finally { setSalvando(false); }
  }
  async function copiar() { const l = await gerar("LINK"); if (!l) return; await navigator.clipboard.writeText(mensagemPesquisa(l)); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
  async function whatsapp() { const l = await gerar("WHATSAPP"); if (!l) return; const fone = (contato?.whatsapp_e164 || contato?.telefone_e164 || "").replace(/\D/g, ""); window.open(`https://wa.me/${fone}?text=${encodeURIComponent(mensagemPesquisa(l))}`, "_blank", "noopener"); }
  async function email() { const l = await gerar("EMAIL"); if (!l) return; window.location.href = `mailto:${contato?.email || ""}?subject=${encodeURIComponent("Pesquisa de satisfação MinasLab")}&body=${encodeURIComponent(mensagemPesquisa(l))}`; }
  return (
    <Modal titulo="Enviar pesquisa de satisfação" aberto={aberto} aoFechar={aoFechar} largura="max-w-xl">
      <div className="grid gap-4">
        <label><span className="label">Cliente *</span><input list="qual-clientes" value={busca} onChange={(e) => escolher(e.target.value)} placeholder="Digite para buscar..." className="input" autoFocus /><datalist id="qual-clientes">{clientes.map((c) => <option key={c.id} value={rotulo(c)} />)}</datalist></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Contrato <span className="font-normal text-slate-400">(opcional)</span></span><select value={contratoId} onChange={(e) => setContratoId(e.target.value)} disabled={!clienteId} className="input"><option value="">Sem contrato</option>{v.contratos.map((k) => <option key={k.id} value={k.id}>{k.numero_contrato || "Sem número"}{k.status ? ` · ${k.status}` : ""}</option>)}</select></label>
          <label><span className="label">Ordem de serviço <span className="font-normal text-slate-400">(opcional)</span></span><select value={osId} onChange={(e) => setOsId(e.target.value)} disabled={!clienteId} className="input"><option value="">Sem OS</option>{v.os.map((o) => <option key={o.id} value={o.id}>{o.numero_os} · {fmtData(o.data_recepcao)}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="label">Contato <span className="font-normal text-slate-400">(para WhatsApp/e-mail)</span></span><select value={contatoId} onChange={(e) => setContatoId(e.target.value)} disabled={!clienteId} className="input"><option value="">—</option>{v.contatos.map((c) => <option key={c.id} value={c.id}>{c.nome || c.email || c.whatsapp_e164}</option>)}</select></label>
        </div>
        {erro && <p className="rounded-xl bg-bad-50 p-3 text-sm text-bad-700">{erro}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={salvando} onClick={copiar} className="btn-outline inline-flex items-center justify-center gap-2">{copiado ? <CheckCircle2 className="h-4 w-4 text-ok-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copiado ? "Copiado!" : "Copiar mensagem"}</button>
          <button type="button" disabled={salvando} onClick={whatsapp} className="btn-primary inline-flex items-center justify-center gap-2 bg-ok-600"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</button>
          <button type="button" disabled={salvando} onClick={email} className="btn-primary inline-flex items-center justify-center gap-2"><Mail className="h-4 w-4" aria-hidden /> E-mail</button>
        </div>
        {envio && <div className="break-all rounded-xl bg-brand-50 p-3 text-xs text-brand-700"><b className="mb-1 block text-sm">Link gerado (válido por 60 dias)</b>{linkPesquisa(envio.token)}</div>}
        <p className="text-xs text-slate-500">Cada link vale para uma resposta. A resposta aparece aqui e no CRM (Pós-venda).</p>
      </div>
    </Modal>
  );
}

const TIPOS_PERGUNTA = [
  { valor: "ESCALA", titulo: "Notas de 1 a 5", ajuda: "Cada item vira uma linha de notas. Nota 1 ou 2 abre tratativa de insatisfação." },
  { valor: "TEXTO", titulo: "Perguntas abertas", ajuda: "O cliente escreve a resposta. Respostas diferentes de “o que mais gostou” viram sugestões de melhoria." },
  { valor: "SERVICO", titulo: "Opções de “Serviço utilizado”", ajuda: "Opções que o cliente marca no início do formulário." },
];

function EditorPerguntas({ perguntas, revisao, podeEscrever, aoMudar, avisar }) {
  const [editando, setEditando] = useState(null); // { id?, tipo, texto, permite_na, obrigatoria, ativa }
  const [rev, setRev] = useState(revisao);
  const [salvando, setSalvando] = useState(false);
  const [verInativas, setVerInativas] = useState(false);
  useEffect(() => { setRev(revisao); }, [revisao]);

  async function gravar(dados) {
    setSalvando(true);
    try { await salvarPergunta(dados); setEditando(null); await aoMudar(); avisar({ tipo: "ok", texto: "Pergunta salva. Vale para as próximas respostas." }); }
    catch (e) { avisar({ tipo: "erro", texto: e.message }); } finally { setSalvando(false); }
  }
  async function mover(lista, i, delta) {
    const j = i + delta; if (j < 0 || j >= lista.length) return;
    const ids = lista.map((q) => q.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await ordenarPerguntas(ids); await aoMudar(); } catch (e) { avisar({ tipo: "erro", texto: e.message }); }
  }
  async function gravarRevisao() {
    try { await salvarRevisao(rev); await aoMudar(); avisar({ tipo: "ok", texto: `Revisão ${rev} registrada no formulário.` }); } catch (e) { avisar({ tipo: "erro", texto: e.message }); }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <ListChecks className="h-5 w-5 text-brand" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <b className="block text-slate-900">Formulário PG 012 · revisão {revisao}</b>
          <span className="text-slate-500">As mudanças valem para as próximas respostas (links já enviados também passam a mostrar as perguntas novas). Respostas antigas não mudam. A recomendação de 0 a 10 é fixa.</span>
        </div>
        {podeEscrever && <div className="flex items-center gap-2"><label className="text-sm text-slate-600" htmlFor="rev-pg012">Revisão</label><input id="rev-pg012" value={rev} onChange={(e) => setRev(e.target.value)} className="input w-20" /><button type="button" onClick={gravarRevisao} disabled={rev === revisao || !rev.trim()} className="btn-outline">Salvar revisão</button></div>}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={verInativas} onChange={(e) => setVerInativas(e.target.checked)} /> Mostrar perguntas retiradas</label>

      {TIPOS_PERGUNTA.map((t) => {
        const ativas = perguntas.filter((q) => q.tipo === t.valor && q.ativa);
        const inativas = perguntas.filter((q) => q.tipo === t.valor && !q.ativa);
        return (
          <div key={t.valor} className="card p-5">
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <div className="flex-1"><h3 className="font-display font-semibold text-slate-900">{t.titulo} <span className="text-sm font-normal text-slate-400">({ativas.length})</span></h3><p className="text-xs text-slate-500">{t.ajuda}</p></div>
              {podeEscrever && <button type="button" onClick={() => setEditando({ tipo: t.valor, texto: "", permite_na: false, obrigatoria: t.valor === "ESCALA", ativa: true })} className="btn-outline inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Acrescentar</button>}
            </div>
            <ul className="divide-y rounded-xl border">
              {ativas.map((q, i) => (
                <li key={q.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-6 text-right text-xs text-slate-400">{i + 1}.</span>
                  <span className="min-w-0 flex-1">{q.texto}
                    {t.valor !== "SERVICO" && <span className="ml-2 text-xs text-slate-500">{q.obrigatoria && !q.permite_na ? "obrigatória" : "opcional"}{q.permite_na ? " · aceita “não se aplica”" : ""}</span>}
                  </span>
                  {podeEscrever && <span className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => mover(ativas, i, -1)} disabled={i === 0} className="btn-ghost p-1.5" title="Subir"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                    <button type="button" onClick={() => mover(ativas, i, 1)} disabled={i === ativas.length - 1} className="btn-ghost p-1.5" title="Descer"><ArrowDown className="h-4 w-4" aria-hidden /></button>
                    <button type="button" onClick={() => setEditando({ ...q })} className="btn-ghost p-1.5" title="Editar"><Pencil className="h-4 w-4" aria-hidden /></button>
                    <button type="button" onClick={() => window.confirm(`Tirar “${q.texto}” do formulário? As respostas antigas continuam guardadas.`) && gravar({ ...q, ativa: false })} className="btn-ghost p-1.5 text-bad-700" title="Tirar do formulário"><EyeOff className="h-4 w-4" aria-hidden /></button>
                  </span>}
                </li>
              ))}
              {ativas.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">Nenhuma pergunta ativa.</li>}
              {verInativas && inativas.map((q) => (
                <li key={q.id} className="flex items-center gap-3 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                  <span className="w-6" /><span className="flex-1 line-through">{q.texto}</span><span className="text-xs">retirada</span>
                  {podeEscrever && <button type="button" onClick={() => gravar({ ...q, ativa: true })} className="btn-ghost inline-flex items-center gap-1 p-1.5 text-xs text-brand-700"><RotateCcw className="h-4 w-4" aria-hidden /> Voltar</button>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Modal titulo={editando?.id ? "Editar pergunta" : "Acrescentar pergunta"} aberto={!!editando} aoFechar={() => setEditando(null)}>
        {editando && <form onSubmit={(e) => { e.preventDefault(); gravar(editando); }} className="grid gap-4 text-sm">
          <p className="text-slate-500">{TIPOS_PERGUNTA.find((t) => t.valor === editando.tipo)?.titulo}</p>
          <label><span className="label">{editando.tipo === "SERVICO" ? "Nome do serviço" : "Texto da pergunta"}</span><textarea autoFocus rows={2} maxLength={300} value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} className="input" /></label>
          {editando.tipo !== "SERVICO" && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editando.obrigatoria} onChange={(e) => setEditando({ ...editando, obrigatoria: e.target.checked })} /> Resposta obrigatória</label>}
          {editando.tipo === "ESCALA" && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editando.permite_na} onChange={(e) => setEditando({ ...editando, permite_na: e.target.checked })} /> Aceita “não se aplica” (fica opcional)</label>}
          {editando.id && <p className="rounded-xl bg-warn-50 p-3 text-xs text-warn-700">Mudar o texto altera como a pergunta aparece daqui em diante e nos relatórios. Se o sentido mudar, prefira tirar esta e acrescentar uma nova.</p>}
          <button disabled={salvando || !editando.texto.trim()} className="btn-primary">{salvando ? "Salvando..." : "Salvar"}</button>
        </form>}
      </Modal>
    </div>
  );
}
