// CURVA ABC — a CASCA do módulo de análise de vendas. Entrada própria na barra
// lateral, por ordem do dono do sistema.
//
// A PERGUNTA QUE ESTA TELA RESPONDE é sempre a mesma, de três ângulos: QUEM
// sustenta o faturamento. Por cliente (aba Clientes), por serviço/produto (aba
// Produtos) e por pessoa que vendeu (aba Vendedores). A régua é a curva ABC —
// classificar pelo DINHEIRO ACUMULADO, não pela posição na fila —, e o motor
// dela mora em lib/curvaAbc.js, testado sem tela e sem banco.
//
// SÓ A DIREÇÃO CHEGA AQUI (SO_DIRECAO em lib/sessao.js). Não é zelo de menu:
// esta tela lê "fin_receber", "fin_clientes" e "fin_categorias", que são o
// faturamento da casa — o mesmo dado que o ml-sync já barra no servidor para
// quem não é direção. Esconder o item do menu é conforto; quem barra de verdade
// é o servidor, em toda chamada.
//
// ============================================================================
// A FONTE AQUI É O TÍTULO A RECEBER — NÃO A NOTA COM ITENS (30/08/2026)
//
// Esta tela nasceu copiando o Painel da Impresilk, onde o faturamento é nota
// fiscal com itens dentro. Quando a ponte do Omie foi ligada, o diagnóstico
// mediu a conta real da MinasLab e achou outra coisa:
//
//     notas fiscais de produto ......... 0     (a casa não emite)
//     ordens de serviço ............ 2.251   (corrigido — ver faturamento.js)
//     contas a receber ............. 2.301  ← o faturamento mora aqui
//     clientes ..................... 1.076
//     categorias financeiras ......... 159
//
// Quem fatura análise ambiental emite RPS e lança o título. Então a casca
// TRADUZ o título para o formato que as três abas já leem — `vendasDosTitulos`
// em lib/faturamento.js, testada sem tela e sem banco — em vez de reescrever
// 3.100 linhas de tela que funcionam. O que a tradução não inventa está escrito
// lá em cima do arquivo: vendedor, produto e data de recebimento.
//
// AS TRÊS AUSÊNCIAS CONTINUAM SENDO TRÊS FATOS DIFERENTES, e não um vazio só:
//
//   1. O SERVIDOR RECUSOU a coleção → este crachá não abre o faturamento. Não
//      diz nada sobre haver ou não haver faturamento.
//   2. A COLEÇÃO ESTÁ VAZIA → a importação não rodou. A ponte já entra no Omie;
//      a casca diz isso e não manda mais procurar credencial que já existe.
//   3. HÁ TÍTULOS, MAS NENHUM NO RECORTE → aí a resposta é de cada aba, pelo
//      `SemVenda` de components/abc/comum.jsx, que sabe dizer "nenhum cliente
//      em 2024" com a palavra certa e ainda aponta em que anos há faturamento.
//
// Zero por falta de importação e zero por falta de venda têm a mesma aparência
// num gráfico e significados opostos na vida. Enquanto não houver dado, esta
// tela não escreve R$ 0,00 em lugar nenhum: zero é uma AFIRMAÇÃO ("não
// faturamos"), ausência é outra coisa.
//
// E NADA DE DADO DE EXEMPLO. Uma tela que mostra número inventado é pior que
// uma tela vazia: a vazia manda perguntar, a inventada manda decidir.
//
// ============================================================================
// O QUE A CASCA ENTREGA ÀS ABAS — E O QUE ELA NÃO CORTA
//
// `vendas` vai INTEIRA — todos os títulos traduzidos. A casca NÃO pré-filtra
// por ano, e isso é decisão, não esquecimento:
//
//   · Quem corta é `recortarVendas(vendas, ano)` de components/abc/comum.jsx —
//     UMA função para as três abas. Régua compartilhada copiada em três
//     arquivos é a que envelhece em dois deles sem ninguém notar.
//   · O corte volta CONTADO (`canceladas`, `semData`, `foraDoAno`): a aba diz
//     embaixo da lista o que descartou. Se a casca cortasse antes, a aba
//     receberia uma lista já limpa e anunciaria "nenhuma cancelada" com
//     convicção — um zero que é, na verdade, cegueira.
//   · O histórico de um cliente ou de um produto (o "mês a mês, ano a ano" que
//     abre no toque) precisa das vendas de FORA do recorte. Entregar só o ano
//     escolhido faria a curva de um cliente de dez anos caber num ano só, sem
//     avisar que o resto existia.
//
// `clientes`, `receber` e `categorias` também vão inteiros: o primeiro é
// cadastro (código → nome, cidade, UF), o segundo é o título cru, para a aba
// que quiser olhar vencimento, e o terceiro dá nome ao código da categoria.
// `ano` viaja junto para todas cortarem com a mesma régua.

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Unplug } from "lucide-react";
import { carregarColecoes } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { moeda, numero, ymdLocal } from "../lib/format.js";
import { PageTitle, Card, Segmented, CarregandoModulo, ErroModulo, Aviso } from "../components/ui.jsx";
import { Explicacao, Pilulas } from "../components/lista.jsx";
import { plural, recortarVendas } from "../components/abc/comum.jsx";
import { anosDoFiltro, vendasDosTitulos } from "../lib/faturamento.js";
import AbaClientes from "../components/abc/AbaClientes.jsx";
import AbaProdutos from "../components/abc/AbaProdutos.jsx";
import AbaVendedores from "../components/abc/AbaVendedores.jsx";

