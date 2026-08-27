// Aba Retiradas — a resposta da pergunta nº 3: QUEM LEVOU O QUÊ. É o extrato
// das SAÍDAS, mais recente primeiro, e é onde se descobre quem pegou o último
// frasco.
//
// As opções do filtro "Quem" saem do elenco MAIS os nomes carimbados nas
// saídas: quem saiu da empresa some do elenco, e sem o carimbo as retiradas
// dele virariam um bloco sem dono.

import { useMemo, useState } from "react";
import { Plus, Download, Search, PackageMinus, Users, Package, UserX } from "lucide-react";
import { dataCurta, dataLonga, ymdLocal } from "../../lib/format.js";
import { StatCard, Empty, Modal, Card } from "../ui.jsx";
import { numeroOuNull, comUnidade, fmtQtd } from "./comum.jsx";

const SEM_PESSOA = "__sem_pessoa";

export const RETIRADA_VAZIA = {
  produtoId: "", quantidade: "", pessoaId: "", motivo: "", data: "", obs: "",
};

function LinhaRetirada({ mv }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">
        {mv.data ? dataLonga(mv.data) : "sem data"}
      </span>

      <PackageMinus size={16} strokeWidth={2.2} className="shrink-0 text-warn-700" />

      <span className="min-w-0 flex-1 basis-40">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {mv.produtoNome || "(produto sem nome carimbado)"}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {mv.motivo || "sem motivo registrado"}
          {mv.obs ? ` · ${mv.obs}` : ""}
        </span>
      </span>

      <span className="w-24 shrink-0 text-right font-display text-sm font-semibold tnum text-slate-900">
        {comUnidade(mv.qtd, mv.unidade)}
      </span>

      {/* Saída sem quem é uma lacuna, não um dado neutro: aparece em warn para
          cobrar o registro. */}
      <span className="w-40 shrink-0 truncate text-right text-sm">
        {mv.pessoaNome ? (
          <span className="text-slate-700">{mv.pessoaNome}</span>
        ) : (
          <span className="chip-warn">sem quem</span>
        )}
      </span>
    </div>
  );
}

