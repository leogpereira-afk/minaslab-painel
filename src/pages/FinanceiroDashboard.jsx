import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Wallet, TrendingUp, AlertTriangle, Landmark, RefreshCw, ReceiptText, Plus, ArrowDownCircle, ArrowUpCircle, ChevronRight, CheckCircle2, X, Building2 } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { liquidoBanco } from "../lib/financeiroCivil.js";
import { operacaoManual } from "../lib/financeiroIntegridade.js";
import { carregarCopiaFinanceira } from "../services/financeiroCache.js";
import { nomeMovimento } from "../lib/movimentoNome.js";
import { hojeSaoPaulo } from "../lib/tituloVencido.js";
import { resumoPainel, totalEmAberto } from "../lib/financeiroPainel.js";

// Regras dos números (em aberto, vencido, recebido/pago no mês, conciliar): src/lib/financeiroPainel.js.
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => String(v || "").slice(0, 10).split("-").reverse().join("/") || "—";
const SEM_ACESSO = "Sem acesso";
const LISTAS = { rec: "recebimentosListar", des: "despesasListar", notas: "notasListar", mov: "movimentosListar" };
const TONS = {
  slate: "bg-slate-50 text-slate-700",
  sky: "bg-sky-50 text-sky-700",
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
};

// Cartão do painel. Com uma ação, o cartão todo é o botão; com várias (Vencidos), cada uma é um botão.
function Kpi({ titulo, valor, sub, Icone, tom = "slate", onClick, acao, acoes }) {
  const corpo = (
    <>
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${TONS[tom]}`}>
          <Icone size={18} aria-hidden="true" />
        </span>
        <p className="min-w-0 text-sm font-bold text-slate-800">{titulo}</p>
      </div>
      <p className="mt-3 break-words text-[1.5rem] font-bold leading-none tracking-tight text-slate-950 2xl:text-2xl">{valor}</p>
      <p className="mt-2 text-xs leading-4 text-slate-500">{sub}</p>
    </>
  );
  const caixa = "group flex min-h-[120px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm";
  const faixa = `flex items-center justify-between rounded-lg px-2 py-2 text-xs font-bold ${TONS[tom]}`;
  if (acoes?.length)
    return (
      <div className={caixa}>
        {corpo}
        <div className="mt-auto grid gap-1 pt-2">
          {acoes.map((a) => (
            <button key={a.rotulo} type="button" onClick={a.onClick} disabled={a.desativado} className={`${faixa} transition hover:brightness-95 disabled:opacity-50`}>
              <span>{a.rotulo}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <button type="button" onClick={onClick} className={`${caixa} transition hover:-translate-y-0.5 hover:shadow-md`}>
      {corpo}
      {acao && (
        <span className={`mt-auto ${faixa}`}>
          <span>{acao}</span>
          <ChevronRight size={17} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

function DetalheMovimento({ mov, onFechar, onAbrir }) {
  const fechar = useRef(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25" onClick={onFechar}>
      <aside role="dialog" aria-modal="true" aria-labelledby="detalhe-mov-titulo" className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Detalhes da movimentação</p>
            <h2 id="detalhe-mov-titulo" className="mt-1 text-xl font-bold">{nomeMovimento(mov)}</h2>
          </div>
          <button ref={fechar} type="button" aria-label="Fechar detalhes" className="rounded-lg p-2 hover:bg-slate-100" onClick={onFechar}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-xs text-slate-500">Data</span>
            <p className="font-semibold">{dataBR(mov.data_movimento)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-xs text-slate-500">Valor</span>
            <p className="font-bold">{moeda(Math.abs(Number(mov.valor || 0)))}</p>
          </div>
        </div>
        <div className="mt-5">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Descrição completa do banco</p>
          <p className="whitespace-pre-wrap break-words rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">{mov.descricao || "Sem descrição"}</p>
        </div>
        {mov.documento && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Documento</p>
            <p className="mt-1 break-all text-sm">{mov.documento}</p>
          </div>
        )}
        <button type="button" className="btn-primary mt-6 w-full" onClick={onAbrir}>Abrir na Movimentação da Conta</button>
      </aside>
    </div>
  );
}

export default function FinanceiroDashboard() {
  const navigate = useNavigate();
  const contexto = useOutletContext();
  const [empresaId, setEmpresaId] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [copia, setCopia] = useState(null);
  const pedido = useRef({ valor: 0 }).current;
  const carregar = useCallback(
    async (atualizar = false) => {
      const id = ++pedido.valor;
      setLoading(true);
      setErro("");
      try {
        const nova = await carregarCopiaFinanceira({ atualizar });
        if (id !== pedido.valor) return;
        setCopia(nova);
        setErro(nova.aviso || (!nova.salvo ? "Dados carregados, mas não foi possível salvá-los neste navegador." : ""));
      } catch (e) {
        if (id === pedido.valor) setErro(e.message || "Falha ao carregar o Financeiro.");
      } finally {
        if (id === pedido.valor) setLoading(false);
      }
    },
    [pedido],
  );
  useEffect(() => {
    carregar();
    return () => {
      pedido.valor++;
    };
  }, [carregar, pedido]);

  const op = useMemo(() => copia?.opcoes || { empresas: [], contas: [] }, [copia]);
  const empresas = useMemo(() => (op.empresas || []).filter((e) => e.ativa !== false), [op]);
  // Lista que o servidor negou a esta pessoa (tela Acessos): mostra "Sem acesso", nunca R$ 0,00.
  const semAcesso = useMemo(() => Object.fromEntries(Object.entries(LISTAS).map(([k, nome]) => [k, !!copia?.listas?.[nome]?.semAcesso])), [copia]);
  const { rec, des, notas, mov } = useMemo(() => {
    const lista = (nome) => (copia?.listas?.[nome]?.itens || []).filter((x) => !empresaId || x.empresa_id === empresaId);
    return Object.fromEntries(Object.entries(LISTAS).map(([k, nome]) => [k, lista(nome)]));
  }, [copia, empresaId]);

  const selecionada = empresas.find((x) => x.id === empresaId);
  const modo = empresaId ? (operacaoManual(selecionada) ? "MLAB" : "MINAS") : "CONSOLIDADO";
  const hoje = hojeSaoPaulo();
  const dados = useMemo(() => {
    const contas = (op.contas || []).filter((c) => c.ativa !== false && (!empresaId || c.empresa_id === empresaId));
    const r = resumoPainel({ rec, des, mov, contas, empresas, hoje });
    r.resultado = liquidoBanco(mov.filter((x) => String(x.data_movimento || "").slice(0, 7) === hoje.slice(0, 7)));
    return r;
  }, [rec, des, mov, op.contas, empresas, empresaId, hoje]);
  const porEmpresa = useMemo(
    () =>
      empresas.map((e) => {
        const daEmpresa = (lista) => lista.filter((x) => x.empresa_id === e.id);
        const r = resumoPainel({ contas: (op.contas || []).filter((c) => c.empresa_id === e.id && c.ativa !== false), hoje });
        return { ...e, saldo: r.saldo, saldoCompleto: r.saldoCompleto, receber: totalEmAberto(daEmpresa(rec)), pagar: totalEmAberto(daEmpresa(des)) };
      }),
    [empresas, op.contas, rec, des, hoje],
  );
  const fecharDetalhe = useCallback(() => setDetalhe(null), []);

  // Abre a lista já filtrada (empresa do painel, status, mês) pelo layout do Financeiro.
  const abrir = (destino, filtro = {}) => (contexto?.abrirContexto ? contexto.abrirContexto(destino, { empresa: empresaId, ...filtro }) : navigate(destino));
  const valorOuSemAcesso = (lista, v) => (semAcesso[lista] ? SEM_ACESSO : moeda(v));
  const conciliaAqui = modo !== "MINAS" && empresas.some(operacaoManual);

  const recentes = [...mov].sort((a, b) => String(b.data_movimento || "").localeCompare(String(a.data_movimento || ""))).slice(0, 6);
  const notasRecentes = [...notas].sort((a, b) => String(b.data_emissao || "").localeCompare(String(a.data_emissao || ""))).slice(0, 5);
  const saldoSub = !dados.contas.length
    ? "Nenhuma conta ativa"
    : dados.saldoCompleto
      ? `${dados.contas.length} conta(s) ativa(s)`
      : `${dados.contas.length - dados.contasSemSaldo.length} de ${dados.contas.length} conta(s) com saldo informado`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Financeiro</h1>
          <p className="mt-1 text-sm text-slate-500">Dados salvos neste navegador. Use Atualizar para buscar novidades.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
          <button type="button" className="btn-outline" onClick={() => navigate("/financas/aplicacoes")}>Aplicações financeiras</button>
          <button type="button" className="btn-outline" onClick={() => navigate("/financas/socios")}>Retiradas dos sócios</button>
          <button type="button" className="btn-outline" onClick={() => carregar(true)} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            {loading ? "Atualizando..." : "Atualizar dados"}
          </button>
        </div>
      </div>
      {copia?.atualizadoEm && (
        <p className="text-xs text-slate-500" role="status">
          Última consulta concluída: {new Date(copia.atualizadoEm).toLocaleString("pt-BR")}. A atualização inclui lançamentos novos, alterações e exclusões.
        </p>
      )}
      {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</div>}

      <div className={`rounded-3xl border bg-white p-5 shadow-sm ${modo === "MLAB" ? "border-blue-100" : modo === "MINAS" ? "border-emerald-100" : "border-slate-200"}`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${modo === "MLAB" ? "bg-blue-50 text-blue-700" : modo === "MINAS" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700"}`}>
              <Building2 size={27} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-950">
                {modo === "CONSOLIDADO" ? "Gestão estratégica consolidada" : modo === "MINAS" ? "MinasLab · operação alimentada pela Omie" : "M Lab · operação realizada neste sistema"}
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                {modo === "CONSOLIDADO"
                  ? "Use esta visão para acompanhar caixa, compromissos e desempenho das duas empresas."
                  : modo === "MINAS"
                    ? "Acompanhe aqui os dados financeiros sincronizados. A operação continua sendo feita na Omie."
                    : "Receba, pague, emita NFS-e, envie ao cliente, atualize o C6 e faça a conciliação por aqui."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-[230px]">
              <span className="label">Empresa</span>
              <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="">Consolidado</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </label>
            {modo === "MLAB" && (
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => navigate("/financas/notas-fiscais/emitir")}>
                  <ReceiptText size={15} aria-hidden="true" />
                  Emitir NFS-e
                </button>
                <button type="button" className="btn-outline" onClick={() => abrir("/financas/movimentacao-conta")}>
                  <Landmark size={15} aria-hidden="true" />
                  Atualizar C6
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Kpi
          titulo="Saldo disponível"
          valor={dados.saldo == null ? "A informar" : moeda(dados.saldo)}
          sub={saldoSub}
          Icone={Wallet}
          tom="emerald"
          acao="Ver contas"
          onClick={() => abrir("/financas/movimentacao-conta")}
        />
        <Kpi
          titulo="A receber no mês"
          valor={valorOuSemAcesso("rec", dados.aReceber)}
          sub={semAcesso.rec ? "Lista não liberada para você (tela Acessos)" : `${dados.rMes.length} em aberto · ${moeda(dados.recebidoMes)} recebido neste mês`}
          Icone={ArrowDownCircle}
          tom="sky"
          acao="Ver recebimentos"
          onClick={() => abrir("/financas/contas-a-receber", { mes: true })}
        />
        <Kpi
          titulo="A pagar no mês"
          valor={valorOuSemAcesso("des", dados.aPagar)}
          sub={semAcesso.des ? "Lista não liberada para você (tela Acessos)" : `${dados.dMes.length} em aberto · ${moeda(dados.pagoMes)} pago neste mês`}
          Icone={ArrowUpCircle}
          tom="rose"
          acao="Ver despesas"
          onClick={() => abrir("/financas/contas-a-pagar", { mes: true })}
        />
        <Kpi
          titulo="Vencidos"
          valor={semAcesso.rec && semAcesso.des ? SEM_ACESSO : moeda(dados.vencidos)}
          sub={semAcesso.rec || semAcesso.des ? "Soma só das listas liberadas para você" : "Em aberto com vencimento antes de hoje"}
          Icone={AlertTriangle}
          tom="amber"
          acoes={[
            { rotulo: `A receber: ${semAcesso.rec ? SEM_ACESSO.toLowerCase() : dados.rV.length}`, desativado: semAcesso.rec, onClick: () => abrir("/financas/contas-a-receber", { status: "VENCIDO" }) },
            { rotulo: `A pagar: ${semAcesso.des ? SEM_ACESSO.toLowerCase() : dados.dV.length}`, desativado: semAcesso.des, onClick: () => abrir("/financas/contas-a-pagar", { status: "VENCIDO" }) },
          ]}
        />
        <Kpi
          titulo="Movimento líquido do mês"
          valor={valorOuSemAcesso("mov", dados.resultado)}
          sub="Inclui transferências; não é lucro"
          Icone={TrendingUp}
          tom={dados.resultado >= 0 ? "emerald" : "rose"}
          acao="Ver movimentos"
          onClick={() => abrir("/financas/movimentacao-conta")}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Saldos por conta</h2>
            <button type="button" className="text-sm font-medium text-blue-700" onClick={() => abrir("/financas/movimentacao-conta")}>Ver todas</button>
          </div>
          <div className="space-y-2">
            {dados.contas.length ? (
              dados.contas.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{c.nome || c.banco}</p>
                    <p className="text-xs text-slate-500">
                      {c.banco || "Conta bancária"} · Saldo: {c.saldo_atualizado_em ? new Date(c.saldo_atualizado_em).toLocaleString("pt-BR") : "data não informada"}
                    </p>
                  </div>
                  <strong className="text-sm">{c.saldo_atual == null ? "A informar" : moeda(c.saldo_atual)}</strong>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">Nenhuma conta encontrada.</p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">O que precisa da sua atenção</h2>
            <AlertTriangle size={18} className="text-amber-500" aria-hidden="true" />
          </div>
          <div className="divide-y">
            {!semAcesso.rec && (
              <button type="button" className="flex w-full justify-between py-3 text-sm" onClick={() => abrir("/financas/contas-a-receber", { status: "VENCIDO" })}>
                Contas a receber vencidas <strong className="text-red-600">{dados.rV.length}</strong>
              </button>
            )}
            {!semAcesso.des && (
              <button type="button" className="flex w-full justify-between py-3 text-sm" onClick={() => abrir("/financas/contas-a-pagar", { status: "VENCIDO" })}>
                Contas a pagar vencidas <strong className="text-red-600">{dados.dV.length}</strong>
              </button>
            )}
            {conciliaAqui && !semAcesso.mov && (
              <button type="button" className="flex w-full justify-between py-3 text-sm" onClick={() => abrir("/financas/conciliacao-mlab")}>
                Movimentos da M Lab para conciliar <strong className="text-amber-600">{dados.pendMov}</strong>
              </button>
            )}
            <button type="button" className="flex w-full justify-between py-3 text-sm" onClick={() => abrir("/financas/movimentacao-conta")}>
              Contas sem saldo informado <strong className={dados.contasSemSaldo.length ? "text-amber-600" : "text-slate-500"}>{dados.contasSemSaldo.length}</strong>
            </button>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold">Atalhos rápidos</h2>
          <div className="grid gap-2">
            {modo !== "MINAS" && (
              <>
                <button type="button" className="btn-outline justify-start" onClick={() => abrir("/financas/contas-a-receber", { novo: true })}>
                  <Plus size={15} aria-hidden="true" />
                  Nova conta a receber
                </button>
                <button type="button" className="btn-outline justify-start" onClick={() => abrir("/financas/contas-a-pagar", { novo: true })}>
                  <Plus size={15} aria-hidden="true" />
                  Nova conta a pagar
                </button>
              </>
            )}
            <button type="button" className="btn-outline justify-start" onClick={() => abrir("/financas/movimentacao-conta")}>
              <Landmark size={15} aria-hidden="true" />
              Movimentação
            </button>
            <button type="button" className="btn-outline justify-start" onClick={() => navigate("/financas/fluxo-caixa")}>
              <TrendingUp size={15} aria-hidden="true" />
              Fluxo de caixa
            </button>
            <button type="button" className="btn-outline justify-start" onClick={() => abrir("/financas/conciliacao-mlab")}>
              <CheckCircle2 size={15} aria-hidden="true" />
              Conciliação
            </button>
          </div>
        </section>
      </div>

      {modo === "CONSOLIDADO" && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold">MinasLab × M Lab</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {porEmpresa.map((e) => (
              <button type="button" key={e.id} onClick={() => setEmpresaId(e.id)} className="rounded-xl border p-4 text-left hover:bg-slate-50">
                <div className="mb-3 flex justify-between">
                  <strong>{e.nome}</strong>
                  <ChevronRight size={16} aria-hidden="true" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500">Saldo{e.saldo != null && !e.saldoCompleto ? " (parcial)" : ""}</span>
                    <b>{e.saldo == null ? "A informar" : moeda(e.saldo)}</b>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">A receber</span>
                    <b>{semAcesso.rec ? SEM_ACESSO : moeda(e.receber)}</b>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">A pagar</span>
                    <b>{semAcesso.des ? SEM_ACESSO : moeda(e.pagar)}</b>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between p-5">
            <h2 className="font-bold">Últimas movimentações</h2>
            <button type="button" className="text-sm font-medium text-blue-700" onClick={() => abrir("/financas/movimentacao-conta")}>Ver todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente / Favorecido</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="w-8"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((m) => {
                  const entrada = String(m.tipo || "").toUpperCase() === "CREDITO";
                  // Mesmos ícones dos cartões: entrada = seta para baixo (A receber), saída = para cima (A pagar).
                  const IconeMov = entrada ? ArrowDownCircle : ArrowUpCircle;
                  return (
                    <tr key={m.id} onClick={() => setDetalhe(m)} className="cursor-pointer border-t transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">{dataBR(m.data_movimento)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${entrada ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                            <IconeMov size={20} aria-label={entrada ? "Entrada" : "Saída"} />
                          </span>
                          <span className="font-semibold text-slate-800">{nomeMovimento(m)}</span>
                        </div>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${entrada ? "text-emerald-700" : "text-rose-700"}`}>
                        {entrada ? "+ " : "- "}
                        {moeda(Math.abs(Number(m.valor || 0)))}
                      </td>
                      <td className="px-3">
                        <button type="button" aria-label={`Ver detalhes de ${nomeMovimento(m)}`} className="rounded p-1 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); setDetalhe(m); }}>
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!recentes.length && <p className="p-8 text-center text-sm text-slate-500">{semAcesso.mov ? "Movimentos não liberados para você." : "Nenhuma movimentação encontrada."}</p>}
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between p-5">
            <h2 className="font-bold">Notas Fiscais {!semAcesso.notas && <span className="text-sm font-medium text-slate-500">· {notas.length} no cadastro</span>}</h2>
            <button type="button" className="text-sm font-medium text-blue-700" onClick={() => abrir("/financas/notas-fiscais")}>Ver todas</button>
          </div>
          <div className="divide-y">
            {notasRecentes.length ? (
              notasRecentes.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{n.cliente || n.fornecedor || n.numero_nf || "Nota fiscal"}</p>
                    <p className="text-xs text-slate-500">
                      {n.numero_nf ? `Nº ${n.numero_nf} · ` : ""}
                      {dataBR(n.data_emissao)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{moeda(n.valor_total)}</p>
                    <p className="text-xs text-slate-500">{n.status || "Registrada"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">{semAcesso.notas ? "Notas não liberadas para você." : "Nenhuma nota encontrada."}</p>
            )}
          </div>
        </section>
      </div>
      {detalhe && <DetalheMovimento mov={detalhe} onFechar={fecharDetalhe} onAbrir={() => abrir("/financas/movimentacao-conta")} />}
    </div>
  );
}
