import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudDownload, Eye, Pencil, Plus, RefreshCw, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import {
  finCategoriaSalvar,
  finCentroSalvar,
  finConfigListar,
  finContaSalvar,
  finFormaSalvar,
  finOmieEstado,
  finOmiePreviaPagina,
  finOmieSincronizarPagina,
} from "../services/financeiro.js";

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioAno = () => `${new Date().getFullYear()}-01-01`;
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const contaVazia = (empresaId="") => ({ id:"", empresa_id:empresaId, nome:"", banco:"", agencia:"", conta:"", saldo_inicial:"0", ativa:true });

function Previa({ titulo, dados }) {
  if (!dados) return null;
  return <div className="rounded-xl border bg-slate-50 p-3 text-sm">
    <div className="flex items-center justify-between gap-3"><b>{titulo}</b><span className="text-xs text-slate-500">página {dados.pagina || 1}/{dados.paginas || 0}</span></div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div><span className="text-slate-500">Nesta página</span><div className="font-semibold">{dados.lidos || 0}</div></div>
      <div><span className="text-slate-500">Total Omie</span><div className="font-semibold">{dados.totalRegistros || 0}</div></div>
      <div><span className="text-slate-500">Valor página</span><div className="font-semibold">{moeda(dados.valorTotal)}</div></div>
      <div><span className="text-slate-500">Páginas</span><div className="font-semibold">{dados.paginas || 0}</div></div>
    </div>
    <div className="mt-2 flex flex-wrap gap-1">{Object.entries(dados.status || {}).map(([s,q]) => <span key={s} className="rounded-full bg-white px-2 py-1 text-[11px]">{s}: {q}</span>)}</div>
    {!!dados.amostra?.length && <div className="mt-3 overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="pr-3 py-1">Documento</th><th className="pr-3">Vencimento</th><th className="pr-3 text-right">Valor</th><th>Status</th></tr></thead><tbody>{dados.amostra.map((x,i)=><tr key={`${x.idOmie}-${i}`} className="border-t"><td className="pr-3 py-1">{x.documento || x.idOmie}</td><td className="pr-3">{x.vencimento || "—"}</td><td className="pr-3 text-right">{moeda(x.valor)}</td><td>{x.status || "—"}</td></tr>)}</tbody></table></div>}
  </div>;
}

export default function ConfigFinanceiro() {
  const navigate = useNavigate();
  const [dados, setDados] = useState({ empresas:[], categorias:[], contas:[], centros:[], formas:[] });
  const [omie, setOmie] = useState({ ligado:false });
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [periodo, setPeriodo] = useState({ de:inicioAno(), ate:hoje() });
  const [validadoPeriodo, setValidadoPeriodo] = useState("");
  const [previas, setPrevias] = useState({ receber:null, pagar:null });
  const [categoria, setCategoria] = useState({ empresa_id:"", nome:"", tipo:"AMBOS" });
  const [conta, setConta] = useState(contaVazia());
  const [centro, setCentro] = useState({ empresa_id:"", nome:"" });
  const [forma, setForma] = useState({ empresa_id:"", nome:"" });
  const chavePeriodo = `${periodo.de}|${periodo.ate}`;
  const periodoValidado = validadoPeriodo === chavePeriodo && !!previas.receber && !!previas.pagar;

  async function carregar() {
    setErro("");
    try {
      const [d,o] = await Promise.all([finConfigListar(), finOmieEstado()]);
      setDados(d); setOmie(o);
      const minas = d.empresas?.find(x => x.usa_omie);
      if (minas) {
        setCategoria(v => ({ ...v, empresa_id:v.empresa_id || minas.id }));
        setConta(v => ({ ...v, empresa_id:v.empresa_id || minas.id }));
        setCentro(v => ({ ...v, empresa_id:v.empresa_id || minas.id }));
      }
    } catch (e) { setErro(e.message); }
  }
  useEffect(() => { carregar(); }, []);

  function mudarPeriodo(campo, valor) {
    setPeriodo(v => ({ ...v, [campo]:valor }));
    setValidadoPeriodo(""); setPrevias({ receber:null, pagar:null }); setOk("");
  }
  async function salvar(fn, obj, limpar) {
    try { setErro(""); await fn(obj); setOk(obj.id ? "Cadastro atualizado." : "Cadastro salvo."); limpar(); await carregar(); }
    catch (e) { setErro(e.message); }
  }
  function editarConta(x) {
    setConta({ id:x.id, empresa_id:x.empresa_id, nome:x.nome || "", banco:x.banco || "", agencia:x.agencia || "", conta:x.conta || "", saldo_inicial:String(x.saldo_inicial ?? 0), ativa:x.ativa !== false });
    setOk("Conta carregada para consulta/edição.");
    window.scrollTo({ top:document.body.scrollHeight * 0.45, behavior:"smooth" });
  }
  function novaConta() {
    const empresaId = conta.empresa_id || dados.empresas?.[0]?.id || "";
    setConta(contaVazia(empresaId));
    setOk("");
  }
  async function prevalidar() {
    if (!omie.ligado) { setErro("A integração Omie não está configurada nos Secrets do Supabase."); return; }
    if (!periodo.de || !periodo.ate || periodo.de > periodo.ate) { setErro("Informe um período válido."); return; }
    setValidando(true); setErro(""); setOk(""); setPrevias({ receber:null, pagar:null }); setValidadoPeriodo("");
    try {
      setProgresso("Pré-validando contas a receber...");
      const receber = await finOmiePreviaPagina("RECEBER", periodo.de, periodo.ate, 1);
      setProgresso("Pré-validando contas a pagar...");
      const pagar = await finOmiePreviaPagina("PAGAR", periodo.de, periodo.ate, 1);
      setPrevias({ receber, pagar });
      setValidadoPeriodo(chavePeriodo);
      setOk("Pré-validação concluída. Nenhum dado foi gravado. Confira a amostra antes de sincronizar.");
    } catch (e) { setErro(e.message); }
    finally { setValidando(false); setProgresso(""); }
  }
  async function sincronizar() {
    if (!periodoValidado) { setErro("Faça a pré-validação deste período antes de sincronizar."); return; }
    const total = Number(previas.receber?.totalRegistros || 0) + Number(previas.pagar?.totalRegistros || 0);
    if (!confirm(`Confirmar sincronização Omie de ${periodo.de} a ${periodo.ate}?\n\nA prévia identificou aproximadamente ${total} títulos. Lançamentos MANUAIS serão preservados.`)) return;
    setSincronizando(true); setErro(""); setOk("");
    try {
      let totalLidos=0, totalInseridos=0, totalAtualizados=0;
      for (const tipo of ["RECEBER","PAGAR"]) {
        let p=1;
        for (;;) {
          setProgresso(`${tipo === "RECEBER" ? "Contas a receber" : "Contas a pagar"} · página ${p}`);
          const r = await finOmieSincronizarPagina(tipo, periodo.de, periodo.ate, p);
          totalLidos += Number(r.lidos || 0); totalInseridos += Number(r.inseridos || 0); totalAtualizados += Number(r.atualizados || 0);
          if (!r.proxima) break;
          p = r.proxima;
          if (p > 5000) throw new Error("A sincronização excedeu o limite de segurança de páginas.");
        }
      }
      setOk(`Sincronização concluída. Lidos: ${totalLidos}. Inseridos: ${totalInseridos}. Atualizados: ${totalAtualizados}. Lançamentos manuais foram preservados.`);
      setValidadoPeriodo("");
      await carregar();
    } catch (e) { setErro(e.message); }
    finally { setSincronizando(false); setProgresso(""); }
  }

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={() => navigate("/financas")}><ArrowLeft size={18}/></button><PageTitle titulo="Configurações Financeiras" descricao="Empresas, categorias, contas, centros de custo e integração Omie."/></div>
    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {ok && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}

    <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><h2 className="font-bold text-slate-900">Integração Omie — MinasLab</h2>{omie.ligado ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13}/>Configurada</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"><AlertTriangle size={13}/>Não configurada</span>}</div><p className="mt-1 text-sm text-slate-500">MinasLab = Omie + manual. M Lab = somente manual. A pré-validação consulta a Omie sem gravar nada; a sincronização usa o ID Omie e preserva lançamentos manuais.</p></div><button className="btn-outline" onClick={carregar}><RefreshCw size={15}/>Verificar</button></div>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><label><span className="label">De</span><input className="input" type="date" value={periodo.de} onChange={e => mudarPeriodo("de", e.target.value)}/></label><label><span className="label">Até</span><input className="input" type="date" value={periodo.ate} onChange={e => mudarPeriodo("ate", e.target.value)}/></label><div className="flex items-end"><button className="btn-outline w-full" disabled={validando || sincronizando || !omie.ligado} onClick={prevalidar}><Eye size={16}/>{validando ? (progresso || "Validando...") : "Pré-validar Omie"}</button></div><div className="flex items-end"><button className="btn-primary w-full" disabled={sincronizando || validando || !omie.ligado || !periodoValidado} onClick={sincronizar}><CloudDownload size={16}/>{sincronizando ? (progresso || "Sincronizando...") : "Sincronizar período"}</button></div></div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2"><Previa titulo="Contas a receber — prévia" dados={previas.receber}/><Previa titulo="Contas a pagar — prévia" dados={previas.pagar}/></div>
      {!periodoValidado && <p className="mt-3 text-xs text-slate-500">O botão de sincronização é liberado somente após a pré-validação do período atual.</p>}
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Categorias</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><select className="input" value={categoria.empresa_id} onChange={e => setCategoria({ ...categoria, empresa_id:e.target.value })}><option value="">Global</option>{dados.empresas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><input className="input" placeholder="Nome" value={categoria.nome} onChange={e => setCategoria({ ...categoria, nome:e.target.value })}/><select className="input" value={categoria.tipo} onChange={e => setCategoria({ ...categoria, tipo:e.target.value })}><option>AMBOS</option><option>RECEITA</option><option>DESPESA</option></select></div><button className="btn-primary mt-3" onClick={() => salvar(finCategoriaSalvar, categoria, () => setCategoria({ ...categoria, nome:"" }))}><Save size={15}/>Salvar categoria</button><div className="mt-4 flex flex-wrap gap-2">{dados.categorias.map(x => <span key={x.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.nome} · {x.tipo}</span>)}</div></section>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Contas bancárias</h2><p className="mt-1 text-xs text-slate-500">Cadastre, consulte e edite os dados bancários usados no Financeiro e na conciliação OFX.</p></div><button type="button" className="btn-outline" onClick={novaConta}><Plus size={15}/>Nova conta</button></div>
        {conta.id && <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">Editando <b>{conta.nome}</b>. Altere os dados abaixo e clique em “Atualizar conta”.</div>}
        <div className="mt-3 grid gap-3 md:grid-cols-2"><select className="input" value={conta.empresa_id} onChange={e => setConta({ ...conta, empresa_id:e.target.value })}>{dados.empresas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><input className="input" placeholder="Nome da conta" value={conta.nome} onChange={e => setConta({ ...conta, nome:e.target.value })}/><input className="input" placeholder="Banco" value={conta.banco} onChange={e => setConta({ ...conta, banco:e.target.value })}/><input className="input" placeholder="Agência" value={conta.agencia} onChange={e => setConta({ ...conta, agencia:e.target.value })}/><input className="input" placeholder="Conta" value={conta.conta} onChange={e => setConta({ ...conta, conta:e.target.value })}/><input className="input" type="number" step="0.01" placeholder="Saldo inicial" value={conta.saldo_inicial} onChange={e => setConta({ ...conta, saldo_inicial:e.target.value })}/></div>
        <button className="btn-primary mt-3" onClick={() => salvar(finContaSalvar, conta, () => setConta(contaVazia(conta.empresa_id)))}><Save size={15}/>{conta.id ? "Atualizar conta" : "Salvar conta"}</button>
        <div className="mt-5 space-y-3">{dados.contas.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhuma conta bancária cadastrada.</div> : dados.contas.map(x => {
          const empresaNome = dados.empresas.find(e => e.id === x.empresa_id)?.nome || "Empresa";
          return <div key={x.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-bold text-slate-900">{x.nome}</div><div className="mt-1 text-xs text-slate-500">{empresaNome} · {x.ativa === false ? "Inativa" : "Ativa"}</div></div><button type="button" className="btn-outline" onClick={() => editarConta(x)}><Pencil size={14}/>Consultar / editar</button></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><span className="text-slate-500">Banco</span><div className="mt-0.5 font-semibold text-slate-800">{x.banco || "—"}</div></div><div><span className="text-slate-500">Agência</span><div className="mt-0.5 font-semibold text-slate-800">{x.agencia || "—"}</div></div><div><span className="text-slate-500">Conta</span><div className="mt-0.5 font-semibold text-slate-800">{x.conta || "—"}</div></div><div><span className="text-slate-500">Saldo inicial</span><div className="mt-0.5 font-semibold text-slate-800">{moeda(x.saldo_inicial)}</div></div></div>
          </div>;
        })}</div>
      </section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Centros de custo</h2><div className="mt-3 flex gap-2"><select className="input" value={centro.empresa_id} onChange={e => setCentro({ ...centro, empresa_id:e.target.value })}>{dados.empresas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><input className="input" placeholder="Centro de custo" value={centro.nome} onChange={e => setCentro({ ...centro, nome:e.target.value })}/></div><button className="btn-primary mt-3" onClick={() => salvar(finCentroSalvar, centro, () => setCentro({ ...centro, nome:"" }))}><Save size={15}/>Salvar centro</button><div className="mt-4 flex flex-wrap gap-2">{dados.centros.map(x => <span key={x.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.nome}</span>)}</div></section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Formas de pagamento</h2><div className="mt-3 flex gap-2"><select className="input" value={forma.empresa_id} onChange={e => setForma({ ...forma, empresa_id:e.target.value })}><option value="">Global</option>{dados.empresas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><input className="input" placeholder="Forma" value={forma.nome} onChange={e => setForma({ ...forma, nome:e.target.value })}/></div><button className="btn-primary mt-3" onClick={() => salvar(finFormaSalvar, forma, () => setForma({ ...forma, nome:"" }))}><Save size={15}/>Salvar forma</button><div className="mt-4 flex flex-wrap gap-2">{dados.formas.map(x => <span key={x.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.nome}</span>)}</div></section>
    </div>
  </div>;
}
