// Fechamento do mês da M Lab: um painel com os cruzamentos banco × títulos e o que falta resolver.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Printer, RefreshCw, XCircle } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finDespesasListar, finMovimentosListar, finNotasListar, finRecebimentosListar } from "../services/financeiro.js";
import { servicosGeradosListar } from "../services/servicosGerados.js";
import { invalidarCopiaFinanceira } from "../services/financeiroCache.js";
import { hojeSaoPaulo } from "../lib/tituloVencido.js";
import { montarFechamento } from "../lib/fechamentoMes.js";
import { conferirOsNotas } from "../lib/conferenciaOsNotas.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ehMLab = (e) => String(e?.nome || "").toLowerCase().replace(/[^a-z]/g, "").startsWith("mlab");
const ESTILO = {
  ok: { icone: CheckCircle2, cor: "text-emerald-700", faixa: "border-emerald-200 bg-emerald-50", rotulo: "Em ordem" },
  atencao: { icone: AlertTriangle, cor: "text-amber-700", faixa: "border-amber-200 bg-amber-50", rotulo: "Atenção" },
  erro: { icone: XCircle, cor: "text-red-700", faixa: "border-red-200 bg-red-50", rotulo: "Resolver" },
};

function Conferencia({ i }) {
  const e = ESTILO[i.severidade];
  const Icone = e.icone;
  return (
    <article className={`rounded-2xl border bg-white p-4 ${i.severidade === "ok" ? "" : "shadow-sm"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icone size={20} className={`shrink-0 ${e.cor}`} aria-hidden="true" />
          <h3 className="font-semibold text-slate-900">{i.titulo}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${i.severidade === "ok" ? "bg-emerald-100 text-emerald-700" : i.severidade === "atencao" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>{e.rotulo}</span>
        </div>
        <div className="text-sm text-slate-600">{i.quantidade ? <><b>{i.quantidade}</b> {i.quantidade === 1 ? "item" : "itens"}{i.valor > 0.005 && <> · <b>{moeda(i.valor)}</b></>}</> : "Nada pendente"}</div>
      </div>
      {i.quantidade > 0 && (
        <>
          {i.dica && <p className="mt-2 text-sm text-slate-600">{i.dica}</p>}
          <details className="mt-2" open={i.quantidade <= 5}>
            <summary className="cursor-pointer text-sm text-slate-600 print:hidden">Ver os itens</summary>
            <ul className="mt-1 divide-y rounded-xl border text-sm">
              {i.lista.map((l, k) => (
                <li key={k} className="flex items-start justify-between gap-3 px-3 py-2"><span className="min-w-0 break-words">{l.texto}</span>{l.valor > 0.005 && <b className="shrink-0">{moeda(l.valor)}</b>}</li>
              ))}
            </ul>
          </details>
          {i.acao && <div className="mt-3 print:hidden"><Link to={i.acao.to} className="btn-outline">{i.acao.rotulo}</Link></div>}
        </>
      )}
    </article>
  );
}

export default function FechamentoMLab() {
  const hoje = hojeSaoPaulo();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (atualizar = false) => {
    setLoading(true);
    setErro("");
    try {
      if (atualizar) invalidarCopiaFinanceira();
      const op = await financeiroOpcoes();
      const mlab = (op?.empresas || []).find(ehMLab);
      if (!mlab) throw new Error("Empresa M Lab não encontrada no cadastro.");
      const [movimentos, receber, pagar, notas, ser] = await Promise.all([
        finMovimentosListar(mlab.id), finRecebimentosListar(mlab.id), finDespesasListar(mlab.id),
        finNotasListar(""), servicosGeradosListar({ empresaId: mlab.id }),
      ]);
      setDados({ movimentos, receber, pagar, notas, servicos: ser?.itens || [], empresaId: mlab.id, nomeOutras: Object.fromEntries((op?.empresas || []).map((e) => [e.id, e.nome])) });
    } catch (e) {
      setErro(e.message || "Não foi possível carregar o fechamento.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const f = useMemo(() => (dados && /^\d{4}-\d{2}$/.test(mes) ? montarFechamento({ movimentos: dados.movimentos, receber: dados.receber, pagar: dados.pagar, mes, hoje }) : null), [dados, mes, hoje]);
  // Serviços Gerados × Notas emitidas: não depende do mês (confere a M Lab inteira).
  const os = useMemo(() => (dados ? conferirOsNotas({ servicos: dados.servicos, notas: dados.notas, recebimentos: dados.receber, empresaId: dados.empresaId, nomeOutras: dados.nomeOutras }) : null), [dados]);
  const totalErros = (f?.erros || 0) + (os?.erros || 0);
  const totalAtencoes = (f?.atencoes || 0) + (os?.atencoes || 0);

  return (
    <div className="space-y-5">
      <PageTitle titulo="Fechamento do mês — M Lab" descricao="Cruza o banco com os títulos e mostra o que está em ordem e o que ainda precisa de você. Só consulta: nada é alterado aqui." />

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <label>
          <span className="label">Mês</span>
          <input className="input" type="month" value={mes} max={hoje.slice(0, 7)} onChange={(e) => setMes(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" disabled={loading} onClick={() => carregar(true)}><RefreshCw size={15} />{loading ? "Atualizando…" : "Atualizar"}</button>
          <button type="button" className="btn-outline" disabled={!f} onClick={() => window.print()}><Printer size={15} />Imprimir</button>
        </div>
      </div>

      {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {loading && <p className="rounded-2xl border bg-white p-8 text-center text-slate-500">Conferindo o banco e os títulos…</p>}

      {f && !loading && (
        <>
          <div className={`rounded-2xl border p-4 ${!totalErros && !totalAtencoes ? ESTILO.ok.faixa : totalErros ? ESTILO.erro.faixa : ESTILO.atencao.faixa}`} role="status">
            <p className="text-lg font-bold">
              {!totalErros && !totalAtencoes ? "Tudo em ordem." : totalErros ? `${totalErros} ${totalErros === 1 ? "ponto precisa" : "pontos precisam"} ser resolvidos${totalAtencoes ? ` e ${totalAtencoes} pedem atenção` : ""}.` : `${totalAtencoes} ${totalAtencoes === 1 ? "ponto pede" : "pontos pedem"} atenção.`}
            </p>
            <p className="text-sm text-slate-600">{f.mesFechado ? "Mês encerrado." : "Mês em andamento: pendências recentes aparecem como atenção, não como erro."}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[["Entradas do mês", f.resumo.entradas], ["Saídas do mês", f.resumo.saidas]].map(([nome, r]) => (
              <div key={nome} className="rounded-2xl border bg-white p-4">
                <p className="text-xs uppercase text-slate-500">{nome} · {r.quantidade} movimentos</p>
                <p className="mt-1 text-2xl font-bold">{moeda(r.total)}</p>
                <p className="text-sm text-slate-600">Conciliado <b className="text-emerald-700">{moeda(r.conciliado)}</b> · falta <b className={r.pendente > 0.005 ? "text-amber-700" : ""}>{moeda(r.pendente)}</b>{r.pendentes ? ` (${r.pendentes})` : ""}</p>
              </div>
            ))}
          </div>

          <section className="space-y-3" aria-label="Conferências do banco">
            <h2 className="font-bold text-slate-800">Banco × títulos</h2>
            {f.itens.map((i) => <Conferencia key={i.id} i={i} />)}
          </section>

          {os && (
            <section className="space-y-3" aria-label="Serviços gerados e notas emitidas">
              <div>
                <h2 className="font-bold text-slate-800">Serviços Gerados × Notas emitidas</h2>
                <p className="text-sm text-slate-600">{os.osComNota} de {os.osFaturadas} OS faturadas têm a nota emitida na M Lab · {os.notasSaida} notas de saída. Esta conferência cobre a M Lab inteira, não só o mês escolhido.</p>
              </div>
              {os.itens.map((i) => <Conferencia key={i.id} i={i} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
