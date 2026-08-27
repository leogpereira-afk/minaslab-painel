// Compras — o CONTROLE DE MATERIAL da MinasLab. Num laboratório o que se
// controla aqui (reagente, vidraria, EPI, papelaria, peça) é o que ACABA no
// meio de uma análise se ninguém viu o saldo. A tela responde três perguntas,
// nesta ordem: (1) o que está acabando, (2) o que já foi pedido e não chegou,
// (3) quem levou o quê. Daí as quatro abas.
//
// Esta é a CASCA: carrega as quatro coleções, guarda o estado, faz a conta do
// saldo e orquestra as abas. A renderização mora em src/components/compras/;
// o que mais de uma aba usa mora em components/compras/comum.jsx — nenhuma aba
// importa da outra.
//
// AS DECISÕES QUE SUSTENTAM O MÓDULO:
// - O SALDO É CALCULADO, NUNCA GRAVADO (a conta está em comum.jsx). Saldo num
//   campo vira segunda verdade que envelhece calada.
// - `estoque_mov` é APPEND-ONLY: é o livro. Conserto de lançamento errado é um
//   AJUSTE novo, com sinal explícito — livro que se apaga não prova nada.
// - Pedido não vira estoque sozinho: o recebimento passa por um modal que
//   confere a quantidade que CHEGOU. Estoque que mente é pior que nenhum.
// - Toda gravação passa por aqui (services/dados.js), com <Aviso> no sucesso E
//   no erro, e recarrega do servidor depois — conferir o efeito, não a
//   ausência de erro.
//
// Segue o exemplar (Compromissos.jsx): componentes auxiliares declarados FORA
// da página; datas sempre ymdLocal; "hoje" é ESTADO.

import { useCallback, useEffect, useMemo, useState } from "react";
import { listar, salvar, apagar, elenco } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { ymdLocal, paraNumero, dataCurta } from "../lib/format.js";
import { baixarPlanilha } from "../lib/planilha.js";
import {
  PageTitle, CarregandoModulo, ErroModulo, Aviso, Segmented,
} from "../components/ui.jsx";
import {
  resumoEstoque, numeroOuNull, temValor, TIPOS_MOV, STATUS_PEDIDO, PROXIMO_PEDIDO,
  entradaDoPedido,
} from "../components/compras/comum.jsx";
import AbaEstoque, { movimentoVazio, produtoParaForm } from "../components/compras/AbaEstoque.jsx";
import AbaPedidos, { pedidoParaForm } from "../components/compras/AbaPedidos.jsx";
import AbaOrdens, { ordemParaForm } from "../components/compras/AbaOrdens.jsx";
import AbaRetiradas, { retiradaVazia } from "../components/compras/AbaRetiradas.jsx";

const COL_PEDIDOS = "compras";
const COL_PRODUTOS = "produtos";
const COL_MOV = "estoque_mov";
const COL_ORDENS = "ordens";

// A aba escolhida sobrevive ao recarregar: quem passa o dia no estoque não
// quer voltar para Pedidos toda vez que atualiza a página.
const K_ABA = "ml_compras_aba";

const ABAS = [
  { valor: "estoque", rotulo: "Estoque" },
  { valor: "pedidos", rotulo: "Pedidos" },
  { valor: "ordens", rotulo: "Ordens de compra" },
  { valor: "retiradas", rotulo: "Retiradas" },
];

