/* CURVA ABC DE CLIENTES — quem sustenta a casa, em ordem, com a classe ao lado.
 *
 * A régua é a da Impresilk, trazida inteira (ela mora em lib/curvaAbc.js, com
 * teste próprio): A+ são os que somam os primeiros 30% do valor, A até 80%,
 * B+ até 90%, B até 95%, C o resto. A classe sai do ACUMULADO, não da posição
 * — faixa por contagem ("os 20 primeiros são A") responde "quantos" quando a
 * pergunta é "quanto dinheiro".
 *
 * TRÊS DECISÕES QUE NÃO SÃO GOSTO:
 *
 * 1. A POSIÇÃO É DA CURVA INTEIRA, marcada ANTES do filtro de classe. Quem
 *    filtra a classe B tem de continuar vendo "99º" — um ranking que recomeça
 *    do 1 dentro do filtro faz o 1º da classe B parecer o maior cliente da
 *    casa. (Decisão do Painel da Impresilk, comentada no código de lá.)
 *
 * 2. A CHAVE É O ID, O NOME SÓ EXIBE. O balde é `clienteId` (o código do
 *    Omie); o nome vem do cadastro e serve para ler. Somar por nome junta dois
 *    clientes homônimos e separa o mesmo cliente que trocou de razão social.
 *
 * 3. GRUPO É COISA DE GENTE, NÃO DEDUÇÃO. O mesmo dono com vários CNPJs só
 *    conta junto quando alguém disse que são o mesmo dono (coleção
 *    `fin_grupos`). Adivinhar por nome parecido ou por raiz de CNPJ acerta na
 *    maioria e erra calado no resto — e o erro aqui promove ou rebaixa cliente
 *    de classe.
 *
 * A FONTE é `fin_vendas`, que o ml-omie grava a partir do Omie (NF e O.S. na
 * mesma coleção, porque a análise não pode ter duas verdades). HOJE ELA ESTÁ
 * VAZIA: a ponte está publicada e desligada, à espera dos segredos que só a
 * direção grava. Esta tela não inventa exemplo nenhum — sem venda, ela diz que
 * não há venda e por quê (ver `SemVenda`, em comum.jsx).
 */

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Link2, Pencil, Search, Trash2, X } from "lucide-react";
import { agruparPor, curvaAbc, FAIXAS, faixaDaClasse } from "../../lib/curvaAbc.js";
import { dataLonga, moeda, moedaCheia } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { apagar, listar, salvar } from "../../services/dados.js";
import { Card, Empty, Modal } from "../ui.jsx";
import { Explicacao, LinhaRanking, Secao } from "../lista.jsx";
import {
  AcoesDoRecorte,
  CabecalhoDoPapel,
  CartoesDaCurva,
  ComportamentoNoTempo,
  useRolarAoAbrir,
  SeloClasse,
  SemVenda,
  frasesDoCorte,
  indiceDeNomes,
  num,
  pct,
  plural,
  recortarVendas,
  semAcento,
  useEscolha,
  useSecoes,
} from "./comum.jsx";

const K_SECOES = "minaslab.abc.clientes.secoes";
const K_CLASSE = "minaslab.abc.clientes.classe";
// A curva nasce aberta (é a tela); grupos nasce fechado — é manutenção, não
// leitura do dia.
const SECOES_PADRAO = ["curva", "cliente"];

