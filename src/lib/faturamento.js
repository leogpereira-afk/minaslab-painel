// O FATURAMENTO DESTA CASA NÃO É UMA VENDA — É UM TÍTULO A RECEBER.
//
// A Curva ABC foi escrita para `fin_vendas`: nota fiscal com itens dentro, do
// jeito que a Impresilk tem. Em 30/08/2026 a ponte do Omie foi ligada e o
// diagnóstico mediu, contra a conta real da MinasLab:
//
//     notas fiscais de produto ......... 0     (a casa não emite)
//     ordens de serviço ................ 0     (mesmo SEM filtro nenhum)
//     contas a receber ............. 2.301
//     clientes ..................... 1.076
//     categorias financeiras ......... 159
//
// Não é ponte quebrada nem importação pela metade: é o desenho do ERP nesta
// casa. Quem fatura análise ambiental emite RPS e lança o título; o item da
// nota, que na Impresilk diz "camiseta" ou "adesivo", aqui não existe.
//
// Então este arquivo TRADUZ o que existe para o formato que as três abas já
// sabem ler — em vez de reescrever 3.100 linhas de tela testada. Um título
// vira uma "venda" de um item só, e esse item é a CATEGORIA FINANCEIRA.
//
// O QUE A TRADUÇÃO NÃO INVENTA:
//
//   · VENDEDOR. O título a receber do Omie não traz vendedor — medido, não
//     suposto. A venda sai daqui SEM o campo, e a aba Vendedores diz isso com
//     todas as letras. Deduzir vendedor por qualquer proximidade (quem cadastrou,
//     quem atendeu antes) seria inventar comissão.
//   · PRODUTO. O item é a categoria ("1.01.02 — Análises"), não o ensaio
//     vendido. A aba avisa que este é o nível de detalhe que existe.
//   · RECEBIMENTO. `pagoEm` e `valorPago` voltam SEMPRE vazios da listagem do
//     Omie (medido: 1.995 títulos "pago", 0 com data de baixa, 0 com valor
//     pago). Por isso a data da venda é a EMISSÃO, e esta casa não oferece uma
//     visão "por recebimento" que ela não teria como preencher. Oferecer o
//     seletor e devolver vazio seria pior que não oferecer.
//
// O CANCELADO NÃO SOME, VIRA MARCA. `cancelada: true` faz `recortarVendas`
// contá-lo e a aba anunciar quantos ficaram de fora — 259 dos 2.301 títulos.
// Título cancelado descartado em silêncio é faturamento que evapora sem
// ninguém ver.

/* Aceita número ou texto do banco. Ausência continua ausência: `null` não vira
   0, porque 0 no dinheiro é uma afirmação ("não faturou") e ausência é outra
   coisa — a mesma regra que a tela inteira segue. */
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const texto = (v) => (v === null || v === undefined ? "" : String(v).trim());

/* CÓDIGO → DESCRIÇÃO. Categoria sem cadastro correspondente NÃO some e NÃO
   vira "sem categoria": ela aparece pelo próprio código. O código é o dado
   verdadeiro; a descrição é enfeite que pode faltar. */
export function indiceDeCategorias(categorias) {
  const mapa = new Map();
  for (const c of Array.isArray(categorias) ? categorias : []) {
    const cod = texto(c?.codigo || c?.id);
    if (!cod) continue;
    const desc = texto(c?.descricao);
    if (desc) mapa.set(cod, desc);
  }
  return mapa;
}

/* O NOME DA CATEGORIA como a tela deve mostrar: "1.01.02 — Análises" quando há
   descrição, só "1.01.02" quando não há. Nunca um travessão sozinho, que o olho
   lê como erro de carga. */
export function nomeDaCategoria(codigo, indice) {
  const cod = texto(codigo);
  if (!cod) return "";
  const desc = indice?.get?.(cod);
  return desc ? `${cod} — ${desc}` : cod;
}

/* A TRADUÇÃO. Devolve a lista no formato que Clientes, Produtos e Vendedores
   já leem: { id, numero, documento, data, clienteId, valor, cancelada, itens }.
   Não corta por ano — quem corta é `recortarVendas`, uma régua só para as três
   abas. */
