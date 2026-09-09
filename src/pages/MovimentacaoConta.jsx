import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, Upload, ArrowRight, Landmark, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finMovimentosPagina, finMovimentosImportar } from "../services/financeiro.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => {
  if (!v) return "—";
  const p = String(v).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
};
const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function tag(bloco, nome) {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]+)`, "i"));
  return m ? m[1].trim() : "";
}
function dataOfx(v) {
  const m = String(v || "").match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function lerContaOFX(t) {
  return { banco: tag(t, "BANKID"), agencia: tag(t, "BRANCHID"), conta: tag(t, "ACCTID"), tipo: tag(t, "ACCTTYPE") };
}
function parseOFX(t) {
  return String(t || "").split(/<STMTTRN>/i).slice(1).map((b) => {
    const valor = Number(tag(b, "TRNAMT").replace(",", ".")) || 0;
    const memo = tag(b, "MEMO");
    const name = tag(b, "NAME");
    const descricao = [name, memo].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" · ");
    return {
      data_movimento: dataOfx(tag(b, "DTPOSTED")),
      descricao: descricao || memo || name,
      tipo: valor >= 0 ? "CREDITO" : "DEBITO",
      valor,
      fitid: tag(b, "FITID"),
      documento: tag(b, "CHECKNUM"),
      origem: "OFX",
    };
  }).filter((x) => x.data_movimento && x.valor !== 0);
}
function detectarContaOFX(meta, contas, empresaId) {
  const cs = (contas || []).filter((c) => c.empresa_id === empresaId);
  if (cs.length === 1) return cs[0];
  const co = soDigitos(meta?.conta), ba = soDigitos(meta?.banco), ag = soDigitos(meta?.agencia);
  const pc = cs.filter((c) => co && soDigitos(c.conta) === co);
  if (pc.length === 1) return pc[0];
  const p = cs.filter((c) => (!ba || soDigitos(c.banco) === ba) && (!co || soDigitos(c.conta) === co) && (!ag || soDigitos(c.agencia) === ag));
  return p.length === 1 ? p[0] : null;
}
function origemAmigavel(v) {
  const x = String(v || "").toUpperCase();
  if (x === "OMIE") return "Omie · automática";
  if (x === "OFX") return "OFX · arquivo bancário";
  if (x === "CSV_C6") return "C6 · legado";
  return v || "Manual";
}

export default function MovimentacaoConta() {
  const navigate = useNavigate();
  const ofxRef = useRef(null);
  const [op, setOp] = useState({ empresas: [], contas: [] });
  const [empresa, setEmpresa] = useState("");
  const [conta, setConta] = useState("");
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState("");
  const [ano, setAno] = useState("");
  const [mes, setMes] = useState("");
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(50);
  const [meta, setMeta] = useState({ total: 0, paginas: 1 });
  const [resumo, setResumo] = useState({ entradas: 0, saidas: 0, conciliados: 0, pendentes: 0 });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [importando, setImportando] = useState(false);

  async function carregar(p = 1) {
    setLoading(true);
    setErro("");
    try {
      const [o, m] = await Promise.all([
        financeiroOpcoes(),
        finMovimentosPagina({ empresaId: empresa, contaId: conta, busca, status, tipoMovimento, ano: ano ? Number(ano) : null, mes: mes ? Number(mes) : null, pagina: p, limite }),
      ]);
      setOp(o || { empresas: [], contas: [] });
      setItens(m?.itens || []);
      setMeta({ total: m?.total || 0, paginas: m?.paginas || 1 });
      setResumo(m?.resumo || { entradas: 0, saidas: 0, conciliados: 0, pendentes: 0 });
      setPagina(m?.pagina || p);
    } catch (e) {
      setErro(e.message || "Não foi possível carregar as movimentações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => carregar(1), 200);
    return () => clearTimeout(t);
  }, [empresa, conta, busca, status, tipoMovimento, ano, mes]);

  const empresaSelecionada = useMemo(() => op.empresas.find((x) => x.id === empresa), [op.empresas, empresa]);
  const contasEmpresa = useMemo(() => op.contas.filter((c) => !empresa || c.empresa_id === empresa), [op.contas, empresa]);
  const saldoResumo = Number(resumo.entradas || 0) - Number(resumo.saidas || 0);
  const ehMLab = /m\s*lab/i.test(empresaSelecionada?.nome || "") && !/minas/i.test(empresaSelecionada?.nome || "");

  async function importarOFX(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!empresa) {
      setErro("Selecione a empresa antes de atualizar por OFX.");
      e.target.value = "";
      return;
    }
    setImportando(true);
    setErro("");
    setAviso("");
    try {
      const texto = await f.text();
      const dados = parseOFX(texto);
      const metaConta = lerContaOFX(texto);
      if (!dados.length) throw new Error("Nenhuma movimentação válida foi encontrada no arquivo OFX.");
      const detectada = conta ? op.contas.find((c) => c.id === conta) : detectarContaOFX(metaConta, op.contas, empresa);
      if (!detectada) throw new Error(`Não foi possível identificar a conta do OFX${metaConta.conta ? ` (conta ${metaConta.conta})` : ""}. Selecione a conta bancária e tente novamente.`);
      setConta(detectada.id);
      const r = await finMovimentosImportar(empresa, detectada.id, dados);
      setAviso(`Movimentação atualizada por OFX na conta ${detectada.nome}: ${r?.inseridos || 0} novos e ${r?.ignorados || 0} já existentes.`);
      await carregar(1);
    } catch (e2) {
      setErro(e2.message || "Falha ao importar o OFX.");
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <PageTitle titulo="Movimentação da Conta" descricao="Uma única visão para movimentos vindos automaticamente da Omie e para extratos bancários atualizados por OFX." />
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" onClick={() => carregar(pagina)} disabled={loading}><RefreshCw size={15}/>Atualizar tela</button>
        <button className="btn-primary" onClick={() => empresa ? ofxRef.current?.click() : setErro("Selecione a empresa antes de atualizar por OFX.")} disabled={importando}><Upload size={16}/>{importando ? "Importando..." : "Atualizar por OFX"}</button>
        <input ref={ofxRef} type="file" accept=".ofx,application/x-ofx" className="hidden" onChange={importarOFX}/>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entradas</p><p className="mt-1 text-2xl font-bold text-emerald-700">{moeda(resumo.entradas)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saídas</p><p className="mt-1 text-2xl font-bold text-rose-700">{moeda(resumo.saidas)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p><p className={`mt-1 text-2xl font-bold ${saldoResumo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{moeda(saldoResumo)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">A conciliar</p><p className="mt-1 text-2xl font-bold text-amber-700">{resumo.pendentes || 0}</p></div>
    </div>

    <div className="grid gap-4 rounded-2xl border bg-white p-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr_0.8fr_1.4fr]">
      <label><span className="label">Empresa</span><select className="input" value={empresa} onChange={(e) => { setEmpresa(e.target.value); setConta(""); setAviso(""); }}><option value="">Todas</option>{op.empresas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label><span className="label">Conta</span><select className="input" value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todas</option>{contasEmpresa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><span className="label">Tipo</span><select className="input" value={tipoMovimento} onChange={(e) => setTipoMovimento(e.target.value)}><option value="">Todos</option><option value="CREDITO">Crédito</option><option value="DEBITO">Débito</option></select></label>
      <label><span className="label">Situação</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option><option value="PENDENTE">Pendente</option><option value="CONCILIADO">Conciliado</option></select></label>
      <label><span className="label">Período</span><div className="flex gap-2"><select className="input" value={mes} onChange={(e)=>setMes(e.target.value)}><option value="">Mês</option>{MESES.map((x,i)=><option key={x} value={i+1}>{x}</option>)}</select><select className="input" value={ano} onChange={(e)=>setAno(e.target.value)}><option value="">Ano</option>{[2024,2025,2026,2027].map((x)=><option key={x}>{x}</option>)}</select></div></label>
      <label><span className="label">Pesquisar</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Favorecido, descrição ou documento"/></div></label>
    </div>

    {empresa && <div className={`rounded-2xl border p-4 ${ehMLab ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex items-start gap-3">
        <Landmark size={20} className={ehMLab ? "text-blue-700" : "text-emerald-700"}/>
        <div>
          <p className="font-semibold text-slate-900">{empresaSelecionada?.nome || "Empresa"}</p>
          <p className="mt-1 text-sm text-slate-600">{ehMLab ? "C6 Bank: atualize a movimentação por arquivo OFX. Depois da importação, os movimentos entram na mesma fila de conciliação usada pelo restante do Financeiro." : "MinasLab: os movimentos integrados pela Omie aparecem automaticamente aqui. OFX continua disponível como atualização bancária controlada quando necessário."}</p>
        </div>
      </div>
    </div>}

    {erro && <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{erro}</div>}
    {aviso && <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{aviso}</div>}

    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Conta</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Situação</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan="7" className="p-8 text-center text-slate-500">Carregando movimentações...</td></tr> : itens.length === 0 ? <tr><td colSpan="7" className="p-8 text-center text-slate-500">Nenhuma movimentação encontrada.</td></tr> : itens.map((m) => <tr key={m.id} className="border-t">
          <td className="px-4 py-3">{dataBR(m.data_movimento)}</td>
          <td className="px-4 py-3"><div className="font-medium text-slate-800">{m.descricao || m.documento || "Movimento bancário"}</div>{m.documento && <div className="mt-0.5 text-xs text-slate-400">{m.documento}</div>}</td>
          <td className="px-4 py-3">{m.conta?.nome || "—"}</td>
          <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{origemAmigavel(m.origem)}</span></td>
          <td className={`px-4 py-3 font-semibold ${m.tipo === "CREDITO" ? "text-emerald-700" : "text-rose-700"}`}>{m.tipo === "CREDITO" ? "Entrada" : "Saída"}</td>
          <td className="px-4 py-3 text-right font-semibold">{moeda(m.valor)}</td>
          <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${m.conciliado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{m.conciliado ? "Conciliado" : "Pendente"}</span></td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">{meta.total} movimentos · página {pagina} de {meta.paginas}</div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" disabled={pagina <= 1} onClick={() => carregar(pagina - 1)}>Anterior</button>
        <button className="btn-outline" disabled={pagina >= meta.paginas} onClick={() => carregar(pagina + 1)}>Próxima</button>
        <button className="btn-primary" onClick={() => navigate("/financas/conciliacao")}>Ir para Conciliação <ArrowRight size={15}/></button>
      </div>
    </div>
  </div>;
}
