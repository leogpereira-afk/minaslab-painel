// O vocabulário do controle de material da MinasLab: as listas fixas
// (unidade, categoria, etapa do pedido), a conta do SALDO e as peças que mais
// de uma aba usa. Mora aqui para NENHUMA aba importar da outra — a casca
// (pages/Compras.jsx) e as quatro abas puxam deste arquivo.

import { useState } from "react";
import { ClipboardList, Search, ShoppingCart, PackageCheck, XCircle } from "lucide-react";
import { Modal } from "../ui.jsx";
import { paraNumero } from "../../lib/format.js";

// As unidades que o laboratório usa de verdade. Texto livre aqui viraria "L",
// "l", "litro" e "Litros" no mesmo estoque, e nenhuma soma fecharia.
export const UNIDADES = ["un", "cx", "L", "mL", "kg", "g", "frasco"];

export const CATEGORIAS = {
  reagente: "Reagente",
  vidraria: "Vidraria",
  epi: "EPI",
  papelaria: "Papelaria",
  peca: "Peça",
  outro: "Outro",
};

export const rotuloCategoria = (c) => CATEGORIAS[c] || CATEGORIAS.outro;

// Etapas do pedido. O ícone diz a etapa antes de a pessoa ler o cabeçalho.
export const STATUS_PEDIDO = {
  solicitada: { rotulo: "Solicitada", icone: ClipboardList, cor: "text-slate-500" },
  cotando: { rotulo: "Em cotação", icone: Search, cor: "text-warn-700" },
  comprada: { rotulo: "Comprada", icone: ShoppingCart, cor: "text-brand-600" },
  recebida: { rotulo: "Recebida", icone: PackageCheck, cor: "text-ok-700" },
  cancelada: { rotulo: "Cancelada", icone: XCircle, cor: "text-bad-700" },
};

export const FLUXO_PEDIDO = ["solicitada", "cotando", "comprada", "recebida"];
export const PROXIMO_PEDIDO = { solicitada: "cotando", cotando: "comprada", comprada: "recebida" };

// Pedido que ainda pode entrar numa ordem de compra: não chegou nem morreu.
export const PEDIDO_EM_ABERTO = (c) => c.status !== "recebida" && c.status !== "cancelada";

export const STATUS_ORDEM = {
  aberta: "Aberta",
  enviada: "Enviada ao fornecedor",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

export const TIPOS_MOV = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };

// Número ausente é AUSENTE: "", null e texto sem dígito nenhum devolvem null,
// nunca 0. Zero digitado é um dado ("mínimo 0" = só repõe quando acabar) e
// precisa sobreviver à ida e à volta.
export function numeroOuNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!/\d/.test(s)) return null;
  return paraNumero(s);
}

export const temNumero = (v) => numeroOuNull(v) !== null;

// Número -> texto do formulário. NÃO usar paraCampo() aqui: ele devolve "" para
// 0 e apagaria, na primeira edição, um mínimo zero gravado de propósito.
export const paraCampoNum = (v) =>
  v === null || v === undefined || v === "" ? "" : String(v).replace(".", ",");

export function fmtQtd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

// Quantidade + unidade numa string só, para linha e planilha.
export const comUnidade = (n, unidade) => `${fmtQtd(n)}${unidade ? ` ${unidade}` : ""}`;

/* O sinal EXPLÍCITO manda — é ele que deixa o ajuste somar ou subtrair. Um
   movimento vindo de fora desta tela (backup, importação) pode chegar sem ele;
   aí o tipo decide, para o livro não parar de fechar por um campo faltando. */
export function sinalDe(mv) {
  const s = Number(mv?.sinal);
  if (s === 1 || s === -1) return s;
  return mv?.tipo === "saida" ? -1 : 1;
}

/* O SALDO É CALCULADO, NUNCA GRAVADO.
   Saldo guardado num campo do produto vira uma SEGUNDA VERDADE que envelhece
   calada: basta um movimento lançado por outro caminho (ou uma gravação que
   falhou no meio) para os dois números discordarem — e aí ninguém confia em
   nenhum dos dois. A conta é sempre esta: soma(quantidade × sinal) dos
   movimentos do produto.
   Produto sem movimento NENHUM não entra no mapa de propósito: "nunca lancei"
   é diferente de "acabou", e a tela precisa dizer coisas diferentes. */
export function resumoEstoque(movs) {
  const mapa = new Map();
  for (const mv of movs || []) {
    if (!mv?.produtoId) continue;
    let r = mapa.get(mv.produtoId);
    if (!r) {
      r = { saldo: 0, movimentos: 0, ultima: "" };
      mapa.set(mv.produtoId, r);
    }
    const q = Math.abs(Number(mv.quantidade));
    if (Number.isFinite(q)) r.saldo += q * sinalDe(mv);
    r.movimentos += 1;
    const dia = String(mv.data || "");
    if (dia > r.ultima) r.ultima = dia;
  }
  // Soma de decimais deixa lixo na casa 17 (0,1 + 0,2 = 0,30000000000000004) e
  // o saldo "igual ao mínimo" nunca bateria.
  for (const r of mapa.values()) r.saldo = Math.round(r.saldo * 1e4) / 1e4;
  return mapa;
}