const COLECOES = ["fin_clientes", "fin_receber", "fin_categorias"];

/* "SERVIÇOS", NÃO "PRODUTOS": o rótulo do menu é a primeira coisa que promete
   o que a aba entrega. A MinasLab não vende produto com item de nota — vende
   análise, e o detalhe que o Omie guarda é a categoria financeira. Chamar de
   "Produtos" faria o dono clicar esperando o ensaio campeão.

   "VENDEDORES" FICA, e fica ATIVA de propósito: medimos que o título a receber
   não traz vendedor, e a aba explica isso em uma tela inteira. Esconder o botão
   pareceria módulo pela metade e deixaria a pergunta sem resposta — quem quer
   o ranking por pessoa merece ler POR QUE ele não existe, não um menu mudo. */
const ABAS = [
  { valor: "clientes", rotulo: "Clientes" },
  { valor: "produtos", rotulo: "Serviços" },
  { valor: "vendedores", rotulo: "Vendedores" },
];

const K_ABA = "minaslab.abc.aba";
const K_ANO = "minaslab.abc.ano";

/* A escolha da pessoa mora no aparelho. Chaves separadas, não um objeto de
   preferências: são duas decisões independentes, e um JSON com dois campos
   envelhece pior que dois valores curtos.

   Ler com `getItem(...) ?? padrao` e NÃO com `|| padrao`: o recorte "Todos" é
   gravado como texto vazio, e o `||` o trocaria pelo ano corrente em toda
   visita — a escolha de ver tudo seria impossível de guardar. */
function lerGuardado(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : v;
  } catch {
    return padrao;
  }
}

function gravarGuardado(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem localStorage a escolha só não persiste */
  }
}

/* ============================================================================
   OS BLOCOS DE AUSÊNCIA DO MÓDULO — fora do componente da página (componente
   declarado dentro remonta a cada render, e o lint da casa reprova como erro).

   Estes dois falam do MÓDULO INTEIRO, não de um recorte: nada chegou, ou nada
   foi liberado. Quando há venda no banco e o recorte é que está vazio, quem
   fala é a aba (`SemVenda`, em components/abc/comum.jsx), porque só ela sabe se
   a palavra é "cliente", "produto" ou "vendedor".
   ========================================================================= */

