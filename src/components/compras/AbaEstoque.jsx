// Aba Estoque — a resposta da pergunta nº 1 do dia: O QUE ESTÁ ACABANDO. E,
// logo em seguida, a pergunta que a equipe faz em voz alta o dia inteiro: ONDE
// ESTÁ GUARDADO. Por isso o local vem em destaque na linha, não escondido na
// ficha.
//
// Estado e gravação moram na casca (pages/Compras.jsx); aqui mora a
// renderização e a inteligência de LEITURA. O saldo NÃO é lido de campo
// nenhum: vem da soma dos movimentos (comum.jsx).

import { useMemo, useState } from "react";
import {
  Plus, Pencil, Download, Search, Package, PackagePlus, PackageMinus, MapPin,
  Boxes, AlertTriangle, HandCoins, Clock, ChevronDown, ChevronRight,
} from "lucide-react";
import { dataCurta, dataLonga, diasEntre, moedaCheia, ymdLocal } from "../../lib/format.js";
import { StatCard, Empty, Modal, Card } from "../ui.jsx";
import {
  CATEGORIAS, UNIDADES, TIPOS_MOV, rotuloCategoria, situacaoSaldo, numeroOuNull,
  paraCampoNum, fmtQtd, comUnidade, sinalDe,
} from "./comum.jsx";

const SEM_LOCAL = "__sem_local";

// Uma linha do extrato do produto. O livro é APPEND-ONLY: não há botão de
// editar nem de apagar aqui de propósito — o conserto de um lançamento errado
// é um AJUSTE novo, que fica registrado. Livro que se apaga não prova nada.
function LinhaMovimento({ mv, unidade }) {
  const sinal = sinalDe(mv);
  const origem = mv.pedidoId ? "recebimento de pedido" : "";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" style={{ borderTop: "1px solid var(--fio-lista)" }}>
      <span className="w-14 shrink-0 text-xs tabular-nums text-slate-500">
        {mv.data ? dataCurta(mv.data) : "sem data"}
      </span>
      <span className={`shrink-0 ${sinal < 0 ? "chip-warn" : "chip-ok"}`}>
        {TIPOS_MOV[mv.tipo] || mv.tipo}
      </span>
      <span className="w-20 shrink-0 text-right font-display text-sm font-medium tnum text-slate-900">
        {sinal < 0 ? "−" : "+"}
        {comUnidade(Math.abs(Number(mv.quantidade) || 0), unidade)}
      </span>
      <span className="min-w-0 flex-1 basis-40 truncate text-xs text-slate-500">
        {[mv.motivo, mv.pessoaNome && `por ${mv.pessoaNome}`, origem, mv.obs].filter(Boolean).join(" · ") ||
          "sem motivo registrado"}
      </span>
    </div>
  );
}

