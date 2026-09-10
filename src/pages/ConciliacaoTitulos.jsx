import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Landmark, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finMovimentosPagina, finRecebimentosListar, finDespesasListar } from "../services/financeiro.js";
import { finConciliarAjustado } from "../services/conciliacaoAjustes.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => { if (!v) return "—"; const p = String(v).slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(v); };
const normaliza = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const reais = (m) => (m?.conciliacoes || []).filter((c) => c?.id && !c?.somente_categoria_omie);
const conciliadoMov = (m) => reais(m).reduce((s, c) => s + Number(c?.valor_movimento ?? c?.valor_conciliado ?? 0), 0);
const restanteMov = (m) => Math.max(0, Math.abs(Number(m?.valor || 0)) - conciliadoMov(m));
const valorTitulo = (x, tipo) => Math.max(0, Number(tipo === "RECEBIMENTO" ? x?.valor_previsto : x?.valor_original) || 0);
const conciliadoTitulo = (x) => Math.max(0, Number(x?.valor_conciliado || 0));
const restanteTitulo = (x, tipo) => Math.max(0, valorTitulo(x, tipo) - conciliadoTitulo(x));
const nomeTitulo = (x, tipo) => tipo === "RECEBIMENTO" ? x?.cliente : x?.fornecedor;
const documentoTitulo = (x) => x?.numero_nf || x?.cnpj_cpf || x?.documento || "";
const dataTitulo = (x) => x?.data_pagamento || x?.data_vencimento || x?.data_lancamento || "";
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const vazioAjuste = { valorTitulo: "", desconto: "", juros: "", multa: "", ajuste: "" };

