// Compras › Pedidos, do lado de QUEM PEDE: "Solicitar material" e "Minhas
// solicitações". Qualquer pessoa do painel usa — o servidor carimba o
// solicitante e a data pelo login, então ninguém escolhe o próprio nome numa
// lista (e ninguém pede no nome de outro).
//
// Cada item enviado vira um pedido "solicitada" na coleção `compras`, a mesma
// lista de quem compra. A pessoa acompanha cada item até chegar, e cada
// mudança de situação chega no sino.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Send, X, RefreshCw, Search, Package, PencilLine } from "lucide-react";
import { Card, Empty } from "../ui.jsx";
import { dataCurta, ymdLocal } from "../../lib/format.js";
import { comprasMinhas, comprasSolicitar } from "../../services/dados.js";
import {
  CATEGORIAS_SOLICITACAO, UNIDADES_SOLICITACAO, URGENCIAS, SETORES, ROTULO_SITUACAO, ANDAMENTO, textoAprovacao,
  rotuloUrgencia, MAX_ITENS, categoriaDoProdutoEstoque,
} from "../../../supabase/functions/_shared/compras-solicitacao.mjs";
import { comUnidade } from "./comum.jsx";

const K_SETOR = "ml_compras_setor";
const itemVazio = () => ({ chave: Math.random().toString(36).slice(2), produtoId: "", livre: false, produto: "", detalhes: "", categoria: "outros", quantidade: "1", unidade: "unidade" });
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* PRODUTO DA LISTA (Léo, 19/11/2026): o colaborador escolhe o produto cadastrado no
   Estoque; digitar só BUSCA. Mostra o saldo para ninguém pedir o que já tem.
   Produto que ainda não foi cadastrado: "Não está na lista — escrever o nome". */
