/* CURVA ABC DE SERVIÇOS — o que a casa fatura, em ordem de faturamento.
 *
 * A régua é a mesma da aba Clientes (lib/curvaAbc.js: A+ até 30% do valor
 * acumulado, A até 80%, B+ até 90%, B até 95%, C o resto). O que muda é a
 * UNIDADE: aqui a linha não é o comprador, é o ITEM do faturamento.
 *
 * ============================================================================
 * NESTA CASA O ITEM É A CATEGORIA FINANCEIRA — E A TELA DIZ ISSO (30/08/2026)
 *
 * A aba nasceu copiando a Impresilk, onde o item vem dentro da nota fiscal:
 * "camiseta", "adesivo", o produto de verdade. Aqui não existe nota de produto
 * (0 medidas) e o faturamento entra por título a receber, que não tem itens —
 * tem uma CATEGORIA ("1.01.02 — Serviços realizados").
 *
 * CORREÇÃO DE 30/08/2026 — HÁ ORDENS DE SERVIÇO, SIM: 2.251 delas. A primeira
 * medição disse "0 O.S." e estava ERRADA, por um defeito meu e não do ERP: a
 * sondagem lia `nTotRegistros` na resposta, campo que não existe nessa família
 * da API (o certo é `total_de_registros`), e o `undefined` virou 0. Um zero
 * inventado é pior que nenhuma medição, porque tem cara de fato.
 *
 * Só que a O.S. TAMBÉM não separa ensaio: todas as 907 de 2026 têm UM item de
 * serviço só, com a mesma descrição-carimbo ("Nota fiscal referente aos
 * serviços analíticos Minaslab"). O que ela carrega de útil é a referência do
 * LIMS (Contrato e O.S. internos) escrita dentro dessa descrição — que aponta
 * para fora do Omie, não para um ensaio.
 *
 * Então esta aba mostra a curva por categoria, que é o nível de detalhe que
 * existe — e a faixa de explicação avisa, com todas as letras, que não é
 * ensaio a ensaio. Sem esse aviso o leitor veria "Análises Ambientais" na
 * classe A+ e concluiria que descobriu o produto campeão, quando na verdade
 * está olhando o balde que contém quase tudo.
 *
 * O dia em que a MinasLab emitir nota com item no Omie, a tradução em
 * lib/faturamento.js passa a mandar o item de verdade e esta aba vira a curva
 * de produto sem trocar uma linha aqui.
 *
 * O BALDE É O CÓDIGO, e a descrição é só rótulo. Num laboratório o mesmo
 * ensaio troca de redação entre uma O.S. e outra ("Ensaio de compressão",
 * "ENSAIO COMPRESSAO 28d"); agrupar por descrição partiria o produto em três
 * linhas médias e nenhuma delas apareceria na classe A. Por isso o código
 * manda e a tela mostra a descrição MAIS RECENTE daquele código — a redação
 * de hoje, não a de 2019.
 *
 * ITEM SEM CÓDIGO NÃO VIRA PRODUTO. Ele sai do ranking e volta contado
 * embaixo, com o dinheiro que carregava: enfiá-lo num balde "sem código"
 * criaria um produto-fantasma que às vezes entra na classe A.
 *
 * A QUANTIDADE SÓ APARECE INTEIRA. Se uma linha do produto veio sem
 * quantidade, a soma das outras não é a quantidade dele — é um pedaço se
 * passando pelo todo. Nesse caso a coluna mostra travessão e o motivo no
 * title. (E mesmo somando tudo: o Omie não manda a unidade de medida dentro
 * do item, então o número é a soma das quantidades lançadas, sem unidade — é
 * o que o dado permite afirmar.)
 *
 * NENHUM NÚMERO DE EXEMPLO ENTRA AQUI. Sem faturamento importado, a tela diz
 * que não há faturamento e por quê — não desenha uma curva de mentira.
 */

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { curvaAbc, FAIXAS } from "../../lib/curvaAbc.js";
import { dataLonga, moeda, moedaCheia } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import { Empty } from "../ui.jsx";
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
  useEscolha,
  useSecoes,
} from "./comum.jsx";

const K_SECOES = "minaslab.abc.produtos.secoes";
const K_CLASSE = "minaslab.abc.produtos.classe";
const SECOES_PADRAO = ["curva", "produto"];

