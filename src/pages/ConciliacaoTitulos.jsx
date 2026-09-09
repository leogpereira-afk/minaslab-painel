import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Landmark, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finRecebimentosPagina, finDespesasPagina, finMovimentosPagina, finConciliar } from "../services/financeiro.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => {
  if (!v) return "—";
  const p = String(v).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(v);
};
const normaliza = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const reais = (m) => (m?.conciliacoes || []).filter((c) => c?.id && !c?.somente_categoria_omie);
const conciliadoMov = (m) => reais(m).reduce((s, c) => s + Number(c?.valor_conciliado || 0), 0);
const restanteMov = (m) => Math.max(0, Math.abs(Number(m?.valor || 0)) - conciliadoMov(m));
const valorTitulo = (x, tipo) => Math.max(0, Number(tipo === "RECEBIMENTO" ? x?.valor_previsto : x?.valor_original) || 0);
const conciliadoTitulo = (x) => Math.max(0, Number(x?.valor_conciliado || 0));
const restanteTitulo = (x, tipo) => Math.max(0, valorTitulo(x, tipo) - conciliadoTitulo(x));
const nomeTitulo = (x, tipo) => tipo === "RECEBIMENTO" ? x?.cliente : x?.fornecedor;
const documentoTitulo = (x) => x?.numero_nf || x?.cnpj_cpf || x?.documento || "";
const dataTitulo = (x) => x?.data_pagamento || x?.data_vencimento || x?.data_lancamento || "";

