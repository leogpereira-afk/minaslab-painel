import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Link2,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Search,
  Undo2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finMovimentosPagina, finMovimentosImportar } from "../services/financeiro.js";
import { API } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";
import { nomeMovimento } from "../lib/movimentoNome.js";

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
  return { banco: tag(t, "BANKID"), agencia: tag(t, "BRANCHID"), conta: tag(t, "ACCTID") };
}
function parseOFX(t) {
  return String(t || "")
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((b) => {
      const valor = Number(tag(b, "TRNAMT").replace(",", ".")) || 0;
      const memo = tag(b, "MEMO");
      const name = tag(b, "NAME");
      return {
        data_movimento: dataOfx(tag(b, "DTPOSTED")),
        descricao: [name, memo].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" · ") || memo || name,
        tipo: valor >= 0 ? "CREDITO" : "DEBITO",
        valor,
        fitid: tag(b, "FITID"),
        documento: tag(b, "CHECKNUM"),
        origem: "OFX",
      };
    })
    .filter((x) => x.data_movimento && x.valor !== 0);
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
function classificacaoAmigavel(v) {
  const x = String(v || "").toUpperCase();
  if (x === "ESTORNO") return "Estorno";
  if (x === "TRANSFERENCIA") return "Transferência";
  if (x === "MOVIMENTO_INTERNO") return "Movimento bancário";
  return "";
}
function situacaoAmigavel(m) {
  if (!m.conciliado) return "Não conciliado";
  return classificacaoAmigavel(m.classificacao_bancaria) || "Conciliado";
}
function situacaoClasses(m) {
  const s = situacaoAmigavel(m);
  if (s === "Conciliado") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s === "Não conciliado") return "bg-amber-50 text-amber-700 border-amber-100";
  if (s === "Transferência") return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "Estorno") return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-slate-50 text-slate-700 border-slate-200";
}
async function chamarInterno(corpo) {
  const r = await comCracha(`${API}/ml-financeiro-movimentos-internos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b?.erro || "Não foi possível resolver o movimento.");
  return b;
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
  const agora = new Date();
  const [ano, setAno] = useState(String(agora.getFullYear()));
  const [mes, setMes] = useState(String(agora.getMonth() + 1));
  const [pagina, setPagina] = useState(1);
  const [meta, setMeta] = useState({ total: 0, paginas: 1 });
  const [resumo, setResumo] = useState({ entradas: 0, saidas: 0, pendentes: 0 });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [importando, setImportando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [menu, setMenu] = useState(null);
  const [resolver, setResolver] = useState(null);
  const [classe, setClasse] = useState("");
  const [relacionadoId, setRelacionadoId] = useState("");
  const [contrapartidas, setContrapartidas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const limite = 8;

  async function carregar(p = 1) {
    setLoading(true);
    setErro("");
    try {
      const [o, m] = await Promise.all([
        financeiroOpcoes(),
        finMovimentosPagina({
          empresaId: empresa,
          contaId: conta,
          busca,
          status,
          tipoMovimento,
          ano: ano ? Number(ano) : null,
          mes: mes ? Number(mes) : null,
          pagina: p,
          limite,
        }),
      ]);
      setOp(o || { empresas: [], contas: [] });
      setItens(m?.itens || []);
      setMeta({ total: m?.total || 0, paginas: m?.paginas || 1 });
      setResumo(m?.resumo || { entradas: 0, saidas: 0, pendentes: 0 });
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

  useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    window.addEventListener("resize", fechar);
    window.addEventListener("scroll", fechar, true);
    return () => {
      window.removeEventListener("resize", fechar);
      window.removeEventListener("scroll", fechar, true);
    };
  }, [menu]);

  const empresaSelecionada = useMemo(() => op.empresas.find((x) => x.id === empresa), [op.empresas, empresa]);
  const contasEmpresa = useMemo(() => op.contas.filter((c) => !empresa || c.empresa_id === empresa), [op.contas, empresa]);
  const contaSelecionada = useMemo(() => op.contas.find((c) => c.id === conta), [op.contas, conta]);
  const saldo = Number(resumo.entradas || 0) - Number(resumo.saidas || 0);
  const saldoConta = contaSelecionada?.saldo_atual;
  const ehMLab = /m\s*lab/i.test(empresaSelecionada?.nome || "") && !/minas/i.test(empresaSelecionada?.nome || "");

  const periodoTexto = useMemo(() => {
    if (!mes || !ano) return "Todos os períodos";
    const inicio = new Date(Number(ano), Number(mes) - 1, 1);
    const fim = new Date(Number(ano), Number(mes), 0);
    const fmt = (d) => d.toLocaleDateString("pt-BR");
    return `${fmt(inicio)}  →  ${fmt(fim)}`;
  }, [mes, ano]);

  const saldosLinha = useMemo(() => {
    const mapa = new Map();
    const hoje = new Date();
    const periodoAtual = Number(ano) === hoje.getFullYear() && Number(mes) === hoje.getMonth() + 1;
    const seguro = Boolean(conta && saldoConta != null && pagina === 1 && !busca && !status && !tipoMovimento && periodoAtual);
    if (!seguro) return mapa;
    let corrente = Number(saldoConta);
    itens.forEach((m) => {
      mapa.set(m.id, corrente);
      const efeito = m.tipo === "CREDITO" ? Math.abs(Number(m.valor || 0)) : -Math.abs(Number(m.valor || 0));
      corrente -= efeito;
    });
    return mapa;
  }, [itens, conta, saldoConta, pagina, busca, status, tipoMovimento, ano, mes]);

  async function importarOFX(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!empresa) {
      setErro("Selecione a empresa antes de atualizar o extrato.");
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
      if (!dados.length) throw new Error("Nenhuma movimentação válida foi encontrada no arquivo.");
      const detectada = conta ? op.contas.find((c) => c.id === conta) : detectarContaOFX(metaConta, op.contas, empresa);
      if (!detectada) throw new Error("Não foi possível identificar a conta. Selecione a conta bancária e tente novamente.");
      setConta(detectada.id);
      const r = await finMovimentosImportar(empresa, detectada.id, dados);
      setAviso(`Extrato atualizado: ${r?.inseridos || 0} novos e ${r?.ignorados || 0} já existentes.`);
      await carregar(1);
    } catch (e2) {
      setErro(e2.message || "Falha ao atualizar o extrato.");
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  function abrirMenu(e, m) {
    e.stopPropagation();
    if (menu?.item?.id === m.id) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const largura = 300;
    const left = Math.max(12, Math.min(window.innerWidth - largura - 12, r.right - largura));
    const top = Math.min(window.innerHeight - 330, r.bottom + 8);
    setMenu({ item: m, top: Math.max(12, top), left });
  }

  function abrirConciliacao(alvo) {
    setMenu(null);
    setDetalhe(null);
    const tipoTitulo = alvo.tipo === "CREDITO" ? "RECEBIMENTO" : "DESPESA";
    navigate(`/financas/conciliacao?tipo=${tipoTitulo}&empresaId=${encodeURIComponent(alvo.empresa_id || "")}&movimentoId=${encodeURIComponent(alvo.id || "")}`);
  }

  async function escolherResolucao(tipo, alvoBase = null) {
    const alvo = alvoBase || detalhe || menu?.item;
    if (!alvo) return;
    if (tipo === "TITULO") {
      abrirConciliacao(alvo);
      return;
    }
    setClasse(tipo);
    setRelacionadoId("");
    setResolver(alvo);
    setDetalhe(null);
    setMenu(null);
    setErro("");
    try {
      if (tipo !== "MOVIMENTO_INTERNO") {
        const r = await finMovimentosPagina({
          empresaId: alvo.empresa_id,
          status: "PENDENTE",
          tipoMovimento: alvo.tipo === "CREDITO" ? "DEBITO" : "CREDITO",
          pagina: 1,
          limite: 100,
        });
        setContrapartidas((r.itens || []).filter((x) => x.id !== alvo.id && Math.abs(Number(x.valor || 0) - Number(alvo.valor || 0)) < 0.01));
      } else {
        setContrapartidas([]);
      }
    } catch (e) {
      setErro(e.message);
      setResolver(null);
    }
  }

  async function salvarResolucao() {
    if (!resolver) return;
    if (classe !== "MOVIMENTO_INTERNO" && !relacionadoId) {
      setErro("Selecione o movimento correspondente.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await chamarInterno({
        action: "classificar",
        movimentoId: resolver.id,
        classificacao: classe,
        relacionadoId: classe === "MOVIMENTO_INTERNO" ? null : relacionadoId,
      });
      setAviso("Movimento resolvido.");
      setResolver(null);
      setDetalhe(null);
      await carregar(pagina);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function desfazerClassificacao(m) {
    setErro("");
    try {
      await chamarInterno({ action: "desfazer", movimentoId: m.id });
      setAviso("Resolução desfeita.");
      setDetalhe(null);
      await carregar(pagina);
    } catch (e) {
      setErro(e.message);
    }
  }

  async function exportar() {
    setErro("");
    try {
      let p = 1;
      let todos = [];
      let paginas = 1;
      do {
        const r = await finMovimentosPagina({
          empresaId: empresa,
          contaId: conta,
          busca,
          status,
          tipoMovimento,
          ano: ano ? Number(ano) : null,
          mes: mes ? Number(mes) : null,
          pagina: p,
          limite: 100,
        });
        todos = todos.concat(r?.itens || []);
        paginas = Number(r?.paginas || 1);
        p += 1;
      } while (p <= paginas && p <= 50);
      const linhas = [
        ["Data", "Descrição", "Documento", "Tipo", "Valor", "Situação", "Conta"],
        ...todos.map((m) => [
          dataBR(m.data_movimento),
          m.descricao || nomeMovimento(m),
          m.documento || "",
          m.tipo === "CREDITO" ? "Entrada" : "Saída",
          Number(m.valor || 0).toFixed(2).replace(".", ","),
          situacaoAmigavel(m),
          m.conta?.nome || "",
        ]),
      ];
      const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimentacao-${ano || "todos"}-${mes ? String(mes).padStart(2, "0") : "todos"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e.message || "Não foi possível exportar as movimentações.");
    }
  }

  const paginasVisiveis = useMemo(() => {
    const total = Math.max(1, Number(meta.paginas || 1));
    const atual = Number(pagina || 1);
    const ini = Math.max(1, Math.min(atual - 2, total - 4));
    const fim = Math.min(total, ini + 4);
    const arr = [];
    for (let i = ini; i <= fim; i += 1) arr.push(i);
    return arr;
  }, [meta.paginas, pagina]);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageTitle titulo="Movimentação da Conta" descricao="Extrato bancário com movimentações e situação de conciliação" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[245px] items-center gap-3 rounded-xl border bg-white px-4 py-2.5 shadow-sm">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700"><CalendarDays size={19} /></span>
            <div>
              <p className="text-xs font-medium text-slate-500">Período</p>
              <p className="text-sm font-semibold text-slate-800">{periodoTexto}</p>
            </div>
          </div>
          <button className="btn-primary h-11 px-5" onClick={() => carregar(pagina)}><RefreshCw size={16} />Atualizar</button>
          <button className="btn-outline h-11" onClick={() => empresa ? ofxRef.current?.click() : setErro("Selecione a empresa antes de atualizar o extrato.")} disabled={importando}>
            <Upload size={16} />{importando ? "Importando..." : ehMLab ? "Atualizar C6" : "Importar extrato"}
          </button>
          <input ref={ofxRef} type="file" accept=".ofx,application/x-ofx" className="hidden" onChange={importarOFX} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><ArrowUp size={24} /></span>
            <div><p className="text-sm font-medium text-slate-600">Entradas do período</p><p className="mt-1 text-2xl font-bold text-emerald-700">{moeda(resumo.entradas)}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-700"><ArrowDown size={24} /></span>
            <div><p className="text-sm font-medium text-slate-600">Saídas do período</p><p className="mt-1 text-2xl font-bold text-rose-700">{moeda(resumo.saidas)}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-700"><BarChart3 size={24} /></span>
            <div><p className="text-sm font-medium text-slate-600">Resultado do período</p><p className={`mt-1 text-2xl font-bold ${saldo >= 0 ? "text-blue-700" : "text-rose-700"}`}>{moeda(saldo)}</p><p className="mt-0.5 text-xs text-slate-500">Entradas - Saídas</p></div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-700"><Wallet size={24} /></span>
            <div className="min-w-0"><p className="text-sm font-medium text-slate-600">Saldo atual da conta</p><p className="mt-1 truncate text-2xl font-bold text-slate-900">{saldoConta == null ? "—" : moeda(saldoConta)}</p><p className="mt-0.5 truncate text-xs text-slate-500">{contaSelecionada?.nome || "Selecione uma conta"}</p></div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[210px_190px_190px_1fr_auto]">
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Conta bancária</span><select className="input" value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todas as contas</option>{contasEmpresa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Tipo de movimento</span><select className="input" value={tipoMovimento} onChange={(e) => setTipoMovimento(e.target.value)}><option value="">Todos</option><option value="CREDITO">Entradas</option><option value="DEBITO">Saídas</option></select></label>
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Situação</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option><option value="PENDENTE">Não conciliados</option><option value="CONCILIADO">Resolvidos</option></select></label>
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Pesquisar</span><div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className="input pl-10" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição, valor, documento..." /></div></label>
          <button className="btn-outline mt-auto h-10 px-4" onClick={exportar}><Download size={16} />Exportar</button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
          <label className="min-w-[180px]"><span className="mb-1 block text-xs font-medium text-slate-600">Empresa</span><select className="input" value={empresa} onChange={(e) => { setEmpresa(e.target.value); setConta(""); }}><option value="">Todas</option>{op.empresas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Mês</span><select className="input min-w-[150px]" value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos</option>{MESES.map((x, i) => <option key={x} value={i + 1}>{x}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Ano</span><select className="input min-w-[110px]" value={ano} onChange={(e) => setAno(e.target.value)}><option value="">Todos</option>{[2024, 2025, 2026, 2027].map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
      </div>

      {erro && <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} />{erro}</div>}
      {aviso && <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{aviso}</div>}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Data</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5">Documento</th>
                <th className="px-4 py-3.5">Tipo</th>
                <th className="px-4 py-3.5 text-right">Valor</th>
                <th className="px-4 py-3.5 text-right">Saldo</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="p-10 text-center text-slate-500">Carregando movimentações...</td></tr>
              ) : itens.length === 0 ? (
                <tr><td colSpan="8" className="p-10 text-center text-slate-500">Nenhuma movimentação encontrada.</td></tr>
              ) : itens.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">{dataBR(m.data_movimento)}</td>
                  <td className="px-4 py-3.5">
                    <button className="max-w-[360px] text-left" onClick={() => setDetalhe(m)}>
                      <span className="block truncate font-semibold text-slate-800">{nomeMovimento(m)}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{m.descricao || ""}</span>
                    </button>
                  </td>
                  <td className="max-w-[130px] truncate px-4 py-3.5 text-slate-600">{m.documento || "—"}</td>
                  <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${m.tipo === "CREDITO" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{m.tipo === "CREDITO" ? "Entrada" : "Saída"}</span></td>
                  <td className={`whitespace-nowrap px-4 py-3.5 text-right font-bold ${m.tipo === "CREDITO" ? "text-emerald-700" : "text-rose-700"}`}>{m.tipo === "CREDITO" ? "" : "- "}{moeda(Math.abs(Number(m.valor || 0)))}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-slate-700">{saldosLinha.has(m.id) ? moeda(saldosLinha.get(m.id)) : "—"}</td>
                  <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${situacaoClasses(m)}`}>{m.conciliado && !m.classificacao_bancaria && <CheckCircle2 size={13} />}{!m.conciliado && <AlertCircle size={13} />}{situacaoAmigavel(m)}</span></td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!m.conciliado && <button className="btn-primary h-8 px-3 py-1 text-xs" onClick={() => abrirConciliacao(m)}>Resolver</button>}
                      <button className="btn-ghost h-8 w-8 p-0" onClick={(e) => abrirMenu(e, m)} aria-label="Mais ações"><MoreVertical size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-slate-500">Mostrando {itens.length ? (pagina - 1) * limite + 1 : 0} a {Math.min(pagina * limite, meta.total)} de {meta.total} movimentos</span>
        <div className="flex flex-wrap items-center gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-lg border bg-white disabled:opacity-40" disabled={pagina <= 1} onClick={() => carregar(pagina - 1)}><ChevronLeft size={16} /></button>
          {paginasVisiveis.map((p) => <button key={p} className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-semibold ${p === pagina ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => carregar(p)}>{p}</button>)}
          <button className="grid h-9 w-9 place-items-center rounded-lg border bg-white disabled:opacity-40" disabled={pagina >= meta.paginas} onClick={() => carregar(pagina + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      {menu && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(null)} aria-label="Fechar menu" />
          <div className="fixed z-50 w-[300px] rounded-2xl border bg-white p-2 text-left shadow-2xl" style={{ top: menu.top, left: menu.left }}>
            <p className="px-3 pb-1 pt-2 text-sm font-bold text-slate-800">O que é este movimento?</p>
            <p className="px-3 pb-2 text-xs text-slate-500">Escolha o que aconteceu com este lançamento.</p>
            {!menu.item.conciliado ? (
              <>
                <button className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50" onClick={() => abrirConciliacao(menu.item)}><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Link2 size={16} /></span><span><b className="block text-sm text-slate-800">Conciliar</b><small className="text-slate-500">Vincular a conta a receber ou pagar</small></span></button>
                <button className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50" onClick={() => escolherResolucao("TRANSFERENCIA", menu.item)}><span className="grid h-8 w-8 place-items-center rounded-full bg-teal-50 text-teal-700"><ArrowLeftRight size={16} /></span><span><b className="block text-sm text-slate-800">Transferência entre contas</b><small className="text-slate-500">Movimento entre contas próprias</small></span></button>
                <button className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50" onClick={() => escolherResolucao("ESTORNO", menu.item)}><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-blue-700"><Undo2 size={16} /></span><span><b className="block text-sm text-slate-800">Estorno</b><small className="text-slate-500">Valor saiu e voltou</small></span></button>
                <button className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50" onClick={() => escolherResolucao("MOVIMENTO_INTERNO", menu.item)}><span className="grid h-8 w-8 place-items-center rounded-full bg-sky-50 text-sky-700"><CircleDollarSign size={16} /></span><span><b className="block text-sm text-slate-800">Outro movimento</b><small className="text-slate-500">Tarifa, rendimento, ajuste etc.</small></span></button>
              </>
            ) : (
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50" onClick={() => { setMenu(null); setDetalhe(menu.item); }}><ChevronRight size={16} />Ver detalhes / desfazer</button>
            )}
          </div>
        </>
      )}

      {detalhe && (
        <div className="fixed inset-0 z-50 bg-slate-950/30" onClick={() => setDetalhe(null)}>
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b p-5"><div><p className="text-xs font-semibold uppercase text-slate-500">Movimentação</p><h2 className="mt-1 text-xl font-bold text-slate-950">{nomeMovimento(detalhe)}</h2></div><button className="btn-ghost h-9 w-9 p-0" onClick={() => setDetalhe(null)}><X size={18} /></button></div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><span className="text-slate-500">Data</span><p className="font-semibold">{dataBR(detalhe.data_movimento)}</p></div><div><span className="text-slate-500">Valor</span><p className={`font-bold ${detalhe.tipo === "CREDITO" ? "text-emerald-700" : "text-rose-700"}`}>{moeda(Math.abs(detalhe.valor))}</p></div><div><span className="text-slate-500">Conta</span><p className="font-semibold">{detalhe.conta?.nome || "—"}</p></div><div><span className="text-slate-500">Tipo</span><p className="font-semibold">{detalhe.tipo === "CREDITO" ? "Entrada" : "Saída"}</p></div></div>
              <div><p className="label">Descrição completa do banco</p><p className="mt-1 rounded-xl border bg-white p-3 text-sm text-slate-700">{detalhe.descricao || "—"}</p></div>
              <div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-slate-500">Documento / ID</span><p className="break-all font-medium">{detalhe.documento || detalhe.fitid || "—"}</p></div><div><span className="text-slate-500">Origem</span><p className="font-medium">{origemAmigavel(detalhe.origem)}</p></div></div>
              {detalhe.conciliado ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold text-emerald-800">✓ {situacaoAmigavel(detalhe)}</p><p className="mt-1 text-sm text-emerald-700">{classificacaoAmigavel(detalhe.classificacao_bancaria) || "Conciliado com uma conta financeira."}</p>{detalhe.classificacao_bancaria ? <button className="btn-outline mt-3" onClick={() => desfazerClassificacao(detalhe)}><RotateCcw size={14} />Desfazer resolução</button> : <button className="btn-outline mt-3" onClick={() => navigate("/financas/conciliacao")}><RotateCcw size={14} />Ver / desfazer conciliação</button>}</div>
              ) : (
                <div><h3 className="font-bold text-slate-900">O que é este movimento?</h3><p className="mb-3 mt-1 text-sm text-slate-500">Escolha o que aconteceu.</p><div className="grid gap-2"><button className="btn-primary justify-start" onClick={() => abrirConciliacao(detalhe)}>Conciliar</button><button className="btn-outline justify-start" onClick={() => escolherResolucao("TRANSFERENCIA")}>Transferência entre contas</button><button className="btn-outline justify-start" onClick={() => escolherResolucao("ESTORNO")}>Estorno</button><button className="btn-outline justify-start" onClick={() => escolherResolucao("MOVIMENTO_INTERNO")}>Outro movimento bancário</button></div></div>
              )}
            </div>
          </aside>
        </div>
      )}

      {resolver && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5"><div><h2 className="font-bold">{classificacaoAmigavel(classe)}</h2><p className="text-sm text-slate-500">{nomeMovimento(resolver)} · {moeda(Math.abs(resolver.valor))}</p></div><button className="btn-ghost h-9 w-9 p-0" onClick={() => setResolver(null)}><X size={18} /></button></div>
            <div className="space-y-4 p-5">
              {classe !== "MOVIMENTO_INTERNO" ? <label><span className="label">Movimento correspondente</span><select className="input" value={relacionadoId} onChange={(e) => setRelacionadoId(e.target.value)}><option value="">Selecione...</option>{contrapartidas.filter((x) => classe !== "ESTORNO" || x.conta_bancaria_id === resolver.conta_bancaria_id).filter((x) => classe !== "TRANSFERENCIA" || x.conta_bancaria_id !== resolver.conta_bancaria_id).map((x) => <option key={x.id} value={x.id}>{dataBR(x.data_movimento)} · {moeda(Math.abs(x.valor))} · {x.conta?.nome || "Conta"} · {nomeMovimento(x)}</option>)}</select></label> : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Este movimento será marcado como resolvido sem criar receita ou despesa.</p>}
              <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setResolver(null)}>Cancelar</button><button className="btn-primary" onClick={salvarResolucao} disabled={salvando}>{salvando ? "Salvando..." : "Confirmar"}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