const COLUNAS = [
  { chave: "posicao", rotulo: "Posição", tipo: "numero" },
  { chave: "classe", rotulo: "Classe" },
  { chave: "codigo", rotulo: "Código" },
  { chave: "produto", rotulo: "Categoria" },
  { chave: "vendas", rotulo: "Títulos", tipo: "numero" },
  { chave: "quantidade", rotulo: "Quantidade", tipo: "numero" },
  { chave: "participacao", rotulo: "% do valor", tipo: "numero" },
  { chave: "acumulado", rotulo: "% acumulado", tipo: "numero" },
  { chave: "valor", rotulo: "Faturamento", tipo: "dinheiro" },
];

/* Abre as vendas em linhas de item e junta por código. Devolve também tudo o
   que NÃO virou produto — é o que permite a tela dizer por que a soma dos
   produtos não bate com a soma das vendas, em vez de deixar a pessoa
   descobrir sozinha e desconfiar das duas. */
function produtosDoRecorte(vendasUsadas) {
  const porCodigo = new Map();
  let semCodigo = 0;
  let semCodigoValor = 0;
  let vendasSemItens = 0;
  let somaDosItens = 0;
  let somaDasVendas = 0;

  for (const v of vendasUsadas) {
    somaDasVendas += num(v?.valor) ?? 0;
    const itens = Array.isArray(v?.itens) ? v.itens : [];
    if (itens.length === 0) {
      vendasSemItens += 1;
      continue;
    }
    for (const it of itens) {
      const valor = num(it?.valor);
      somaDosItens += valor ?? 0;
      const codigo = String(it?.codigo ?? "").trim();
      if (!codigo) {
        semCodigo += 1;
        semCodigoValor += valor ?? 0;
        continue;
      }
      let p = porCodigo.get(codigo);
      if (!p) {
        p = {
          codigo,
          descricao: "",
          diaDaDescricao: "",
          valor: 0,
          quantidade: 0,
          semQuantidade: 0,
          linhas: 0,
          vendas: new Set(),
          itens: [],
        };
        porCodigo.set(codigo, p);
      }
      p.valor += valor ?? 0;
      p.linhas += 1;
      const q = num(it?.quantidade);
      if (q === null) p.semQuantidade += 1;
      else p.quantidade += q;
      p.vendas.add(v.id);
      p.itens.push({ venda: v, item: it });
      // A descrição MAIS RECENTE do código: a redação de hoje é a que a
      // pessoa reconhece. Empate de data fica com a primeira lida — mudar de
      // rótulo a cada carregamento seria pior que escolher.
      const dia = String(v?.data ?? "");
      const desc = String(it?.descricao ?? "").trim();
      if (desc && dia > p.diaDaDescricao) {
        p.descricao = desc;
        p.diaDaDescricao = dia;
      }
    }
  }

  const arredondar = (n) => Math.round(n * 100) / 100;
  return {
    produtos: [...porCodigo.values()].map((p) => ({ ...p, valor: arredondar(p.valor) })),
    semCodigo,
    semCodigoValor: arredondar(semCodigoValor),
    vendasSemItens,
    somaDosItens: arredondar(somaDosItens),
    somaDasVendas: arredondar(somaDasVendas),
  };
}

/* O que abre no toque de um produto: o comportamento dele no tempo e quem
   compra. Fora do componente da página de propósito — componente declarado
   dentro remonta a subárvore a cada render (e o lint reprova). */