function EscolherProduto({ indice, item, produtos, saldoDe, aoEscolher, aoLivre, aoMudarLivre, aoLimpar }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef(null);
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const achados = useMemo(() => produtos.filter((p) => termos.every((t) => semAcento(`${p.nome} ${p.local || ""}`).includes(t))).slice(0, 40), [produtos, busca]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const idLista = `sol-prod-lista-${item.chave}`;

  if (item.produtoId) {
    const s = saldoDe(item.produtoId);
    return (
      <div className="col-span-2 flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 lg:col-span-1">
        <Package size={15} className="shrink-0 text-brand-700" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{item.produto}</span>
          {s !== null && <span className="block text-[11px] text-slate-500">no estoque: {comUnidade(s, item.unidade)}</span>}
        </span>
        <button type="button" className="shrink-0 text-xs font-semibold text-brand-700 hover:underline" onClick={aoLimpar} aria-label={`Trocar o produto do item ${indice + 1}`}>Trocar</button>
      </div>
    );
  }
  if (item.livre) {
    return (
      <div className="col-span-2 flex items-center gap-1 lg:col-span-1">
        <input aria-label={`Produto do item ${indice + 1} (não está na lista)`} list="sol-sugestoes" className="input" placeholder="Nome do produto que não está na lista" value={item.produto} onChange={aoMudarLivre} maxLength={120} autoFocus />
        <button type="button" className="grid h-11 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" title="Voltar para a lista" aria-label="Voltar para a lista de produtos" onClick={aoLimpar}><Search size={15} /></button>
      </div>
    );
  }
  const escolher = (p) => { aoEscolher(p); setBusca(""); setAberto(false); };
  return (
    <div ref={caixa} className="relative col-span-2 lg:col-span-1">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          role="combobox" aria-expanded={aberto} aria-controls={idLista} aria-autocomplete="list"
          aria-label={`Produto do item ${indice + 1}: busque e escolha na lista`}
          className="input pl-9" placeholder={produtos.length ? "Buscar produto do estoque…" : "Nenhum produto cadastrado ainda"}
          value={busca} onFocus={() => setAberto(true)}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); setAtivo(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setAtivo((a) => Math.min(a + 1, achados.length)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && aberto) { e.preventDefault(); if (achados[ativo]) escolher(achados[ativo]); else if (ativo === achados.length) { aoLivre(busca); setAberto(false); } }
            else if (e.key === "Escape") setAberto(false);
          }}
        />
      </div>
      {aberto && (
        <ul id={idLista} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {achados.map((p, k) => {
            const s = saldoDe(p.id);
            return (
              <li key={p.id} role="option" aria-selected={k === ativo} onMouseDown={(e) => { e.preventDefault(); escolher(p); }} onMouseEnter={() => setAtivo(k)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${k === ativo ? "bg-brand-50" : ""}`}>
                <Package size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-slate-800">{p.nome}</span>
                <span className={`shrink-0 text-xs ${s === null ? "text-slate-400" : s > 0 ? "text-ok-700" : "text-bad-700"}`}>{s === null ? "sem saldo lançado" : `tem ${comUnidade(s, p.unidade)}`}</span>
              </li>
            );
          })}
          {!achados.length && <li className="px-3 py-2 text-sm text-slate-500">{produtos.length ? "Nenhum produto com esse nome." : "O Estoque ainda não tem produtos cadastrados."}</li>}
          <li role="option" aria-selected={ativo === achados.length} onMouseDown={(e) => { e.preventDefault(); aoLivre(busca); setAberto(false); }} onMouseEnter={() => setAtivo(achados.length)}
            className={`flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm font-medium text-brand-700 ${ativo === achados.length ? "bg-brand-50" : ""}`}>
            <PencilLine size={14} aria-hidden="true" /> Não está na lista — escrever o nome{busca.trim() ? ` “${busca.trim()}”` : ""}
          </li>
        </ul>
      )}
    </div>
  );
}

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

export function SolicitarMaterial({ sessao, sugestoes, produtos = [], saldos, aoEnviar, avisar }) {
  const produtosAtivos = useMemo(() => (produtos || []).filter((p) => p.ativo !== false && p.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [produtos]);
  const saldoDe = (id) => { const r = saldos?.get?.(id); return r ? r.saldo : null; };
  const [setor, setSetor] = useState(() => {
    try { return localStorage.getItem(K_SETOR) || SETORES[0]; } catch { return SETORES[0]; }
  });
  const [urgencia, setUrgencia] = useState("media");
  const [itens, setItens] = useState(() => [itemVazio()]);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const hoje = ymdLocal(new Date());

  const atualizar = (chave, mudanca) => setItens((l) => l.map((it) => (it.chave === chave ? { ...it, ...mudanca } : it)));
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
        itens: preenchidos.map(({ produtoId, produto, detalhes, categoria, quantidade, unidade }) => ({ produtoId, produto, detalhes, categoria, quantidade, unidade })),
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
              <EscolherProduto indice={i} item={it} produtos={produtosAtivos} saldoDe={saldoDe}
                aoEscolher={(p) => atualizar(it.chave, { produtoId: p.id, livre: false, produto: p.nome, unidade: p.unidade || "un", categoria: categoriaDoProdutoEstoque(p.categoria) })}
                aoLivre={(texto) => atualizar(it.chave, { produtoId: "", livre: true, produto: String(texto || "").toLocaleUpperCase("pt-BR") })}
                aoMudarLivre={mudar(it.chave, "produto")}
                aoLimpar={() => atualizar(it.chave, { produtoId: "", livre: false, produto: "", unidade: "unidade", categoria: "outros" })} />
              <input aria-label={`Detalhes do item ${i + 1}`} className="input col-span-2 lg:col-span-1" placeholder="Ex.: tamanho M, 1 L" value={it.detalhes} onChange={mudar(it.chave, "detalhes")} maxLength={200} />
              <select aria-label={`Categoria do item ${i + 1}`} className="select col-span-2 disabled:bg-slate-50 disabled:text-slate-500 lg:col-span-1" value={it.categoria} onChange={mudar(it.chave, "categoria")} disabled={!!it.produtoId} title={it.produtoId ? "Vem do cadastro do produto" : undefined}>
                {Object.entries(CATEGORIAS_SOLICITACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <input aria-label={`Quantidade do item ${i + 1}`} type="number" min="0.001" step="any" inputMode="decimal" className="input" value={it.quantidade} onChange={mudar(it.chave, "quantidade")} />
              <select aria-label={`Unidade do item ${i + 1}`} className="select disabled:bg-slate-50 disabled:text-slate-500" value={it.unidade} onChange={mudar(it.chave, "unidade")} disabled={!!it.produtoId} title={it.produtoId ? "Vem do cadastro do produto" : undefined}>
                {[...new Set([...(it.produtoId ? [it.unidade] : []), ...UNIDADES_SOLICITACAO])].map((u) => <option key={u}>{u}</option>)}
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