export function vendasDosTitulos(receber, categorias) {
  const indice = indiceDeCategorias(categorias);
  const saida = [];

  for (const t of Array.isArray(receber) ? receber : []) {
    if (!t) continue;
    const valor = num(t.valor);
    const codigo = texto(t.categoria);
    const nome = nomeDaCategoria(codigo, indice);

    saida.push({
      id: texto(t.id) || texto(t.omieId),
      numero: texto(t.numero),
      documento: texto(t.numero),
      /* A EMISSÃO é a data do faturamento. Vencimento é promessa e baixa não
         veio — ver o cabeçalho. */
      data: texto(t.emissao),
      clienteId: texto(t.clienteId),
      valor,
      cancelada: texto(t.status) === "cancelado",
      /* UM item por título. Título sem categoria entra com a lista vazia, e a
         aba Produtos já sabe pôr isso no balde "sem detalhe" contado — em vez
         de sumir com o valor. */
      itens: codigo
        ? [
            {
              id: codigo,
              codigo,
              descricao: nome,
              nome,
              valor,
              /* QUANTIDADE NÃO EXISTE AQUI, e por isso viaja NULA. Categoria
                 financeira não tem "quantas unidades"; pôr 1 por título faria a
                 coluna Quantidade repetir a coluna Títulos com outro nome — e
                 duas colunas dizendo a mesma coisa se leem como duas medidas. A
                 aba já sabe mostrar travessão com o motivo quando a quantidade
                 não veio. */
              quantidade: null,
            },
          ]
        : [],
    });
  }

  return saida;
}

/* OS ANOS QUE O FILTRO OFERECE.
 *
 * Nasceu com piso fixo em 2020, copiado do print do Painel da Impresilk — que
 * tem dez anos de história. A MinasLab entrou no Omie em 2024, e o filtro
 * mostrava 2020, 2021, 2022 e 2023: quatro botões que só sabem devolver tela
 * vazia. Botão que não pode dar certo não é filtro, é armadilha; e quatro deles
 * em fila fazem o módulo parecer quebrado antes de o dono clicar em nada.
 *
 * Agora o piso é O PRIMEIRO ANO COM FATURAMENTO. Três coisas entram além dele,
 * e cada uma existe por um motivo:
 *
 *   · O ANO CORRENTE, sempre. Na virada de janeiro ainda não há título do ano
 *     novo; sem esta linha o ano novo seria inalcançável justamente no mês em
 *     que o dono mais quer olhar para ele — e ele não teria onde clicar para
 *     descobrir que ainda não entrou nada.
 *   · TODO ano com faturamento, mesmo fora da faixa. Se um título de 2019
 *     aparecer numa importação futura, a lista não pode escondê-lo.
 *   · O ANO JÁ ESCOLHIDO. Parece zelo demais e não é: uma escolha guardada no
 *     aparelho que saísse da lista deixaria a tela SEM NENHUMA PÍLULA ACESA, e
 *     é exatamente assim que alguém conclui que "o filtro não funciona".
 *
 * Sem faturamento nenhum, sobra o ano corrente. Oferecer sete anos vazios
 * quando não há dado é encher a tela de perguntas que já se sabe responder.
 */
export function anosDoFiltro({ anosComVenda, anoAtual, anoEscolhido } = {}) {
  const ehAno = (v) => /^\d{4}$/.test(String(v ?? ""));
  const comVenda = (Array.isArray(anosComVenda) ? anosComVenda : []).filter(ehAno).map(String);
  const atual = ehAno(anoAtual) ? String(anoAtual) : null;

  const anos = new Set(comVenda);
  if (atual) anos.add(atual);
  if (ehAno(anoEscolhido)) anos.add(String(anoEscolhido));

  /* O PISO É O MENOR ANO COM FATURAMENTO — e daí até hoje sem buraco. Um ano
     no meio sem título ainda merece botão: "2025 não teve faturamento" é uma
     resposta, e some da lista viraria uma pergunta que ninguém pode fazer. */
  if (comVenda.length && atual) {
    const piso = Number(comVenda.reduce((m, a) => (a < m ? a : m)));
    for (let a = piso; a <= Number(atual); a += 1) anos.add(String(a));
  }

  return [...anos].sort();
}