function DetalheDoProduto({ produto, itensNoTempo, compradores, anoTexto }) {
  const teto = compradores.length ? compradores[0].valor : 0;
  return (
    <div className="space-y-4">
      <ComportamentoNoTempo itens={itensNoTempo} anoPadrao={anoTexto} um="venda" varios="vendas" />

      <div>
        <span className="font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
          Quem compra {anoTexto ? `em ${anoTexto}` : "neste recorte"}
        </span>
        <div className="mt-1.5 max-h-96 overflow-y-auto pr-1">
          {compradores.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum comprador identificado neste recorte.</p>
          ) : (
            compradores.map((c) => (
              <LinhaRanking
                key={c.id}
                nome={c.nome}
                valor={moeda(c.valor)}
                apoios={[plural(c.vendas, "venda", "vendas")]}
                medida={c.valor}
                teto={teto}
              />
            ))
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Código {produto.codigo} · {plural(produto.linhas, "linha de item", "linhas de item")} em{" "}
        {plural(produto.vendas.size, "venda", "vendas")}
        {produto.semQuantidade > 0 &&
          ` · ${plural(produto.semQuantidade, "linha veio", "linhas vieram")} sem quantidade`}
        .
      </p>
    </div>
  );
}

/* Recebe o mesmo contrato de props da aba Clientes; `receber` e `editavel`
   não entram aqui porque esta aba não escreve nada e não olha o financeiro —
   ela só lê fin_vendas. */
/* QUANDO A CURVA NÃO SEPARA NADA, A TELA DIZ ISSO ANTES DE DESENHAR.
   Medido no Omie da MinasLab em 30/08/2026: 748 dos 748 títulos de 2026 caem na
   MESMA categoria, "1.01.02 — SERVIÇOS REALIZADOS". Uma curva ABC sobre isso é
   uma barra só, com 100% e classe A+ — e uma barra de 100% não se lê como
   "não há detalhe": lê-se como "achei o produto campeão". O leitor sairia daqui
   com uma conclusão que o dado não sustenta, sem nenhum erro na tela.

   Também está medido POR QUE não há detalhe, para o aviso não virar mistério:
   as 2.251 ordens de serviço desta casa têm UM item cada, sempre com a mesma
   descrição-carimbo, e o cadastro de serviços tem 6 linhas que se diferenciam
   por IMPOSTO, não por ensaio. Não é o Omie que esconde o detalhe: é que o
   detalhe nunca foi digitado nele.

   O corte é 90%: abaixo disso a curva já separa alguma coisa e o aviso só
   atrapalharia. Componente fora da página porque declarado dentro remonta a
   cada render, e o lint da casa reprova como erro. */
function CurvaQueNaoSepara({ topo, quantas, titulos }) {
  const fatia = topo?.participacao;
  return (
    <div className="rounded-xl border border-warn-200 bg-warn-50 px-4 py-3">
      <p className="font-display text-sm font-semibold text-warn-800">
        Esta curva não separa nada — e o motivo não é a curva.
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-warn-800">
        {fatia === null || fatia === undefined
          ? "Uma única categoria carrega o recorte inteiro"
          : `${(fatia * 100).toFixed(fatia > 0.999 ? 0 : 1).replace(".", ",")}% do faturamento deste recorte está numa categoria só`}
        {topo?.rotulo ? ` (${topo.rotulo})` : ""}
        {quantas > 1 ? `, entre ${quantas} categorias no total` : ", e não há outra"}. Classificar
        A+/A/B/C em cima disso devolveria uma barra de 100% — que se lê como “achei o serviço
        campeão”, e não é o que o dado diz.
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-warn-700">
        O Omie desta casa não guarda QUAL ensaio foi vendido. Existem 2.251 ordens de serviço,
        mas cada uma tem um item de serviço só, sempre com a mesma descrição — e o cadastro de
        serviços tem 6 linhas que se diferenciam por imposto, não por ensaio. O dinheiro entra
        como título a receber
        {titulos ? ` (${titulos} títulos neste recorte)` : ""}, carregando só a categoria
        financeira. Não é o ERP que esconde: é que o detalhe nunca foi digitado nele. Para a curva
        por ensaio existir, a O.S. precisaria ser lançada com o serviço escolhido. Enquanto isso,
        quem separa de verdade é a aba <strong>Clientes</strong>.
      </p>
    </div>
  );
}

export default function AbaProdutos({ vendas, clientes, ano, hojeISO, setAviso }) {
  const [aberto, setAberto] = useState(null);
  const [classeVista, escolherClasse] = useEscolha(K_CLASSE, "");
  const [grupoAberto, setGrupoAberto] = useState(null);
  const [secaoAberta, alternarSecao, abrirSecao] = useSecoes(K_SECOES, SECOES_PADRAO);
  /* Mesmo motivo da aba Clientes: o detalhe nasce depois do ranking. */
  const alvoDoDetalhe = useRolarAoAbrir(aberto);

  const anoTexto = /^\d{4}$/.test(String(ano ?? "")) ? String(ano) : "";
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(String(hojeISO ?? "")) ? String(hojeISO) : "";

  const recorte = useMemo(() => recortarVendas(vendas, anoTexto), [vendas, anoTexto]);
  const nomes = useMemo(() => indiceDeNomes(clientes, vendas), [clientes, vendas]);
  const bruto = useMemo(() => produtosDoRecorte(recorte.usadas), [recorte]);

  const abc = useMemo(
    () =>
      curvaAbc(bruto.produtos, {
        valorDe: (p) => p.valor,
        chaveDe: (p) => p.codigo,
        rotuloDe: (p) => p.descricao || `Código ${p.codigo}`,
      }),
    [bruto]
  );

  /* 90% numa categoria só = a curva perdeu a função. Ver CurvaQueNaoSepara. */
  const naoSepara = abc.curva.length > 0 && (abc.curva[0].participacao ?? 0) >= 0.9;

  const membrosDaFaixa = useMemo(() => {
    const f = FAIXAS.find((x) => x.id === classeVista);
    if (f) return f.membros;
    return classeVista ? [classeVista] : null;
  }, [classeVista]);

  const lista = useMemo(
    () => (membrosDaFaixa ? abc.curva.filter((p) => membrosDaFaixa.includes(p.classe)) : abc.curva),
    [abc, membrosDaFaixa]
  );

  const linhaAberta = useMemo(
    () => (aberto ? abc.curva.find((p) => p.chave === aberto) || null : null),
    [aberto, abc]
  );

  /* O detalhe olha duas janelas, como na aba Clientes: o ano a ano é o
     histórico completo do código (é ele que mostra o ensaio que a casa parou
     de vender), e os compradores são os do recorte na tela. */
  const detalhe = useMemo(() => {
    if (!linhaAberta) return null;
    const codigo = linhaAberta.chave;
    const itensNoTempo = [];
    for (const v of recorte.validas) {
      for (const it of Array.isArray(v?.itens) ? v.itens : []) {
        if (String(it?.codigo ?? "").trim() !== codigo) continue;
        itensNoTempo.push({ data: v.data, valor: num(it?.valor) ?? 0 });
      }
    }
    const porCliente = new Map();
    for (const { venda, item } of linhaAberta.item.itens) {
      const id = String(venda?.clienteId ?? "");
      const chave = id || "sem-cliente";
      let c = porCliente.get(chave);
      if (!c) {
        c = {
          id: chave,
          nome: id ? nomes.get(id) || `Cliente #${id}` : "sem cliente identificado",
          valor: 0,
          vendasVistas: new Set(),
        };
        porCliente.set(chave, c);
      }
      c.valor += num(item?.valor) ?? 0;
      c.vendasVistas.add(venda.id);
    }
    const compradores = [...porCliente.values()]
      .map((c) => ({ id: c.id, nome: c.nome, valor: Math.round(c.valor * 100) / 100, vendas: c.vendasVistas.size }))
      .sort((a, b) => b.valor - a.valor);
    return { itensNoTempo, compradores };
  }, [linhaAberta, recorte, nomes]);

  const rotuloDaClasse = classeVista ? classeVista.replace("*", "") : "";
  const diferenca = Math.round((bruto.somaDasVendas - bruto.somaDosItens) * 100) / 100;

  const baixar = () => {
    if (!lista.length) {
      return setAviso({ tipo: "erro", texto: "Não há produto nenhum neste recorte para baixar." });
    }
    try {
      const arquivo = baixarPlanilha({
        nome: `curva-abc-produtos${anoTexto ? `-${anoTexto}` : ""}`,
        titulo: `Curva ABC de produtos${anoTexto ? ` — ${anoTexto}` : ""}`,
        colunas: COLUNAS,
        linhas: lista.map((p) => ({
          posicao: p.posicao,
          classe: p.classe,
          codigo: p.item.codigo,
          produto: p.rotulo,
          vendas: p.item.vendas.size,
          // Célula VAZIA quando falta quantidade em alguma linha: um número
          // parcial numa planilha vira total somado por quem abrir depois.
          quantidade: p.item.semQuantidade === 0 ? Math.round(p.item.quantidade * 1000) / 1000 : null,
          participacao: p.participacao === null ? null : Math.round(p.participacao * 1000) / 10,
          acumulado: p.acumulado === null ? null : Math.round(p.acumulado * 1000) / 10,
          valor: p.valor,
        })),
      });
      setAviso({ tipo: "ok", texto: `Planilha baixada: ${arquivo} (${plural(lista.length, "produto", "produtos")}).` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  if (abc.vazio) {
    return (
      <div className="space-y-4">
        <CabecalhoDoPapel
          titulo={`MinasLab — Curva ABC de produtos${anoTexto ? ` · ${anoTexto}` : ""}`}
          linhas={[hoje ? `Emitido em ${dataLonga(hoje)}` : null, "Nenhum produto no recorte."]}
        />
        <SemVenda
          vendas={vendas}
          clientes={clientes}
          anoTexto={anoTexto}
          recorte={recorte}
          unidade="venda com item"
          notas={[
            bruto.vendasSemItens > 0
              ? `${plural(bruto.vendasSemItens, "venda do recorte veio", "vendas do recorte vieram")} sem nenhum item dentro: o cabeçalho chegou e a lista de produtos não.`
              : null,
            bruto.semCodigo > 0
              ? `${plural(bruto.semCodigo, "item", "itens")} sem código de produto (${moeda(
                  bruto.semCodigoValor
                )}) — fora do ranking: sem código não há como juntar o mesmo produto de duas notas.`
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
        titulo={`MinasLab — Curva ABC de produtos${anoTexto ? ` · ${anoTexto}` : " · todos os anos"}`}
        linhas={[
          hoje ? `Emitido em ${dataLonga(hoje)}` : null,
          `${plural(abc.curva.length, "produto", "produtos")} no recorte · ${moedaCheia(abc.total)} em itens`,
          "A+ soma os primeiros 30% do faturamento · A até 80% · B+ até 90% · B até 95% · C o resto.",
          classeVista ? `Impresso só com a classe ${rotuloDaClasse}.` : null,
          ...frasesDoCorte(recorte),
        ]}
      />

      <Secao
        titulo={anoTexto ? `O que mais vendemos em ${anoTexto}` : "O que mais vendemos — todos os anos"}
        sub={`${plural(abc.curva.length, "produto", "produtos")} no recorte · ${moedaCheia(abc.total)}`}
        aberta={secaoAberta("curva")}
        aoAlternar={() => alternarSecao("curva")}
        acao={<AcoesDoRecorte aoBaixarPlanilha={baixar} />}
      >
        <CartoesDaCurva
          faixas={abc.faixas}
          unidade={{ um: "produto", varios: "produtos" }}
          classeVista={classeVista}
          aoEscolherClasse={escolherClasse}
          grupoAberto={grupoAberto}
          aoAlternarGrupo={setGrupoAberto}
        />

        <Explicacao>
          {/* O AVISO VEM ANTES DA RÉGUA porque é o que muda a leitura do número.
              Explicar a curva primeiro e a unidade depois faria o olho classificar
              "Análises Ambientais" como produto campeão antes de saber que é balde. */}
          <strong>Aqui a linha é a categoria financeira do título</strong>, não o ensaio vendido: a
          MinasLab fatura por RPS e o título do Omie não traz itens — este é o nível de detalhe que
          existe hoje. Dito isso, vale a mesma régua da aba Clientes:{" "}
          <strong>A+</strong> são as categorias que somam os primeiros 30% do faturamento,{" "}
          <strong>A</strong> até 80%, <strong>B+</strong> até 90%, <strong>B</strong> até 95%,{" "}
          <strong>C</strong> o resto. O número forte é o faturamento da categoria; as colunas cinza
          contam em quantos títulos ela apareceu. Categorias iguais são juntadas pelo{" "}
          <strong>código</strong>, e o nome mostrado é a descrição do cadastro.{" "}
          <strong>Toque numa categoria</strong> para o comportamento dela no tempo e para quem
          contratou.
        </Explicacao>

        {naoSepara && (
          <CurvaQueNaoSepara
            topo={abc.curva[0]}
            quantas={abc.curva.length}
            titulos={recorte.usadas.length}
          />
        )}

        {classeVista && (
          <div className="sem-impressao flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Mostrando só a classe <strong className="text-slate-700">{rotuloDaClasse}</strong> —{" "}
              {plural(lista.length, "produto", "produtos")} de {abc.curva.length}. A posição continua sendo
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
          <Empty>Nenhum produto na classe {rotuloDaClasse} neste recorte.</Empty>
        ) : (
          <div>
            {lista.map((p) => (
              <LinhaRanking
                key={p.chave}
                nome={
                  <>
                    <span className="tnum mr-1.5 font-display text-[11px] font-medium text-slate-400">
                      {p.posicao}º
                    </span>
                    <SeloClasse classe={p.classe} />
                    <span title={`${p.rotulo} · código ${p.item.codigo}`}>{p.rotulo}</span>
                  </>
                }
                valor={moeda(p.valor)}
                apoios={[
                  plural(p.item.vendas.size, "venda", "vendas"),
                  p.item.semQuantidade === 0 ? (
                    (Math.round(p.item.quantidade * 100) / 100).toLocaleString("pt-BR")
                  ) : (
                    /* Travessão com o motivo à mão: somar só as linhas que
                       têm quantidade entregaria um pedaço com cara de total. */
                    <span
                      key="sem-qtd"
                      title={`${plural(
                        p.item.semQuantidade,
                        "linha deste produto veio",
                        "linhas deste produto vieram"
                      )} sem quantidade — somar só as outras daria um número menor que o real, com cara de total.`}
                    >
                      —
                    </span>
                  ),
                ]}
                medida={p.valor}
                teto={tetoDaCurva}
                aberta={aberto === p.chave}
                /* Como na aba Clientes: o clique PEDE o detalhe, então garante
                   o quadro aberto — recolhido, ele renderizaria fechado. */
                aoAbrir={() => {
                  const proximo = aberto === p.chave ? null : p.chave;
                  setAberto(proximo);
                  if (proximo) abrirSecao("produto");
                }}
              />
            ))}
          </div>
        )}

        <div className="space-y-0.5 text-[11px] text-slate-400">
          {/* A RÉGUA DOS DOIS TOTAIS, dita com números medidos e sem palpite
              de causa: o ranking soma ITEM, a aba Clientes soma VENDA. Quando
              o Omie manda no cabeçalho da nota algo que não está no item
              (imposto, frete, desconto), os dois totais discordam — e quem vê
              as duas telas no mesmo dia merece saber disso antes de achar que
              uma das duas está quebrada. */}
          <p>
            Os itens deste recorte somam {moedaCheia(bruto.somaDosItens)}; as vendas do mesmo recorte
            somam {moedaCheia(bruto.somaDasVendas)}
            {Math.abs(diferenca) > 0.01
              ? ` — ${moedaCheia(Math.abs(diferenca))} de diferença, que vive no total da nota e não dentro do item, e por isso não entra neste ranking.`
              : " — os dois batem."}
          </p>
          {bruto.vendasSemItens > 0 && (
            <p>
              {plural(bruto.vendasSemItens, "venda do recorte", "vendas do recorte")} sem nenhum item
              carregado — presente na curva de clientes, ausente nesta.
            </p>
          )}
          {bruto.semCodigo > 0 && (
            <p>
              {plural(bruto.semCodigo, "item", "itens")} sem código de produto (
              {moeda(bruto.semCodigoValor)}) — fora do ranking: sem código não há como juntar o mesmo
              produto de duas notas.
            </p>
          )}
          {abc.foraDaCurva.quantidade > 0 && (
            <p>
              {plural(abc.foraDaCurva.quantidade, "produto faturou", "produtos faturaram")} zero ou valor
              negativo no recorte — fora da curva.
            </p>
          )}
          {frasesDoCorte(recorte).map((f) => (
            <p key={f}>{f}</p>
          ))}
        </div>
      </Secao>

      {linhaAberta && detalhe && (
        <div ref={alvoDoDetalhe}>
        <Secao
          titulo={linhaAberta.rotulo}
          sub={`${linhaAberta.posicao}º da curva · classe ${linhaAberta.classe} · ${moedaCheia(
            linhaAberta.valor
          )} no recorte · ${pct(linhaAberta.participacao) ?? "—"} do faturamento`}
          aberta={secaoAberta("produto")}
          aoAlternar={() => alternarSecao("produto")}
          acao={
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => setAberto(null)}
              aria-label="Fechar o produto"
            >
              <X size={16} />
            </button>
          }
        >
          <DetalheDoProduto
            /* A chave remonta o quadro ao trocar de produto: sem ela, o ano
               escolhido no mês a mês do produto anterior ficaria de pé. */
            key={linhaAberta.chave}
            produto={linhaAberta.item}
            itensNoTempo={detalhe.itensNoTempo}
            compradores={detalhe.compradores}
            anoTexto={anoTexto}
          />
        </Secao>
        </div>
      )}
    </div>
  );
}
