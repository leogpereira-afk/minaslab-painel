// Aba Pedidos — a resposta da pergunta nº 2: O QUE JÁ FOI PEDIDO E NÃO CHEGOU.
// O fluxo anda numa direção só (solicitada → em cotação → comprada → recebida)
// e a tela é organizada por ele: cada etapa é um grupo, e a seta empurra o
// pedido para a próxima sem abrir formulário. Canceladas ficam por último,
// recolhidas — são história, não trabalho.
//
// A ÚNICA mudança de rumo: chegar em "recebida" passa pelo modal de
// recebimento, onde a quantidade é conferida antes de virar estoque.

import { useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, ArrowRight, ClipboardList, ShoppingCart, PackageCheck,
  HandCoins, Download, ChevronDown, ChevronRight, ScrollText,
} from "lucide-react";
import { dataCurta, ymdLocal, moedaCheia, MESES_LONGOS } from "../../lib/format.js";
import { StatCard, Empty, Modal, Card } from "../ui.jsx";
import {
  STATUS_PEDIDO, FLUXO_PEDIDO, PROXIMO_PEDIDO, ModalRecebimento, temValor,
  numeroOuNull, paraCampoNum, fmtQtd, comUnidade, entradaDoPedido,
} from "./comum.jsx";

// A escolha de ver (ou não) as canceladas sobrevive ao recarregar da página.
const K_CANCELADAS = "ml_compras_canceladas";

export const PEDIDO_VAZIO = {
  id: "", item: "", qtde: "", fornecedor: "", valor: "", status: "solicitada",
  solicitante: "", data: "", dataRecebida: "", os: "", obs: "",
  produtoId: "", ordemId: "", qtdeRecebida: "",
};