const COLUNAS = [
  { chave: "posicao", rotulo: "Posição", tipo: "numero" },
  { chave: "classe", rotulo: "Classe" },
  { chave: "cliente", rotulo: "Cliente" },
  { chave: "cnpjs", rotulo: "CNPJs somados", tipo: "numero" },
  { chave: "documentos", rotulo: "Documentos", tipo: "numero" },
  { chave: "participacao", rotulo: "% do valor", tipo: "numero" },
  { chave: "acumulado", rotulo: "% acumulado", tipo: "numero" },
  { chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
];

// "3 O.S.", "3 NF" ou "3 docs" — o rótulo sai do que o recorte TEM. Escrever
// "O.S." num recorte de notas fiscais seria vocabulário de outra empresa
// afirmando coisa errada sobre esta.
function rotuloDeDocumentos(vendasDaLinha) {
  const tipos = new Set(
    vendasDaLinha.map((v) => String(v?.documento || "").toUpperCase()).filter(Boolean)
  );
  const n = vendasDaLinha.length;
  if (tipos.size === 1 && tipos.has("OS")) return plural(n, "O.S.", "O.S.");
  if (tipos.size === 1 && tipos.has("NF")) return plural(n, "NF", "NF");
  return plural(n, "doc.", "docs");
}

/* O FORMULÁRIO DO GRUPO. Fica FORA da página de propósito: componente
   declarado dentro remonta a subárvore a cada tecla e o campo perde o foco
   (três telas da Impresilk ao mesmo tempo, com build e lint verdes).
   O estado do formulário é do chamador — é ele que grava e que sabe validar. */
function ModalGrupo({ form, setForm, candidatos, grupoPorCliente, salvando, aoSalvar, aoApagar, aoFechar }) {
  if (!form) return null;
  const busca = semAcento(form.busca || "");
  const escolhidos = new Set(form.chaves || []);
  const achados = candidatos.filter((c) => {
    if (escolhidos.has(c.id)) return false;
    if (busca.length < 2) return false;
    return semAcento(c.nome).includes(busca) || semAcento(c.doc).includes(busca) || c.id.includes(busca);
  });

  const alternar = (id) =>
    setForm((f) => ({
      ...f,
      chaves: (f.chaves || []).includes(id) ? f.chaves.filter((x) => x !== id) : [...(f.chaves || []), id],
    }));

  return (
    <Modal titulo={form.id ? "Editar grupo de CNPJs" : "Vincular CNPJs"} aberto aoFechar={aoFechar} largura="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-500">
          O mesmo dono comprando por vários CNPJs vira UM cliente na curva — os valores somam e a linha
          passa a mostrar de quantos CNPJs ela é feita. Cada CNPJ só pode estar em um grupo.
        </p>

        <div>
          <label className="label" htmlFor="grupo-nome">
            Nome do grupo
          </label>
          <input
            id="grupo-nome"
            type="text"
            className="input"
            placeholder="Ex.: Grupo Aliança"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </div>

        <div>
          <span className="label">CNPJs deste grupo ({(form.chaves || []).length})</span>
          {(form.chaves || []).length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum ainda — busque abaixo e toque para juntar.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(form.chaves || []).map((id) => {
                const c = candidatos.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800"
                  >
                    {c ? c.nome : `Cliente #${id}`}
                    <button
                      type="button"
                      className="text-brand-600 hover:text-bad-600"
                      onClick={() => alternar(id)}
                      aria-label={`Tirar ${c ? c.nome : id} do grupo`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="grupo-busca">
            Procurar cliente
          </label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input
              id="grupo-busca"
              type="text"
              className="input pl-9"
              placeholder="Nome, CNPJ/CPF ou código do Omie"
              value={form.busca || ""}
              onChange={(e) => setForm((f) => ({ ...f, busca: e.target.value }))}
            />
          </div>
          <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {busca.length < 2 ? (
              <p className="text-xs text-slate-400">Digite ao menos duas letras.</p>
            ) : achados.length === 0 ? (
              <p className="text-xs text-slate-400">Ninguém com esse nome no cadastro nem nas vendas.</p>
            ) : (
              achados.slice(0, 40).map((c) => {
                const jaEm = grupoPorCliente.get(c.id);
                const travado = !!jaEm && jaEm.id !== form.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={travado}
                    title={
                      travado
                        ? `Já está no grupo “${jaEm.nome}”. Tire de lá primeiro — um CNPJ só pode estar em um grupo.`
                        : undefined
                    }
                    onClick={() => alternar(c.id)}
                    className={clsx(
                      "flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                      travado ? "cursor-not-allowed opacity-40" : "hover:bg-slate-50"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-700">{c.nome}</span>
                    {c.doc && <span className="tnum shrink-0 text-[11px] text-slate-400">{c.doc}</span>}
                    <span className="tnum w-24 shrink-0 text-right text-xs text-slate-500">
                      {c.valor > 0 ? moeda(c.valor) : "—"}
                    </span>
                  </button>
                );
              })
            )}
            {achados.length > 40 && (
              <p className="text-[11px] text-slate-400">
                e mais {achados.length - 40} — escreva mais letras para estreitar.
              </p>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            A coluna da direita é o que o cliente comprou no recorte que está na tela; travessão quer dizer
            que ele não comprou neste recorte, não que nunca comprou.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {form.id ? (
            <button type="button" className="btn-ghost text-bad-700" onClick={aoApagar} disabled={salvando}>
              <Trash2 size={15} strokeWidth={2.5} /> Desfazer grupo
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={aoSalvar} disabled={salvando}>
              {salvando ? "Gravando…" : "Gravar grupo"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* O QUE ABRE NO TOQUE: o comportamento do cliente no tempo e as vendas do
   recorte. Também fora da página, pela mesma razão. */
function DetalheDoCliente({ linha, itensNoTempo, vendasDoRecorte, membros, receberInfo, anoTexto, editavel, aoEditarGrupo }) {
  const teto = Math.max(...vendasDoRecorte.map((v) => num(v.valor) ?? 0), 0);
  return (
    <div className="space-y-4">
      {linha.item.ehGrupo && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="min-w-0">
            Grupo de CNPJs — soma de: {membros.length ? membros.join(" · ") : "nenhum membro gravado"}
          </span>
          {editavel && (
            <button type="button" className="btn-ghost !px-2 !py-0.5 text-xs" onClick={aoEditarGrupo}>
              <Pencil size={12} /> Editar grupo
            </button>
          )}
        </div>
      )}

      <ComportamentoNoTempo
        itens={itensNoTempo}
        anoPadrao={anoTexto}
        um="venda"
        varios="vendas"
      />

      <div>
        <span className="font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
          {anoTexto ? `Vendas de ${anoTexto}` : "Vendas do recorte"}
        </span>
        <div className="mt-1.5 max-h-96 overflow-y-auto pr-1">
          {vendasDoRecorte.map((v) => (
            <LinhaRanking
              key={v.id}
              nome={
                <>
                  <span className="tnum mr-1.5 text-xs text-slate-400">{dataLonga(v.data)}</span>
                  {String(v.documento || "doc").toUpperCase()} {v.numero || "sem número"}
                </>
              }
              valor={num(v.valor) === null ? null : moeda(v.valor)}
              apoios={linha.item.ehGrupo ? [`#${v.clienteId}`] : []}
              medida={num(v.valor) ?? undefined}
              teto={teto}
            />
          ))}
        </div>
        {linha.item.ehGrupo && (
          <p className="mt-1 text-[11px] text-slate-400">
            A coluna cinza é o código do CNPJ que emitiu cada documento — num grupo, é ela que diz por
            qual empresa o dono comprou.
          </p>
        )}
      </div>

      {receberInfo && (
        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          {receberInfo.titulos === 0 ? (
            <>Nenhum título em aberto no financeiro para este cliente.</>
          ) : (
            <>
              {plural(receberInfo.titulos, "título em aberto", "títulos em aberto")} no financeiro, somando{" "}
              <strong className="tnum font-semibold text-slate-800">{moedaCheia(receberInfo.valor)}</strong>
              {receberInfo.vencidos > 0 && ` — ${receberInfo.vencidos} com vencimento já passado.`}
            </>
          )}
          <span className="block text-[11px] text-slate-400">
            Contas a receber é outro recorte: ele não olha o ano da curva, e sim tudo o que está aberto
            hoje.
          </span>
        </div>
      )}
    </div>
  );
}

export default function AbaClientes({ vendas, clientes, receber, ano, hojeISO, editavel, setAviso }) {
  /* `null` é CARREGANDO, e é diferente de `[]` (nenhum grupo). Enquanto os
     grupos não chegam, a curva NÃO é desenhada: uma curva montada sem os
     grupos classifica o dono de três CNPJs três vezes mais baixo, e ela
     apareceria certa por um segundo e mudaria sozinha. */
  const [grupos, setGrupos] = useState(null);
  const [gruposFalhou, setGruposFalhou] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [classeVista, escolherClasse] = useEscolha(K_CLASSE, "");
  const [grupoAberto, setGrupoAberto] = useState(() => {
    const f = FAIXAS.find((x) => x.id === classeVista) || faixaDaClasse(classeVista);
    return f && f.membros.length > 1 ? f.id : null;
  });
  const [secaoAberta, alternarSecao, abrirSecao] = useSecoes(K_SECOES, SECOES_PADRAO);
  /* O quadro do detalhe nasce depois de um ranking de dezenas de linhas —
     sem isto ele abriria fora da dobra e o clique pareceria não ter feito
     nada. Ver useRolarAoAbrir em comum.jsx. */
  const alvoDoDetalhe = useRolarAoAbrir(aberto);

  useEffect(() => {
    let vivo = true;
    /* Falhar aqui NÃO pode virar "nenhum grupo ainda": além de mentir, com a
       lista vazia a conferência de duplicidade deixaria gravar um CNPJ que já
       está noutro grupo. Falhou = curva sem grupos, dito em voz alta, e o
       botão de vincular fica fora do ar. */
    listar("fin_grupos")
      .then((g) => {
        if (!vivo) return;
        setGrupos(Array.isArray(g) ? g : []);
        setGruposFalhou(false);
      })
      .catch(() => {
        if (!vivo) return;
        setGrupos([]);
        setGruposFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const anoTexto = /^\d{4}$/.test(String(ano ?? "")) ? String(ano) : "";
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(String(hojeISO ?? "")) ? String(hojeISO) : "";

  const recorte = useMemo(() => recortarVendas(vendas, anoTexto), [vendas, anoTexto]);
  const nomes = useMemo(() => indiceDeNomes(clientes, vendas), [clientes, vendas]);
  const grupoPorId = useMemo(() => new Map((grupos || []).map((g) => [String(g.id), g])), [grupos]);
  const grupoPorCliente = useMemo(() => {
    const m = new Map();
    for (const g of grupos || []) {
      for (const ch of g.chaves || []) m.set(String(ch), { id: String(g.id), nome: String(g.nome || "sem nome") });
    }
    return m;
  }, [grupos]);

  /* Venda SEM cliente identificado não entra na curva. Se entrasse, todas
     elas cairiam no mesmo balde de chave vazia e a tela mostraria um cliente
     gigante que não existe — o pior tipo de erro, o que parece resultado. */
  const semCliente = useMemo(() => {
    const soltas = recorte.usadas.filter((v) => String(v?.clienteId ?? "") === "");
    return { quantidade: soltas.length, valor: soltas.reduce((t, v) => t + (num(v.valor) ?? 0), 0) };
  }, [recorte]);

  const abc = useMemo(() => {
    if (grupos === null) return null;
    const mapa = {};
    for (const g of grupos) {
      for (const ch of g.chaves || []) mapa[String(ch)] = String(g.id);
    }
    const comCliente = recorte.usadas.filter((v) => String(v?.clienteId ?? "") !== "");
    // O AGRUPAMENTO VEM ANTES DA CURVA: somar as classes de três CNPJs
    // classificados em separado daria outra resposta, e a errada.
    const baldes = agruparPor(comCliente, mapa, {
      chaveDe: (v) => v.clienteId,
      valorDe: (v) => v.valor,
    });
    return curvaAbc(baldes, {
      valorDe: (b) => b.valor,
      // O prefixo separa um grupo de um cliente avulso de mesmo código.
      chaveDe: (b) => (b.ehGrupo ? `g:${b.chave}` : `s:${b.chave}`),
      rotuloDe: (b) =>
        b.ehGrupo
          ? grupoPorId.get(b.chave)?.nome || `Grupo #${b.chave}`
          : nomes.get(b.chave) || `Cliente #${b.chave}`,
    });
  }, [grupos, recorte, nomes, grupoPorId]);

  const membrosDaFaixa = useMemo(() => {
    const f = FAIXAS.find((x) => x.id === classeVista);
    if (f) return f.membros;
    return classeVista ? [classeVista] : null;
  }, [classeVista]);

  const lista = useMemo(() => {
    if (!abc) return [];
    return membrosDaFaixa ? abc.curva.filter((c) => membrosDaFaixa.includes(c.classe)) : abc.curva;
  }, [abc, membrosDaFaixa]);

  const linhaAberta = useMemo(
    () => (aberto && abc ? abc.curva.find((c) => c.chave === aberto) || null : null),
    [aberto, abc]
  );

  /* O detalhe olha DUAS janelas de propósito: o ano a ano é o histórico
     completo (é ele que mostra o cliente que sumiu), e as vendas listadas são
     as do recorte que está na tela. Misturar as duas faria a soma do detalhe
     não bater com a linha do ranking. */
  const detalhe = useMemo(() => {
    if (!linhaAberta) return null;
    const b = linhaAberta.item;
    const ids = new Set(
      (b.ehGrupo ? grupoPorId.get(b.chave)?.chaves || b.chaves : [b.chave]).map((x) => String(x))
    );
    const historico = recorte.validas.filter((v) => ids.has(String(v.clienteId ?? "")));
    const vendasDoRecorte = [...b.itens].sort((x, y) => String(y.data).localeCompare(String(x.data)));
    const membros = [...ids].map((id) => nomes.get(id) || `Cliente #${id}`);

    const emAberto = (Array.isArray(receber) ? receber : []).filter(
      (r) => ids.has(String(r?.clienteId ?? "")) && String(r?.status) === "aberto"
    );
    const receberInfo =
      Array.isArray(receber) && receber.length > 0
        ? {
            titulos: emAberto.length,
            valor: emAberto.reduce((t, r) => t + (num(r.valor) ?? 0), 0),
            vencidos: hoje ? emAberto.filter((r) => r.vencimento && String(r.vencimento) < hoje).length : 0,
          }
        : null;

    return {
      membros,
      vendasDoRecorte,
      receberInfo,
      itensNoTempo: historico.map((v) => ({ data: v.data, valor: num(v.valor) ?? 0 })),
    };
  }, [linhaAberta, grupoPorId, recorte, nomes, receber, hoje]);

  // Todo mundo que pode entrar num grupo: o cadastro inteiro mais qualquer id
  // que apareceu numa venda sem estar no cadastro.
  const candidatos = useMemo(() => {
    const porId = new Map();
    for (const [id, nome] of nomes) porId.set(id, { id, nome, doc: "", valor: 0 });
    for (const c of Array.isArray(clientes) ? clientes : []) {
      const id = String(c?.omieId || c?.id || "");
      if (!id) continue;
      const atual = porId.get(id) || { id, nome: `Cliente #${id}`, doc: "", valor: 0 };
      porId.set(id, { ...atual, doc: String(c?.doc || ""), nome: atual.nome });
    }
    for (const v of recorte.usadas) {
      const id = String(v?.clienteId ?? "");
      if (!id) continue;
      const atual = porId.get(id) || { id, nome: `Cliente #${id}`, doc: String(v?.clienteDoc || ""), valor: 0 };
      porId.set(id, { ...atual, valor: atual.valor + (num(v.valor) ?? 0) });
    }
    return [...porId.values()].sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [nomes, clientes, recorte]);

  const rotuloDaClasse = classeVista ? classeVista.replace("*", "") : "";
  const totalDeClientes = abc ? abc.curva.length : 0;

  const gravarGrupo = async () => {
    const nome = String(form?.nome || "").trim();
    const chaves = [...new Set((form?.chaves || []).map(String))];
    if (!nome) return setAviso({ tipo: "erro", texto: "Dê um nome ao grupo." });
    if (chaves.length < 2) return setAviso({ tipo: "erro", texto: "Um grupo precisa de pelo menos dois CNPJs." });
    if (gruposFalhou) {
      return setAviso({
        tipo: "erro",
        texto: "Os grupos não carregaram — sem a lista atual eu não tenho como conferir se um CNPJ já está em outro grupo.",
      });
    }
    /* UM CNPJ, UM GRUPO. Sem esta trava, o mesmo cliente contaria num grupo e
       sumiria do outro em silêncio, e as duas curvas ficariam erradas. */
    const conflito = chaves.map((ch) => grupoPorCliente.get(ch)).find((g) => g && g.id !== String(form?.id || ""));
    if (conflito) {
      return setAviso({
        tipo: "erro",
        texto: `Um dos CNPJs já está no grupo “${conflito.nome}”. Tire de lá primeiro — cada CNPJ só pode estar em um grupo.`,
      });
    }
    setSalvando(true);
    try {
      const salvo = await salvar("fin_grupos", { ...(form.id ? { id: form.id } : {}), nome, chaves });
      setGrupos((atual) => [...(atual || []).filter((g) => String(g.id) !== String(salvo.id)), salvo]);
      setForm(null);
      // O recorte muda de verdade: a linha aberta pode nem existir mais.
      setAberto(null);
      setAviso({ tipo: "ok", texto: `Grupo “${nome}” gravado. A curva já conta os CNPJs juntos.` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const desfazerGrupo = async (id, nome) => {
    if (!window.confirm(`Desfazer o grupo “${nome}”? Os CNPJs voltam a contar separados na curva.`)) return;
    setSalvando(true);
    try {
      await apagar("fin_grupos", id);
      setGrupos((atual) => (atual || []).filter((g) => String(g.id) !== String(id)));
      setForm(null);
      setAberto(null);
      setAviso({ tipo: "ok", texto: `Grupo “${nome}” desfeito.` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // A planilha leva a lista QUE ESTÁ NA TELA, com o filtro de classe aplicado
  // — planilha que discorda da tela é a próxima reunião perdida.
  const baixar = () => {
    if (!lista.length) {
      return setAviso({ tipo: "erro", texto: "Não há cliente nenhum neste recorte para baixar." });
    }
    try {
      const arquivo = baixarPlanilha({
        nome: `curva-abc-clientes${anoTexto ? `-${anoTexto}` : ""}`,
        titulo: `Curva ABC de clientes${anoTexto ? ` — ${anoTexto}` : ""}`,
        colunas: COLUNAS,
        linhas: lista.map((c) => ({
          posicao: c.posicao,
          classe: c.classe,
          cliente: c.rotulo,
          cnpjs: c.item.chaves.length,
          documentos: c.item.itens.length,
          participacao: c.participacao === null ? null : Math.round(c.participacao * 1000) / 10,
          acumulado: c.acumulado === null ? null : Math.round(c.acumulado * 1000) / 10,
          valor: c.valor,
        })),
      });
      setAviso({ tipo: "ok", texto: `Planilha baixada: ${arquivo} (${plural(lista.length, "cliente", "clientes")}).` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  if (grupos === null) {
    return (
      <Card className="py-8 text-center text-sm text-slate-400">
        Lendo os grupos de CNPJ antes de somar a curva…
      </Card>
    );
  }

  if (!abc || abc.vazio) {
    return (
      <div className="space-y-4">
        <CabecalhoDoPapel
          titulo={`MinasLab — Curva ABC de clientes${anoTexto ? ` · ${anoTexto}` : ""}`}
          linhas={[hoje ? `Emitido em ${dataLonga(hoje)}` : null, "Nenhuma venda no recorte."]}
        />
        <SemVenda
          vendas={vendas}
          clientes={clientes}
          anoTexto={anoTexto}
          recorte={recorte}
          unidade="venda"
          notas={[
            semCliente.quantidade > 0
              ? `${plural(semCliente.quantidade, "venda do recorte veio", "vendas do recorte vieram")} sem cliente identificado (${moeda(
                  semCliente.valor
                )}): sem código de cliente não há em quem somar.`
              : null,
          ]}
        />
      </div>
    );
  }

  const tetoDaCurva = abc.curva.length ? abc.curva[0].valor : 0;

  return (
    <div className="space-y-4">
      <CabecalhoDoPapel
        titulo={`MinasLab — Curva ABC de clientes${anoTexto ? ` · ${anoTexto}` : " · todos os anos"}`}
        linhas={[
          hoje ? `Emitido em ${dataLonga(hoje)}` : null,
          `${plural(totalDeClientes, "cliente", "clientes")} no recorte · ${moedaCheia(abc.total)}`,
          "A+ soma os primeiros 30% do valor · A até 80% · B+ até 90% · B até 95% · C o resto. Grupo de CNPJs conta como um cliente.",
          classeVista ? `Impresso só com a classe ${rotuloDaClasse}.` : null,
          ...frasesDoCorte(recorte),
        ]}
      />

      {gruposFalhou && (
        <p className="sem-impressao rounded-xl bg-warn-50 px-3.5 py-2.5 text-xs text-warn-800">
          Os grupos de CNPJ não carregaram. Esta curva está contando cada CNPJ separado — o dono com
          várias empresas aparece dividido, em classe mais baixa do que a real. Recarregue a página para
          tentar de novo.
        </p>
      )}

      <Secao
        titulo={anoTexto ? `Curva ABC de ${anoTexto}` : "Curva ABC — todos os anos"}
        sub={`${plural(totalDeClientes, "cliente", "clientes")} no recorte · ${moedaCheia(abc.total)}`}
        aberta={secaoAberta("curva")}
        aoAlternar={() => alternarSecao("curva")}
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {editavel && !gruposFalhou && (
              <button
                type="button"
                className="btn-outline"
                title="Juntar os CNPJs do mesmo dono para contarem como um cliente só"
                onClick={() => setForm({ id: "", nome: "", chaves: [], busca: "" })}
              >
                <Link2 size={16} strokeWidth={2.5} /> Vincular CNPJs
              </button>
            )}
            <AcoesDoRecorte aoBaixarPlanilha={baixar} />
          </div>
        }
      >
        <CartoesDaCurva
          faixas={abc.faixas}
          unidade={{ um: "cliente", varios: "clientes" }}
          classeVista={classeVista}
          aoEscolherClasse={escolherClasse}
          grupoAberto={grupoAberto}
          aoAlternarGrupo={setGrupoAberto}
        />

        <Explicacao>
          Todos os compradores do recorte, em ordem de valor: <strong>A+</strong> são os que somam os
          primeiros 30% do dinheiro, <strong>A</strong> até 80%, <strong>B+</strong> até 90%,{" "}
          <strong>B</strong> até 95%, <strong>C</strong> o resto — a classe sai do acumulado, não da
          posição. O número forte é o faturamento no recorte; as colunas cinza contam os documentos e a
          fatia dele no total. A barra compara com o maior cliente da curva inteira, e por isso a cauda
          desenha barras curtas mesmo com a classe C filtrada. <strong>Toque num cliente</strong> para o
          comportamento dele mês a mês e ano a ano.
        </Explicacao>

        {classeVista && (
          <div className="sem-impressao flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Mostrando só a classe <strong className="text-slate-700">{rotuloDaClasse}</strong> —{" "}
              {plural(lista.length, "cliente", "clientes")} de {totalDeClientes}. A posição continua sendo
              a da curva inteira.
            </span>
            <button
              type="button"
              className="font-medium text-brand-600 underline"
              onClick={() => {
                escolherClasse("");
                setGrupoAberto(null);
              }}
            >
              ver todos
            </button>
          </div>
        )}

        {lista.length === 0 ? (
          <Empty>Nenhum cliente na classe {rotuloDaClasse} neste recorte.</Empty>
        ) : (
          <div>
            {lista.map((c) => (
              <LinhaRanking
                key={c.chave}
                nome={
                  <>
                    <span className="tnum mr-1.5 font-display text-[11px] font-medium text-slate-400">
                      {c.posicao}º
                    </span>
                    <SeloClasse classe={c.classe} />
                    <span title={c.rotulo}>{c.rotulo}</span>
                    {c.item.ehGrupo && (
                      <span
                        className="ml-1.5 rounded bg-brand-50 px-1 py-px text-[10px] font-medium text-brand-700"
                        title={`Grupo de CNPJs: ${c.item.chaves.length} de ${
                          grupoPorId.get(c.item.chave)?.chaves?.length ?? c.item.chaves.length
                        } compraram neste recorte.`}
                      >
                        grupo · {c.item.chaves.length} CNPJs
                      </span>
                    )}
                  </>
                }
                valor={moeda(c.valor)}
                apoios={[rotuloDeDocumentos(c.item.itens), pct(c.participacao)]}
                medida={c.valor}
                teto={tetoDaCurva}
                /* UM SINAL DE ESTADO POR LINHA: aqui ele é o selo da classe.
                   Tingir também a barra e o valor pintaria a lista inteira, e
                   tom em tudo é tom em nada. */
                aberta={aberto === c.chave}
                /* Clicar no cliente PEDE o detalhe: além de escolher a linha,
                   garante que o quadro esteja aberto. Se ele estivesse
                   recolhido (escolha guardada no aparelho), o clique
                   renderizaria um quadro fechado e nada apareceria. */
                aoAbrir={() => {
                  const proximo = aberto === c.chave ? null : c.chave;
                  setAberto(proximo);
                  if (proximo) abrirSecao("cliente");
                }}
              />
            ))}
          </div>
        )}

        {(semCliente.quantidade > 0 || frasesDoCorte(recorte).length > 0 || abc.foraDaCurva.quantidade > 0) && (
          <div className="space-y-0.5 text-[11px] text-slate-400">
            {semCliente.quantidade > 0 && (
              <p>
                {plural(semCliente.quantidade, "venda do recorte", "vendas do recorte")} sem cliente
                identificado ({moeda(semCliente.valor)}) — fora da curva: sem código de cliente não dá
                para dizer de quem é.
              </p>
            )}
            {abc.foraDaCurva.quantidade > 0 && (
              <p>
                {plural(abc.foraDaCurva.quantidade, "cliente comprou", "clientes compraram")} zero ou
                valor negativo no recorte — fora da curva: quem não comprou não tem posição na curva de
                quem comprou.
              </p>
            )}
            {frasesDoCorte(recorte).map((f) => (
              <p key={f}>{f}</p>
            ))}
          </div>
        )}
      </Secao>

      {linhaAberta && detalhe && (
        <div ref={alvoDoDetalhe}>
        <Secao
          titulo={linhaAberta.rotulo}
          sub={`${linhaAberta.posicao}º da curva · classe ${linhaAberta.classe} · ${moedaCheia(
            linhaAberta.valor
          )} no recorte · ${pct(linhaAberta.participacao) ?? "—"} do total`}
          aberta={secaoAberta("cliente")}
          aoAlternar={() => alternarSecao("cliente")}
          acao={
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => setAberto(null)}
              aria-label="Fechar o cliente"
            >
              <X size={16} />
            </button>
          }
        >
          <DetalheDoCliente
            /* A chave remonta o quadro quando muda o cliente: sem ela, o ano
               escolhido no mês a mês do cliente anterior ficaria de pé no
               próximo, mostrando um recorte que ninguém pediu. */
            key={linhaAberta.chave}
            linha={linhaAberta}
            itensNoTempo={detalhe.itensNoTempo}
            vendasDoRecorte={detalhe.vendasDoRecorte}
            membros={detalhe.membros}
            receberInfo={detalhe.receberInfo}
            anoTexto={anoTexto}
            editavel={editavel}
            aoEditarGrupo={() => {
              const g = grupoPorId.get(linhaAberta.item.chave);
              if (!g) return;
              setForm({ id: String(g.id), nome: String(g.nome || ""), chaves: (g.chaves || []).map(String), busca: "" });
            }}
          />
        </Secao>
        </div>
      )}

      {(grupos.length > 0 || editavel) && (
        <Secao
          titulo="Grupos de CNPJ"
          sub={
            grupos.length === 0
              ? "nenhum grupo ainda — cada CNPJ conta sozinho na curva"
              : `${plural(grupos.length, "grupo", "grupos")} somando CNPJs do mesmo dono`
          }
          aberta={secaoAberta("grupos")}
          aoAlternar={() => alternarSecao("grupos")}
        >
          <Explicacao>
            O mesmo dono comprando por vários CNPJs vira <strong>um cliente</strong> na curva. Isto não é
            deduzido de nome parecido nem de raiz de CNPJ: alguém precisa dizer que são o mesmo dono, e é
            o que se faz aqui.
          </Explicacao>
          {grupos.length === 0 ? (
            <Empty>Nenhum grupo gravado.</Empty>
          ) : (
            <div className="space-y-0.5">
              {grupos.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                    {g.nome || "grupo sem nome"}
                  </span>
                  <span className="tnum shrink-0 text-xs text-slate-400">
                    {plural((g.chaves || []).length, "CNPJ", "CNPJs")}
                  </span>
                  {editavel && (
                    <span className="sem-impressao flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() =>
                          setForm({
                            id: String(g.id),
                            nome: String(g.nome || ""),
                            chaves: (g.chaves || []).map(String),
                            busca: "",
                          })
                        }
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs text-bad-700"
                        onClick={() => desfazerGrupo(g.id, g.nome || "sem nome")}
                        disabled={salvando}
                      >
                        <Trash2 size={13} /> Desfazer
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Secao>
      )}

      <ModalGrupo
        form={form}
        setForm={setForm}
        candidatos={candidatos}
        grupoPorCliente={grupoPorCliente}
        salvando={salvando}
        aoSalvar={gravarGrupo}
        aoApagar={() => desfazerGrupo(form.id, form.nome || "sem nome")}
        aoFechar={() => setForm(null)}
      />
    </div>
  );
}
