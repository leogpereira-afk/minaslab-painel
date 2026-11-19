// Aba Pedidos — o lado de QUEM COMPRA: tudo o que foi pedido e não chegou,
// agrupado por CATEGORIA como uma lista de compras (papelaria numa ida, mercado
// em outra). Dentro da categoria, urgência alta primeiro e, no empate, quem
// espera há mais tempo. Marque vários e mude a situação de uma vez: quem pediu
// é avisado no sino (o servidor manda um aviso por pessoa).
//
// O fluxo anda numa direção só (solicitada → em cotação → comprada → recebida).
// A ÚNICA mudança de rumo: chegar em "recebida" passa pelo modal de
// recebimento, onde a quantidade é conferida antes de virar estoque.

import { useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, ArrowRight, ClipboardList, ShoppingCart, Search, Flame,
  Download, ScrollText,
} from "lucide-react";
import { dataCurta, ymdLocal, moedaCheia } from "../../lib/format.js";
import { StatCard, Empty, Modal, Card } from "../ui.jsx";
import {
  STATUS_PEDIDO, PROXIMO_PEDIDO, ModalRecebimento, temValor,
  numeroOuNull, paraCampoNum, fmtQtd, comUnidade, entradaDoPedido,
} from "./comum.jsx";
import {
  CATEGORIAS_SOLICITACAO, URGENCIAS, SETORES, agruparPorCategoria, rotuloCategoria, rotuloUrgencia,
} from "../../../supabase/functions/_shared/compras-solicitacao.mjs";
import { TagSituacao, COR_URGENCIA } from "./AbaSolicitacao.jsx";

// "Em aberto" ou "Todas": a escolha sobrevive ao recarregar da página.
const K_FILTRO = "ml_compras_pedidos_filtro";
const FINAL = new Set(["recebida", "cancelada"]);

export const PEDIDO_VAZIO = {
  id: "", item: "", qtde: "", fornecedor: "", valor: "", status: "solicitada",
  solicitante: "", data: "", dataRecebida: "", os: "", obs: "",
  produtoId: "", ordemId: "", qtdeRecebida: "",
  detalhes: "", categoria: "outros", urgencia: "media", setor: "", solicitanteUsuario: "",
};

function Linha({ salvando, c, editavel, acoes, marcado, aoMarcar }) {
  const Icone = c.st.icone;
  const final = FINAL.has(c.status);
  const proxima = PROXIMO_PEDIDO[c.status];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors ${c.status === "cancelada" ? "bg-slate-50" : marcado ? "border-brand-300 bg-brand-50" : ""}`}
      style={marcado ? undefined : { borderColor: "var(--hairline)" }}
    >
      {editavel && (
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-brand-600 disabled:opacity-30"
          checked={marcado}
          disabled={final}
          onChange={(e) => aoMarcar(c.id, e.target.checked)}
          aria-label={`Marcar ${c.item}`}
        />
      )}
      <Icone size={17} strokeWidth={2.2} className={`shrink-0 ${c.st.cor}`} title={c.st.rotulo} />

      <span className="min-w-0 flex-1 basis-56">
        <span className={`block break-words font-display text-sm font-medium text-slate-900 ${c.status === "cancelada" ? "line-through" : ""}`}>
          {c.item}
          {c.qtde ? <span className="font-normal text-slate-500"> — {c.qtde}</span> : null}
        </span>
        {c.detalhes && <span className="block break-words text-xs text-slate-600">{c.detalhes}</span>}
        <span className="block break-words text-xs text-slate-500">
          {[
            c.solicitante && `pedido por ${c.solicitante}`,
            c.setor,
            c.fornecedor,
            c.produtoNome && `estoque: ${c.produtoNome}`,
            c.recebida !== null && `recebido ${fmtQtd(c.recebida)}`,
            c.status === "cancelada" && c.motivoRecusa && `motivo: ${c.motivoRecusa}`,
            c.obs,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      <span className={`shrink-0 text-xs ${COR_URGENCIA[c.urgencia] || "text-slate-500"}`} title="Urgência">{rotuloUrgencia(c.urgencia)}</span>
      <span className="shrink-0"><TagSituacao status={c.status} /></span>
      {c.ordemNumero && (
        <span className="chip shrink-0 whitespace-nowrap" title="Está numa ordem de compra">
          <ScrollText size={12} strokeWidth={2.4} className="mr-1" />
          OC {c.ordemNumero}
        </span>
      )}
      {c.os && <span className="chip-brand shrink-0 whitespace-nowrap">O.S. {c.os}</span>}

      <span className="shrink-0 text-right">
        <span className="block font-display text-sm font-medium tnum text-slate-900">
          {temValor(c) ? moedaCheia(c.valor) : <span className="text-xs font-normal text-slate-400">sem valor</span>}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
          {c.data ? dataCurta(c.data) : "sem data"}
          {c.dataRecebida ? ` · recebida ${dataCurta(c.dataRecebida)}` : ""}
        </span>
      </span>

      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          {/* Avançar uma etapa sem abrir formulário: é o clique mais comum
              desta tela. Recebida e recusada não têm para onde ir. */}
          {proxima && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => acoes.avancarPedido(c.id)}
              aria-label={`${proxima === "recebida" ? "Conferir recebimento" : `Avançar para ${STATUS_PEDIDO[proxima].rotulo}`}: ${c.item}`}
              title={
                proxima === "recebida"
                  ? "Marcar recebida (confere a quantidade antes de entrar no estoque)"
                  : `Avançar para ${STATUS_PEDIDO[proxima].rotulo}`
              }
              className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
            >
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          )}
          <button
            type="button"
            disabled={salvando}
            onClick={() => acoes.abrirPedido(c.id)}
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
            aria-label={`Editar pedido: ${c.item}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => acoes.removerPedido(c.id)}
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
            title="Apagar"
            aria-label={`Apagar pedido: ${c.item}`}
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