function Modal({ titulo, onClose, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold text-slate-900">{titulo}</h2><button className="btn-ghost h-9 w-9 p-0" onClick={onClose}><X size={18}/></button></div><div className="max-h-[calc(92vh-68px)] overflow-y-auto p-5">{children}</div></div></div>;
}

export default function ConciliacaoTitulos() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const abriuDireto = useRef(false);
  const tipoInicial = String(params.get("tipo") || "RECEBIMENTO").toUpperCase() === "DESPESA" ? "DESPESA" : "RECEBIMENTO";
  const empresaInicial = params.get("empresaId") || "";
  const tituloDiretoId = params.get("tituloId") || "";
  const [tipo, setTipo] = useState(tipoInicial);
  const [op, setOp] = useState({ empresas: [] });
  const [empresa, setEmpresa] = useState(empresaInicial);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("A_CONCILIAR");
  const [periodo, setPeriodo] = useState(mesAtual());
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
  const [ajustes, setAjustes] = useState(vazioAjuste);

  async function carregar(p = pagina) {
    setLoading(true); setErro("");
    try {
      const [opts, lista] = await Promise.all([financeiroOpcoes(), tipo === "RECEBIMENTO" ? finRecebimentosListar(empresa) : finDespesasListar(empresa)]);
      setOp(opts || { empresas: [] });
      const termo = normaliza(busca);
      const filtrados = (lista || []).filter((x) => {
        const cancelado = String(x.status || "").toUpperCase() === "CANCELADO";
        const restante = restanteTitulo(x, tipo);
        const conciliado = restante <= 0.005 || x.conciliado === true;
        if (situacao === "A_CONCILIAR" && (conciliado || cancelado)) return false;
        if (situacao === "CONCILIADO" && !conciliado) return false;
        if (periodo && !String(dataTitulo(x) || "").slice(0, 7).startsWith(periodo)) return false;
        if (!termo) return true;
        return normaliza(`${nomeTitulo(x, tipo)} ${documentoTitulo(x)} ${x.descricao || ""} ${x.cnpj_cpf || ""}`).includes(termo);
      });
      const limite = 25, paginas = Math.max(1, Math.ceil(filtrados.length / limite)), paginaValida = Math.min(Math.max(1, p), paginas), ini = (paginaValida - 1) * limite;
      setItens(filtrados.slice(ini, ini + limite)); setMeta({ total: filtrados.length, paginas, pagina: paginaValida }); setPagina(paginaValida);
    } catch (e) { setErro(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(() => carregar(1), 250); return () => clearTimeout(t); }, [tipo, empresa, busca, situacao, periodo]);

  async function abrir(x, tipoForcado = tipo) {
    if (!x?.empresa_id) { setErro("Este título não possui empresa vinculada."); return; }
    setTitulo(x); setSelecionados([]); setBuscaMov(""); setAjustes(vazioAjuste); setCarregandoMov(true); setErro(""); setOk("");
    try { const r = await finMovimentosPagina({ empresaId: x.empresa_id, status: "PENDENTE", tipoMovimento: tipoForcado === "RECEBIMENTO" ? "CREDITO" : "DEBITO", pagina: 1, limite: 100 }); setMovimentos(r.itens || []); }
    catch (e) { setErro(e.message); setTitulo(null); } finally { setCarregandoMov(false); }
  }

  useEffect(() => {
    if (!tituloDiretoId || abriuDireto.current) return;
    abriuDireto.current = true;
    (async () => { try { setLoading(true); const lista = tipoInicial === "RECEBIMENTO" ? await finRecebimentosListar(empresaInicial) : await finDespesasListar(empresaInicial); const alvo = (lista || []).find((x) => String(x.id) === String(tituloDiretoId)); if (!alvo) throw new Error("Não foi possível localizar o título selecionado para conciliação."); setTipo(tipoInicial); setEmpresa(alvo.empresa_id || empresaInicial); const dataAlvo = String(dataTitulo(alvo) || "").slice(0, 7); if (dataAlvo) setPeriodo(dataAlvo); await abrir(alvo, tipoInicial); } catch (e) { setErro(e.message); } finally { setLoading(false); } })();
  }, [tituloDiretoId, tipoInicial, empresaInicial]);

  const candidatos = useMemo(() => {
    if (!titulo) return [];
    const termo = normaliza(buscaMov), alvo = restanteTitulo(titulo, tipo), dtTitulo = dataTitulo(titulo) ? new Date(`${String(dataTitulo(titulo)).slice(0, 10)}T00:00:00`) : null, nome = normaliza(nomeTitulo(titulo, tipo)), doc = normaliza(documentoTitulo(titulo));
    return movimentos.filter((m) => restanteMov(m) > 0.005).filter((m) => !termo || normaliza(`${m.descricao || ""} ${m.documento || ""} ${m.conta?.nome || ""} ${dataBR(m.data_movimento)} ${Math.abs(Number(m.valor || 0)).toFixed(2)}`).includes(termo)).map((m) => {
      const disp = restanteMov(m), dtMov = new Date(`${String(m.data_movimento).slice(0, 10)}T00:00:00`), dias = dtTitulo ? Math.abs(dtMov - dtTitulo) / 86400000 : 9999, texto = normaliza(`${m.descricao || ""} ${m.documento || ""}`); let score = 0;
      if (Math.abs(disp - alvo) < 0.01) score += 6; if (dias <= 3) score += 3; else if (dias <= 7) score += 1; if (nome && texto.includes(nome)) score += 5; if (doc && doc.length >= 2 && texto.includes(doc)) score += 3;
      return { m, disp, dias, score };
    }).sort((a, b) => b.score - a.score || a.dias - b.dias || Math.abs(a.disp - alvo) - Math.abs(b.disp - alvo));
  }, [titulo, movimentos, buscaMov, tipo]);

  const valorSelecionado = selecionados.reduce((s, id) => s + (candidatos.find((c) => c.m.id === id)?.disp || 0), 0);
  const umSelecionado = selecionados.length === 1;
  const restanteAtual = titulo ? restanteTitulo(titulo, tipo) : 0;
  const valorTituloAjuste = ajustes.valorTitulo === "" ? Math.min(restanteAtual, valorSelecionado) : num(ajustes.valorTitulo);
  const valorEsperado = valorTituloAjuste - num(ajustes.desconto) + num(ajustes.juros) + num(ajustes.multa) + num(ajustes.ajuste);
  const diferenca = valorSelecionado - valorEsperado;
  const temAjuste = Math.abs(num(ajustes.desconto)) > 0.005 || Math.abs(num(ajustes.juros)) > 0.005 || Math.abs(num(ajustes.multa)) > 0.005 || Math.abs(num(ajustes.ajuste)) > 0.005 || ajustes.valorTitulo !== "";
  const podeConfirmar = selecionados.length > 0 && valorTituloAjuste > 0.005 && Math.abs(diferenca) <= 0.01 && (!temAjuste || umSelecionado);

  function alternar(id) {
    setSelecionados((a) => { const novo = a.includes(id) ? a.filter((x) => x !== id) : [...a, id]; setAjustes(vazioAjuste); return novo; });
  }
  function setCampo(k, v) { setAjustes((a) => ({ ...a, [k]: v })); }

  async function confirmar() {
    if (!titulo || !podeConfirmar) return;
    setSalvando(true); setErro(""); setOk("");
    try {
      if (umSelecionado) {
        const c = candidatos.find((x) => x.m.id === selecionados[0]);
        if (!c) throw new Error("Movimento selecionado não encontrado.");
        await finConciliarAjustado({ movimentoId: c.m.id, recebimentoId: tipo === "RECEBIMENTO" ? titulo.id : null, despesaId: tipo === "DESPESA" ? titulo.id : null, valorTitulo: valorTituloAjuste, valorMovimento: valorSelecionado, desconto: num(ajustes.desconto), juros: num(ajustes.juros), multa: num(ajustes.multa), ajuste: num(ajustes.ajuste), dataLiquidacao: String(c.m.data_movimento || "").slice(0, 10) });
      } else {
        let faltaTitulo = valorTituloAjuste;
        for (const id of selecionados) {
          if (faltaTitulo <= 0.005) break;
          const c = candidatos.find((x) => x.m.id === id); if (!c) continue;
          const v = Math.min(faltaTitulo, c.disp); if (v <= 0.005) continue;
          await finConciliarAjustado({ movimentoId: c.m.id, recebimentoId: tipo === "RECEBIMENTO" ? titulo.id : null, despesaId: tipo === "DESPESA" ? titulo.id : null, valorTitulo: v, valorMovimento: v, desconto: 0, juros: 0, multa: 0, ajuste: 0, dataLiquidacao: String(c.m.data_movimento || "").slice(0, 10) });
          faltaTitulo -= v;
        }
      }
      const restanteDepois = Math.max(0, restanteAtual - valorTituloAjuste);
      setOk(`Conciliação registrada.${temAjuste ? " Ajustes financeiros gravados separadamente do valor original do título." : ""}${restanteDepois > 0.005 ? ` Restante do título: ${moeda(restanteDepois)}.` : " Título totalmente conciliado."}`);
      setTitulo(null); setSelecionados([]); setMovimentos([]); setAjustes(vazioAjuste); await carregar(pagina);
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={() => navigate(tipo === "RECEBIMENTO" ? "/financas/recebimentos" : "/financas/despesas")}><ArrowLeft size={18}/></button><PageTitle titulo="Conciliação por Títulos" descricao="Selecione o título e vincule o movimento bancário. Diferenças podem ser justificadas por desconto, juros, multa ou outros ajustes." /></div>

    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setTipo("RECEBIMENTO")} className={`rounded-2xl border p-4 text-left transition ${tipo === "RECEBIMENTO" ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200" : "bg-white hover:bg-slate-50"}`}><div className="flex items-center gap-3"><ArrowDownCircle className="text-emerald-700"/><div><div className="font-bold">Recebimentos</div><div className="text-sm text-slate-500">Conferir créditos bancários contra contas a receber.</div></div></div></button>
      <button type="button" onClick={() => setTipo("DESPESA")} className={`rounded-2xl border p-4 text-left transition ${tipo === "DESPESA" ? "border-rose-300 bg-rose-50 ring-1 ring-rose-200" : "bg-white hover:bg-slate-50"}`}><div className="flex items-center gap-3"><ArrowUpCircle className="text-rose-700"/><div><div className="font-bold">Despesas</div><div className="text-sm text-slate-500">Conferir débitos bancários contra contas a pagar.</div></div></div></button>
    </div>

    <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[200px_190px_180px_1fr]">
      <label><span className="label">Empresa</span><select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}><option value="">Todas</option>{op.empresas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label><span className="label">Situação da conciliação</span><select className="input" value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todos</option><option value="A_CONCILIAR">A conciliar</option><option value="CONCILIADO">Conciliados</option></select></label>
      <label><span className="label">Mês</span><div className="flex gap-2"><input className="input" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)}/>{periodo && <button type="button" className="btn-ghost h-10 px-2 text-xs" onClick={() => setPeriodo("")}>Todos</button>}</div></label>
      <label><span className="label">Pesquisar título</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tipo === "RECEBIMENTO" ? "Cliente, CNPJ, NF ou descrição" : "Fornecedor, CNPJ, documento ou descrição"}/></div></label>
    </div>

    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {ok && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}

    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">{tipo === "RECEBIMENTO" ? "Cliente" : "Fornecedor"}</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Já conciliado</th><th className="px-4 py-3 text-right">A conciliar</th><th className="px-4 py-3">Status</th><th/></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="p-8 text-center text-slate-500">Carregando...</td></tr> : itens.length === 0 ? <tr><td colSpan="8" className="p-8 text-center text-slate-500">Nenhum título encontrado.</td></tr> : itens.map((x) => { const restante = restanteTitulo(x, tipo), cancelado = String(x.status || "").toUpperCase() === "CANCELADO"; return <tr key={x.id} className="border-t"><td className="px-4 py-3">{x.empresa?.nome || "—"}</td><td className="px-4 py-3"><div className="font-medium">{nomeTitulo(x, tipo) || "—"}</div><div className="text-xs text-slate-500">{documentoTitulo(x) || x.descricao || ""}</div></td><td className="px-4 py-3">{dataBR(x.data_vencimento)}</td><td className="px-4 py-3 text-right">{moeda(valorTitulo(x, tipo))}</td><td className="px-4 py-3 text-right text-emerald-700">{moeda(conciliadoTitulo(x))}</td><td className="px-4 py-3 text-right font-semibold">{moeda(restante)}</td><td className="px-4 py-3">{String(x.status || "—").toUpperCase()}</td><td className="px-4 py-3 text-right"><button className="btn-outline py-1.5" disabled={cancelado || restante <= 0.005} onClick={() => abrir(x)}><Landmark size={14}/>{restante <= 0.005 ? "Conciliado" : "Conciliar com extrato"}</button></td></tr>; })}</tbody></table></div>

    <div className="flex items-center justify-between rounded-xl border bg-white p-3 text-sm"><span className="text-slate-500">{meta.total} títulos · página {pagina} de {meta.paginas}</span><div className="flex gap-2"><button className="btn-outline h-9" disabled={pagina <= 1} onClick={() => carregar(pagina - 1)}>Anterior</button><button className="btn-outline h-9" disabled={pagina >= meta.paginas} onClick={() => carregar(pagina + 1)}>Próxima</button></div></div>

    {titulo && <Modal titulo={`Conciliar ${tipo === "RECEBIMENTO" ? "recebimento" : "despesa"} — ${nomeTitulo(titulo, tipo) || "Título"}`} onClose={() => !salvando && setTitulo(null)}><div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Valor do título</div><div className="font-bold">{moeda(valorTitulo(titulo, tipo))}</div></div><div className="rounded-xl bg-emerald-50 p-3"><div className="text-xs text-emerald-700">Já conciliado</div><div className="font-bold text-emerald-800">{moeda(conciliadoTitulo(titulo))}</div></div><div className="rounded-xl bg-amber-50 p-3"><div className="text-xs text-amber-700">Restante</div><div className="font-bold text-amber-800">{moeda(restanteAtual)}</div></div></div>
      <label className="block"><span className="label">Pesquisar no extrato</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input autoFocus className="input pl-9" value={buscaMov} onChange={(e) => setBuscaMov(e.target.value)} placeholder="Descrição, documento, conta, data ou valor"/></div></label>
      {carregandoMov ? <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Buscando movimentos bancários...</div> : candidatos.length === 0 ? <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Nenhum movimento pendente compatível foi encontrado.</div> : <div className="space-y-2">{candidatos.map(({ m, disp, score }) => { const marcado = selecionados.includes(m.id); return <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${marcado ? "border-teal-400 bg-teal-50" : "hover:bg-slate-50"}`}><input type="checkbox" className="mt-1" checked={marcado} onChange={() => alternar(m.id)}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{m.descricao || m.documento || "Movimento bancário"}</span><span className="font-bold">{moeda(disp)}</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{dataBR(m.data_movimento)}</span><span>{m.conta?.nome || "Conta não informada"}</span><span>{m.origem || "—"}</span>{m.documento && <span>Doc. {m.documento}</span>}{score >= 6 && <span className="font-semibold text-emerald-700">Sugestão forte</span>}</div></div></label>; })}</div>}

      {selecionados.length > 0 && <div className="rounded-2xl border bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="font-bold text-slate-900">Ajustar diferença da conciliação</div><div className="text-xs text-slate-500">O valor original do título permanece intacto. Desconto, juros e multa ficam registrados separadamente.</div></div>{!umSelecionado && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Ajustes disponíveis com 1 movimento</span>}</div>
        <div className="grid gap-3 md:grid-cols-5">
          <label><span className="label">Valor do título nesta conciliação</span><input className="input" type="number" min="0" step="0.01" value={ajustes.valorTitulo} onChange={(e) => setCampo("valorTitulo", e.target.value)} placeholder={String(Math.min(restanteAtual, valorSelecionado).toFixed(2))}/></label>
          <label><span className="label">Desconto</span><input className="input" type="number" min="0" step="0.01" disabled={!umSelecionado} value={ajustes.desconto} onChange={(e) => setCampo("desconto", e.target.value)}/></label>
          <label><span className="label">Juros</span><input className="input" type="number" min="0" step="0.01" disabled={!umSelecionado} value={ajustes.juros} onChange={(e) => setCampo("juros", e.target.value)}/></label>
          <label><span className="label">Multa</span><input className="input" type="number" min="0" step="0.01" disabled={!umSelecionado} value={ajustes.multa} onChange={(e) => setCampo("multa", e.target.value)}/></label>
          <label><span className="label">Outros ajustes (+/-)</span><input className="input" type="number" step="0.01" disabled={!umSelecionado} value={ajustes.ajuste} onChange={(e) => setCampo("ajuste", e.target.value)}/></label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-500">Valor esperado no banco</div><div className="font-bold">{moeda(valorEsperado)}</div></div><div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-500">Valor selecionado no banco</div><div className="font-bold">{moeda(valorSelecionado)}</div></div><div className={`rounded-xl p-3 ${Math.abs(diferenca) <= 0.01 ? "bg-emerald-50" : "bg-amber-100"}`}><div className="text-xs text-slate-600">Diferença</div><div className={`font-bold ${Math.abs(diferenca) <= 0.01 ? "text-emerald-800" : "text-amber-900"}`}>{moeda(diferenca)}</div></div></div>
        {Math.abs(diferenca) > 0.01 && umSelecionado && <div className="mt-3 text-sm text-amber-800">Há uma diferença de <strong>{moeda(Math.abs(diferenca))}</strong>. Informe desconto, juros, multa, outro ajuste ou altere o valor do título desta conciliação até a diferença ficar zerada.</div>}
      </div>}

      <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-white pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-slate-600">Selecionados: <strong>{selecionados.length}</strong> · banco: <strong>{moeda(valorSelecionado)}</strong> · título nesta conciliação: <strong>{moeda(valorTituloAjuste)}</strong></div><button className="btn-primary" disabled={!podeConfirmar || salvando} onClick={confirmar}>{salvando ? "Conciliando..." : <><CheckCircle2 size={15}/>Confirmar conciliação</>}</button></div>
    </div></Modal>}
  </div>;
}