function Modal({ titulo, onClose, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
    <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold text-slate-900">{titulo}</h2><button className="btn-ghost h-9 w-9 p-0" onClick={onClose}><X size={18}/></button></div>
      <div className="max-h-[calc(92vh-68px)] overflow-y-auto p-5">{children}</div>
    </div>
  </div>;
}

export default function ConciliacaoTitulos() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState("RECEBIMENTO");
  const [op, setOp] = useState({ empresas: [] });
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState([]);
  const [meta, setMeta] = useState({ total: 0, paginas: 1, pagina: 1 });
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [titulo, setTitulo] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [buscaMov, setBuscaMov] = useState("");
  const [selecionados, setSelecionados] = useState([]);
  const [carregandoMov, setCarregandoMov] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar(p = pagina) {
    setLoading(true); setErro("");
    try {
      const opts = await financeiroOpcoes();
      setOp(opts || { empresas: [] });
      const f = { empresaId: empresa, busca, pagina: p, limite: 25 };
      const r = tipo === "RECEBIMENTO" ? await finRecebimentosPagina(f) : await finDespesasPagina(f);
      setItens(r.itens || []);
      setMeta({ total: r.total || 0, paginas: r.paginas || 1, pagina: r.pagina || p });
      setPagina(r.pagina || p);
    } catch (e) { setErro(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(() => carregar(1), 250); return () => clearTimeout(t); }, [tipo, empresa, busca]);

  async function abrir(x) {
    if (!x?.empresa_id) { setErro("Este título não possui empresa vinculada."); return; }
    setTitulo(x); setSelecionados([]); setBuscaMov(""); setCarregandoMov(true); setErro(""); setOk("");
    try {
      const r = await finMovimentosPagina({ empresaId: x.empresa_id, status: "PENDENTE", tipoMovimento: tipo === "RECEBIMENTO" ? "CREDITO" : "DEBITO", pagina: 1, limite: 100 });
      setMovimentos(r.itens || []);
    } catch (e) { setErro(e.message); setTitulo(null); } finally { setCarregandoMov(false); }
  }

  const candidatos = useMemo(() => {
    if (!titulo) return [];
    const termo = normaliza(buscaMov);
    const alvo = restanteTitulo(titulo, tipo);
    const dtTitulo = dataTitulo(titulo) ? new Date(`${String(dataTitulo(titulo)).slice(0, 10)}T00:00:00`) : null;
    const nome = normaliza(nomeTitulo(titulo, tipo));
    const doc = normaliza(documentoTitulo(titulo));
    return movimentos
      .filter((m) => restanteMov(m) > 0.005)
      .filter((m) => !termo || normaliza(`${m.descricao || ""} ${m.documento || ""} ${m.conta?.nome || ""} ${dataBR(m.data_movimento)} ${Math.abs(Number(m.valor || 0)).toFixed(2)}`).includes(termo))
      .map((m) => {
        const disp = restanteMov(m);
        const dtMov = new Date(`${String(m.data_movimento).slice(0, 10)}T00:00:00`);
        const dias = dtTitulo ? Math.abs(dtMov - dtTitulo) / 86400000 : 9999;
        const texto = normaliza(`${m.descricao || ""} ${m.documento || ""}`);
        let score = 0;
        if (Math.abs(disp - alvo) < 0.01) score += 6;
        if (dias <= 3) score += 3; else if (dias <= 7) score += 1;
        if (nome && texto.includes(nome)) score += 5;
        if (doc && doc.length >= 2 && texto.includes(doc)) score += 3;
        return { m, disp, dias, score };
      })
      .sort((a, b) => b.score - a.score || a.dias - b.dias || Math.abs(a.disp - alvo) - Math.abs(b.disp - alvo));
  }, [titulo, movimentos, buscaMov, tipo]);

  const valorSelecionado = selecionados.reduce((s, id) => {
    const x = candidatos.find((c) => c.m.id === id);
    return s + (x?.disp || 0);
  }, 0);

  function alternar(id) { setSelecionados((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]); }

  async function confirmar() {
    if (!titulo || !selecionados.length) return;
    let restante = restanteTitulo(titulo, tipo);
    if (restante <= 0.005) return;
    setSalvando(true); setErro(""); setOk("");
    try {
      let feitos = 0;
      for (const id of selecionados) {
        if (restante <= 0.005) break;
        const c = candidatos.find((x) => x.m.id === id);
        if (!c) continue;
        const valor = Math.min(restante, c.disp);
        if (valor <= 0.005) continue;
        await finConciliar(c.m.id, {
          recebimentoId: tipo === "RECEBIMENTO" ? titulo.id : null,
          despesaId: tipo === "DESPESA" ? titulo.id : null,
          valor,
        });
        restante -= valor;
        feitos++;
      }
      setOk(`${feitos} movimento(s) conciliado(s) com o ${tipo === "RECEBIMENTO" ? "recebimento" : "pagamento"}.${restante > 0.005 ? ` Restante do título: ${moeda(restante)}.` : " Título totalmente conciliado."}`);
      setTitulo(null); setSelecionados([]); setMovimentos([]);
      await carregar(pagina);
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={() => navigate("/financas/bancos")}><ArrowLeft size={18}/></button><PageTitle titulo="Conciliação por Títulos" descricao="Selecione primeiro o recebimento ou a despesa e depois vincule os lançamentos bancários compatíveis." /></div>

    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setTipo("RECEBIMENTO")} className={`rounded-2xl border p-4 text-left transition ${tipo === "RECEBIMENTO" ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200" : "bg-white hover:bg-slate-50"}`}><div className="flex items-center gap-3"><ArrowDownCircle className="text-emerald-700"/><div><div className="font-bold">Recebimentos</div><div className="text-sm text-slate-500">Conferir créditos bancários contra contas a receber.</div></div></div></button>
      <button type="button" onClick={() => setTipo("DESPESA")} className={`rounded-2xl border p-4 text-left transition ${tipo === "DESPESA" ? "border-rose-300 bg-rose-50 ring-1 ring-rose-200" : "bg-white hover:bg-slate-50"}`}><div className="flex items-center gap-3"><ArrowUpCircle className="text-rose-700"/><div><div className="font-bold">Despesas</div><div className="text-sm text-slate-500">Conferir débitos bancários contra contas a pagar.</div></div></div></button>
    </div>

    <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[220px_1fr]"><label><span className="label">Empresa</span><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{op.empresas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label><label><span className="label">Pesquisar título</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tipo === "RECEBIMENTO" ? "Cliente, CNPJ, NF ou descrição" : "Fornecedor, CNPJ, documento ou descrição"}/></div></label></div>

    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {ok && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}

    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">{tipo === "RECEBIMENTO" ? "Cliente" : "Fornecedor"}</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Já conciliado</th><th className="px-4 py-3 text-right">A conciliar</th><th className="px-4 py-3">Status</th><th/></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="p-8 text-center text-slate-500">Carregando...</td></tr> : itens.length === 0 ? <tr><td colSpan="8" className="p-8 text-center text-slate-500">Nenhum título encontrado.</td></tr> : itens.map((x) => { const restante = restanteTitulo(x, tipo); const cancelado = String(x.status || "").toUpperCase() === "CANCELADO"; return <tr key={x.id} className="border-t"><td className="px-4 py-3">{x.empresa?.nome || "—"}</td><td className="px-4 py-3"><div className="font-medium">{nomeTitulo(x, tipo) || "—"}</div><div className="text-xs text-slate-500">{documentoTitulo(x) || x.descricao || ""}</div></td><td className="px-4 py-3">{dataBR(x.data_vencimento)}</td><td className="px-4 py-3 text-right">{moeda(valorTitulo(x, tipo))}</td><td className="px-4 py-3 text-right text-emerald-700">{moeda(conciliadoTitulo(x))}</td><td className="px-4 py-3 text-right font-semibold">{moeda(restante)}</td><td className="px-4 py-3">{String(x.status || "—").toUpperCase()}</td><td className="px-4 py-3 text-right"><button className="btn-outline py-1.5" disabled={cancelado || restante <= 0.005} onClick={() => abrir(x)}><Landmark size={14}/>{restante <= 0.005 ? "Conciliado" : "Conciliar"}</button></td></tr>; })}</tbody></table></div>

    <div className="flex items-center justify-between rounded-xl border bg-white p-3 text-sm"><span className="text-slate-500">{meta.total} títulos · página {pagina} de {meta.paginas}</span><div className="flex gap-2"><button className="btn-outline h-9" disabled={pagina <= 1} onClick={() => carregar(pagina - 1)}>Anterior</button><button className="btn-outline h-9" disabled={pagina >= meta.paginas} onClick={() => carregar(pagina + 1)}>Próxima</button></div></div>

    {titulo && <Modal titulo={`Conciliar ${tipo === "RECEBIMENTO" ? "recebimento" : "despesa"} — ${nomeTitulo(titulo, tipo) || "Título"}`} onClose={() => !salvando && setTitulo(null)}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Valor do título</div><div className="font-bold">{moeda(valorTitulo(titulo, tipo))}</div></div><div className="rounded-xl bg-emerald-50 p-3"><div className="text-xs text-emerald-700">Já conciliado</div><div className="font-bold text-emerald-800">{moeda(conciliadoTitulo(titulo))}</div></div><div className="rounded-xl bg-amber-50 p-3"><div className="text-xs text-amber-700">Restante</div><div className="font-bold text-amber-800">{moeda(restanteTitulo(titulo, tipo))}</div></div></div>
        <label className="block"><span className="label">Pesquisar no extrato</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input autoFocus className="input pl-9" value={buscaMov} onChange={(e) => setBuscaMov(e.target.value)} placeholder="Descrição, documento, conta, data ou valor"/></div></label>
        {carregandoMov ? <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Buscando movimentos bancários...</div> : candidatos.length === 0 ? <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Nenhum movimento pendente compatível foi encontrado. O título pode permanecer sem conciliação até o lançamento bancário aparecer.</div> : <div className="space-y-2">{candidatos.map(({ m, disp, score }) => { const marcado = selecionados.includes(m.id); return <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${marcado ? "border-teal-400 bg-teal-50" : "hover:bg-slate-50"}`}><input type="checkbox" className="mt-1" checked={marcado} onChange={() => alternar(m.id)}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{m.descricao || m.documento || "Movimento bancário"}</span><span className="font-bold">{moeda(disp)}</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{dataBR(m.data_movimento)}</span><span>{m.conta?.nome || "Conta não informada"}</span><span>{m.origem || "—"}</span>{m.documento && <span>Doc. {m.documento}</span>}{score >= 6 && <span className="font-semibold text-emerald-700">Sugestão forte</span>}</div></div></label>; })}</div>}
        <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-white pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-slate-600">Selecionados: <strong>{selecionados.length}</strong> · disponível: <strong>{moeda(valorSelecionado)}</strong> · falta no título: <strong>{moeda(restanteTitulo(titulo, tipo))}</strong></div><button className="btn-primary" disabled={!selecionados.length || salvando} onClick={confirmar}>{salvando ? "Conciliando..." : <><CheckCircle2 size={15}/>Confirmar conciliação</>}</button></div>
      </div>
    </Modal>}
  </div>;
}