function ModalRecusa({ quantos, salvando, aoConfirmar, aoFechar }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Modal titulo={`Recusar ${quantos} ${quantos === 1 ? "item" : "itens"}`} aberto aoFechar={aoFechar}>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (motivo.trim() && !salvando) aoConfirmar(motivo.trim()); }}
      >
        <div>
          <label className="label" htmlFor="recusa-motivo">Motivo (quem pediu vai ler no sino)</label>
          <textarea id="recusa-motivo" className="input" rows={3} maxLength={300} autoFocus required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: já tem no estoque, é só retirar." />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Voltar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !motivo.trim()}>{salvando ? "Gravando…" : "Recusar"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function FormPedido({ form, setForm, produtos, entrada, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  /* Com a entrada já carimbada no livro, a quantidade recebida vira LEITURA.
     Deixá-la editável criava uma segunda verdade calada: corrigir 10 para 7
     aqui fazia a tela dizer 7 e o saldo continuar 10. O conserto é um AJUSTE,
     que fica registrado — o livro do estoque é append-only. */
  const unidadeEntrada = entrada ? produtos.find((p) => p.id === entrada.produtoId)?.unidade || "" : "";

  const opcoes = produtos.filter((p) => p.ativo !== false);
  // Pedido antigo pode apontar para produto desativado: o select precisa
  // continuar mostrando, senão editar qualquer outro campo trocaria o vínculo
  // sem ninguém pedir.
  if (form.produtoId && !opcoes.some((p) => p.id === form.produtoId)) {
    const antigo = produtos.find((p) => p.id === form.produtoId);
    opcoes.push(
      antigo ? { ...antigo, nome: `${antigo.nome} (desativado)` } : { id: form.produtoId, nome: "(produto fora do cadastro)" }
    );
  }

  return (
    <Modal titulo={form.id ? "Editar pedido" : "Novo pedido de compra"} aberto={!!form} aoFechar={aoFechar}>
      <form
        aria-busy={salvando}
        onSubmit={(e) => {
          e.preventDefault();
          if (salvando) return;
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="cp-item">Item</label>
          <input id="cp-item" type="text" className="input" value={form.item} onChange={setCampo("item")} autoFocus required />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:min-w-0">
          <div>
            <label className="label" htmlFor="cp-det">Detalhes (tamanho, marca, cor…)</label>
            <input id="cp-det" type="text" className="input" value={form.detalhes} onChange={setCampo("detalhes")} maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="cp-cat">Categoria</label>
            <select id="cp-cat" className="select" value={form.categoria} onChange={setCampo("categoria")}>
              {Object.entries(CATEGORIAS_SOLICITACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cp-urg">Urgência</label>
            <select id="cp-urg" className="select" value={form.urgencia} onChange={setCampo("urgencia")}>
              {["baixa", "media", "alta"].map((u) => <option key={u} value={u}>{URGENCIAS[u]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cp-setor">Setor</label>
            <select id="cp-setor" className="select" value={form.setor} onChange={setCampo("setor")}>
              <option value="">—</option>
              {[...new Set([...SETORES, form.setor].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cp-prod">Produto do estoque (opcional)</label>
          <select id="cp-prod" className="select" value={form.produtoId} onChange={setCampo("produtoId")}>
            <option value="">— não vinculado —</option>
            {opcoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.unidade || "un"})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Vinculado, o recebimento já sabe onde dar entrada. Sem vínculo, dá para escolher na hora.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:min-w-0">
          <div>
            <label className="label" htmlFor="cp-qtde">Quantidade</label>
            <input id="cp-qtde" type="text" className="input" placeholder="ex.: 2 cx" value={form.qtde} onChange={setCampo("qtde")} />
          </div>
          <div>
            <label className="label" htmlFor="cp-forn">Fornecedor</label>
            <input id="cp-forn" type="text" className="input" value={form.fornecedor} onChange={setCampo("fornecedor")} />
          </div>
          <div>
            <label className="label" htmlFor="cp-valor">Valor (R$)</label>
            <input id="cp-valor" type="text" inputMode="decimal" className="input" placeholder="0,00" value={form.valor} onChange={setCampo("valor")} />
          </div>
          <div>
            <label className="label" htmlFor="cp-status">Situação</label>
            <select id="cp-status" className="select" value={form.status} onChange={setCampo("status")}>
              {Object.entries(STATUS_PEDIDO).map(([valor, s]) => (
                <option key={valor} value={valor}>{s.rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cp-solic">Solicitante</label>
            {/* Veio de "Solicitar material": o nome é o carimbo do login, não se troca. */}
            <input id="cp-solic" type="text" className="input read-only:bg-slate-50 read-only:text-slate-500" value={form.solicitante} onChange={setCampo("solicitante")} readOnly={!!form.solicitanteUsuario} />
          </div>
          <div>
            <label className="label" htmlFor="cp-data">Data da solicitação</label>
            <input id="cp-data" type="date" className="input" value={form.data} onChange={setCampo("data")} />
          </div>
          <div>
            <label className="label" htmlFor="cp-os">Para a O.S.</label>
            <input id="cp-os" type="text" className="input" placeholder="opcional" value={form.os} onChange={setCampo("os")} />
          </div>
          <div>
            <label className="label" htmlFor="cp-recebida">Quantidade recebida</label>
            <input
              id="cp-recebida" type="text" inputMode="decimal"
              className="input disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="em branco = ainda não chegou"
              value={form.qtdeRecebida} onChange={setCampo("qtdeRecebida")}
              disabled={!!entrada}
            />
            {entrada && (
              <p className="mt-1 text-xs text-slate-500">
                entrou no estoque: {comUnidade(Math.abs(Number(entrada.quantidade) || 0), unidadeEntrada)}
                {entrada.data ? ` em ${dataCurta(entrada.data)}` : ""} — corrija por um ajuste na aba Estoque.
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cp-obs">Observações</label>
          <textarea id="cp-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.item.trim()}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaPedidos({
  pedidos, produtos, ordens, movs, editavel, salvando,
  formPedido, setFormPedido, recebendo, acoes, aoExportar,
}) {
  const [recorte, setRecorte] = useState(null); // "novas" | "alta" | "cotando" | "comprada" | null
  const [filtro, setFiltro] = useState(() => {
    try { return localStorage.getItem(K_FILTRO) === "todas" ? "todas" : "abertas"; } catch { return "abertas"; }
  });
  const [marcados, setMarcados] = useState(() => new Set());
  const [recusando, setRecusando] = useState(false);

  const vm = useMemo(() => {
    const nomeProduto = new Map(produtos.map((p) => [p.id, p.nome]));
    const numeroOrdem = new Map(ordens.map((o) => [o.id, o.numero]));
    const todos = pedidos.map((c) => ({
      ...c,
      st: STATUS_PEDIDO[c.status] || STATUS_PEDIDO.solicitada,
      produtoNome: c.produtoId ? nomeProduto.get(c.produtoId) || "produto fora do cadastro" : "",
      ordemNumero: c.ordemId ? numeroOrdem.get(c.ordemId) || "?" : "",
      // Ausente é ausente: pedido que não chegou não "recebeu 0".
      recebida: numeroOuNull(c.qtdeRecebida),
    }));
    const abertos = todos.filter((c) => !FINAL.has(c.status));
    return {
      todos,
      novas: todos.filter((c) => c.status === "solicitada").length,
      alta: abertos.filter((c) => c.urgencia === "alta").length,
      cotando: todos.filter((c) => c.status === "cotando").length,
      comprada: todos.filter((c) => c.status === "comprada").length,
    };
  }, [pedidos, produtos, ordens]);

  const lista = vm.todos.filter((c) => {
    if (recorte === "novas") return c.status === "solicitada";
    if (recorte === "alta") return c.urgencia === "alta" && !FINAL.has(c.status);
    if (recorte === "cotando") return c.status === "cotando";
    if (recorte === "comprada") return c.status === "comprada";
    return filtro === "todas" || !FINAL.has(c.status);
  });
  const grupos = agruparPorCategoria(lista);
  // Marcado que saiu da tela (filtro, recarga, outra pessoa mudou) não conta.
  const idsVisiveis = new Set(lista.filter((c) => !FINAL.has(c.status)).map((c) => c.id));
  const sel = [...marcados].filter((id) => idsVisiveis.has(id));

  const marcar = (id, sim) => setMarcados((m) => { const n = new Set(m); if (sim) n.add(id); else n.delete(id); return n; });
  const marcarGrupo = (itens, sim) => setMarcados((m) => {
    const n = new Set(m);
    for (const c of itens) if (!FINAL.has(c.status)) { if (sim) n.add(c.id); else n.delete(c.id); }
    return n;
  });
  const lote = async (status, motivo = "") => {
    if (!sel.length) return;
    const ok = status === "recebida" ? acoes.receberVarios(sel) : await acoes.situacaoLote(sel, status, motivo);
    if (ok !== false) setMarcados(new Set());
    setRecusando(false);
  };
  const trocarFiltro = (v) => {
    setFiltro(v);
    setRecorte(null);
    try { localStorage.setItem(K_FILTRO, v); } catch { /* sem localStorage a escolha só não persiste */ }
  };
  const alternarRecorte = (r) => setRecorte((atual) => (atual === r ? null : r));

  const exportar = () =>
    aoExportar({
      nome: "pedidos-de-compra",
      titulo: `Pedidos de compra${recorte ? "" : filtro === "abertas" ? " — em aberto" : ""}`,
      colunas: [
        { chave: "categoria", rotulo: "Categoria", tipo: "texto" },
        { chave: "item", rotulo: "Produto", tipo: "texto" },
        { chave: "detalhes", rotulo: "Detalhes", tipo: "texto" },
        { chave: "qtde", rotulo: "Quantidade pedida", tipo: "texto" },
        { chave: "urgencia", rotulo: "Urgência", tipo: "texto" },
        { chave: "solicitante", rotulo: "Quem pediu", tipo: "texto" },
        { chave: "setor", rotulo: "Setor", tipo: "texto" },
        { chave: "data", rotulo: "Solicitado em", tipo: "data" },
        { chave: "situacao", rotulo: "Situação", tipo: "texto" },
        { chave: "recebida", rotulo: "Quantidade recebida", tipo: "numero" },
        { chave: "produto", rotulo: "Produto do estoque", tipo: "texto" },
        { chave: "fornecedor", rotulo: "Fornecedor", tipo: "texto" },
        { chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
        { chave: "dataRecebida", rotulo: "Recebido em", tipo: "data" },
        { chave: "ordem", rotulo: "Ordem de compra", tipo: "texto" },
        { chave: "os", rotulo: "O.S.", tipo: "texto" },
        { chave: "obs", rotulo: "Observações", tipo: "texto" },
      ],
      // Valor ausente vai VAZIO, não 0: a coluna vai ser somada.
      linhas: grupos.flatMap((g) => g.itens).map((c) => ({
        categoria: rotuloCategoria(c.categoria),
        item: c.item || "",
        detalhes: c.detalhes || null,
        qtde: c.qtde || null,
        urgencia: rotuloUrgencia(c.urgencia),
        solicitante: c.solicitante || null,
        setor: c.setor || null,
        data: c.data || null,
        situacao: c.status === "cancelada" ? "Recusada" : c.st.rotulo,
        recebida: c.recebida,
        produto: c.produtoNome || null,
        fornecedor: c.fornecedor || null,
        valor: temValor(c) ? Number(c.valor) : null,
        dataRecebida: c.dataRecebida || null,
        ordem: c.ordemNumero ? `OC ${c.ordemNumero}` : null,
        os: c.os || null,
        obs: [c.obs, c.motivoRecusa && `Motivo da recusa: ${c.motivoRecusa}`].filter(Boolean).join(" · ") || null,
      })),
    });

  // O modal resolve os pedidos AGORA, pelo id: guardar o objeto de quando o
  // botão foi clicado receberia de volta um pedido velho se a lista recarregou
  // no meio.
  const pedidosRecebendo = recebendo ? pedidos.filter((p) => recebendo.pedidoIds.includes(p.id)) : [];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Novas solicitações" valor={String(vm.novas)} sub="esperando quem compra" tom={vm.novas ? "brand" : "neutral"} icone={ClipboardList} onClick={() => alternarRecorte("novas")} ativo={recorte === "novas"} />
        <StatCard rotulo="Urgência alta" valor={String(vm.alta)} sub="em aberto" tom={vm.alta ? "bad" : "neutral"} icone={Flame} onClick={() => alternarRecorte("alta")} ativo={recorte === "alta"} />
        <StatCard rotulo="Em cotação" valor={String(vm.cotando)} sub="pedindo preço" tom={vm.cotando ? "warn" : "neutral"} icone={Search} onClick={() => alternarRecorte("cotando")} ativo={recorte === "cotando"} />
        <StatCard rotulo="Compradas" valor={String(vm.comprada)} sub="aguardando chegar" tom="neutral" icone={ShoppingCart} onClick={() => alternarRecorte("comprada")} ativo={recorte === "comprada"} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-900">Solicitações da equipe — agrupadas para a compra</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="ped-filtro">Mostrar</label>
            <select id="ped-filtro" className="select min-h-11 w-auto" value={filtro} onChange={(e) => trocarFiltro(e.target.value)}>
              <option value="abertas">Em aberto</option>
              <option value="todas">Todas</option>
            </select>
            <button type="button" className="btn-outline min-h-11 disabled:cursor-not-allowed disabled:opacity-50" onClick={exportar} disabled={!lista.length}>
              <Download size={16} strokeWidth={2.2} /> Baixar planilha
            </button>
            {editavel && (
              <button type="button" className="btn-primary min-h-11" onClick={() => acoes.abrirPedido(null)}>
                <Plus size={16} strokeWidth={2.5} /> Novo pedido
              </button>
            )}
          </div>
        </div>
        <p className="mb-2 mt-2 text-xs text-slate-500">
          Agrupadas por categoria, como uma lista de compras: papelaria numa ida, mercado em outra.
          {editavel ? " Marque vários e mude a situação de uma vez — quem pediu é avisado no sino." : ""}
        </p>

        {recorte && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p role="status" className="text-sm text-brand-800">Filtro ativo: {({ novas: "Novas solicitações", alta: "Urgência alta", cotando: "Em cotação", comprada: "Compradas" })[recorte]}.</p>
            <button type="button" className="btn-outline min-h-11" onClick={() => setRecorte(null)}>Limpar filtro</button>
          </div>
        )}

        {grupos.length === 0 && (
          <Empty>{recorte || filtro === "abertas" ? "Nada em aberto por aqui. 🎉" : "Nenhum pedido de compra ainda."}</Empty>
        )}

        <div className="space-y-5">
          {grupos.map((g) => {
            const abertos = g.itens.filter((c) => !FINAL.has(c.status));
            const todosMarcados = abertos.length > 0 && abertos.every((c) => marcados.has(c.id));
            return (
              <section key={g.categoria} aria-label={g.rotulo}>
                <h3 className="mb-2 mt-3 flex items-center gap-2 font-display text-sm font-semibold text-brand-ink">
                  {editavel && abertos.length > 0 && (
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={todosMarcados} onChange={(e) => marcarGrupo(g.itens, e.target.checked)} aria-label={`Marcar todos de ${g.rotulo}`} />
                  )}
                  {g.rotulo} <span className="font-normal text-slate-400">· {g.itens.length}</span>
                </h3>
                <div className="space-y-2">
                  {g.itens.map((c) => (
                    <Linha key={c.id} salvando={salvando} c={c} editavel={editavel} acoes={acoes} marcado={marcados.has(c.id)} aoMarcar={marcar} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Card>

      {/* A barra de lote só aparece com algo marcado e fica grudada no rodapé:
          no celular, a lista é longa e o botão não pode ficar lá em cima. */}
      {editavel && sel.length > 0 && (
        <div className="sticky bottom-3 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-white p-3 shadow-card-hover">
          <span className="text-sm font-medium text-slate-700" role="status">{sel.length} {sel.length > 1 ? "itens marcados" : "item marcado"}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline min-h-11" disabled={salvando} onClick={() => setMarcados(new Set())}>Desmarcar</button>
            <button type="button" className="btn-outline min-h-11 text-bad-700" disabled={salvando} onClick={() => setRecusando(true)}>Recusar…</button>
            <button type="button" className="btn-outline min-h-11" disabled={salvando} onClick={() => lote("cotando")}>Em cotação</button>
            <button type="button" className="btn-outline min-h-11" disabled={salvando} onClick={() => lote("comprada")}>Comprada</button>
            <button type="button" className="btn-primary min-h-11" disabled={salvando} onClick={() => lote("recebida")}>Recebida</button>
          </div>
        </div>
      )}

      {recusando && (
        <ModalRecusa quantos={sel.length} salvando={salvando} aoConfirmar={(motivo) => lote("cancelada", motivo)} aoFechar={() => setRecusando(false)} />
      )}

      <FormPedido
        form={formPedido}
        setForm={setFormPedido}
        produtos={produtos}
        // A entrada é procurada AGORA, pelo id do pedido em edição: a mesma
        // régua que a casca usa para recusar recebimento repetido.
        entrada={entradaDoPedido(movs, formPedido?.id)}
        salvando={salvando}
        aoSalvar={acoes.salvarPedido}
        aoFechar={() => setFormPedido(null)}
      />

      {pedidosRecebendo.length > 0 && (
        <ModalRecebimento
          key={recebendo.pedidoIds.join("|")}
          pedidos={pedidosRecebendo}
          produtos={produtos}
          salvando={salvando}
          aoConfirmar={acoes.confirmarRecebimento}
          aoSoMarcar={acoes.soMarcarRecebida}
          aoFechar={acoes.fecharRecebimento}
        />
      )}
    </div>
  );
}

/* Semente do formulário do pedido. Campo a campo, e não um spread do registro:
   um `obs: null` vindo do banco viraria form.obs.trim() e derrubaria a tela.
   Os números voltam como TEXTO do jeito que se digita — e zero volta como "0":
   paraCampo(0) devolveria "" e apagaria uma quantidade recebida zero (chegou
   nada) lançada de propósito.
   O que a gravação preserva do registro velho é responsabilidade da casca, que
   relê o pedido pelo id antes de gravar. */
export const pedidoParaForm = (c) =>
  c
    ? {
        id: c.id,
        item: c.item || "",
        qtde: c.qtde || "",
        fornecedor: c.fornecedor || "",
        valor: paraCampoNum(c.valor),
        status: c.status || "solicitada",
        solicitante: c.solicitante || "",
        data: c.data || "",
        dataRecebida: c.dataRecebida || "",
        os: c.os || "",
        obs: c.obs || "",
        produtoId: c.produtoId || "",
        ordemId: c.ordemId || "",
        qtdeRecebida: paraCampoNum(c.qtdeRecebida),
        detalhes: c.detalhes || "",
        categoria: c.categoria || "outros",
        urgencia: c.urgencia || "media",
        setor: c.setor || "",
        solicitanteUsuario: c.solicitanteUsuario || "",
      }
    : { ...PEDIDO_VAZIO, data: ymdLocal(new Date()) };
