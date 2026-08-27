// Aba Ordens de compra — o documento que junta vários pedidos num pedido só
// para o fornecedor. É aqui que "o que já foi pedido e não chegou" ganha
// PRAZO: a previsão vencida vira dívida do fornecedor, com quantos dias.
//
// QUEM MANDA na composição da ordem é o carimbo `ordemId` no pedido — a tela
// monta a lista a partir dele. O campo `pedidoIds` da ordem é o retrato do que
// foi enviado ao fornecedor naquele dia; serve de documento, não de verdade
// corrente. Duas listas divergindo em silêncio seria pior que uma só.

import { useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, ArrowRight, Download, ScrollText, PackageCheck,
  HandCoins, Truck, AlertTriangle, ChevronDown, ChevronRight,
} from "lucide-react";
import { dataCurta, dataLonga, diasEntre, moedaCheia, ymdLocal } from "../../lib/format.js";
import { StatCard, Empty, Modal, Card } from "../ui.jsx";
import {
  STATUS_PEDIDO, STATUS_ORDEM, PEDIDO_EM_ABERTO, ModalRecebimento, temValor,
} from "./comum.jsx";

// Semente do FORMULÁRIO (o registro tem também `valorTotal`, que não se
// digita: sai da soma dos pedidos marcados, na gravação).
export const ORDEM_VAZIA = {
  id: "", numero: "", fornecedor: "", data: "", previsao: "",
  status: "aberta", pedidoIds: [], obs: "",
};

const ndias = (n) => `${n} ${n === 1 ? "dia" : "dias"}`;

// A frase do prazo. Prazo em palavras cobra; data só informa.
function prazoOrdem(o, hojeISO) {
  if (o.status === "recebida") return { texto: "recebida", chip: "chip-ok", peso: 1000, atrasada: false };
  if (o.status === "cancelada") return { texto: "cancelada", chip: "chip", peso: 2000, atrasada: false };
  if (!o.previsao) return { texto: "sem previsão", chip: "chip", peso: 500, atrasada: false };
  const dias = diasEntre(hojeISO, o.previsao);
  if (dias < 0) return { texto: `atrasada há ${ndias(-dias)}`, chip: "chip-bad", peso: dias, atrasada: true };
  if (dias === 0) return { texto: "chega HOJE", chip: "chip-warn", peso: 0, atrasada: false };
  if (dias <= 7) return { texto: `em ${ndias(dias)}`, chip: "chip-warn", peso: dias, atrasada: false };
  return { texto: `em ${ndias(dias)}`, chip: "chip", peso: dias, atrasada: false };
}