function SemFaturamento({ motivo }) {
  if (motivo === "recusada") {
    return (
      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn-100 text-warn-700">
            <KeyRound size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 space-y-2">
            <p className="font-display text-base font-semibold text-slate-900">
              O servidor não abriu o faturamento para este crachá.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              A coleção <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">fin_receber</code> foi
              recusada na leitura. Isso <strong>não</strong> quer dizer que não há vendas — quer dizer
              que quem está logado agora não tem permissão para vê-las. O menu é conforto; quem barra
              de verdade é o servidor, e foi ele que barrou.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Se você deveria enxergar o faturamento, fale com a direção: o papel do seu login precisa
              ser <strong>direção</strong>.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  /* A PONTE FOI LIGADA EM 30/08/2026 — este bloco parou de falar de credencial
     que falta. Se ele aparecer hoje, a ausência é outra: a ponte entra no Omie,
     mas nenhum título chegou ao painel. Dizer "falta a credencial" mandaria o
     dono procurar no lugar errado. */
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <Unplug size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="font-display text-base font-semibold text-slate-900">
            A ponte com o Omie está ligada, mas nenhum título chegou ao painel.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            A Curva ABC lê o que a MinasLab faturou. Nesta casa isso mora nas{" "}
            <strong>contas a receber</strong> do Omie — a coleção{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">fin_receber</code> —, e ela
            está vazia. É isto que a tela está lendo: <strong>zero registro, não zero venda</strong>.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            A credencial do Omie já está gravada e a ponte já respondeu — o que falta é a
            importação ter rodado. Ela traz os títulos ano a ano, e o primeiro carregamento é
            manual, de propósito: importar sozinho um histórico inteiro sem ninguém olhando é como
            este painel perde a chance de avisar que algo veio errado.
          </p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Enquanto isso esta tela não mostra R$ 0,00 em lugar nenhum, e não desenha nenhuma curva de
        exemplo. Zero é uma afirmação — “não faturamos nada” —, e o que existe aqui é ausência de
        dado. Assim que os títulos entrarem, a curva se acende sozinha.
      </p>
    </Card>
  );
}

/* ========================================================================= */

export default function CurvaAbc() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { vendas, clientes, receber, recusadas }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  /* "Hoje" é ESTADO, nunca constante de módulo: esta tela fica aberta de um dia
     para o outro na sala da direção, e um dia congelado faria a virada do ano
     passar despercebida — o filtro continuaria parando no ano velho. */
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const [aba, setAba] = useState(() => {
    const g = lerGuardado(K_ABA, "clientes");
    return ABAS.some((a) => a.valor === g) ? g : "clientes";
  });

  /* O ano: "" é a escolha "Todos" (uma escolha de verdade, que fica guardada),
     e o padrão de quem nunca escolheu é o ANO CORRENTE — a pergunta do dia a
     dia é sobre este ano, não sobre a história inteira.

     O que veio do aparelho é CONFERIDO antes de virar filtro: localStorage é
     texto que qualquer coisa pode ter escrito, e um "abc" guardado ali daria um
     recorte vazio com pílula nenhuma acesa — a tela pareceria quebrada sem
     nenhum erro em lugar nenhum. */
  const [ano, setAno] = useState(() => {
    const atual = ymdLocal(new Date()).slice(0, 4);
    const g = lerGuardado(K_ANO, atual);
    return g === "" || /^\d{4}$/.test(g) ? g : atual;
  });

  const escolherAba = (v) => {
    setAba(v);
    gravarGuardado(K_ABA, v);
  };
  const escolherAno = (v) => {
    const texto = v == null ? "" : String(v);
    setAno(texto);
    gravarGuardado(K_ANO, texto);
  };

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    // carregarColecoes: uma viagem só, e só baixa o que MUDOU desde a última
    // carga (o rev do servidor decide). Voltar à tela sem novidade custa a
    // pergunta, não o download.
    carregarColecoes(COLECOES)
      .then((r) => {
        const receber = r.fin_receber || [];
        const categorias = r.fin_categorias || [];
        setDados({
          /* A FONTE DO FATURAMENTO DESTA CASA É O TÍTULO A RECEBER, não a nota
             com itens — medido no Omie em 30/08/2026: 0 notas, 0 O.S., 2.301
             títulos. A tradução mora em lib/faturamento.js, testada sem tela.
             As abas continuam recebendo o formato de sempre. */
          vendas: vendasDosTitulos(receber, categorias),
          clientes: r.fin_clientes || [],
          receber,
          categorias,
          recusadas: r._recusadas || [],
        });
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (dados
        // existe). Sem este aviso, a recarga que falha deixaria a tela velha em
        // silêncio, e a decisão sairia de um número de ontem.
        setAviso({
          tipo: "erro",
          texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga.",
        });
      });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  /* Voltou para a aba: busca de novo. É a tela onde isso mais importa — no dia
     em que a ponte for ligada, a primeira importação roda em outra janela e o
     dono quer ver o faturamento aparecer aqui sem procurar o F5. */
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

  /* A MESMA função que as abas usam, para o rodapé desta casca não ter uma
     segunda régua. Ela conta o que ficou de fora em vez de descartar calado. */
  const recorte = useMemo(() => recortarVendas(dados?.vendas, ano), [dados, ano]);

  /* A SOMA DO RECORTE: só entra venda com valor medido, e quantas ficaram sem
     valor viaja junto. Se NENHUMA tiver valor, o total é ausência — e ausência
     não vira "R$ 0" na linha do rodapé, que é onde o olho procura o tamanho do
     recorte. */
  const soma = useMemo(() => {
    let total = 0;
    let medidas = 0;
    for (const v of recorte.usadas) {
      const bruto = v?.valor;
      const n = typeof bruto === "number" ? bruto : Number(bruto);
      if (bruto !== null && bruto !== undefined && bruto !== "" && Number.isFinite(n)) {
        total += n;
        medidas += 1;
      }
    }
    return {
      total: medidas ? total : null,
      semValor: recorte.usadas.length - medidas,
    };
  }, [recorte]);

  /* QUEM DECIDE OS ANOS É O DADO, não uma constante. O piso era 2020, copiado
     do print do Painel da Impresilk; a MinasLab entrou no Omie em 2024 e a tela
     oferecia quatro botões (2020..2023) que só sabiam devolver recorte vazio.
     A regra inteira, com as bordas, mora em lib/faturamento.js — testada sem
     tela: o ano corrente entra sempre (a virada de janeiro), ano com
     faturamento fora da faixa não some, e o ano já escolhido nunca cai da
     lista (senão a tela ficaria sem nenhuma pílula acesa). */
  const opcoesDeAno = useMemo(() => {
    const lista = anosDoFiltro({
      anosComVenda: recorte.anosComVenda,
      anoAtual: hojeISO.slice(0, 4),
      anoEscolhido: ano,
    });
    return [{ valor: "", rotulo: "Todos" }, ...lista.map((a) => ({ valor: a, rotulo: a }))];
  }, [recorte.anosComVenda, hojeISO, ano]);

  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!dados) return <CarregandoModulo />;

  const recusada = dados.recusadas.includes("fin_receber");
  const semNada = dados.vendas.length === 0 && dados.clientes.length === 0;

  const cabecalho = (
    <PageTitle
      titulo="Curva ABC"
      descricao="Quem sustenta o faturamento — por cliente, por serviço e por vendedor."
      acao={
        <button
          type="button"
          className="sem-impressao btn-ghost"
          onClick={recarregar}
          title="Buscar de novo no servidor"
        >
          <RefreshCw size={16} strokeWidth={2.5} /> Atualizar
        </button>
      }
    />
  );

  /* Sem NADA no banco (nem venda, nem cadastro), a tela é só a explicação: sem
     filtro de ano e sem abas por cima do vazio. Três abas vazias em fila fazem
     um defeito parecer três. */
  if (recusada || semNada) {
    return (
      <div>
        <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
        {cabecalho}
        <SemFaturamento motivo={recusada ? "recusada" : "sem-ponte"} />
      </div>
    );
  }

  const props = {
    vendas: dados.vendas,
    clientes: dados.clientes,
    receber: dados.receber,
    ano,
    hojeISO,
    editavel,
    setAviso,
  };

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      {cabecalho}

      <div className="sem-impressao space-y-3">
        <Explicacao>
          As vendas são as notas fiscais e as ordens de serviço importadas do Omie. Venda cancelada
          continua gravada, mas fica fora de todas as somas, e venda sem data não entra em recorte
          nenhum — as duas voltam contadas embaixo de cada lista, nunca descartadas em silêncio.
        </Explicacao>

        <Pilulas opcoes={opcoesDeAno} valor={ano} aoEscolher={escolherAno} />

        {/* As abas não cabem na largura do celular. Sem o overflow aqui, a
            PÁGINA INTEIRA passa a rolar de lado. */}
        <div className="max-w-full overflow-x-auto pb-1">
          <Segmented opcoes={ABAS} valor={aba} onChange={escolherAba} />
        </div>
      </div>

      <div className="mt-4">
        {aba === "clientes" && <AbaClientes {...props} />}
        {aba === "produtos" && <AbaProdutos {...props} />}
        {aba === "vendedores" && <AbaVendedores {...props} />}
      </div>

      {/* O TAMANHO DO RECORTE, sempre visível: "isto aqui é tudo?" é a primeira
          dúvida diante de um ranking, e a resposta não pode depender de abrir
          uma seção. Quando o recorte está vazio quem fala é a aba, com a
          palavra dela — aqui a linha sumiria para dizer "0 vendas", que não
          ajuda ninguém. */}
      {recorte.usadas.length > 0 && (
        // `sem-impressao`: no papel quem diz o recorte é o cabeçalho de cada
        // aba (CabecalhoDoPapel), com a régua junto. Duas linhas dizendo a
        // mesma coisa numa folha que circula solta é uma a mais para conferir.
        <p className="sem-impressao mt-3 text-xs text-slate-400">
          Recorte: {plural(recorte.usadas.length, "venda", "vendas")}
          {ano ? ` de ${ano}` : " (todos os anos)"}
          {soma.total === null ? " · nenhuma delas traz valor" : ` · ${moeda(soma.total)} somados`}
          {soma.total !== null &&
            soma.semValor > 0 &&
            ` (${plural(soma.semValor, "venda sem valor ficou", "vendas sem valor ficaram")} de fora da soma)`}
          {" · de "}
          {numero(recorte.recebidas)} no banco
        </p>
      )}
    </div>
  );
}