function Linha({ c, editavel, acoes }) {
  const Icone = c.st.icone;
  const cancelada = c.status === "cancelada";
  const proxima = PROXIMO_PEDIDO[c.status];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors ${cancelada ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--hairline)" }}
    >
      <Icone size={17} strokeWidth={2.2} className={`shrink-0 ${c.st.cor}`} title={c.st.rotulo} />

      <span className="min-w-0 flex-1 basis-48">
        <span className={`block truncate font-display text-sm font-medium text-slate-900 ${cancelada ? "line-through" : ""}`}>
          {c.item}
          {c.qtde ? <span className="font-normal text-slate-500"> — {c.qtde}</span> : null}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[
            c.fornecedor,
            c.solicitante && `pedido por ${c.solicitante}`,
            c.produtoNome && `estoque: ${c.produtoNome}`,
            c.recebida !== null && `recebido ${fmtQtd(c.recebida)}`,
            c.obs,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

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
              desta tela. Recebida e cancelada não têm para onde ir. */}
          {proxima && (
            <button
              type="button"
              onClick={() => acoes.avancarPedido(c.id)}
              title={
                proxima === "recebida"
                  ? "Marcar recebida (confere a quantidade antes de entrar no estoque)"
                  : `Avançar para ${STATUS_PEDIDO[proxima].rotulo}`
              }
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
            >
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          )}
          <button
            type="button"
            onClick={() => acoes.abrirPedido(c.id)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => acoes.removerPedido(c.id)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
            title="Apagar"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
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
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="cp-item">Item</label>
          <input id="cp-item" type="text" className="input" value={form.item} onChange={setCampo("item")} autoFocus required />
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
        <div className="grid grid-cols-2 gap-3">
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
            <input id="cp-solic" type="text" className="input" value={form.solicitante} onChange={setCampo("solicitante")} />
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
        <div className="flex justify-end gap-2">
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
  pedidos, produtos, ordens, movs, hojeISO, editavel, salvando,
  formPedido, setFormPedido, recebendo, acoes, aoExportar,
}) {
  const [recorte, setRecorte] = useState(null); // "abertas" | "receber" | "mes" | null
  const [verCanceladas, setVerCanceladas] = useState(() => {
    try {
      return localStorage.getItem(K_CANCELADAS) === "1";
    } catch {
      return false;
    }
  });

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

    const mes = hojeISO.slice(0, 7);
    const noMes = (dia) => String(dia || "").slice(0, 7) === mes;

    /* Nos grupos em andamento, a solicitação mais antiga vem primeiro — é a
       que espera há mais tempo. Recebidas e canceladas, o mais recente. */
    const porData = (a, b) =>
      String(a.data || "9999").localeCompare(String(b.data || "9999")) ||
      String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""));

    const grupos = FLUXO_PEDIDO.map((status) => ({
      status,
      nome: STATUS_PEDIDO[status].rotulo,
      itens: todos
        .filter((c) => c.status === status)
        .sort(
          status === "recebida"
            ? (a, b) => String(b.dataRecebida || "").localeCompare(String(a.dataRecebida || ""))
            : porData
        ),
    })).filter((g) => g.itens.length > 0);

    const canceladas = todos.filter((c) => c.status === "cancelada").sort((a, b) => porData(b, a));

    const recebidasMes = todos.filter((c) => c.status === "recebida" && noMes(c.dataRecebida));
    const comValor = recebidasMes.filter(temValor);

    return {
      grupos,
      canceladas,
      abertas: todos.filter((c) => c.status === "solicitada" || c.status === "cotando").length,
      receber: todos.filter((c) => c.status === "comprada").length,
      recebidasMes: recebidasMes.length,
      // null = nenhuma recebida com valor no mês; a tela escreve "sem registro"
      // em vez de somar um zero que não existe.
      gasto: comValor.length ? comValor.reduce((s, c) => s + (Number(c.valor) || 0), 0) : null,
      noMes,
    };
  }, [pedidos, produtos, ordens, hojeISO]);

  const alternarCanceladas = () =>
    setVerCanceladas((v) => {
      const novo = !v;
      try {
        localStorage.setItem(K_CANCELADAS, novo ? "1" : "0");
      } catch {
        /* sem localStorage a escolha só não persiste */
      }
      return novo;
    });

  const mesNome = MESES_LONGOS[Number(hojeISO.slice(5, 7)) - 1];

  const gruposVisiveis =
    recorte === "abertas"
      ? vm.grupos.filter((g) => g.status === "solicitada" || g.status === "cotando")
      : recorte === "receber"
        ? vm.grupos.filter((g) => g.status === "comprada")
        : recorte === "mes"
          ? vm.grupos
              .filter((g) => g.status === "recebida")
              .map((g) => ({
                ...g,
                nome: `Recebidas em ${mesNome}`,
                itens: g.itens.filter((c) => vm.noMes(c.dataRecebida)),
              }))
              .filter((g) => g.itens.length > 0)
          : vm.grupos;

  // Sai o RECORTE VISÍVEL — inclusive as canceladas, se estiverem abertas.
  const linhasVisiveis = [
    ...gruposVisiveis.flatMap((g) => g.itens),
    ...(!recorte && verCanceladas ? vm.canceladas : []),
  ];

  const exportar = () =>
    aoExportar({
      nome: "pedidos-de-compra",
      titulo: `Pedidos de compra${
        recorte === "abertas"
          ? " — em aberto"
          : recorte === "receber"
            ? " — comprados, aguardando chegada"
            : recorte === "mes"
              ? ` — recebidos em ${mesNome}`
              : ""
      }`,
      colunas: [
        { chave: "item", rotulo: "Item", tipo: "texto" },
        { chave: "qtde", rotulo: "Quantidade pedida", tipo: "texto" },
        { chave: "recebida", rotulo: "Quantidade recebida", tipo: "numero" },
        { chave: "produto", rotulo: "Produto do estoque", tipo: "texto" },
        { chave: "fornecedor", rotulo: "Fornecedor", tipo: "texto" },
        { chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
        { chave: "situacao", rotulo: "Situação", tipo: "texto" },
        { chave: "solicitante", rotulo: "Solicitante", tipo: "texto" },
        { chave: "data", rotulo: "Solicitado em", tipo: "data" },
        { chave: "dataRecebida", rotulo: "Recebido em", tipo: "data" },
        { chave: "ordem", rotulo: "Ordem de compra", tipo: "texto" },
        { chave: "os", rotulo: "O.S.", tipo: "texto" },
        { chave: "obs", rotulo: "Observações", tipo: "texto" },
      ],
      // Valor ausente vai VAZIO, não 0: a coluna vai ser somada.
      linhas: linhasVisiveis.map((c) => ({
        item: c.item || "",
        qtde: c.qtde || null,
        recebida: c.recebida,
        produto: c.produtoNome || null,
        fornecedor: c.fornecedor || null,
        valor: temValor(c) ? Number(c.valor) : null,
        situacao: c.st.rotulo,
        solicitante: c.solicitante || null,
        data: c.data || null,
        dataRecebida: c.dataRecebida || null,
        ordem: c.ordemNumero ? `OC ${c.ordemNumero}` : null,
        os: c.os || null,
        obs: c.obs || null,
      })),
    });

  // O modal resolve os pedidos AGORA, pelo id: guardar o objeto de quando o
  // botão foi clicado receberia de volta um pedido velho se a lista recarregou
  // no meio.
  const pedidosRecebendo = recebendo ? pedidos.filter((p) => recebendo.pedidoIds.includes(p.id)) : [];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Abertas"
          valor={String(vm.abertas)}
          sub="solicitadas e em cotação"
          tom={vm.abertas > 0 ? "brand" : "neutral"}
          icone={ClipboardList}
          onClick={() => setRecorte(recorte === "abertas" ? null : "abertas")}
          ativo={recorte === "abertas"}
        />
        <StatCard
          rotulo="Para receber"
          valor={String(vm.receber)}
          sub="compradas, aguardando chegada"
          tom={vm.receber > 0 ? "warn" : "neutral"}
          icone={ShoppingCart}
          onClick={() => setRecorte(recorte === "receber" ? null : "receber")}
          ativo={recorte === "receber"}
        />
        <StatCard
          rotulo="Recebidas no mês"
          valor={String(vm.recebidasMes)}
          sub={`em ${mesNome}`}
          tom="ok"
          icone={PackageCheck}
          onClick={() => setRecorte(recorte === "mes" ? null : "mes")}
          ativo={recorte === "mes"}
        />
        <StatCard
          rotulo="Gasto no mês"
          valor={vm.gasto === null ? "sem registro" : moedaCheia(vm.gasto)}
          sub={`recebidas em ${mesNome}`}
          tom="neutral"
          icone={HandCoins}
        />
      </div>

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn-outline disabled:cursor-not-allowed disabled:opacity-50"
          onClick={exportar}
          disabled={linhasVisiveis.length === 0}
          title={linhasVisiveis.length === 0 ? "Nada na tela para baixar" : undefined}
        >
          <Download size={16} strokeWidth={2.2} /> Baixar planilha
        </button>
        {editavel && (
          <button type="button" className="btn-primary" onClick={() => acoes.abrirPedido(null)}>
            <Plus size={16} strokeWidth={2.5} /> Novo pedido
          </button>
        )}
      </div>

      {gruposVisiveis.length === 0 && (
        <Empty>
          {recorte
            ? "Nada neste recorte. Clique de novo no cartão para ver tudo."
            : "Nenhum pedido de compra por aqui. Registre o primeiro no botão lá em cima."}
        </Empty>
      )}

      <div className="space-y-6">
        {gruposVisiveis.map((g) => (
          <Card key={g.status}>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.nome} <span className="text-slate-400">({g.itens.length})</span>
            </h2>
            <div className="space-y-2">
              {g.itens.map((c) => (
                <Linha key={c.id} c={c} editavel={editavel} acoes={acoes} />
              ))}
            </div>
          </Card>
        ))}

        {/* Canceladas são história: ficam por último e recolhidas por padrão.
            A escolha de abrir fica guardada — quem revisa cancelamento toda
            semana não quer clicar toda vez. */}
        {!recorte && vm.canceladas.length > 0 && (
          <Card>
            <button
              type="button"
              onClick={alternarCanceladas}
              aria-expanded={verCanceladas}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
                Canceladas <span className="text-slate-400">({vm.canceladas.length})</span>
              </h2>
              {verCanceladas ? (
                <ChevronDown size={16} className="text-slate-400" />
              ) : (
                <ChevronRight size={16} className="text-slate-400" />
              )}
            </button>
            {verCanceladas && (
              <div className="mt-3 space-y-2">
                {vm.canceladas.map((c) => (
                  <Linha key={c.id} c={c} editavel={editavel} acoes={acoes} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

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
      }
    : { ...PEDIDO_VAZIO, data: ymdLocal(new Date()) };