function LinhaProduto({ p, editavel, aberto, aoAbrir, extrato, acoes }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={aoAbrir}
          aria-expanded={aberto}
          title={aberto ? "Fechar o extrato" : "Ver o extrato deste produto"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <Package size={17} strokeWidth={2.2} className="shrink-0 text-brand-600" />

        <span className="min-w-0 flex-1 basis-48">
          <span className="block truncate font-display text-sm font-medium text-slate-900">{p.nome}</span>
          <span className="block truncate text-xs text-slate-500">
            {[rotuloCategoria(p.categoria), p.fornecedorPadrao, p.obs].filter(Boolean).join(" · ")}
          </span>
        </span>

        {/* O LOCAL em destaque: é a pergunta do dia a dia. Produto sem local
            não fica em silêncio — quem guardou sem anotar precisa ver isso. */}
        <span className="shrink-0">
          {p.local ? (
            <span className="chip-brand max-w-[16rem] truncate" title={p.local}>
              <MapPin size={12} strokeWidth={2.4} className="mr-1 shrink-0" />
              {p.local}
            </span>
          ) : (
            <span className="chip">sem local definido</span>
          )}
        </span>

        <span className="w-28 shrink-0 text-right">
          <span className="block font-display text-sm font-semibold tnum text-slate-900">
            {p.saldo === null ? (
              <span className="text-xs font-normal text-slate-400">sem movimento</span>
            ) : (
              comUnidade(p.saldo, p.unidade)
            )}
          </span>
          <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
            {p.minimo === null ? "sem mínimo" : `mín. ${comUnidade(p.minimo, p.unidade)}`}
          </span>
        </span>

        <span className={`${p.sit.chip} shrink-0 whitespace-nowrap`}>{p.sit.texto}</span>
        {p.ativo === false && <span className="chip shrink-0">desativado</span>}

        {editavel && (
          <span className="flex shrink-0 items-center gap-0.5">
            {/* Produto desativado não recebe lançamento novo — mas continua
                editável, senão não teria como reativar. */}
            {p.ativo !== false && (
              <>
                <button
                  type="button"
                  onClick={() => acoes.abrirMovimento(p, "entrada")}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-ok-50 hover:text-ok-700"
                  title="Entrada"
                >
                  <PackagePlus size={15} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => acoes.abrirMovimento(p, "saida")}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-warn-50 hover:text-warn-700"
                  title="Saída"
                >
                  <PackageMinus size={15} strokeWidth={2.2} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => acoes.abrirProduto(p)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Editar produto"
            >
              <Pencil size={14} />
            </button>
          </span>
        )}
      </div>

      {aberto && (
        <div className="mt-2 pl-11">
          <p className="mb-1 text-xs text-slate-500">
            {p.custo === null ? "Custo médio sem registro" : `Custo médio ${moedaCheia(p.custo)}`}
            {p.valorEstoque !== null ? ` · em estoque ${moedaCheia(p.valorEstoque)}` : ""}
            {p.ultima ? ` · última movimentação em ${dataLonga(p.ultima)}` : ""}
          </p>
          {extrato.length === 0 ? (
            <Empty className="py-6">Nenhum movimento lançado para este produto.</Empty>
          ) : (
            <div>
              {extrato.map((mv) => (
                <LinhaMovimento key={mv.id} mv={mv} unidade={p.unidade} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Produto NÃO se apaga: o livro do estoque aponta para ele, e apagar deixaria
// movimento órfão. Desativar tira das escolhas novas e mantém o histórico
// legível.
export function FormProduto({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <Modal titulo={form.id ? "Editar produto" : "Novo produto"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="pr-nome">Nome do produto</label>
          <input id="pr-nome" type="text" className="input" value={form.nome} onChange={setCampo("nome")} autoFocus required />
        </div>
        <div>
          <label className="label" htmlFor="pr-local">Onde está guardado</label>
          <input
            id="pr-local" type="text" className="input"
            placeholder="Ex.: Almoxarifado, prateleira B3"
            value={form.local} onChange={setCampo("local")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pr-cat">Categoria</label>
            <select id="pr-cat" className="select" value={form.categoria} onChange={setCampo("categoria")}>
              {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pr-un">Unidade</label>
            <select id="pr-un" className="select" value={form.unidade} onChange={setCampo("unidade")}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pr-min">Mínimo (ponto de reposição)</label>
            <input
              id="pr-min" type="text" inputMode="decimal" className="input"
              placeholder="em branco = sem mínimo"
              value={form.minimo} onChange={setCampo("minimo")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-custo">Custo médio (R$)</label>
            <input
              id="pr-custo" type="text" inputMode="decimal" className="input"
              placeholder="em branco = sem registro"
              value={form.custoMedio} onChange={setCampo("custoMedio")}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pr-forn">Fornecedor de costume</label>
          <input id="pr-forn" type="text" className="input" placeholder="opcional" value={form.fornecedorPadrao} onChange={setCampo("fornecedorPadrao")} />
        </div>
        <div>
          <label className="label" htmlFor="pr-obs">Observações</label>
          <textarea id="pr-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        {form.id && (
          <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="pr-ativo">
            <input
              id="pr-ativo" type="checkbox" className="h-4 w-4"
              checked={form.ativo !== false}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Produto ativo (desmarque para tirar das listas sem apagar o histórico)
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.nome.trim()}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Entrada / saída / ajuste. Modal curto de propósito: quem está com o frasco na
// mão não vai preencher ficha.
export function ModalMovimento({ form, setForm, equipe, resumo, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const q = numeroOuNull(form.quantidade);
  const atual = resumo.get(form.produtoId)?.saldo ?? null;
  const sinal = form.tipo === "saida" ? -1 : form.tipo === "ajuste" ? Number(form.sinal) : 1;
  const depois = q === null ? null : Math.round(((atual ?? 0) + q * sinal) * 1e4) / 1e4;

  return (
    <Modal titulo={`${TIPOS_MOV[form.tipo]} — ${form.produtoNome}`} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-500">
          Saldo agora:{" "}
          {atual === null ? (
            <span className="text-slate-400">sem movimento lançado</span>
          ) : (
            <strong className="tnum text-slate-900">{comUnidade(atual, form.unidade)}</strong>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="mv-tipo">Tipo</label>
            <select id="mv-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
              {Object.entries(TIPOS_MOV).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          {form.tipo === "ajuste" ? (
            <div>
              <label className="label" htmlFor="mv-sinal">O ajuste</label>
              <select id="mv-sinal" className="select" value={String(form.sinal)} onChange={(e) => setForm({ ...form, sinal: Number(e.target.value) })}>
                <option value="1">soma ao saldo</option>
                <option value="-1">tira do saldo</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="mv-data">Data</label>
              <input id="mv-data" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="mv-qtd">Quantidade ({form.unidade || "un"})</label>
            <input
              id="mv-qtd" type="text" inputMode="decimal" className="input"
              value={form.quantidade} onChange={setCampo("quantidade")} autoFocus
            />
          </div>
          {form.tipo === "ajuste" && (
            <div>
              <label className="label" htmlFor="mv-data-aj">Data</label>
              <input id="mv-data-aj" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="mv-pessoa">Quem</label>
            <select id="mv-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")}>
              <option value="">— não informado —</option>
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mv-motivo">Motivo / O.S.</label>
            <input id="mv-motivo" type="text" className="input" placeholder="Ex.: análise da O.S. 1420" value={form.motivo} onChange={setCampo("motivo")} />
          </div>
        </div>

        {/* AVISO, não trava: saldo negativo é sintoma de lançamento faltando, e
            impedir o registro esconderia o que de fato aconteceu. */}
        {depois !== null && depois < 0 && (
          <p className="rounded-xl border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
            O saldo ficaria negativo ({fmtQtd(depois)}) — confira se falta lançar entrada.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || q === null || q <= 0 || !form.data}>
            {salvando ? "Gravando..." : "Lançar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaEstoque({
  produtos, movs, resumo, equipe, hojeISO, editavel, salvando,
  formProduto, setFormProduto, formMov, setFormMov, acoes, aoExportar,
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [local, setLocal] = useState("");
  const [recorte, setRecorte] = useState(null); // "abaixo" | "parado" | null
  const [aberto, setAberto] = useState(null);
  const [verInativos, setVerInativos] = useState(false);

  const vm = useMemo(() => {
    const preparar = (p) => {
      const r = resumo.get(p.id) || null;
      const saldo = r ? r.saldo : null;
      const minimo = numeroOuNull(p.minimo);
      const custo = numeroOuNull(p.custoMedio);
      return {
        ...p,
        saldo,
        minimo,
        custo,
        sit: situacaoSaldo(saldo, minimo),
        ultima: r?.ultima || "",
        // Sem data na última movimentação não dá para dizer há quanto tempo
        // está parado — e "não sei" não vira zero.
        parado: r && r.ultima ? diasEntre(r.ultima, hojeISO) : null,
        valorEstoque: saldo !== null && custo !== null ? Math.round(saldo * custo * 100) / 100 : null,
      };
    };
    const ordenar = (a, b) =>
      a.sit.peso - b.sit.peso || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");

    const ativos = produtos.filter((p) => p.ativo !== false).map(preparar).sort(ordenar);
    const inativos = produtos.filter((p) => p.ativo === false).map(preparar).sort(ordenar);

    const locais = [...new Set(ativos.map((p) => String(p.local || "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );

    const abaixo = ativos.filter((p) => p.sit.chave === "abaixo");
    const parados = ativos.filter((p) => p.parado !== null && p.parado > 90);
    const nunca = ativos.filter((p) => p.saldo === null).length;
    const comCusto = ativos.filter((p) => p.valorEstoque !== null);
    const valorTotal = comCusto.reduce((s, p) => s + p.valorEstoque, 0);

    return {
      ativos, inativos, locais, abaixo, parados, nunca,
      // Quem ENTRA na soma × quem não tem PREÇO lançado são contas diferentes:
      // produto sem movimento fica de fora da soma mesmo tendo custo, e chamar
      // isso de "sem custo lançado" seria uma frase falsa no cartão.
      comCusto: comCusto.length,
      semCusto: ativos.filter((p) => p.custo === null).length,
      valorTotal: Math.round(valorTotal * 100) / 100,
    };
  }, [produtos, resumo, hojeISO]);

  const q = busca.trim().toLowerCase();
  const base = verInativos ? [...vm.ativos, ...vm.inativos] : vm.ativos;
  const visiveis = base.filter((p) => {
    if (recorte === "abaixo" && p.sit.chave !== "abaixo") return false;
    if (recorte === "parado" && !(p.parado !== null && p.parado > 90)) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (local === SEM_LOCAL && String(p.local || "").trim()) return false;
    if (local && local !== SEM_LOCAL && String(p.local || "").trim() !== local) return false;
    if (q && !String(p.nome || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const extratoDe = (produtoId) =>
    movs
      .filter((m) => m.produtoId === produtoId)
      .sort(
        (a, b) =>
          String(b.data || "").localeCompare(String(a.data || "")) ||
          String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))
      );

  // Sai o RECORTE VISÍVEL — planilha que exporta "tudo" enquanto a tela mostra
  // uma prateleira entrega uma conta que ninguém pediu. Por isso o filtro vai
  // escrito no título: fora da tela, o recorte anônimo passa por total.
  const exportar = () => {
    const filtros = [
      categoria ? rotuloCategoria(categoria) : null,
      local === SEM_LOCAL ? "sem local" : local || null,
      recorte === "abaixo" ? "abaixo do mínimo" : recorte === "parado" ? "parados há mais de 90 dias" : null,
      q ? `busca "${busca.trim()}"` : null,
      // Desativado misturado sem aviso vira produto "do estoque" numa reunião:
      // o título diz, e a coluna abaixo diz linha a linha.
      verInativos ? "inclui desativados" : null,
    ].filter(Boolean);
    aoExportar({
      nome: "estoque",
      titulo: `Estoque${filtros.length ? ` — ${filtros.join(" · ")}` : ""}`,
      colunas: [
        { chave: "nome", rotulo: "Produto", tipo: "texto" },
        { chave: "categoria", rotulo: "Categoria", tipo: "texto" },
        { chave: "local", rotulo: "Onde está guardado", tipo: "texto" },
        { chave: "unidade", rotulo: "Unidade", tipo: "texto" },
        { chave: "saldo", rotulo: "Saldo", tipo: "numero" },
        { chave: "minimo", rotulo: "Mínimo", tipo: "numero" },
        { chave: "situacao", rotulo: "Situação", tipo: "texto" },
        { chave: "cadastro", rotulo: "Situação do cadastro", tipo: "texto" },
        { chave: "custo", rotulo: "Custo médio", tipo: "dinheiro" },
        { chave: "valor", rotulo: "Valor em estoque", tipo: "dinheiro" },
        { chave: "ultima", rotulo: "Última movimentação", tipo: "data" },
        { chave: "fornecedor", rotulo: "Fornecedor de costume", tipo: "texto" },
      ],
      // Saldo e custo ausentes vão VAZIOS, não 0: a planilha vai ser somada, e
      // um zero inventado viraria "acabou" ou "de graça" na conta.
      linhas: visiveis.map((p) => ({
        nome: p.nome || "",
        categoria: rotuloCategoria(p.categoria),
        local: p.local || null,
        unidade: p.unidade || "un",
        saldo: p.saldo,
        minimo: p.minimo,
        situacao: p.sit.texto,
        cadastro: p.ativo === false ? "desativado" : "ativo",
        custo: p.custo,
        valor: p.valorEstoque,
        ultima: p.ultima || null,
        fornecedor: p.fornecedorPadrao || null,
      })),
    });
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Abaixo do mínimo"
          valor={String(vm.abaixo.length)}
          sub={
            vm.abaixo.length > 0
              ? "repor antes de faltar no meio da análise"
              : "nada abaixo do ponto de reposição"
          }
          tom={vm.abaixo.length > 0 ? "bad" : "ok"}
          icone={AlertTriangle}
          onClick={() => setRecorte(recorte === "abaixo" ? null : "abaixo")}
          ativo={recorte === "abaixo"}
        />
        <StatCard
          rotulo="Produtos cadastrados"
          valor={String(vm.ativos.length)}
          sub={vm.nunca > 0 ? `${vm.nunca} sem nenhum movimento` : undefined}
          tom="neutral"
          icone={Boxes}
        />
        <StatCard
          rotulo="Sem movimento há 90 dias"
          valor={String(vm.parados.length)}
          sub="entre os que já tiveram movimento"
          tom={vm.parados.length > 0 ? "warn" : "neutral"}
          icone={Clock}
          onClick={() => setRecorte(recorte === "parado" ? null : "parado")}
          ativo={recorte === "parado"}
        />
        <StatCard
          rotulo="Valor em estoque"
          valor={vm.comCusto > 0 ? moedaCheia(vm.valorTotal) : "sem registro"}
          sub={vm.semCusto > 0 ? `${vm.semCusto} sem custo lançado` : "todos com custo lançado"}
          tom="neutral"
          icone={HandCoins}
        />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative">
              <label className="label" htmlFor="es-busca">Buscar produto</label>
              <Search size={15} className="pointer-events-none absolute left-3 top-[2.15rem] text-slate-400" />
              <input
                id="es-busca" type="search" className="input w-56 pl-9" placeholder="nome do produto"
                value={busca} onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="es-cat">Categoria</label>
              <select id="es-cat" className="select w-40" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="es-local">Local</label>
              <select id="es-local" className="select w-48" value={local} onChange={(e) => setLocal(e.target.value)}>
                <option value="">Todos</option>
                {vm.locais.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
                <option value={SEM_LOCAL}>(sem local definido)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {vm.inativos.length > 0 && (
              <button
                type="button"
                className="btn-outline"
                aria-pressed={verInativos}
                onClick={() => setVerInativos((v) => !v)}
              >
                {verInativos ? "Esconder desativados" : `Ver desativados (${vm.inativos.length})`}
              </button>
            )}
            {/* Baixar é LEITURA: quem enxerga a tela leva o recorte embora,
                mesmo sem permissão de escrita. */}
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
              <button type="button" className="btn-primary" onClick={() => acoes.abrirProduto(null)}>
                <Plus size={16} strokeWidth={2.5} /> Novo produto
              </button>
            )}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <Empty>
            {vm.ativos.length === 0
              ? "Nenhum produto cadastrado ainda. Comece pelo que costuma faltar."
              : "Nada neste recorte. Limpe a busca ou clique de novo no cartão."}
          </Empty>
        ) : (
          <div className="space-y-2">
            {visiveis.map((p) => (
              <LinhaProduto
                key={p.id}
                p={p}
                editavel={editavel}
                aberto={aberto === p.id}
                aoAbrir={() => setAberto(aberto === p.id ? null : p.id)}
                extrato={aberto === p.id ? extratoDe(p.id) : []}
                acoes={acoes}
              />
            ))}
          </div>
        )}
      </Card>

      <FormProduto
        form={formProduto}
        setForm={setFormProduto}
        salvando={salvando}
        aoSalvar={acoes.salvarProduto}
        aoFechar={() => setFormProduto(null)}
      />

      <ModalMovimento
        form={formMov}
        setForm={setFormMov}
        equipe={equipe}
        resumo={resumo}
        salvando={salvando}
        aoSalvar={acoes.lancarMovimento}
        aoFechar={() => setFormMov(null)}
      />
    </div>
  );
}

// Semente do formulário de movimento — a casca chama isto no clique da linha.
// Mora aqui porque é o desenho desta aba; a data nasce do relógio LOCAL.
export const movimentoVazio = (produto, tipo) => ({
  produtoId: produto.id,
  produtoNome: produto.nome || "",
  unidade: produto.unidade || "un",
  tipo,
  sinal: tipo === "saida" ? -1 : 1,
  quantidade: "",
  data: ymdLocal(new Date()),
  motivo: "",
  pessoaId: "",
  obs: "",
});

// Semente do formulário de produto. Os números voltam como TEXTO do jeito que
// se digita — e zero volta como "0": paraCampo(0) devolveria "" e apagaria um
// mínimo zero gravado de propósito.
export const produtoParaForm = (p) => ({
  id: p?.id || "",
  nome: p?.nome || "",
  unidade: p?.unidade || "un",
  categoria: p?.categoria || "outro",
  local: p?.local || "",
  minimo: paraCampoNum(p?.minimo),
  custoMedio: paraCampoNum(p?.custoMedio),
  fornecedorPadrao: p?.fornecedorPadrao || "",
  obs: p?.obs || "",
  ativo: p ? p.ativo !== false : true,
});