/* A frase da linha, e o peso que ordena a lista: o que está abaixo do mínimo
   sobe. "sem movimento" NÃO é zero — produto recém-cadastrado nunca teve
   saldo, e escrever "0 em estoque" afirmaria que acabou. Mínimo em branco
   também não é zero: sem ponto de reposição não dá para dizer se está faltando.
   A `chave` é o que os filtros comparam — comparar a frase exibida faria o
   recorte quebrar calado no dia em que alguém melhorar o texto. */
export function situacaoSaldo(saldo, minimo) {
  if (saldo === null) return { chave: "sem-movimento", texto: "sem movimento", chip: "chip", peso: 1 };
  if (minimo === null) return { chave: "sem-minimo", texto: "sem mínimo definido", chip: "chip", peso: 2 };
  if (saldo < minimo) return { chave: "abaixo", texto: "abaixo do mínimo", chip: "chip-bad", peso: -1 };
  if (saldo === minimo) return { chave: "limite", texto: "no limite", chip: "chip-warn", peso: 0 };
  return { chave: "ok", texto: "ok", chip: "chip-ok", peso: 3 };
}

// Valor ausente não é zero: pedido sem preço mostra "sem valor" e fica fora da
// soma do mês.
export const temValor = (c) => temNumero(c?.valor);

/* A ENTRADA que um pedido JÁ lançou no livro (ou null). O livro é APPEND-ONLY:
   dar entrada duas vezes no mesmo pedido dobra o saldo e o erro fica lá para
   sempre. Régua ÚNICA de propósito — quem oferece o recebimento, quem grava o
   movimento e quem mostra a "quantidade recebida" precisam responder a mesma
   coisa; três réguas parecidas divergem em silêncio. */
export const entradaDoPedido = (movs, pedidoId) =>
  (pedidoId && (movs || []).find((m) => m.pedidoId === pedidoId && m.tipo === "entrada")) || null;

const norm = (s) => String(s ?? "").trim().toLowerCase();

/* RECEBIMENTO — o único caminho de pedido para estoque, e ele passa por aqui
   de propósito. Pedido e recebimento divergem no mundo real (chega menos, chega
   quebrado, chega em duas remessas): entrada automática pela quantidade PEDIDA
   encheria o estoque de números que ninguém conferiu, e estoque que mente é
   pior que estoque nenhum.
   Serve um pedido só (aba Pedidos) e a ordem inteira em lote (aba Ordens). */
