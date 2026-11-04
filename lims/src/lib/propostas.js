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
export const precoUnitario = (item) => item.params.reduce((s, p) => s + (Number(p.preco) || 0), 0);
export const totalItem = (item) => (Number(item.qtd) || 0) * precoUnitario(item);
export const subtotal = (p) => p.itens.reduce((s, it) => s + totalItem(it), 0);
export const totalProposta = (p) => subtotal(p) + (Number(p.outros) || 0);

// O que o documento enviado ao cliente mostra, conforme "Exibição de preços".
export function exibicao(p) {
  const valores = p.exib !== "Não Exibir Valores";
  const outros = valores && p.exib !== "Valor Total SEM Outros custos";
  const porParametro = valores && p.exib.includes("valor parâmetros");
  return { valores, outros, porParametro, total: valores ? subtotal(p) + (outros ? Number(p.outros) || 0 : 0) : null };
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
  const nomeDe = (col, id, campo = "nome") => catalogo[col].find((x) => x.id === id)?.[campo] || "";
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
    pacoteId: pacote.id, descricao: pacote.descricao, matriz: nomeDe("matrizes", pacote.matriz),
    legislacao: nomeDe("legislacoes", pacote.legislacao), tabela: tabela?.nome || "", qtd: Math.max(1, Number(qtd) || 1), params,
  };
}

export const adicionarItem = (p, item) => ({ ...p, itens: [...p.itens, item] });

// Número da proposta: continua a numeração indicada em Configuração do
// sistema → Proposta (ex.: seguir do GerenciaLab), por ano.
export const chaveNumero = (ano) => `proposta:${ano}`;
export const minimoNumero = (config) => Math.max(0, (Number(config?.numeroInicialProposta) || 1) - 1);
