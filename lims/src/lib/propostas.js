// Regras das propostas, no formato do GerenciaLab: número "00000957/2026.0"
// (sequência/ano.versão), status da lista e exibição de preços. Puro e testado.

export const STATUS_PROPOSTA = ["Aguardando", "A-C Aprovado", "A-C pendente", "A.C recursada", "Aceito", "Cancelado", "Copia", "Gerar contrato", "Recusado", "Revisado", "Salvo"];

export const COR_STATUS = {
  Aceito: "ok", Salvo: "info", Aguardando: "warn", "A-C pendente": "warn", "A-C Aprovado": "primary", "Gerar contrato": "primary",
  Recusado: "crit", Cancelado: "crit", "A.C recursada": "crit", Copia: "default", Revisado: "default",
};

export const EXIBICAO_PRECOS = ["Valor total COM Outros custos", "Valor Total SEM Outros custos", "Valor total COM Outros custos COM valor parâmetros", "Não Exibir Valores"];

// Catálogo de exemplo. Na etapa com servidor vem de Configurações → Especificação Serviços.
export const PARAMETROS = [
  { cod: "PH", nome: "pH", abrev: "pH", grupo: "Físico-químico", lq: "2,0", ld: "—", inc: "0,06", un: "—", metodo: "SMWW 4500-H+ B", acred: true, preco: 18 },
  { cod: "TUR", nome: "Turbidez", abrev: "Turb.", grupo: "Físico-químico", lq: "0,1", ld: "0,05", inc: "0,08", un: "uT", metodo: "SMWW 2130 B", acred: true, preco: 18 },
  { cod: "COR", nome: "Cor aparente", abrev: "Cor", grupo: "Físico-químico", lq: "2,5", ld: "1,0", inc: "0,9", un: "uH", metodo: "SMWW 2120 C", acred: true, preco: 20 },
  { cod: "CRL", nome: "Cloro residual livre", abrev: "CRL", grupo: "Físico-químico", lq: "0,05", ld: "0,02", inc: "0,04", un: "mg/L", metodo: "SMWW 4500-Cl G", acred: true, preco: 22 },
  { cod: "FLU", nome: "Fluoreto", abrev: "F⁻", grupo: "Físico-químico", lq: "0,1", ld: "0,05", inc: "0,05", un: "mg/L", metodo: "SMWW 4500-F C", acred: false, preco: 35 },
  { cod: "DUR", nome: "Dureza total", abrev: "Dur.", grupo: "Físico-químico", lq: "5,0", ld: "2,0", inc: "1,8", un: "mg/L CaCO₃", metodo: "SMWW 2340 C", acred: false, preco: 28 },
  { cod: "CT", nome: "Coliformes totais", abrev: "CT", grupo: "Microbiológico", lq: "1", ld: "—", inc: "—", un: "NMP/100 mL", metodo: "SMWW 9223 B", acred: true, preco: 45 },
  { cod: "EC", nome: "Escherichia coli", abrev: "E. coli", grupo: "Microbiológico", lq: "1", ld: "—", inc: "—", un: "NMP/100 mL", metodo: "SMWW 9223 B", acred: true, preco: 45 },
  { cod: "DBO", nome: "Demanda bioquímica de oxigênio", abrev: "DBO", grupo: "Físico-químico", lq: "2,0", ld: "1,0", inc: "12%", un: "mg/L O₂", metodo: "SMWW 5210 B", acred: true, preco: 85 },
  { cod: "DQO", nome: "Demanda química de oxigênio", abrev: "DQO", grupo: "Físico-químico", lq: "10", ld: "5", inc: "8%", un: "mg/L O₂", metodo: "SMWW 5220 D", acred: true, preco: 70 },
  { cod: "SST", nome: "Sólidos suspensos totais", abrev: "SST", grupo: "Físico-químico", lq: "5", ld: "2", inc: "10%", un: "mg/L", metodo: "SMWW 2540 D", acred: false, preco: 40 },
  { cod: "OG", nome: "Óleos e graxas", abrev: "O&G", grupo: "Físico-químico", lq: "10", ld: "5", inc: "15%", un: "mg/L", metodo: "SMWW 5520 D", acred: false, preco: 95 },
  { cod: "CTT", nome: "Coliformes termotolerantes", abrev: "CTT", grupo: "Microbiológico", lq: "1", ld: "—", inc: "—", un: "NMP/100 mL", metodo: "SMWW 9221 E", acred: true, preco: 50 },
  { cod: "SAL", nome: "Salmonella spp.", abrev: "Salm.", grupo: "Microbiológico", lq: "—", ld: "—", inc: "—", un: "/25 g", metodo: "ISO 6579-1", acred: false, preco: 120 },
  { cod: "CPP", nome: "Contagem padrão em placas", abrev: "CPP", grupo: "Microbiológico", lq: "1", ld: "—", inc: "—", un: "UFC/mL", metodo: "ISO 4833-1", acred: false, preco: 55 },
];

