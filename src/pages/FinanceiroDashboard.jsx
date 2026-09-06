import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { financeiroDashboard, financeiroOpcoes } from "../services/financeiro.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${Number(v || 0).toFixed(1).replace(".", ",")}%`;
function mesAtual() { const d = new Date(); const de = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; const fim = new Date(d.getFullYear(), d.getMonth()+1, 0); const ate = `${fim.getFullYear()}-${String(fim.getMonth()+1).padStart(2,"0")}-${String(fim.getDate()).padStart(2,"0")}`; return { de, ate }; }

function Card({ titulo, valor, subtitulo, Icone, destaque = "text-slate-900" }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p><p className={`mt-2 text-2xl font-bold ${destaque}`}>{valor}</p>{subtitulo && <p className="mt-1 text-xs text-slate-500">{subtitulo}</p>}</div><span className="rounded-xl bg-slate-50 p-2.5 text-slate-600"><Icone size={20}/></span></div>
  </div>;
}

export default function FinanceiroDashboard() {
  const navigate = useNavigate();
  const periodo = mesAtual();
  const [empresaId, setEmpresaId] = useState("");
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);
  const [opcoes, setOpcoes] = useState({ empresas: [] });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true); setErro("");
    try {
      const [o, d] = await Promise.all([financeiroOpcoes(), financeiroDashboard({ empresaId, de, ate })]);
      setOpcoes(o); setDados(d);
    } catch (e) { setErro(e.message || "Falha ao carregar o dashboard."); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, [empresaId, de, ate]);

  const serie = useMemo(() => {
    const mapa = new Map();
    for (const r of dados?.recebimentos || []) { const k = String(r.data_vencimento || "").slice(0,7); if (!k) continue; const a = mapa.get(k) || { mes:k, entradas:0, saidas:0 }; a.entradas += Number(r.valor_recebido || 0); mapa.set(k,a); }
    for (const d of dados?.despesas || []) { const k = String(d.data_vencimento || "").slice(0,7); if (!k) continue; const a = mapa.get(k) || { mes:k, entradas:0, saidas:0 }; a.saidas += Number(d.valor_pago || 0); mapa.set(k,a); }
    return [...mapa.values()].sort((a,b)=>a.mes.localeCompare(b.mes)).slice(-6);
  }, [dados]);
  const maxSerie = Math.max(1, ...serie.flatMap(x => [x.entradas, x.saidas]));

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={()=>navigate("/financas")}><ArrowLeft size={18}/></button><PageTitle titulo="Dashboard Financeiro" descricao="MinasLab + M Lab, com lançamentos manuais e integração Omie da MinasLab." /></div>

    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
      <label className="block"><span className="label">Empresa</span><select className="input" value={empresaId} onChange={e=>setEmpresaId(e.target.value)}><option value="">Consolidado</option>{(opcoes.empresas||[]).map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
      <label className="block"><span className="label">De</span><input className="input" type="date" value={de} onChange={e=>setDe(e.target.value)}/></label>
      <label className="block"><span className="label">Até</span><input className="input" type="date" value={ate} onChange={e=>setAte(e.target.value)}/></label>
      <div className="flex items-end"><button className="btn-outline w-full" onClick={carregar} disabled={carregando}><RefreshCw size={15} className={carregando?"animate-spin":""}/>{carregando?"Carregando...":"Atualizar"}</button></div>
    </div>
    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card titulo="Total Recebido" valor={moeda(dados?.totalRecebido)} subtitulo="Realizado no período" Icone={ArrowDownCircle} destaque="text-emerald-700"/>
      <Card titulo="A Receber" valor={moeda(dados?.totalReceber)} subtitulo="Saldo de títulos abertos" Icone={TrendingUp} destaque="text-sky-700"/>
      <Card titulo="Total Pago" valor={moeda(dados?.totalPago)} subtitulo="Despesas realizadas" Icone={ArrowUpCircle} destaque="text-rose-700"/>
      <Card titulo="A Pagar" valor={moeda(dados?.totalPagar)} subtitulo="Saldo de despesas abertas" Icone={Wallet} destaque="text-amber-700"/>
      <Card titulo="Saldo Atual" valor={moeda(dados?.saldoAtual)} subtitulo="Saldo inicial + recebido - pago" Icone={Wallet}/>
      <Card titulo="Saldo Projetado" valor={moeda(dados?.saldoProjetado)} subtitulo="Inclui a receber e a pagar" Icone={TrendingUp}/>
      <Card titulo="Inadimplência" valor={pct(dados?.inadimplencia)} subtitulo="Títulos vencidos sobre a carteira" Icone={AlertTriangle} destaque={Number(dados?.inadimplencia)>0?"text-red-700":"text-emerald-700"}/>
      <Card titulo="Notas no período" valor={moeda(dados?.notas)} subtitulo="Valor total cadastrado" Icone={FileText}/>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4"><h2 className="font-semibold text-slate-900">Entradas x Saídas</h2><p className="text-xs text-slate-500">Visualização dos valores realizados no período selecionado.</p></div>
      {serie.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Sem movimentação realizada no período.</p> : <div className="space-y-4">{serie.map(x=><div key={x.mes}><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{x.mes.split("-").reverse().join("/")}</span><span>Entrada {moeda(x.entradas)} · Saída {moeda(x.saidas)}</span></div><div className="grid gap-1"><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{width:`${x.entradas/maxSerie*100}%`}}/></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-rose-500" style={{width:`${x.saidas/maxSerie*100}%`}}/></div></div></div>)}</div>}
    </div>
  </div>;
}