export default function Compras() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { pedidos, produtos, movs, ordens }
  const [equipe, setEquipe] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState(() => {
    try {
      const guardada = localStorage.getItem(K_ABA);
      return ABAS.some((a) => a.valor === guardada) ? guardada : "estoque";
    } catch {
      return "estoque";
    }
  });

  const [formProduto, setFormProduto] = useState(null);
  const [formMov, setFormMov] = useState(null);
  const [formPedido, setFormPedido] = useState(null);
  const [formOrdem, setFormOrdem] = useState(null);
  const [formRetirada, setFormRetirada] = useState(null);
  // Só os IDS do que está sendo recebido: guardar o objeto do clique devolveria
  // um pedido velho se a lista recarregasse no meio.
  const [recebendo, setRecebendo] = useState(null); // { pedidoIds: [] } | null

  // "Hoje" é ESTADO, não conta do render: a tela fica aberta de um dia para o
  // outro e o dia congelado mentiria o prazo da ordem e o mês dos cartões.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.all([listar(COL_PEDIDOS), listar(COL_PRODUTOS), listar(COL_MOV), listar(COL_ORDENS)])
      .then(([pedidos, produtos, movs, ordens]) => {
        setDados({ pedidos, produtos, movs, ordens });
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (dados
        // existe) — sem este aviso, a recarga que falha deixava saldo velho na
        // tela, em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
      });
  }, []);

  useEffect(() => {
    recarregar();
    // O elenco é só para o "quem" das saídas. Se falhar, a tela continua — o
    // campo fica sem opções e a retirada pode ser registrada sem nome.
    elenco().then(setEquipe).catch(() => {});
  }, [recarregar]);

  // Voltou para a aba do navegador: refaz a conta do dia e busca o que chegou.
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

  // O saldo de cada produto, calculado do livro a cada carga. Nunca lido de
  // campo gravado.
  const resumo = useMemo(() => resumoEstoque(dados?.movs || []), [dados]);

  const trocarAba = (valor) => {
    setAba(valor);
    // Um recebimento aberto pertence à aba onde começou: levá-lo junto para
    // outra aba assustaria quem só queria olhar o estoque.
    setRecebendo(null);
    try {
      localStorage.setItem(K_ABA, valor);
    } catch {
      /* sem localStorage a escolha só não persiste */
    }
  };

  // Uma porta só para baixar planilha: o try/catch e a frase do aviso ficam
  // num lugar só, e cada aba manda o RECORTE QUE ESTÁ NA TELA.
  const exportar = ({ nome, titulo, colunas, linhas }) => {
    try {
      // baixarPlanilha já carimba o dia local no nome do arquivo.
      const arquivo = baixarPlanilha({ nome, titulo, colunas, linhas });
      setAviso({
        tipo: "ok",
        texto: `${arquivo} baixado (${linhas.length} ${linhas.length === 1 ? "linha" : "linhas"}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  // Grava, avisa e RECARREGA. Devolve o registro como o servidor confirmou —
  // quem chamou às vezes precisa do id novo.
  const gravar = async (colecao, registro, fraseOk) => {
    setSalvando(true);
    try {
      const r = await salvar(colecao, registro);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
      return r;
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const avisarErro = (msg) => setAviso({ tipo: "erro", texto: msg });

  // Este pedido já virou entrada no estoque? Evita oferecer a mesma entrada
  // duas vezes e dobrar o saldo. A régua mora em comum.jsx — é a MESMA que
  // trava o campo "quantidade recebida" e que recusa a gravação repetida.
  const entradaDe = (pedidoId) => entradaDoPedido(dados?.movs, pedidoId);
  const temEntrada = (pedidoId) => !!entradaDe(pedidoId);

  // A frase que todo mundo repete quando a entrada já existe.
  const desdeQuando = (mv) => (mv?.data ? dataCurta(mv.data) : "data não registrada");

  // ---- produtos --------------------------------------------------------
  const salvarProduto = async () => {
    const f = formProduto;
    if (!f?.nome.trim()) return;
    /* Relê o produto pelo ID na hora de gravar: o objeto que semeou o
       formulário pode ter envelhecido num recarregar, e gravar por cima
       apagaria o que mudou no servidor enquanto o modal estava aberto. */
    const atual = f.id ? dados.produtos.find((p) => p.id === f.id) : null;
    if (f.id && !atual) return avisarErro("Este produto não está mais na lista. Recarregue e tente de novo.");
    const gravado = await gravar(
      COL_PRODUTOS,
      {
        ...(atual || {}),
        nome: f.nome.trim(),
        unidade: f.unidade,
        categoria: f.categoria,
        local: f.local.trim(),
        // Em branco grava null, não 0: produto sem ponto de reposição não é
        // produto com mínimo zero.
        minimo: numeroOuNull(f.minimo),
        custoMedio: numeroOuNull(f.custoMedio),
        fornecedorPadrao: f.fornecedorPadrao.trim(),
        obs: f.obs.trim(),
        ativo: f.ativo !== false,
      },
      f.id ? "Produto atualizado." : `Produto "${f.nome.trim()}" cadastrado.`
    );
    if (gravado) setFormProduto(null);
  };

  // ---- movimentos (o livro) --------------------------------------------
  const lancarMovimento = async () => {
    const f = formMov;
    const q = numeroOuNull(f?.quantidade);
    if (!f || q === null || q <= 0 || !f.data) return;
    const produto = dados.produtos.find((p) => p.id === f.produtoId);
    if (!produto) return avisarErro("Este produto não está mais na lista. Recarregue e tente de novo.");
    const pessoa = equipe.find((p) => p.id === f.pessoaId);
    const sinal = f.tipo === "saida" ? -1 : f.tipo === "ajuste" ? (Number(f.sinal) < 0 ? -1 : 1) : 1;
    const gravado = await gravar(
      COL_MOV,
      {
        produtoId: f.produtoId,
        // CARIMBO: o nome do produto vai gravado junto. Produto renomeado ou
        // desativado depois não pode apagar o histórico do livro.
        produtoNome: produto.nome || f.produtoNome || "",
        tipo: f.tipo,
        // A quantidade é SEMPRE positiva; quem dá a direção é o sinal.
        quantidade: Math.abs(q),
        sinal,
        data: f.data,
        motivo: f.motivo.trim(),
        pessoaId: f.pessoaId,
        pessoaNome: f.pessoaId ? pessoa?.nome || "" : "",
        pedidoId: "",
        ordemId: "",
        obs: f.obs?.trim() || "",
      },
      `${TIPOS_MOV[f.tipo]} de ${produto.nome} lançada.`
    );
    if (gravado) setFormMov(null);
  };

  const registrarRetirada = async () => {
    const f = formRetirada;
    const q = numeroOuNull(f?.quantidade);
    if (!f || !f.produtoId || q === null || q <= 0 || !f.data) return;
    const produto = dados.produtos.find((p) => p.id === f.produtoId);
    if (!produto) return avisarErro("Este produto não está mais na lista. Recarregue e tente de novo.");
    const pessoa = equipe.find((p) => p.id === f.pessoaId);
    const gravado = await gravar(
      COL_MOV,
      {
        produtoId: f.produtoId,
        produtoNome: produto.nome || "",
        tipo: "saida",
        quantidade: Math.abs(q),
        sinal: -1,
        data: f.data,
        motivo: f.motivo.trim(),
        pessoaId: f.pessoaId,
        // CARIMBO: quem levou fica gravado pelo nome. A pessoa pode sair da
        // empresa; a retirada dela não pode virar um bloco sem dono.
        pessoaNome: f.pessoaId ? pessoa?.nome || "" : "",
        pedidoId: "",
        ordemId: "",
        obs: f.obs.trim(),
      },
      `Retirada de ${produto.nome} registrada.`
    );
    if (gravado) setFormRetirada(null);
  };

  // ---- pedidos ---------------------------------------------------------
  const salvarPedido = async () => {
    const f = formPedido;
    if (!f?.item.trim()) return;
    const atual = f.id ? dados.pedidos.find((c) => c.id === f.id) : null;
    if (f.id && !atual) return avisarErro("Este pedido não está mais na lista. Recarregue e tente de novo.");
    const registro = {
      ...(atual || {}),
      item: f.item.trim(),
      qtde: f.qtde.trim(),
      fornecedor: f.fornecedor.trim(),
      // Campo vazio fica vazio: valor ausente não é R$ 0.
      valor: f.valor.trim() ? paraNumero(f.valor) : "",
      status: f.status,
      solicitante: f.solicitante.trim(),
      data: f.data,
      dataRecebida: f.dataRecebida,
      os: f.os.trim(),
      obs: f.obs.trim(),
      produtoId: f.produtoId || "",
      ordemId: f.ordemId || "",
      /* Com entrada CARIMBADA no livro, a quantidade recebida é do LIVRO, não
         do formulário: corrigir 10 para 7 aqui faria a tela dizer 7 com o saldo
         parado em 10, em silêncio — uma segunda verdade. O campo vem travado na
         tela; aqui repõe-se o valor gravado, porque proteção que só existe na
         tela não protege. A correção é um AJUSTE na aba Estoque. */
      qtdeRecebida: temEntrada(f.id) ? (atual?.qtdeRecebida ?? "") : (numeroOuNull(f.qtdeRecebida) ?? ""),
    };
    // Marcou recebida sem data? Carimba o dia no ato — é este carimbo que
    // sustenta os cartões do mês.
    if (registro.status === "recebida" && !registro.dataRecebida) {
      registro.dataRecebida = ymdLocal(new Date());
    }
    const gravado = await gravar(
      COL_PEDIDOS,
      registro,
      f.id ? "Pedido atualizado." : "Pedido registrado."
    );
    if (!gravado) return;
    setFormPedido(null);
    /* Acabou de VIRAR recebida (e ainda não deu entrada)? Oferece a entrada —
       sem lançar nada sozinho. A comparação é com o status ANTERIOR de
       propósito: quem só corrigiu a observação de um pedido antigo não pode
       levar o modal de recebimento na cara toda vez. */
    if (registro.status === "recebida" && atual?.status !== "recebida" && !temEntrada(gravado.id)) {
      setRecebendo({ pedidoIds: [gravado.id] });
    }
  };

  const avancarPedido = (id) => {
    const c = dados.pedidos.find((x) => x.id === id);
    if (!c) return avisarErro("Este pedido não está mais na lista. Recarregue e tente de novo.");
    const prox = PROXIMO_PEDIDO[c.status];
    if (!prox) return;
    // Chegar em "recebida" é a única etapa que não anda sozinha: a quantidade
    // que chegou precisa ser conferida antes de virar saldo.
    if (prox === "recebida") {
      /* Este pedido JÁ virou entrada (alguém devolveu o status e clicou de
         novo)? Então não se oferece o recebimento outra vez — a segunda entrada
         dobraria o saldo e o livro é append-only. O status anda sozinho, sem
         tocar no estoque, porque o estoque já está lançado. */
      const jaEntrou = entradaDe(c.id);
      if (jaEntrou) {
        return gravar(
          COL_PEDIDOS,
          { ...c, status: "recebida", dataRecebida: c.dataRecebida || jaEntrou.data || ymdLocal(new Date()) },
          `Pedido marcado como recebido. O estoque não mudou: já entrou no estoque em ${desdeQuando(jaEntrou)}.`
        );
      }
      return setRecebendo({ pedidoIds: [c.id] });
    }
    gravar(COL_PEDIDOS, { ...c, status: prox }, `Pedido marcado como ${STATUS_PEDIDO[prox].rotulo}.`);
  };

  const removerPedido = async (id) => {
    const c = dados.pedidos.find((x) => x.id === id);
    if (!c) return avisarErro("Este pedido não está mais na lista. Recarregue e tente de novo.");
    const entrou = temEntrada(c.id);
    if (
      !window.confirm(
        `Apagar "${c.item}"?${entrou ? " A entrada que ele fez no estoque continua lançada no livro." : ""}`
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      await apagar(COL_PEDIDOS, c.id);
      setAviso({ tipo: "ok", texto: "Pedido apagado." });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // ---- ordens de compra ------------------------------------------------
  const salvarOrdem = async () => {
    const f = formOrdem;
    if (!f?.fornecedor.trim() || !f.numero.trim()) return;
    const atual = f.id ? dados.ordens.find((o) => o.id === f.id) : null;
    if (f.id && !atual) return avisarErro("Esta ordem não está mais na lista. Recarregue e tente de novo.");

    const marcados = dados.pedidos.filter((c) => f.pedidoIds.includes(c.id));
    const comValor = marcados.filter(temValor);

    setSalvando(true);
    try {
      const gravada = await salvar(COL_ORDENS, {
        ...(atual || {}),
        numero: f.numero.trim(),
        fornecedor: f.fornecedor.trim(),
        data: f.data,
        previsao: f.previsao,
        status: f.status,
        // Soma só o que tem preço lançado. Pedido sem valor não entra como R$ 0
        // — o documento diria um total que ninguém combinou.
        valorTotal: comValor.length
          ? Math.round(comValor.reduce((s, c) => s + Number(c.valor), 0) * 100) / 100
          : "",
        pedidoIds: marcados.map((c) => c.id),
        obs: f.obs.trim(),
      });

      /* O CARIMBO é o que vale: é por `ordemId` no pedido que as duas telas
         montam a ordem. Carimba quem entrou e SOLTA quem saiu — carimbo velho
         deixaria o pedido em duas ordens ao mesmo tempo. */
      const falhas = [];
      for (const c of marcados) {
        if (c.ordemId === gravada.id) continue;
        try {
          await salvar(COL_PEDIDOS, { ...c, ordemId: gravada.id });
        } catch (e) {
          falhas.push(`${c.item} (${e.message})`);
        }
      }
      for (const c of dados.pedidos) {
        if (c.ordemId !== gravada.id || f.pedidoIds.includes(c.id)) continue;
        try {
          await salvar(COL_PEDIDOS, { ...c, ordemId: "" });
        } catch (e) {
          falhas.push(`${c.item} (${e.message})`);
        }
      }

      setFormOrdem(null);
      if (falhas.length) {
        setAviso({
          tipo: "erro",
          texto: `Ordem OC ${f.numero.trim()} gravada, mas não consegui vincular: ${falhas.join(" · ")}. Confira na aba Pedidos.`,
        });
      } else {
        setAviso({
          tipo: "ok",
          texto: `Ordem OC ${f.numero.trim()} gravada com ${marcados.length} ${
            marcados.length === 1 ? "pedido" : "pedidos"
          }.`,
        });
      }
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const avancarOrdem = (id) => {
    const o = dados.ordens.find((x) => x.id === id);
    if (!o) return avisarErro("Esta ordem não está mais na lista. Recarregue e tente de novo.");
    if (o.status !== "aberta") return;
    gravar(COL_ORDENS, { ...o, status: "enviada" }, `Ordem OC ${o.numero} marcada como enviada.`);
  };

  const receberOrdem = async (id) => {
    const o = dados.ordens.find((x) => x.id === id);
    if (!o) return avisarErro("Esta ordem não está mais na lista. Recarregue e tente de novo.");
    const pendentes = dados.pedidos.filter(
      (c) => c.ordemId === o.id && c.status !== "recebida" && c.status !== "cancelada"
    );
    // Item que já virou entrada no livro fica FORA da conferência: oferecê-lo
    // de novo é convidar a dobrar o saldo.
    const paraConferir = pendentes.filter((c) => !temEntrada(c.id));
    const jaEntraram = pendentes.length - paraConferir.length;

    if (!paraConferir.length) {
      return gravar(
        COL_ORDENS,
        { ...o, status: "recebida" },
        jaEntraram
          ? `Ordem OC ${o.numero} marcada como recebida. ${jaEntraram} ${
              jaEntraram === 1 ? "item já tinha entrado" : "itens já tinham entrado"
            } no estoque.`
          : `Ordem OC ${o.numero} marcada como recebida.`
      );
    }

    /* O MODAL PRIMEIRO, a ordem DEPOIS da confirmação. Marcar a ordem antes
       deixava-a dizendo "recebida" quando a pessoa fechava o modal — e o botão
       de receber sumia junto, sem caminho de volta. */
    setRecebendo({ pedidoIds: paraConferir.map((c) => c.id), ordemId: o.id });
    if (jaEntraram) {
      setAviso({
        tipo: "ok",
        texto: `${jaEntraram} ${
          jaEntraram === 1 ? "item desta ordem já tinha entrado" : "itens desta ordem já tinham entrado"
        } no estoque e ficaram fora da conferência.`,
      });
    }
  };

  const removerOrdem = async (id) => {
    const o = dados.ordens.find((x) => x.id === id);
    if (!o) return avisarErro("Esta ordem não está mais na lista. Recarregue e tente de novo.");
    const itens = dados.pedidos.filter((c) => c.ordemId === o.id);
    if (
      !window.confirm(
        `Apagar a ordem OC ${o.numero || "sem número"}?${
          itens.length ? ` Os ${itens.length} pedidos dela continuam, soltos.` : ""
        }`
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      // Solta os pedidos ANTES de apagar: pedido carimbado com uma ordem que
      // não existe mais some das duas telas sem dizer por quê.
      for (const c of itens) await salvar(COL_PEDIDOS, { ...c, ordemId: "" });
      await apagar(COL_ORDENS, o.id);
      setAviso({ tipo: "ok", texto: "Ordem apagada. Os pedidos dela continuam na aba Pedidos." });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // ---- recebimento (pedido -> estoque) ---------------------------------
  const confirmarRecebimento = async (linhas) => {
    setSalvando(true);
    const ordemId = recebendo?.ordemId || "";
    const hoje = ymdLocal(new Date());
    const falhas = [];
    let feitos = 0;
    try {
      for (const l of linhas) {
        const c = dados.pedidos.find((x) => x.id === l.pedidoId);
        if (!c) {
          falhas.push("um pedido saiu da lista");
          continue;
        }
        /* A CONFERÊNCIA FINAL é aqui, na hora de gravar. O modal pode ter sido
           montado antes de a entrada existir, e o livro é append-only: uma
           segunda entrada do mesmo pedido dobra o saldo e ninguém desfaz. */
        const jaEntrou = entradaDe(c.id);
        if (jaEntrou) {
          falhas.push(`${c.item}: já entrou no estoque em ${desdeQuando(jaEntrou)}`);
          continue;
        }
        try {
          let produtoId = l.produtoId;
          let produtoNome = dados.produtos.find((p) => p.id === produtoId)?.nome || "";
          if (!produtoId && l.novoProduto) {
            const criado = await salvar(COL_PRODUTOS, {
              nome: l.novoProduto.nome,
              unidade: l.novoProduto.unidade,
              categoria: l.novoProduto.categoria,
              local: l.novoProduto.local,
              // Nasce sem mínimo e sem custo: inventar 0 aqui faria o produto
              // aparecer "no limite" no dia seguinte sem ninguém ter decidido.
              minimo: null,
              custoMedio: null,
              fornecedorPadrao: l.novoProduto.fornecedorPadrao || "",
              obs: "",
              ativo: true,
            });
            produtoId = criado.id;
            produtoNome = criado.nome;
          }
          if (!produtoId) {
            falhas.push(`${c.item}: sem produto escolhido`);
            continue;
          }
          const dia = c.dataRecebida || hoje;
          /* O LIVRO PRIMEIRO, o pedido depois. Na ordem inversa, um movimento
             que falhava deixava o pedido "recebida" com o estoque vazio e sem
             caminho de retentativa — a tela dizia que chegou e o saldo dizia
             que não. Assim, se a entrada falhar, o pedido não se mexe. */
          await salvar(COL_MOV, {
            produtoId,
            produtoNome,
            tipo: "entrada",
            quantidade: Math.abs(l.quantidade),
            sinal: 1,
            data: dia,
            motivo: `Recebimento do pedido "${c.item}"`,
            pessoaId: "",
            pessoaNome: "",
            // Os carimbos de origem: é por eles que se volta do saldo até a
            // nota do fornecedor.
            pedidoId: c.id,
            ordemId: c.ordemId || "",
            obs: "",
          });
          try {
            await salvar(COL_PEDIDOS, {
              ...c,
              status: "recebida",
              dataRecebida: dia,
              produtoId,
              qtdeRecebida: l.quantidade,
            });
          } catch (e) {
            /* A entrada JÁ está no livro (o saldo está certo); o que faltou foi
               o carimbo no pedido. Dizer isso com todas as letras evita que
               alguém "receba de novo" e dobre o saldo. */
            falhas.push(
              `${c.item}: a entrada foi lançada no estoque, mas não consegui marcar o pedido como recebido (${e.message}) — marque na aba Pedidos, sem dar entrada outra vez`
            );
            continue;
          }
          feitos += 1;
        } catch (e) {
          // Nada foi gravado nesta linha: nem livro, nem pedido.
          falhas.push(
            `${c.item}: ${e.message} — o pedido continua como ${
              STATUS_PEDIDO[c.status]?.rotulo || c.status
            }; tente receber de novo`
          );
        }
      }
      /* A ORDEM só é marcada depois que os itens foram conferidos: marcá-la
         antes fazia a ordem mentir quando a pessoa desistia no modal. */
      if (ordemId) {
        const o = dados.ordens.find((x) => x.id === ordemId);
        if (o && o.status !== "recebida") {
          try {
            await salvar(COL_ORDENS, { ...o, status: "recebida" });
          } catch (e) {
            falhas.push(`ordem OC ${o.numero || "sem número"}: ${e.message}`);
          }
        }
      }
      if (falhas.length) {
        setAviso({
          tipo: "erro",
          texto: `Dei entrada em ${feitos} de ${linhas.length}. Não consegui: ${falhas.join(" · ")}`,
        });
      } else {
        setAviso({
          tipo: "ok",
          texto:
            feitos === 1
              ? "Recebimento lançado e estoque atualizado."
              : `${feitos} recebimentos lançados e estoque atualizado.`,
        });
      }
    } finally {
      setSalvando(false);
    }
    setRecebendo(null);
    recarregar();
  };

  const soMarcarRecebida = async () => {
    const ids = recebendo?.pedidoIds || [];
    const ordemId = recebendo?.ordemId || "";
    setSalvando(true);
    const hoje = ymdLocal(new Date());
    const falhas = [];
    let feitos = 0;
    try {
      for (const id of ids) {
        const c = dados.pedidos.find((x) => x.id === id);
        if (!c) {
          falhas.push("um pedido saiu da lista");
          continue;
        }
        try {
          await salvar(COL_PEDIDOS, { ...c, status: "recebida", dataRecebida: c.dataRecebida || hoje });
          feitos += 1;
        } catch (e) {
          falhas.push(`${c.item}: ${e.message}`);
        }
      }
      // A ordem também só é marcada aqui, depois da decisão de quem conferiu.
      if (ordemId) {
        const o = dados.ordens.find((x) => x.id === ordemId);
        if (o && o.status !== "recebida") {
          try {
            await salvar(COL_ORDENS, { ...o, status: "recebida" });
          } catch (e) {
            falhas.push(`ordem OC ${o.numero || "sem número"}: ${e.message}`);
          }
        }
      }
      if (falhas.length) {
        setAviso({ tipo: "erro", texto: `Marquei ${feitos} de ${ids.length}. Não consegui: ${falhas.join(" · ")}` });
      } else {
        setAviso({
          tipo: "ok",
          texto:
            feitos === 1
              ? "Pedido marcado como recebido. O estoque não foi alterado."
              : `${feitos} pedidos marcados como recebidos. O estoque não foi alterado.`,
        });
      }
    } finally {
      setSalvando(false);
    }
    setRecebendo(null);
    recarregar();
  };

  const acoes = {
    // estoque
    abrirProduto: (p) =>
      setFormProduto(produtoParaForm(p ? dados.produtos.find((x) => x.id === p.id) || p : null)),
    salvarProduto,
    abrirMovimento: (p, tipo) => {
      const atual = dados.produtos.find((x) => x.id === p.id);
      if (!atual) return avisarErro("Este produto não está mais na lista. Recarregue e tente de novo.");
      setFormMov(movimentoVazio(atual, tipo));
    },
    lancarMovimento,
    // pedidos
    abrirPedido: (id) => setFormPedido(pedidoParaForm(id ? dados.pedidos.find((c) => c.id === id) : null)),
    salvarPedido,
    avancarPedido,
    removerPedido,
    // ordens
    abrirOrdem: (id) =>
      setFormOrdem(ordemParaForm(id ? dados.ordens.find((o) => o.id === id) : null, dados.ordens, dados.pedidos)),
    salvarOrdem,
    avancarOrdem,
    receberOrdem,
    removerOrdem,
    // recebimento
    confirmarRecebimento,
    soMarcarRecebida,
    fecharRecebimento: () => setRecebendo(null),
    // retiradas
    abrirRetirada: () => setFormRetirada(retiradaVazia()),
    registrarRetirada,
  };

  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!dados) return <CarregandoModulo />;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Compras"
        descricao="O material da casa num lugar só: o que está acabando, o que já foi pedido e quem levou o quê."
      />

      <div className="mb-6 max-w-full overflow-x-auto">
        <Segmented opcoes={ABAS} valor={aba} onChange={trocarAba} />
      </div>

      {aba === "estoque" && (
        <AbaEstoque
          produtos={dados.produtos}
          movs={dados.movs}
          resumo={resumo}
          equipe={equipe}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          formProduto={formProduto}
          setFormProduto={setFormProduto}
          formMov={formMov}
          setFormMov={setFormMov}
          acoes={acoes}
          aoExportar={exportar}
        />
      )}

      {aba === "pedidos" && (
        <AbaPedidos
          pedidos={dados.pedidos}
          produtos={dados.produtos}
          ordens={dados.ordens}
          // O livro entra na aba só para uma coisa: dizer se o pedido JÁ virou
          // entrada — é isso que trava a "quantidade recebida" no formulário.
          movs={dados.movs}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          formPedido={formPedido}
          setFormPedido={setFormPedido}
          recebendo={recebendo}
          acoes={acoes}
          aoExportar={exportar}
        />
      )}

      {aba === "ordens" && (
        <AbaOrdens
          ordens={dados.ordens}
          pedidos={dados.pedidos}
          produtos={dados.produtos}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          formOrdem={formOrdem}
          setFormOrdem={setFormOrdem}
          recebendo={recebendo}
          acoes={acoes}
          aoExportar={exportar}
        />
      )}

      {aba === "retiradas" && (
        <AbaRetiradas
          movs={dados.movs}
          produtos={dados.produtos}
          resumo={resumo}
          equipe={equipe}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          formRetirada={formRetirada}
          setFormRetirada={setFormRetirada}
          acoes={acoes}
          aoExportar={exportar}
        />
      )}
    </div>
  );
}