export const SERVICOS = [
  { id: 1, nome: "Potabilidade", matriz: "Água para consumo humano", la: "Portaria GM/MS 888/2021", params: ["PH", "TUR", "COR", "CRL", "FLU", "CT", "EC"] },
  { id: 2, nome: "Efluente — lançamento", matriz: "Efluente", la: "CONAMA 430/2011", params: ["PH", "DBO", "DQO", "SST", "OG", "CTT"] },
  { id: 3, nome: "Água bruta / poço", matriz: "Água subterrânea", la: "CONAMA 396/2008", params: ["PH", "TUR", "COR", "DUR", "CT", "EC"] },
  { id: 4, nome: "Microbiologia de alimentos", matriz: "Alimentos", la: "IN 161/2022", params: ["SAL", "CPP", "CT", "EC"] },
  { id: 5, nome: "Monitoramento de cloro", matriz: "Água para consumo humano", la: "Portaria GM/MS 888/2021", params: ["CRL", "PH", "TUR"] },
];

export const parametro = (cod) => PARAMETROS.find((p) => p.cod === cod);
export const servico = (id) => SERVICOS.find((s) => s.id === Number(id));

export const numeroProposta = (p) => `${String(p.num).padStart(8, "0")}/${p.ano}.${p.ver}`;

export const precoUnitario = (item) => item.params.reduce((s, c) => s + (parametro(c)?.preco || 0), 0);
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

export const proximoNumero = (lista) => Math.max(0, ...lista.map((p) => p.num)) + 1;
export const proximoId = (lista) => Math.max(0, ...lista.map((p) => p.id)) + 1;

// Proposta aceita não se edita: muda por revisão, que sobe a versão e guarda o motivo.
export const podeEditar = (p) => p.status !== "Aceito";

export function criarRevisao(p, motivo, por, hojeIso) {
  const m = String(motivo || "").trim();
  if (!m) throw new Error("Informe o motivo da revisão.");
  const ver = p.ver + 1;
  return { ...p, ver, status: "Revisado", aceite: null, revs: [...(p.revs || []), { ver, motivo: m, em: hojeIso, por }] };
}

export function copiarProposta(p, lista, por, hojeIso, validadeIso) {
  return {
    ...structuredClone(p),
    id: proximoId(lista), num: proximoNumero(lista), ano: Number(hojeIso.slice(0, 4)), ver: 0,
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

export function adicionarItem(p, sid, qtd, selecionados) {
  const s = servico(sid);
  if (!s) throw new Error("Escolha o serviço.");
  const params = s.params.filter((c) => selecionados.has(c));
  if (!params.length) throw new Error("Marque ao menos um parâmetro.");
  return { ...p, itens: [...p.itens, { sid: s.id, qtd: Math.max(1, Number(qtd) || 1), params }] };
}
