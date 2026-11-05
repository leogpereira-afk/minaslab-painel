// Regras das propostas, no formato do GerenciaLab: número "00000957/2026.0"
// (sequência/ano.versão), status da lista e exibição de preços. Puro e testado.

export const STATUS_PROPOSTA = ["Aguardando", "A-C Aprovado", "A-C pendente", "A.C recursada", "Aceito", "Cancelado", "Copia", "Gerar contrato", "Recusado", "Revisado", "Salvo"];

export const COR_STATUS = {
  Aceito: "ok", Salvo: "info", Aguardando: "warn", "A-C pendente": "warn", "A-C Aprovado": "primary", "Gerar contrato": "primary",
  Recusado: "crit", Cancelado: "crit", "A.C recursada": "crit", Copia: "default", Revisado: "default",
};

export const EXIBICAO_PRECOS = ["Valor total COM Outros custos", "Valor Total SEM Outros custos", "Valor total COM Outros custos COM valor parâmetros", "Não Exibir Valores"];

export const numeroProposta = (p) => `${String(p.num).padStart(8, "0")}/${p.ano}.${p.ver}`;

// Item da proposta guarda uma CÓPIA dos parâmetros e preços do momento em que
// foi incluído: mudar o catálogo depois não altera proposta já feita.
// Valor de uma amostra: soma dos parâmetros (ou o "Total da amostra" digitado)
// menos o desconto %. É o que o GerenciaLab mostra em "Total da amostra".
export const somaParametros = (item) => (item.params || []).reduce((s, p) => s + (Number(p.preco) || 0), 0);
export function precoUnitario(item) {
  const base = item.precoAmostra !== undefined && item.precoAmostra !== null && item.precoAmostra !== "" ? Number(item.precoAmostra) || 0 : somaParametros(item);
  const desc = Math.min(100, Math.max(0, Number(item.desconto) || 0));
  return Math.round(base * (1 - desc / 100) * 100) / 100;
}
export const totalItem = (item) => (Number(item.qtd) || 0) * precoUnitario(item);
export const subtotal = (p) => p.itens.reduce((s, it) => s + totalItem(it), 0);
export const totalOutros = (p) => (Array.isArray(p.outrosItens) ? p.outrosItens.reduce((s, o) => s + (Number(o.valor) || 0) * (Number(o.qtd) || 1), 0) : Number(p.outros) || 0);
export const totalProposta = (p) => subtotal(p) + totalOutros(p);

// O que o documento enviado ao cliente mostra, conforme "Exibição de preços".
export function exibicao(p) {
  const valores = p.exib !== "Não Exibir Valores";
  const outros = valores && p.exib !== "Valor Total SEM Outros custos";
  const porParametro = valores && p.exib.includes("valor parâmetros");
  return { valores, outros, porParametro, total: valores ? subtotal(p) + (outros ? totalOutros(p) : 0) : null };
}


// Proposta aceita não se edita: muda por revisão, que sobe a versão e guarda o motivo.
export const podeEditar = (p) => p.status !== "Aceito";

export function criarRevisao(p, motivo, por, hojeIso) {
  const m = String(motivo || "").trim();
  if (!m) throw new Error("Informe o motivo da revisão.");
  const ver = p.ver + 1;
  return { ...p, ver, status: "Revisado", aceite: null, revs: [...(p.revs || []), { ver, motivo: m, em: hojeIso, por }] };
}

// num vem do servidor (numeração atômica); o id novo é dado ao gravar.
export function copiarProposta(p, num, por, hojeIso, validadeIso) {
  const { id: _id, cod: _cod, criadoEm: _c1, criadoPor: _c2, atualizadoEm: _a1, atualizadoPor: _a2, ...base } = structuredClone(p);
  return {
    ...base,
    num, ano: Number(hojeIso.slice(0, 4)), ver: 0,
    status: "Copia", statusProc: "Aguardando aceite", criacao: hojeIso, validade: validadeIso,
    views: 0, revs: [], docs: [], aceite: null, resp: por,
  };
}

export function aceitarProposta(p, { data, nome, obs }) {
  if (!String(nome || "").trim()) throw new Error("Informe quem aceitou.");
  if (!data) throw new Error("Informe a data do aceite.");
  return { ...p, status: "Aceito", statusProc: "Gerar contrato", aceite: { data, nome: nome.trim(), obs: String(obs || "").trim() } };
}

// Etapa 1 (Criar proposta): o que impede o Avançar.
export function erroEtapa1(d) {
  if (!d.clienteId) return "Selecione o cliente.";
  if (!d.criacao) return "Informe a data de criação da proposta.";
  if (!d.validade || d.validade < d.criacao) return "A data de validade deve ser igual ou posterior à data de criação.";
  if (d.ciclo === "Parcelado" && !(Number(d.parcelas) >= 1)) return "Informe o número de parcelas.";
  return "";
}

