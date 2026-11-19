// Compras › Pedidos, do lado de QUEM PEDE: "Solicitar material" e "Minhas
// solicitações". Qualquer pessoa do painel usa — o servidor carimba o
// solicitante e a data pelo login, então ninguém escolhe o próprio nome numa
// lista (e ninguém pede no nome de outro).
//
// Cada item enviado vira um pedido "solicitada" na coleção `compras`, a mesma
// lista de quem compra. A pessoa acompanha cada item até chegar, e cada
// mudança de situação chega no sino.

import { useCallback, useMemo, useState } from "react";
import { Plus, Send, X, RefreshCw } from "lucide-react";
import { Card, Empty } from "../ui.jsx";
import { dataCurta, ymdLocal } from "../../lib/format.js";
import { comprasMinhas, comprasSolicitar } from "../../services/dados.js";
import {
  CATEGORIAS_SOLICITACAO, UNIDADES_SOLICITACAO, URGENCIAS, SETORES, ROTULO_SITUACAO, ANDAMENTO, textoAprovacao,
  rotuloUrgencia, MAX_ITENS,
} from "../../../supabase/functions/_shared/compras-solicitacao.mjs";

const K_SETOR = "ml_compras_setor";
const itemVazio = () => ({ chave: Math.random().toString(36).slice(2), produto: "", detalhes: "", categoria: "outros", quantidade: "1", unidade: "unidade" });

export const COR_URGENCIA = { alta: "text-bad-700 font-semibold", media: "text-warn-700 font-semibold", baixa: "text-slate-500" };
export const TAG_SITUACAO = {
  solicitada: "bg-slate-200 text-slate-700",
  aprovada: "bg-emerald-100 text-emerald-800",
  cotando: "bg-warn-100 text-warn-800",
  comprada: "bg-sky-100 text-sky-700",
  recebida: "bg-ok-100 text-ok-800",
  cancelada: "bg-bad-100 text-bad-800",
};