export function ModalRetirada({ form, setForm, produtos, equipe, resumo, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const ativos = produtos.filter((p) => p.ativo !== false);
  const prod = ativos.find((p) => p.id === form.produtoId);
  const q = numeroOuNull(form.quantidade);
  const atual = resumo.get(form.produtoId)?.saldo ?? null;
  const depois = q === null ? null : Math.round(((atual ?? 0) - q) * 1e4) / 1e4;

  return (
    <Modal titulo="Registrar retirada" aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="rt-prod">Produto</label>
          <select id="rt-prod" className="select" value={form.produtoId} onChange={setCampo("produtoId")} required>
            <option value="">— escolha o produto —</option>
            {ativos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.unidade || "un"}){p.local ? ` — ${p.local}` : ""}
              </option>
            ))}
          </select>
          {prod && (
            <p className="mt-1 text-xs text-slate-500">
              {prod.local ? `Guardado em ${prod.local}. ` : "Sem local definido. "}
              {atual === null ? "Sem movimento lançado." : `Saldo agora: ${comUnidade(atual, prod.unidade)}.`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="rt-qtd">Quantidade{prod ? ` (${prod.unidade || "un"})` : ""}</label>
            <input
              id="rt-qtd" type="text" inputMode="decimal" className="input"
              value={form.quantidade} onChange={setCampo("quantidade")}
            />
          </div>
          <div>
            <label className="label" htmlFor="rt-pessoa">Quem levou</label>
            <select id="rt-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")}>
              <option value="">— não informado —</option>
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rt-motivo">Motivo / O.S.</label>
            <input
              id="rt-motivo" type="text" className="input"
              placeholder="Ex.: análise da O.S. 1420" value={form.motivo} onChange={setCampo("motivo")}
            />
          </div>
          <div>
            <label className="label" htmlFor="rt-data">Data</label>
            <input id="rt-data" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="rt-obs">Observações</label>
          <textarea id="rt-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>

        {/* AVISA e DEIXA GRAVAR: saldo negativo é sintoma de entrada que não foi
            lançada, não de retirada proibida. Travar aqui só faria a pessoa
            levar o frasco sem registrar — e aí o livro perde a saída também. */}
        {depois !== null && depois < 0 && (
          <p className="rounded-xl border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
            O saldo ficaria negativo ({fmtQtd(depois)}) — confira se falta lançar entrada.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.produtoId || q === null || q <= 0 || !form.data}>
            {salvando ? "Gravando..." : "Registrar retirada"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaRetiradas({
  movs, produtos, resumo, equipe, hojeISO, editavel, salvando,
  formRetirada, setFormRetirada, acoes, aoExportar,
}) {
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [produto, setProduto] = useState("");

  const vm = useMemo(() => {
    const unidadeDe = new Map(produtos.map((p) => [p.id, p.unidade || "un"]));
    // Só SAÍDA. Ajuste negativo também tira do saldo, mas é conserto de
    // lançamento, não gente levando material — misturar os dois faria a
    // pergunta "quem pegou o último frasco" responder errado.
    const saidas = movs
      .filter((m) => m.tipo === "saida")
      .map((m) => ({
        ...m,
        qtd: Math.abs(Number(m.quantidade) || 0),
        unidade: unidadeDe.get(m.produtoId) || "",
      }))
      .sort(
        (a, b) =>
          String(b.data || "").localeCompare(String(a.data || "")) ||
          String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))
      );

    // Opções de "Quem": o elenco vivo mais quem já retirou e não está mais
    // nele (carimbo). Sem isso, a retirada de quem saiu ficaria sem filtro.
    const pessoas = equipe.map((p) => ({ id: p.id, nome: p.nome }));
    for (const m of saidas) {
      if (m.pessoaId && !pessoas.some((p) => p.id === m.pessoaId)) {
        pessoas.push({ id: m.pessoaId, nome: m.pessoaNome || "(pessoa fora do elenco)" });
      }
    }
    pessoas.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    const prods = [];
    for (const m of saidas) {
      if (m.produtoId && !prods.some((p) => p.id === m.produtoId)) {
        prods.push({ id: m.produtoId, nome: m.produtoNome || "(produto sem nome)" });
      }
    }
    prods.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    const mes = hojeISO.slice(0, 7);
    const doMes = saidas.filter((m) => String(m.data || "").slice(0, 7) === mes);

    return {
      saidas,
      pessoas,
      prods,
      noMes: doMes.length,
      pessoasMes: new Set(doMes.filter((m) => m.pessoaId).map((m) => m.pessoaId)).size,
      produtosMes: new Set(doMes.map((m) => m.produtoId)).size,
      semPessoa: saidas.filter((m) => !m.pessoaId).length,
    };
  }, [movs, produtos, equipe, hojeISO]);

  const q = busca.trim().toLowerCase();
  const visiveis = vm.saidas.filter((m) => {
    if (pessoa === SEM_PESSOA && m.pessoaId) return false;
    if (pessoa && pessoa !== SEM_PESSOA && m.pessoaId !== pessoa) return false;
    if (produto && m.produtoId !== produto) return false;
    if (q) {
      const alvo = `${m.produtoNome || ""} ${m.pessoaNome || ""} ${m.motivo || ""} ${m.obs || ""}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  });

  const exportar = () => {
    const filtros = [
      pessoa === SEM_PESSOA
        ? "sem quem"
        : pessoa
          ? vm.pessoas.find((p) => p.id === pessoa)?.nome
          : null,
      produto ? vm.prods.find((p) => p.id === produto)?.nome : null,
      q ? `busca "${busca.trim()}"` : null,
    ].filter(Boolean);
    aoExportar({
      nome: "retiradas",
      titulo: `Retiradas do estoque${filtros.length ? ` — ${filtros.join(" · ")}` : ""}`,
      colunas: [
        { chave: "data", rotulo: "Data", tipo: "data" },
        { chave: "produto", rotulo: "Produto", tipo: "texto" },
        { chave: "quantidade", rotulo: "Quantidade", tipo: "numero" },
        { chave: "unidade", rotulo: "Unidade", tipo: "texto" },
        { chave: "pessoa", rotulo: "Quem levou", tipo: "texto" },
        { chave: "motivo", rotulo: "Motivo / O.S.", tipo: "texto" },
        { chave: "obs", rotulo: "Observações", tipo: "texto" },
      ],
      linhas: visiveis.map((m) => ({
        data: m.data || null,
        produto: m.produtoNome || null,
        quantidade: m.qtd,
        unidade: m.unidade || null,
        // Sem pessoa a célula fica VAZIA: escrever "—" faria parecer registro.
        pessoa: m.pessoaNome || null,
        motivo: m.motivo || null,
        obs: m.obs || null,
      })),
    });
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard rotulo="Retiradas no mês" valor={String(vm.noMes)} tom="neutral" icone={PackageMinus} />
        <StatCard rotulo="Pessoas no mês" valor={String(vm.pessoasMes)} sub="com nome registrado" tom="neutral" icone={Users} />
        <StatCard rotulo="Produtos no mês" valor={String(vm.produtosMes)} tom="neutral" icone={Package} />
        <StatCard
          rotulo="Sem quem registrado"
          valor={String(vm.semPessoa)}
          sub="retiradas sem dono no histórico"
          tom={vm.semPessoa > 0 ? "warn" : "ok"}
          icone={UserX}
          onClick={() => setPessoa(pessoa === SEM_PESSOA ? "" : SEM_PESSOA)}
          ativo={pessoa === SEM_PESSOA}
        />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative">
              <label className="label" htmlFor="rt-busca">Buscar</label>
              <Search size={15} className="pointer-events-none absolute left-3 top-[2.15rem] text-slate-400" />
              <input
                id="rt-busca" type="search" className="input w-56 pl-9" placeholder="produto, pessoa, O.S."
                value={busca} onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="rt-quem">Quem</label>
              <select id="rt-quem" className="select w-44" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
                <option value="">Todos</option>
                {vm.pessoas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
                <option value={SEM_PESSOA}>(sem quem registrado)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rt-produto">Produto</label>
              <select id="rt-produto" className="select w-52" value={produto} onChange={(e) => setProduto(e.target.value)}>
                <option value="">Todos</option>
                {vm.prods.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

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
              <button type="button" className="btn-primary" onClick={acoes.abrirRetirada}>
                <Plus size={16} strokeWidth={2.5} /> Registrar retirada
              </button>
            )}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <Empty>
            {vm.saidas.length === 0
              ? "Nenhuma retirada registrada ainda."
              : "Nada neste recorte. Limpe a busca ou os filtros."}
          </Empty>
        ) : (
          <div className="space-y-2">
            {visiveis.map((m) => (
              <LinhaRetirada key={m.id} mv={m} />
            ))}
          </div>
        )}

        {visiveis.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Mostrando {visiveis.length} de {vm.saidas.length}{" "}
            {vm.saidas.length === 1 ? "saída" : "saídas"} · a mais recente em{" "}
            {visiveis[0].data ? dataCurta(visiveis[0].data) : "data não informada"}.
          </p>
        )}
      </Card>

      <ModalRetirada
        form={formRetirada}
        setForm={setFormRetirada}
        produtos={produtos}
        equipe={equipe}
        resumo={resumo}
        salvando={salvando}
        aoSalvar={acoes.registrarRetirada}
        aoFechar={() => setFormRetirada(null)}
      />
    </div>
  );
}

// Semente do formulário de retirada: a data nasce do relógio LOCAL (ymdLocal),
// nunca de toISOString — depois das 21h no Brasil ele devolve o dia de amanhã.
export const retiradaVazia = () => ({ ...RETIRADA_VAZIA, data: ymdLocal(new Date()) });