function LinhaOrdem({ o, editavel, aberto, aoAbrir, acoes }) {
  const podeAvancar = o.status === "aberta";
  const podeReceber = o.status === "aberta" || o.status === "enviada";
  return (
    <div
      className={`rounded-xl border p-3 ${o.status === "cancelada" ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--hairline)" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={aoAbrir}
          aria-expanded={aberto}
          title={aberto ? "Fechar os itens" : "Ver os itens desta ordem"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <ScrollText size={17} strokeWidth={2.2} className="shrink-0 text-brand-600" />

        <span className="min-w-0 flex-1 basis-48">
          <span className="block truncate font-display text-sm font-medium text-slate-900">
            OC {o.numero || "sem número"}
            <span className="font-normal text-slate-500"> — {o.fornecedor || "fornecedor não informado"}</span>
          </span>
          <span className="block truncate text-xs text-slate-500">
            {[
              `${o.itens.length} ${o.itens.length === 1 ? "item" : "itens"}`,
              // O cancelado aparece À PARTE, e não somado: ele está na ordem,
              // mas fora do valor e da conta do que se espera.
              o.cancelados > 0 ? `${o.cancelados} cancelado${o.cancelados === 1 ? "" : "s"}` : null,
              STATUS_ORDEM[o.status] || o.status,
              o.data ? `emitida ${dataCurta(o.data)}` : "sem data de emissão",
              o.previsao ? `previsão ${dataLonga(o.previsao)}` : null,
              o.obs,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className="block font-display text-sm font-medium tnum text-slate-900"
            title={
              o.valorDocumento !== null && o.valorDocumento !== o.valor
                ? `No documento enviado ao fornecedor: ${moedaCheia(o.valorDocumento)}`
                : undefined
            }
          >
            {o.valor === null ? (
              <span className="text-xs font-normal text-slate-400">sem valor lançado</span>
            ) : (
              moedaCheia(o.valor)
            )}
          </span>
          {o.semValor > 0 && (
            <span className="mt-0.5 block text-xs text-slate-400">{o.semValor} sem valor</span>
          )}
        </span>

        <span className={`${o.pz.chip} shrink-0 whitespace-nowrap`}>{o.pz.texto}</span>

        {editavel && (
          <span className="flex shrink-0 items-center gap-0.5">
            {podeAvancar && (
              <button
                type="button"
                onClick={() => acoes.avancarOrdem(o.id)}
                title="Marcar como enviada ao fornecedor"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
              >
                <ArrowRight size={15} strokeWidth={2.2} />
              </button>
            )}
            {podeReceber && (
              <button
                type="button"
                onClick={() => acoes.receberOrdem(o.id)}
                title="Marcar recebida (oferece dar entrada nos itens)"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-ok-50 hover:text-ok-700"
              >
                <PackageCheck size={15} strokeWidth={2.2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => acoes.abrirOrdem(o.id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => acoes.removerOrdem(o.id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
              title="Apagar"
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>

      {aberto && (
        <div className="mt-2 pl-11">
          {o.itens.length === 0 ? (
            <Empty className="py-6">
              Nenhum pedido nesta ordem. Edite a ordem para marcar os pedidos que entram nela.
            </Empty>
          ) : (
            o.itens.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                style={{ borderTop: "1px solid var(--fio-lista)" }}
              >
                <span className="min-w-0 flex-1 basis-40 truncate text-sm text-slate-900">
                  {c.item}
                  {c.qtde ? <span className="text-slate-500"> — {c.qtde}</span> : null}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-slate-700">
                  {temValor(c) ? moedaCheia(c.valor) : <span className="text-xs text-slate-400">sem valor</span>}
                </span>
                <span className="chip shrink-0">{(STATUS_PEDIDO[c.status] || STATUS_PEDIDO.solicitada).rotulo}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FormOrdem({ form, setForm, pedidos, salvando, aoSalvar, aoFechar }) {
  const [verTodos, setVerTodos] = useState(false);
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  /* Entram na escolha os pedidos livres que ainda podem ser pedidos, MAIS
     todos os que já são desta ordem — inclusive os já recebidos. Esconder o
     item recebido faria a gravação desmarcá-lo em silêncio e ele sairia da
     ordem sem ninguém pedir. */
  const disponiveis = pedidos.filter((c) =>
    form.id && c.ordemId === form.id ? true : !c.ordemId && PEDIDO_EM_ABERTO(c)
  );
  const fornecedores = [...new Set(disponiveis.map((c) => String(c.fornecedor || "").trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );

  const alvo = form.fornecedor.trim().toLowerCase();
  const doFornecedor = alvo
    ? disponiveis.filter((c) => String(c.fornecedor || "").trim().toLowerCase() === alvo)
    : [];
  const lista = verTodos || doFornecedor.length === 0 ? disponiveis : doFornecedor;

  const marcados = disponiveis.filter((c) => form.pedidoIds.includes(c.id));
  const comValor = marcados.filter(temValor);
  const total = comValor.length ? comValor.reduce((s, c) => s + Number(c.valor), 0) : null;

  const alternar = (id) =>
    setForm({
      ...form,
      pedidoIds: form.pedidoIds.includes(id)
        ? form.pedidoIds.filter((x) => x !== id)
        : [...form.pedidoIds, id],
    });

  return (
    <Modal
      titulo={form.id ? `Editar ordem de compra${form.numero ? ` OC ${form.numero}` : ""}` : "Nova ordem de compra"}
      aberto
      aoFechar={aoFechar}
      largura="max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="oc-forn">Fornecedor</label>
            <input
              id="oc-forn" type="text" className="input" list="oc-fornecedores"
              value={form.fornecedor} onChange={setCampo("fornecedor")} autoFocus required
            />
            <datalist id="oc-fornecedores">
              {fornecedores.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="oc-numero">Número</label>
            <input id="oc-numero" type="text" className="input" value={form.numero} onChange={setCampo("numero")} required />
          </div>
          <div>
            <label className="label" htmlFor="oc-data">Emitida em</label>
            <input id="oc-data" type="date" className="input" value={form.data} onChange={setCampo("data")} />
          </div>
          <div>
            <label className="label" htmlFor="oc-prev">Previsão de entrega</label>
            <input id="oc-prev" type="date" className="input" value={form.previsao} onChange={setCampo("previsao")} />
          </div>
          {form.id && (
            <div>
              <label className="label" htmlFor="oc-status">Situação</label>
              <select id="oc-status" className="select" value={form.status} onChange={setCampo("status")}>
                {Object.entries(STATUS_ORDEM).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
            <span className="label mb-0">Pedidos desta ordem</span>
            {doFornecedor.length > 0 && (
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? `Só os de ${form.fornecedor.trim()}` : "Ver todos os pedidos em aberto"}
              </button>
            )}
          </div>
          {lista.length === 0 ? (
            <Empty className="py-6">
              Nenhum pedido em aberto fora de ordem. Crie o pedido primeiro, na aba Pedidos.
            </Empty>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2" style={{ borderColor: "var(--hairline)" }}>
              {lista.map((c) => (
                <label
                  key={c.id}
                  htmlFor={`oc-ped-${c.id}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    id={`oc-ped-${c.id}`}
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    checked={form.pedidoIds.includes(c.id)}
                    onChange={() => alternar(c.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-900">
                      {c.item}
                      {c.qtde ? <span className="text-slate-500"> — {c.qtde}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {[c.fornecedor || "sem fornecedor", (STATUS_PEDIDO[c.status] || STATUS_PEDIDO.solicitada).rotulo]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-700">
                    {temValor(c) ? moedaCheia(c.valor) : <span className="text-xs text-slate-400">sem valor</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {/* O total sai da soma dos VALORES CONHECIDOS. Pedido sem preço não
              entra como zero — entra como aviso de que o total está incompleto. */}
          <p className="mt-2 text-sm text-slate-600">
            {marcados.length === 0
              ? "Nenhum pedido marcado."
              : `${marcados.length} ${marcados.length === 1 ? "pedido marcado" : "pedidos marcados"} · total ${
                  total === null ? "sem valor lançado" : moedaCheia(total)
                }${marcados.length - comValor.length > 0 ? ` (${marcados.length - comValor.length} sem valor)` : ""}`}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="oc-obs">Observações</label>
          <textarea id="oc-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.fornecedor.trim() || !form.numero.trim()}>
            {salvando ? "Gravando..." : "Gravar ordem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaOrdens({
  ordens, pedidos, produtos, hojeISO, editavel, salvando,
  formOrdem, setFormOrdem, recebendo, acoes, aoExportar,
}) {
  const [recorte, setRecorte] = useState(null); // "abertas" | "atrasadas" | null
  const [aberta, setAberta] = useState(null);

  const vm = useMemo(() => {
    const linhas = ordens
      .map((o) => {
        const itens = pedidos
          .filter((c) => c.ordemId === o.id)
          .sort((a, b) => String(a.item || "").localeCompare(String(b.item || ""), "pt-BR"));
        /* Pedido CANCELADO continua na ordem como história — o documento foi
           enviado com ele — mas sai das CONTAS: somá-lo faria a direção ler
           compromisso de dinheiro que ninguém vai gastar e item que ninguém
           espera. O que ainda se espera é o que PEDIDO_EM_ABERTO diz. */
        const cancelados = itens.filter((c) => c.status === "cancelada").length;
        const valendo = itens.filter((c) => c.status !== "cancelada");
        const comValor = valendo.filter(temValor);
        const doc = o.valorTotal === "" || o.valorTotal === null || o.valorTotal === undefined ? null : Number(o.valorTotal);
        return {
          ...o,
          itens,
          cancelados,
          aguardando: itens.filter(PEDIDO_EM_ABERTO).length,
          // Soma dos valores CONHECIDOS. Nenhum conhecido = "sem valor
          // lançado", nunca R$ 0.
          valor: comValor.length ? Math.round(comValor.reduce((s, c) => s + Number(c.valor), 0) * 100) / 100 : null,
          valorDocumento: Number.isFinite(doc) ? doc : null,
          semValor: valendo.length - comValor.length,
          pz: prazoOrdem(o, hojeISO),
        };
      })
      .sort((a, b) => a.pz.peso - b.pz.peso || String(b.data || "").localeCompare(String(a.data || "")));

    const emAberto = linhas.filter((o) => o.status === "aberta" || o.status === "enviada");
    const atrasadas = linhas.filter((o) => o.pz.atrasada);
    const comValorAberto = emAberto.filter((o) => o.valor !== null);

    return {
      linhas,
      emAberto,
      atrasadas,
      itensAguardando: emAberto.reduce((s, o) => s + o.aguardando, 0),
      valorAberto: comValorAberto.length
        ? Math.round(comValorAberto.reduce((s, o) => s + o.valor, 0) * 100) / 100
        : null,
    };
  }, [ordens, pedidos, hojeISO]);

  const visiveis =
    recorte === "abertas" ? vm.emAberto : recorte === "atrasadas" ? vm.atrasadas : vm.linhas;

  const exportar = () =>
    aoExportar({
      nome: "ordens-de-compra",
      titulo: `Ordens de compra${
        recorte === "abertas" ? " — em aberto" : recorte === "atrasadas" ? " — atrasadas" : ""
      }`,
      colunas: [
        { chave: "numero", rotulo: "Número", tipo: "texto" },
        { chave: "fornecedor", rotulo: "Fornecedor", tipo: "texto" },
        { chave: "data", rotulo: "Emitida em", tipo: "data" },
        { chave: "previsao", rotulo: "Previsão", tipo: "data" },
        { chave: "itens", rotulo: "Itens", tipo: "numero" },
        { chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
        { chave: "situacao", rotulo: "Situação", tipo: "texto" },
        { chave: "prazo", rotulo: "Prazo", tipo: "texto" },
        { chave: "obs", rotulo: "Observações", tipo: "texto" },
      ],
      linhas: visiveis.map((o) => ({
        numero: o.numero || null,
        fornecedor: o.fornecedor || null,
        data: o.data || null,
        previsao: o.previsao || null,
        itens: o.itens.length,
        // Sem valor conhecido a célula fica VAZIA: a coluna vai ser somada.
        valor: o.valor,
        situacao: STATUS_ORDEM[o.status] || o.status,
        prazo: o.pz.texto,
        obs: o.obs || null,
      })),
    });

  const pedidosRecebendo = recebendo ? pedidos.filter((p) => recebendo.pedidoIds.includes(p.id)) : [];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Atrasadas"
          valor={String(vm.atrasadas.length)}
          sub="previsão vencida e nada recebido"
          tom={vm.atrasadas.length > 0 ? "bad" : "ok"}
          icone={AlertTriangle}
          onClick={() => setRecorte(recorte === "atrasadas" ? null : "atrasadas")}
          ativo={recorte === "atrasadas"}
        />
        <StatCard
          rotulo="Em aberto"
          valor={String(vm.emAberto.length)}
          sub="abertas e enviadas ao fornecedor"
          tom={vm.emAberto.length > 0 ? "brand" : "neutral"}
          icone={Truck}
          onClick={() => setRecorte(recorte === "abertas" ? null : "abertas")}
          ativo={recorte === "abertas"}
        />
        <StatCard rotulo="Itens aguardando" valor={String(vm.itensAguardando)} tom="neutral" icone={PackageCheck} />
        <StatCard
          rotulo="Valor em aberto"
          valor={vm.valorAberto === null ? "sem registro" : moedaCheia(vm.valorAberto)}
          sub="somando só os itens com preço"
          tom="neutral"
          icone={HandCoins}
        />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ordens <span className="text-slate-400">({visiveis.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline disabled:cursor-not-allowed disabled:opacity-50"
              onClick={exportar}
              disabled={visiveis.length === 0}
              title={visiveis.length === 0 ? "Nada na tela para baixar" : undefined}
            >
              <Download size={16} strokeWidth={2.2} /> Baixar planilha
            </button>
            {editavel && (
              <button type="button" className="btn-primary" onClick={() => acoes.abrirOrdem(null)}>
                <Plus size={16} strokeWidth={2.5} /> Nova ordem
              </button>
            )}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <Empty>
            {vm.linhas.length === 0
              ? "Nenhuma ordem de compra ainda. Junte os pedidos em aberto de um fornecedor no botão lá em cima."
              : "Nada neste recorte. Clique de novo no cartão para ver tudo."}
          </Empty>
        ) : (
          <div className="space-y-2">
            {visiveis.map((o) => (
              <LinhaOrdem
                key={o.id}
                o={o}
                editavel={editavel}
                aberto={aberta === o.id}
                aoAbrir={() => setAberta(aberta === o.id ? null : o.id)}
                acoes={acoes}
              />
            ))}
          </div>
        )}
      </Card>

      {formOrdem && (
        <FormOrdem
          form={formOrdem}
          setForm={setFormOrdem}
          pedidos={pedidos}
          salvando={salvando}
          aoSalvar={acoes.salvarOrdem}
          aoFechar={() => setFormOrdem(null)}
        />
      )}

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

// Semente do formulário da ordem. O número novo é uma SUGESTÃO (o maior já
// usado + 1) e continua editável: quem numera é o fornecedor, às vezes.
export const ordemParaForm = (o, ordens, pedidos) => {
  if (o) {
    // Campo a campo (e não um spread): um `obs: null` do banco derrubaria o
    // textarea, e valorTotal não se digita.
    return {
      id: o.id,
      numero: o.numero == null ? "" : String(o.numero),
      fornecedor: o.fornecedor || "",
      data: o.data || "",
      previsao: o.previsao || "",
      status: o.status || "aberta",
      obs: o.obs || "",
      /* A composição vem do CARIMBO `ordemId` dos pedidos, não do retrato
         `pedidoIds` gravado: pedido apagado depois do envio continuaria na
         lista velha e a ordem afirmaria um item que não existe mais. */
      pedidoIds: pedidos.filter((c) => c.ordemId === o.id).map((c) => c.id),
    };
  }
  const numeros = ordens
    .map((x) => parseInt(String(x.numero || "").replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  return {
    ...ORDEM_VAZIA,
    numero: String(numeros.length ? Math.max(...numeros) + 1 : 1),
    data: ymdLocal(new Date()),
    pedidoIds: [],
  };
};