export function TagSituacao({ status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_SITUACAO[status] || TAG_SITUACAO.solicitada}`}>
      {ROTULO_SITUACAO[status] || status}
    </span>
  );
}

function Andamento({ status }) {
  if (status === "cancelada") return <span className="text-xs text-slate-500">recusada</span>;
  const i = ANDAMENTO.indexOf(status);
  return (
    <span className="inline-flex items-center gap-1" title={ROTULO_SITUACAO[status]} aria-label={`Andamento: ${ROTULO_SITUACAO[status] || status}`}>
      {ANDAMENTO.map((s, k) => (
        <i key={s} className={`inline-block h-1 w-5 rounded ${k <= i ? "bg-brand-600" : "bg-slate-200"}`} />
      ))}
    </span>
  );
}

// Uma busca só para as duas abas: o que eu pedi + os nomes já pedidos (sugestão do campo Produto).
export function useMinhasSolicitacoes() {
  const [estado, setEstado] = useState({ itens: null, sugestoes: [], erro: "" });
  const recarregar = useCallback(() => {
    comprasMinhas()
      .then((r) => setEstado({ itens: r.itens, sugestoes: r.sugestoes, erro: "" }))
      .catch((e) => setEstado((s) => ({ ...s, itens: s.itens || [], erro: e.message })));
  }, []);
  // Quem chama decide QUANDO buscar (a página de Compras busca junto com a
  // própria recarga: ao abrir e ao voltar para a aba do navegador).
  return { ...estado, recarregar };
}

export function SolicitarMaterial({ sessao, sugestoes, aoEnviar, avisar }) {
  const [setor, setSetor] = useState(() => {
    try { return localStorage.getItem(K_SETOR) || SETORES[0]; } catch { return SETORES[0]; }
  });
  const [urgencia, setUrgencia] = useState("media");
  const [itens, setItens] = useState(() => [itemVazio()]);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const hoje = ymdLocal(new Date());

  const mudar = (chave, campo) => (e) => setItens((l) => l.map((it) => (it.chave === chave ? { ...it, [campo]: e.target.value } : it)));
  const tirar = (chave) => setItens((l) => (l.length > 1 ? l.filter((it) => it.chave !== chave) : l));
  const preenchidos = itens.filter((it) => it.produto.trim());

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!preenchidos.length) return avisar({ tipo: "erro", texto: "Escreva pelo menos um produto." });
    const semQtd = preenchidos.find((it) => !(Number(String(it.quantidade).replace(",", ".")) > 0));
    if (semQtd) return avisar({ tipo: "erro", texto: `Confira a quantidade de "${semQtd.produto.trim()}".` });
    setEnviando(true);
    try {
      const gravados = await comprasSolicitar({
        setor, urgencia, obs,
        itens: preenchidos.map(({ produto, detalhes, categoria, quantidade, unidade }) => ({ produto, detalhes, categoria, quantidade, unidade })),
      });
      try { localStorage.setItem(K_SETOR, setor); } catch { /* só não lembra o setor */ }
      setItens([itemVazio()]);
      setObs("");
      setUrgencia("media");
      const n = gravados.length;
      avisar({ tipo: "ok", texto: `Solicitação enviada com ${n} ${n > 1 ? "itens" : "item"}. Quem compra foi avisado. Acompanhe em “Minhas solicitações”.` });
      aoEnviar();
    } catch (ex) {
      avisar({ tipo: "erro", texto: ex.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <form onSubmit={enviar} aria-busy={enviando}>
        <h2 className="mb-3 font-display text-base font-semibold text-slate-900">Nova solicitação</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>div]:min-w-0">
          <div>
            <label className="label" htmlFor="sol-quem">Solicitante</label>
            <input id="sol-quem" className="input bg-slate-50 text-slate-600" readOnly value={sessao?.nome || sessao?.usuario || ""} />
          </div>
          <div>
            <label className="label" htmlFor="sol-setor">Setor</label>
            <select id="sol-setor" className="select" value={setor} onChange={(e) => setSetor(e.target.value)}>
              {SETORES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sol-data">Data</label>
            <input id="sol-data" className="input bg-slate-50 text-slate-600" readOnly value={hoje.split("-").reverse().join("/")} />
          </div>
          <div>
            <label className="label" htmlFor="sol-urg">Urgência</label>
            <select id="sol-urg" className="select" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
              {["baixa", "media", "alta"].map((u) => <option key={u} value={u}>{URGENCIAS[u]}</option>)}
            </select>
          </div>
        </div>
        <p className="mb-4 mt-2 text-xs text-slate-500">Solicitante e data vêm do seu login — ninguém precisa escolher o nome numa lista.</p>

        <datalist id="sol-sugestoes">
          {sugestoes.map((s) => <option key={s} value={s} />)}
        </datalist>

        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_5rem_minmax(0,1.2fr)_2.75rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
            <span>Produto</span><span>Detalhes (tamanho, marca, cor…)</span><span>Categoria</span><span>Qtd.</span><span>Unidade</span><span />
          </div>
          {itens.map((it, i) => (
            <div key={it.chave} className="grid grid-cols-2 gap-2 rounded-xl border p-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_5rem_minmax(0,1.2fr)_2.75rem] lg:border-0 lg:p-0" style={{ borderColor: "var(--hairline)" }}>
              <input aria-label={`Produto do item ${i + 1}`} list="sol-sugestoes" className="input col-span-2 lg:col-span-1" placeholder="Digite: o painel sugere o que já foi pedido" value={it.produto} onChange={mudar(it.chave, "produto")} maxLength={120} />
              <input aria-label={`Detalhes do item ${i + 1}`} className="input col-span-2 lg:col-span-1" placeholder="Ex.: tamanho M, 1 L" value={it.detalhes} onChange={mudar(it.chave, "detalhes")} maxLength={200} />
              <select aria-label={`Categoria do item ${i + 1}`} className="select col-span-2 lg:col-span-1" value={it.categoria} onChange={mudar(it.chave, "categoria")}>
                {Object.entries(CATEGORIAS_SOLICITACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <input aria-label={`Quantidade do item ${i + 1}`} type="number" min="0.001" step="any" inputMode="decimal" className="input" value={it.quantidade} onChange={mudar(it.chave, "quantidade")} />
              <select aria-label={`Unidade do item ${i + 1}`} className="select" value={it.unidade} onChange={mudar(it.chave, "unidade")}>
                {UNIDADES_SOLICITACAO.map((u) => <option key={u}>{u}</option>)}
              </select>
              <button type="button" onClick={() => tirar(it.chave)} disabled={itens.length === 1} className="col-span-2 grid h-11 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700 disabled:opacity-40 lg:col-span-1 lg:w-11" title="Tirar item" aria-label={`Tirar o item ${i + 1}`}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-outline mt-3 min-h-11" onClick={() => setItens((l) => [...l, itemVazio()])} disabled={itens.length >= MAX_ITENS}>
          <Plus size={15} /> Adicionar item
        </button>

        <div className="mt-4">
          <label className="label" htmlFor="sol-obs">Observação para quem compra (opcional)</label>
          <textarea id="sol-obs" className="input" rows={2} maxLength={500} placeholder="Ex.: a luva é para a análise de amanhã cedo." value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Ao enviar, cada item vira um pedido “Solicitada” em Compras › Pedidos e quem compra recebe aviso no sino.</p>
          <button type="submit" className="btn-primary min-h-11" disabled={enviando || !preenchidos.length}>
            <Send size={15} /> {enviando ? "Enviando…" : "Enviar solicitação"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function MinhasSolicitacoes({ itens, erro, aoRecarregar }) {
  const lista = useMemo(
    () => [...(itens || [])].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")) || String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))),
    [itens]
  );
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-slate-900">Minhas solicitações</h2>
        <button type="button" className="btn-outline min-h-11" onClick={aoRecarregar}><RefreshCw size={14} /> Atualizar</button>
      </div>
      <p className="mb-3 text-xs text-slate-500">Você acompanha cada item até chegar. Cada mudança de situação avisa você no sino.</p>
      {erro && <div role="alert" className="mb-3 rounded-xl bg-bad-50 p-3 text-sm text-bad-800">{erro}</div>}
      {itens === null ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <Empty>Você ainda não pediu nada por aqui.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Data</th><th className="px-2 py-2">Produto</th><th className="px-2 py-2">Qtd.</th>
                <th className="px-2 py-2">Urgência</th><th className="px-2 py-2">Situação</th><th className="px-2 py-2">Andamento</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">{p.data ? dataCurta(p.data) : "—"}</td>
                  <td className="px-2 py-2">
                    <span className="font-medium text-slate-900">{p.item}</span>
                    {p.detalhes && <span className="block text-xs text-slate-500">{p.detalhes}</span>}
                    {p.status === "cancelada" && p.motivoRecusa && <span className="block text-xs text-bad-700">Motivo: {p.motivoRecusa}</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {p.qtde || "—"}
                    {p.qtdeSolicitada && textoAprovacao(p) && <span className="block text-xs font-medium text-warn-700">aprovado de {p.qtdeSolicitada} pedidos</span>}
                  </td>
                  <td className={`px-2 py-2 ${COR_URGENCIA[p.urgencia] || ""}`}>{rotuloUrgencia(p.urgencia)}</td>
                  <td className="px-2 py-2"><TagSituacao status={p.status} /></td>
                  <td className="px-2 py-2"><Andamento status={p.status} />{p.status === "recebida" && p.dataRecebida ? <span className="ml-2 text-xs text-slate-500">{dataCurta(p.dataRecebida)}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
