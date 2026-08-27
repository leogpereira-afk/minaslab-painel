// Compras — os pedidos de compra do laboratório, da solicitação ao
// recebimento. O fluxo anda numa direção só (solicitada → em cotação →
// comprada → recebida) e a tela é organizada por ele: cada etapa é um grupo,
// e o botão de avançar empurra o pedido para a próxima sem abrir formulário.
// Canceladas ficam por último, recolhidas — são história, não trabalho.
//
// Segue o exemplar (Compromissos.jsx): linha e formulário declarados FORA do
// componente da página; datas sempre ymdLocal; aviso no sucesso E no erro;
// depois de gravar, recarrega do servidor.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, ArrowRight, ClipboardList, Search, ShoppingCart,
  PackageCheck, XCircle, HandCoins, ChevronDown, ChevronRight,
} from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import {
  dataCurta, ymdLocal, moedaCheia, paraNumero, MESES_LONGOS,
} from "../lib/format.js";
import {
  PageTitle, StatCard, Empty, CarregandoModulo, ErroModulo, Aviso, Modal, Card,
} from "../components/ui.jsx";

const COLECAO = "compras";
// A escolha de ver (ou não) as canceladas sobrevive ao recarregar da página.
const K_CANCELADAS = "ml_compras_canceladas";

// O ícone diz a etapa antes de a pessoa ler o cabeçalho do grupo.
const STATUS = {
  solicitada: { rotulo: "Solicitada", icone: ClipboardList, cor: "text-slate-500" },
  cotando: { rotulo: "Em cotação", icone: Search, cor: "text-warn-700" },
  comprada: { rotulo: "Comprada", icone: ShoppingCart, cor: "text-brand-600" },
  recebida: { rotulo: "Recebida", icone: PackageCheck, cor: "text-ok-700" },
  cancelada: { rotulo: "Cancelada", icone: XCircle, cor: "text-bad-700" },
};

const FLUXO = ["solicitada", "cotando", "comprada", "recebida"];
const PROXIMO = { solicitada: "cotando", cotando: "comprada", comprada: "recebida" };

const VAZIO = {
  id: "", item: "", qtde: "", fornecedor: "", valor: "", status: "solicitada",
  solicitante: "", data: "", dataRecebida: "", os: "", obs: "",
};

// Valor ausente não é zero: compra sem preço registrado mostra "sem valor",
// e não entra na soma do mês como R$ 0.
const temValor = (c) => c.valor !== "" && c.valor !== null && c.valor !== undefined;

function Linha({ c, editavel, acoes }) {
  const Icone = c.st.icone;
  const cancelada = c.status === "cancelada";
  const proxima = PROXIMO[c.status];
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
          {[c.fornecedor, c.solicitante && `pedido por ${c.solicitante}`, c.obs].filter(Boolean).join(" · ")}
        </span>
      </span>

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
              onClick={() => acoes.avancar(c)}
              title={`Avançar para ${STATUS[proxima].rotulo}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
            >
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          )}
          <button
            type="button"
            onClick={() => acoes.abrirForm(c)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => acoes.remover(c)}
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

function FormCompra({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <Modal titulo={form.id ? "Editar compra" : "Nova compra"} aberto={!!form} aoFechar={aoFechar}>
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
              {Object.entries(STATUS).map(([valor, s]) => (
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

export default function Compras() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // Os cartões viram recorte: clicar filtra a lista; clicar de novo volta.
  const [recorte, setRecorte] = useState(null); // "abertas" | "receber" | "mes" | null
  const [verCanceladas, setVerCanceladas] = useState(() => {
    try {
      return localStorage.getItem(K_CANCELADAS) === "1";
    } catch {
      return false;
    }
  });
  // "Hoje" é ESTADO, não conta do render: a tela fica aberta de um dia para o
  // outro e o mês congelado mentiria os cartões.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    listar(COLECAO)
      .then((lista) => {
        setItens(lista);
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm
        // existe) — sem este aviso, a recarga que falha deixava a tela velha
        // em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
      });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Voltou para a aba: refaz a conta do mês e busca o que chegou.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [recarregar]);

  const vm = useMemo(() => {
    if (!itens) return null;
    const todos = itens.map((c) => ({ ...c, st: STATUS[c.status] || STATUS.solicitada }));

    const mes = hojeISO.slice(0, 7);
    const noMes = (dia) => String(dia || "").slice(0, 7) === mes;

    /* Nos grupos em andamento, a solicitação mais antiga vem primeiro — é a
       que espera há mais tempo. Recebidas e canceladas, o mais recente. */
    const porData = (a, b) =>
      String(a.data || "9999").localeCompare(String(b.data || "9999")) ||
      String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""));

    const grupos = FLUXO.map((status) => ({
      status,
      nome: STATUS[status].rotulo,
      itens: todos
        .filter((c) => c.status === status)
        .sort(
          status === "recebida"
            ? (a, b) => String(b.dataRecebida || "").localeCompare(String(a.dataRecebida || ""))
            : porData
        ),
    })).filter((g) => g.itens.length > 0);

    const canceladas = todos
      .filter((c) => c.status === "cancelada")
      .sort((a, b) => porData(b, a));

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
  }, [itens, hojeISO]);

  const gravar = async (dados, fraseOk) => {
    setSalvando(true);
    try {
      // st é conta da tela e não vai para o banco. O valor digitado volta a
      // número — e campo vazio fica vazio: dado ausente não é zero.
      const { st: _st, ...limpo } = dados;
      if (typeof limpo.valor === "string") {
        limpo.valor = limpo.valor.trim() ? paraNumero(limpo.valor) : "";
      }
      // Marcou recebida (pelo formulário ou pela seta) sem data? Carimba o dia
      // no ato — é o carimbo que sustenta os cartões do mês.
      if (limpo.status === "recebida" && !limpo.dataRecebida) {
        limpo.dataRecebida = ymdLocal(new Date());
      }
      await salvar(COLECAO, limpo);
      setForm(null);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const acoes = {
    abrirForm: (c) =>
      setForm(
        c
          ? {
              ...VAZIO,
              ...c,
              // Valor volta para o campo do jeito que se digita. Não usar
              // paraCampo aqui: ele devolve "" para 0, e valor zero REGISTRADO
              // não é a mesma coisa que valor sem registro.
              valor: c.valor == null || c.valor === "" ? "" : String(c.valor).replace(".", ","),
            }
          : { ...VAZIO, data: ymdLocal(new Date()) }
      ),
    avancar: (c) => {
      const prox = PROXIMO[c.status];
      if (!prox) return;
      gravar({ ...c, status: prox }, `Compra marcada como ${STATUS[prox].rotulo}.`);
    },
    remover: async (c) => {
      if (!window.confirm(`Apagar "${c.item}"?`)) return;
      try {
        await apagar(COLECAO, c.id);
        setAviso({ tipo: "ok", texto: "Compra apagada." });
        recarregar();
      } catch (e) {
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
  };

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

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

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

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Compras"
        descricao="Os pedidos de compra do laboratório — da solicitação ao recebimento."
        acao={
          editavel && (
            <button type="button" className="btn-primary" onClick={() => acoes.abrirForm(null)}>
              <Plus size={16} strokeWidth={2.5} /> Nova compra
            </button>
          )
        }
      />

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

      <FormCompra
        form={form}
        setForm={setForm}
        salvando={salvando}
        aoSalvar={() => gravar(form, form.id ? "Compra atualizada." : "Compra registrada.")}
        aoFechar={() => setForm(null)}
      />
    </div>
  );
}