// Monta o item a partir de um Pacote de Serviços do catálogo (Configurações).
// selecionados: Set de ids de parâmetro marcados. Preço vem da tabela do pacote.
export function itemDoPacote(pacote, catalogo, qtd, selecionados) {
  if (!pacote) throw new Error("Escolha o pacote de serviços.");
  const tabela = catalogo.tabelas_preco.find((t) => t.id === pacote.tabelaPreco);
  const nomeDe = (col, id, campo = "nome") => (catalogo[col] || []).find((x) => x.id === id)?.[campo] || "";
  const params = (pacote.parametros || []).filter((id) => selecionados.has(id)).map((id) => {
    const p = catalogo.parametros.find((x) => x.id === id);
    if (!p) return null;
    return {
      id, nome: p.parametro, abrev: p.abreviacao || "", metodo: nomeDe("metodos", p.metodo), un: nomeDe("unidades", p.unidade, "sigla"),
      lq: p.lq || "", acred: p.acreditado === "Sim", preco: Number(tabela?.precos?.[id]) || 0,
    };
  }).filter(Boolean);
  if (!params.length) throw new Error("Marque ao menos um parâmetro.");
  return {
    pacoteId: pacote.id, descricao: pacote.descricao, grupo: nomeDe("grupos_servico", pacote.grupo), matriz: nomeDe("matrizes", pacote.matriz),
    legislacao: nomeDe("legislacoes", pacote.legislacao), legislacao2: pacote.legislacao2 ? [nomeDe("legislacoes", pacote.legislacao2)].filter(Boolean) : [],
    tabela: tabela?.nome || "", qtd: Math.max(1, Number(qtd) || 1), params, ident: "", desconto: 0, entradaSaida: "-",
    prazo: prazoDosParametros(catalogo, params), periodicidade: "Único",
  };
}

// Prazo da amostra (dias): o maior "Prazo limite (dias)" dos parâmetros.
export function prazoDosParametros(catalogo, params) {
  const d = params.map((x) => Number((catalogo.parametros || []).find((p) => p.id === x.id)?.prazoDias) || 0);
  return d.length ? Math.max(...d) || "" : "";
}

// Parâmetro do catálogo como linha da amostra (preço da tabela escolhida).
export function parametroDoCatalogo(catalogo, id, tabelaNome = "") {
  const p = catalogo.parametros.find((x) => x.id === id);
  if (!p) return null;
  const nomeDe = (col, v, campo = "nome") => (catalogo[col] || []).find((x) => x.id === v)?.[campo] || "";
  const tabela = catalogo.tabelas_preco.find((t) => t.nome === tabelaNome);
  return { id, nome: p.parametro, abrev: p.abreviacao || "", metodo: nomeDe("metodos", p.metodo), un: nomeDe("unidades", p.unidade, "sigla"), lq: p.lq || "", acred: p.acreditado === "Sim", preco: Number(tabela?.precos?.[id] ?? p.preco) || 0, subcontratado: nomeDe("subcontratados", p.subcontratado, "empresa") };
}

// "Sem pacote": a amostra é montada à mão (legislação, grupo, matriz, especificação).
export function itemManual(catalogo, { legislacao = "", legislacao2 = [], grupo = "", matriz = "", parametros = [], tabela = "", subcontratado = "", periodicidade = "Único", repetir = "", agendar = "" }) {
  if (!grupo) throw new Error("Selecione o grupo de serviços.");
  if (!matriz) throw new Error("Selecione a matriz.");
  const params = parametros.map((id) => parametroDoCatalogo(catalogo, id, tabela)).filter(Boolean).map((x) => (subcontratado ? { ...x, subcontratado } : x));
  if (!params.length) throw new Error("Marque ao menos um parâmetro (Especificação).");
  const nomeDe = (col, v, campo = "nome") => (catalogo[col] || []).find((x) => x.id === v)?.[campo] || "";
  return {
    pacoteId: null, descricao: nomeDe("matrizes", matriz), grupo: nomeDe("grupos_servico", grupo), matriz: nomeDe("matrizes", matriz),
    legislacao: nomeDe("legislacoes", legislacao), legislacao2: legislacao2.map((id) => nomeDe("legislacoes", id)).filter(Boolean), tabela, qtd: 1, params,
    ident: "", desconto: 0, entradaSaida: "-", prazo: prazoDosParametros(catalogo, params), periodicidade, repetir, agendar,
  };
}

export const adicionarItem = (p, item) => ({ ...p, itens: [...p.itens, item] });

// Número da proposta: continua a numeração indicada em Configuração do
// sistema → Proposta (ex.: seguir do GerenciaLab), por ano.
export const chaveNumero = (ano) => `proposta:${ano}`;
export const minimoNumero = (config) => Math.max(0, (Number(config?.numeroInicialProposta) || 1) - 1);