export function ModalRecebimento({ pedidos, produtos, salvando, aoConfirmar, aoSoMarcar, aoFechar }) {
  const [linhas, setLinhas] = useState(() =>
    pedidos.map((p) => {
      /* Casamento por nome EXATO e só quando não há dúvida (um único produto
         ativo com aquele nome). Adivinhar pelo parecido carimbaria a entrada no
         produto errado — e o livro do estoque é append-only, o erro fica. */
      const iguais = produtos.filter((x) => x.ativo !== false && norm(x.nome) === norm(p.item));
      const pedida = numeroOuNull(p.qtde);
      /* O vínculo velho do pedido só vale se o produto EXISTE e está ATIVO: o
         select só oferece ativos, e um id fora da lista deixava o campo em
         branco com o botão habilitado — a entrada era lançada num produto que
         não aparece na tela do estoque. */
      const vinculado = p.produtoId ? produtos.find((x) => x.id === p.produtoId) : null;
      const vinculoVale = !!vinculado && vinculado.ativo !== false;
      return {
        pedidoId: p.id,
        item: p.item || "(pedido sem item)",
        qtdeTexto: p.qtde || "",
        fornecedor: p.fornecedor || "",
        produtoId: vinculoVale ? p.produtoId : iguais.length === 1 ? iguais[0].id : "",
        vinculoPerdido: !!p.produtoId && !vinculoVale,
        quantidade: paraCampoNum(pedida),
        novoNome: p.item || "",
        novaUnidade: "un",
        novaCategoria: "outro",
        novoLocal: "",
      };
    })
  );

  const ativos = produtos.filter((p) => p.ativo !== false);
  const setLinha = (i, campos) =>
    setLinhas((ls) => ls.map((l, n) => (n === i ? { ...l, ...campos } : l)));

  const completa = (l) => {
    const q = numeroOuNull(l.quantidade);
    if (q === null || q <= 0) return false;
    if (l.produtoId === "__novo") return l.novoNome.trim() !== "";
    // Não basta TER um produtoId: ele precisa estar na lista OFERECIDA. Id que
    // não casa com nenhuma option deixa o select em branco e a entrada iria
    // para um produto que a tela do estoque não mostra.
    return ativos.some((p) => p.id === l.produtoId);
  };
  const pronto = linhas.every(completa);

  const confirmar = () =>
    aoConfirmar(
      linhas.map((l) => ({
        pedidoId: l.pedidoId,
        produtoId: l.produtoId === "__novo" ? "" : l.produtoId,
        novoProduto:
          l.produtoId === "__novo"
            ? {
                nome: l.novoNome.trim(),
                unidade: l.novaUnidade,
                categoria: l.novaCategoria,
                local: l.novoLocal.trim(),
                fornecedorPadrao: l.fornecedor,
              }
            : null,
        quantidade: numeroOuNull(l.quantidade),
      }))
    );

  const varios = linhas.length > 1;

  return (
    <Modal
      titulo={varios ? `Receber ${linhas.length} pedidos` : "Dar entrada no estoque agora?"}
      aberto
      aoFechar={aoFechar}
      largura="max-w-2xl"
    >
      <p className="mb-4 text-sm text-slate-500">
        Confira a quantidade que <strong>chegou de verdade</strong> — ela pode ser
        diferente da pedida. A entrada no estoque é lançada com o carimbo do pedido.
      </p>

      <div className="space-y-3">
        {linhas.map((l, i) => {
          const prod = ativos.find((p) => p.id === l.produtoId);
          const q = numeroOuNull(l.quantidade);
          return (
            <div key={l.pedidoId} className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
              <p className="font-display text-sm font-medium text-slate-900">{l.item}</p>
              <p className="text-xs text-slate-500">
                {[
                  l.qtdeTexto ? `pedido: ${l.qtdeTexto}` : "quantidade pedida não informada",
                  l.fornecedor,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`rec-prod-${i}`}>Produto do estoque</label>
                  <select
                    id={`rec-prod-${i}`}
                    className="select"
                    value={l.produtoId}
                    onChange={(e) => setLinha(i, { produtoId: e.target.value, vinculoPerdido: false })}
                  >
                    <option value="">— escolha o produto —</option>
                    {ativos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.unidade || "un"})
                      </option>
                    ))}
                    <option value="__novo">+ criar produto novo</option>
                  </select>
                  {l.vinculoPerdido && (
                    <p className="mt-1 text-xs text-warn-700">
                      O produto vinculado foi desativado — escolha outro ou reative no Estoque.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor={`rec-qtd-${i}`}>Quantidade recebida</label>
                  <input
                    id={`rec-qtd-${i}`}
                    type="text"
                    inputMode="decimal"
                    className="input"
                    value={l.quantidade}
                    onChange={(e) => setLinha(i, { quantidade: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {q !== null && q <= 0
                      ? "Precisa ser maior que zero."
                      : prod
                        ? `em ${prod.unidade || "un"}`
                        : l.produtoId === "__novo"
                          ? `em ${l.novaUnidade}`
                          : "escolha o produto para saber a unidade"}
                  </p>
                </div>
              </div>

              {l.produtoId === "__novo" && (
                <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2" style={{ borderColor: "var(--hairline)" }}>
                  <div>
                    <label className="label" htmlFor={`rec-nome-${i}`}>Nome do produto</label>
                    <input
                      id={`rec-nome-${i}`}
                      type="text"
                      className="input"
                      value={l.novoNome}
                      onChange={(e) => setLinha(i, { novoNome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`rec-local-${i}`}>Onde vai ficar guardado</label>
                    <input
                      id={`rec-local-${i}`}
                      type="text"
                      className="input"
                      placeholder="Ex.: Almoxarifado, prateleira B3"
                      value={l.novoLocal}
                      onChange={(e) => setLinha(i, { novoLocal: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`rec-un-${i}`}>Unidade</label>
                    <select
                      id={`rec-un-${i}`}
                      className="select"
                      value={l.novaUnidade}
                      onChange={(e) => setLinha(i, { novaUnidade: e.target.value })}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`rec-cat-${i}`}>Categoria</label>
                    <select
                      id={`rec-cat-${i}`}
                      className="select"
                      value={l.novaCategoria}
                      onChange={(e) => setLinha(i, { novaCategoria: e.target.value })}
                    >
                      {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>{rotulo}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-outline" onClick={aoFechar} disabled={salvando}>
          Cancelar
        </button>
        {/* Saída honesta: às vezes o pedido chegou mas não é material de
            estoque (serviço, frete). Marcar recebido sem inventar movimento. */}
        <button type="button" className="btn-outline" onClick={aoSoMarcar} disabled={salvando}>
          Só marcar recebida
        </button>
        <button type="button" className="btn-primary" onClick={confirmar} disabled={salvando || !pronto}>
          {salvando ? "Gravando..." : "Dar entrada no estoque"}
        </button>
      </div>
      {!pronto && (
        <p className="mt-2 text-right text-xs text-slate-500">
          Cada linha precisa de um produto e de uma quantidade maior que zero.
        </p>
      )}
    </Modal>
  );
}
