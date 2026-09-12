import ReguaAnual from "../components/financeiro/ReguaAnual.jsx";
import ComparativoMensal from "../components/financeiro/ComparativoMensal.jsx";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Landmark, ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finMovimentosListar, finRecebimentosListar, finDespesasListar } from "../services/financeiro.js";

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioAno = () => `${new Date().getFullYear()}-01-01`;
const dataBR = (v) => { if (!v) return ""; const p = String(v).slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(v); };
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
function baixarCsv(nome, cabecalho, linhas) {
  const conteudo = `\uFEFF${cabecalho.map(csv).join(";")}\r\n${linhas.map((l) => l.map(csv).join(";")).join("\r\n")}`;
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function RelatoriosFinanceiro() {
  const [op, setOp] = useState({ empresas: [], contas: [] });
  const [empresa, setEmpresa] = useState("");
  const [conta, setConta] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [de, setDe] = useState(inicioAno());
  const [ate, setAte] = useState(hoje());
  const [movimentos, setMovimentos] = useState([]);
  const [recebimentos, setRecebimentos] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setLoading(true); setErro("");
    try {
      const [o, m, r, d] = await Promise.all([financeiroOpcoes(), finMovimentosListar(empresa), finRecebimentosListar(empresa), finDespesasListar(empresa)]);
      setOp(o || { empresas: [], contas: [] }); setMovimentos(m || []); setRecebimentos(r || []); setDespesas(d || []);
    } catch (e) { setErro(e.message || "Não foi possível carregar os relatórios."); }
    finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [empresa]);

  const empresas = useMemo(() => new Map((op.empresas || []).map((x) => [x.id, x.nome])), [op.empresas]);
  const contas = useMemo(() => (op.contas || []).filter((x) => !empresa || x.empresa_id === empresa), [op.contas, empresa]);
  const contasMap = useMemo(() => new Map((op.contas || []).map((x) => [x.id, x])), [op.contas]);
  const noPeriodo = (v) => { const d = String(v || "").slice(0, 10); return !!d && (!de || d >= de) && (!ate || d <= ate); };
  const movimentosFiltrados = useMemo(() => movimentos.filter((m) => (!conta || m.conta_bancaria_id === conta) && noPeriodo(m.data_movimento)), [movimentos, conta, de, ate]);
  const recebimentosFiltrados = useMemo(() => recebimentos.filter((r) => noPeriodo(r.data_vencimento || r.data_lancamento)), [recebimentos, de, ate]);
  const despesasFiltradas = useMemo(() => despesas.filter((d) => noPeriodo(d.data_vencimento || d.data_lancamento)), [despesas, de, ate]);

  function exportarBancos() {
    const linhas = movimentosFiltrados.map((m) => { const c = contasMap.get(m.conta_bancaria_id) || {}; return [dataBR(m.data_movimento), empresas.get(m.empresa_id) || m.empresa?.nome || "", c.banco || "", c.nome || "", c.agencia || "", c.conta || "", m.tipo, Number(m.valor || 0).toFixed(2).replace(".", ","), m.descricao || "", m.documento || "", m.origem || "", m.conciliado ? "SIM" : "NÃO", m.fitid || m.id_omie || ""]; });
    const sufixo = conta ? (contasMap.get(conta)?.nome || "conta") : "todas-contas";
    baixarCsv(`financeiro-extrato-${sufixo}-${de}-${ate}.csv`, ["Data", "Empresa", "Banco", "Conta", "Agência", "Número da conta", "Tipo", "Valor", "Descrição", "Documento", "Origem", "Conciliado", "Identificador"], linhas);
  }
  function exportarRecebimentos() {
    baixarCsv(`financeiro-recebimentos-${de}-${ate}.csv`, ["Empresa", "Cliente", "CPF/CNPJ", "Descrição", "Valor previsto", "Valor recebido", "Valor pendente", "Vencimento", "Pagamento", "Status", "Categoria", "Conta", "Forma de pagamento", "NF", "Origem", "ID Omie"], recebimentosFiltrados.map((r) => [r.empresa?.nome || empresas.get(r.empresa_id) || "", r.cliente || "", r.cnpj_cpf || "", r.descricao || "", Number(r.valor_previsto || 0).toFixed(2).replace(".", ","), Number(r.valor_recebido || 0).toFixed(2).replace(".", ","), Number(r.valor_pendente || 0).toFixed(2).replace(".", ","), dataBR(r.data_vencimento), dataBR(r.data_pagamento), r.status || "", r.categoria?.nome || r.categoria_texto || "", r.conta_bancaria?.nome || r.conta_bancaria_texto || "", r.forma_pagamento || "", r.numero_nf || "", r.origem || "", r.id_omie || ""]));
  }
  function exportarDespesas() {
    baixarCsv(`financeiro-despesas-${de}-${ate}.csv`, ["Empresa", "Fornecedor", "Documento", "Descrição", "Valor original", "Valor pago", "Valor pendente", "Vencimento", "Pagamento", "Status", "Categoria", "Centro de custo", "Conta", "Forma de pagamento", "Origem", "ID Omie"], despesasFiltradas.map((d) => [d.empresa?.nome || empresas.get(d.empresa_id) || "", d.fornecedor || "", d.documento || "", d.descricao || "", Number(d.valor_original || 0).toFixed(2).replace(".", ","), Number(d.valor_pago || 0).toFixed(2).replace(".", ","), Number(d.valor_pendente || 0).toFixed(2).replace(".", ","), dataBR(d.data_vencimento), dataBR(d.data_pagamento), d.status || "", d.categoria?.nome || d.categoria_texto || "", d.centro_custo?.nome || d.centro_custo_texto || "", d.conta_bancaria?.nome || d.conta_bancaria_texto || "", d.forma_pagamento || "", d.origem || "", d.id_omie || ""]));
  }

  return <div className="space-y-5">
    <PageTitle titulo="Relatórios Financeiros" descricao="Exporte dados operacionais do Financeiro por empresa, período e conta bancária."/>
    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4">
      <label><span className="label">Empresa</span><select className="input" value={empresa} onChange={(e) => { setEmpresa(e.target.value); setConta(""); }}><option value="">Todas / Consolidado</option>{(op.empresas || []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label><span className="label">Banco / conta</span><select className="input" value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todas as contas juntas</option>{contas.map((x) => <option key={x.id} value={x.id}>{[x.banco, x.nome].filter(Boolean).join(" · ")}</option>)}</select></label>
      <label><span className="label">De</span><input className="input" type="date" value={de} onChange={(e) => {setDe(e.target.value);if(e.target.value)setAno(Number(e.target.value.slice(0,4)))}}/></label>
      <label><span className="label">Até</span><input className="input" type="date" value={ate} onChange={(e) => setAte(e.target.value)}/></label>
    </section>

    <ReguaAnual ano={ano} setAno={setAno} movimentos={movimentos} conta={conta} de={de} ate={ate} onPeriodo={p=>{setDe(p.de);setAte(p.ate)}} loading={loading}/>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Landmark size={18} className="text-teal-700"/><h2 className="font-bold">Extrato bancário</h2></div><p className="mt-2 text-sm text-slate-500">{movimentosFiltrados.length} movimento(s) no período. Baixe uma conta específica ou todas as contas em uma única planilha.</p><button className="btn-primary mt-4 w-full" disabled={loading} onClick={exportarBancos}><Download size={16}/>Baixar planilha bancária</button></section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ArrowDownCircle size={18} className="text-emerald-700"/><h2 className="font-bold">Recebimentos</h2></div><p className="mt-2 text-sm text-slate-500">{recebimentosFiltrados.length} recebimento(s) no período selecionado.</p><button className="btn-outline mt-4 w-full" disabled={loading} onClick={exportarRecebimentos}><Download size={16}/>Baixar recebimentos</button></section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ArrowUpCircle size={18} className="text-rose-700"/><h2 className="font-bold">Despesas</h2></div><p className="mt-2 text-sm text-slate-500">{despesasFiltradas.length} despesa(s) no período selecionado.</p><button className="btn-outline mt-4 w-full" disabled={loading} onClick={exportarDespesas}><Download size={16}/>Baixar despesas</button></section>
    </div>

    <button type="button" className="btn-outline" onClick={carregar} disabled={loading}><RefreshCw size={15}/>{loading ? "Atualizando..." : "Atualizar dados"}</button>
    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><BarChart3 size={14} className="mr-1 inline"/>Os arquivos são CSV em UTF-8, abrem normalmente no Excel e preservam os dados do sistema sem alterar nenhum registro.</div>
  <ComparativoMensal movimentos={movimentosFiltrados}/>
</div>;
}
