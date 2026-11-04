// Dados de DEMONSTRAÇÃO, todos fictícios. Servem para validar telas e
// navegação antes da porta do LIMS no Supabase. Nenhum dado real do
// GerenciaLab é copiado para cá.

import { isoDia } from "./formato.js";
import { servico } from "./propostas.js";

const CLIENTES = [
  ["Ativo", "Carlos Eduardo Pires", "Laticínios Serra Verde Ltda", "Serra Verde Laticínios", "12.345.678/0001-90", "qualidade@serraverde.com.br", "Montes Claros"],
  ["Ativo", "Mariana Lopes", "SAAE Bocaiúva", "SAAE Bocaiúva", "98.765.432/0001-10", "laboratorio@saaebocaiuva.mg.gov.br", "Bocaiúva"],
  ["Ativo", "Rogério Antunes", "Cervejaria Norte Mineira S.A.", "Cervejaria Norte", "45.112.330/0001-08", "rogerio@cervejarianorte.com.br", "Montes Claros"],
  ["Ativo", "Fernanda Rocha", "Hospital Santa Rita", "Santa Rita", "21.908.765/0001-44", "sesmt@hsantarita.org.br", "Montes Claros"],
  ["Inativo", "Paulo Henrique Dias", "Posto Avenida Combustíveis Ltda", "Posto Avenida", "33.221.110/0001-77", "posto.avenida@email.com", "Janaúba"],
  ["Ativo", "Luciana Mendes", "Mineração Vale do Jequi Ltda", "Vale do Jequi", "07.654.321/0001-65", "meioambiente@valejequi.com.br", "Grão Mogol"],
  ["Ativo", "João Batista Neves", "João Batista Neves", "", "123.456.789-09", "joaobneves@email.com", "Francisco Sá"],
  ["Ativo", "Patrícia Gomes", "Frigorífico Gorutuba Ltda", "Frigogorutuba", "66.432.109/0001-21", "qualidade@frigogorutuba.com.br", "Janaúba"],
  ["Ativo", "Ricardo Teixeira", "Condomínio Ibituruna Residence", "Ibituruna Residence", "14.789.000/0001-03", "sindico@ibituruna.com.br", "Montes Claros"],
  ["Ativo", "Aline Ferraz", "Indústria de Polpas Sertão Ltda", "Polpas Sertão", "52.019.874/0001-56", "aline@polpassertao.com.br", "Pirapora"],
  ["Ativo", "Secretaria de Obras", "Município de Coração de Jesus", "", "18.017.392/0001-40", "obras@coracaodejesus.mg.gov.br", "Coração de Jesus"],
  ["Inativo", "Marcos Viana", "Construtora Montes Ltda", "Construtora Montes", "29.887.654/0001-12", "contato@construtoramontes.com.br", "Montes Claros"],
  ["Ativo", "Bruna Alves", "Água Mineral Fonte Clara Ltda", "Fonte Clara", "40.556.778/0001-80", "bruna@fonteclara.com.br", "Salinas"],
  ["Ativo", "Diego Souza", "Granja São Judas Ltda", "Granja São Judas", "71.223.445/0001-09", "granjasj@email.com", "Capitão Enéas"],
  ["Ativo", "Helena Faria", "Clínica Vida Plena Ltda", "Vida Plena", "88.112.334/0001-61", "helena@vidaplena.med.br", "Montes Claros"],
  ["Ativo", "Thiago Martins", "Laboratório Parceiro Análises Ltda", "LabParceiro", "60.778.990/0001-27", "thiago@labparceiro.com.br", "Belo Horizonte"],
  ["Ativo", "Sandra Ribeiro", "Supermercado Bom Preço Ltda", "Bom Preço", "35.665.221/0001-49", "qualidade@bompreco.com.br", "Montes Claros"],
  ["Ativo", "Eduardo Lima", "Usina Solar Norte Ltda", "Solar Norte", "11.990.887/0001-35", "eduardo@solarnorte.com.br", "Janaúba"],
  ["Ativo", "Vanessa Cruz", "Escola Municipal Sagrado Coração", "EM Sagrado Coração", "19.334.556/0001-70", "direcao.emsc@educacao.mg.gov.br", "Montes Claros"],
  ["Ativo", "Gustavo Prado", "Distribuidora Hídrica Ltda", "Hídrica", "47.100.223/0001-02", "gustavo@hidrica.com.br", "Montes Claros"],
  ["Ativo", "Renata Alcântara", "Doceria Doce Sabor Ltda", "Doce Sabor", "27.443.665/0001-31", "renata@docesabor.com.br", "Montes Claros"],
  ["Ativo", "Fábio Moreira", "Cooperativa Agropecuária do Norte", "Coopernorte", "02.556.443/0001-88", "fabio@coopernorte.coop.br", "Montes Claros"],
];

const SOLICITANTES = [
  ["Mariana Lopes", "SAAE Bocaiúva", "laboratorio@saaebocaiuva.mg.gov.br"],
  ["Carlos Eduardo Pires", "Laticínios Serra Verde Ltda", "qualidade@serraverde.com.br"],
  ["Ana Paula Rocha", "Laticínios Serra Verde Ltda", "ana.rocha@serraverde.com.br"],
  ["Rogério Antunes", "Cervejaria Norte Mineira S.A.", "rogerio@cervejarianorte.com.br"],
  ["Luciana Mendes", "Mineração Vale do Jequi Ltda", "meioambiente@valejequi.com.br"],
  ["Fernanda Rocha", "Hospital Santa Rita", "sesmt@hsantarita.org.br"],
];

const RESP = ["Equipe Comercial", "Júlia Prado", "Diego Rocha"];

const dataHora = (iso, i) => `${iso.split("-").reverse().join("/")} ${String(8 + (i % 9)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`;

export function dadosDemo(hoje = new Date()) {
  const dia = (n) => isoDia(n, hoje);
  const clientes = CLIENTES.map((r, i) => ({
    id: 1001 + i * 7, status: r[0], resp: r[1], razao: r[2], fantasia: r[3], doc: r[4], email: r[5], cidade: r[6],
    uf: i === 15 ? "MG" : ["MG", "MG", "MG", "BA", "MG", "MG", "GO"][i % 7],
    tipo: i === 15 ? "Fornecedor" : i === 19 ? "Cliente / Fornecedor" : "Cliente",
    pessoa: r[4].replace(/\D/g, "").length === 11 ? "PF" : "PJ",
    tel: `(38) 32${String(10 + i).padStart(2, "0")}-${String(1000 + i * 311).slice(0, 4)}`,
    cel: `(38) 99${String(100 + i * 37).slice(0, 3)}-${String(1000 + i * 271).slice(0, 4)}`,
    cep: `39400-${String(100 + i * 13).padStart(3, "0")}`,
    end: `Rua ${["das Flores", "Dom Pedro II", "Coronel Prates", "Padre Augusto", "Afonso Pena"][i % 5]}`, num: String(100 + i * 17), comp: "",
    bairro: ["Centro", "Ibituruna", "Todos os Santos", "Major Prates", "Delfino Magalhães"][i % 5], ie: "", im: "",
    criado: dataHora(dia(-400 + i * 15), i), mod: dataHora(dia(-30 + i), i + 3), obs: i === 4 ? "Cadastro inativado a pedido do cliente" : "",
  }));
  const solicitantes = SOLICITANTES.map((r, i) => ({
    id: 301 + i, status: "Ativo", nome: r[0], cliente: r[1], email: r[2],
    tel: `(38) 99${String(710 + i * 9)}-${String(2200 + i * 41)}`, criado: dataHora(dia(-200 + i * 20), i),
  }));
  const ano = hoje.getFullYear();
  const spec = [
    [5, "Aceito", 0, [[1, 4]], -40, "Ordem de serviço gerada"], [0, "Aceito", 1, [[2, 2]], -35, "Contrato gerado"],
    [2, "Salvo", 0, [[4, 6]], -6, "Aguardando aceite"], [1, "Aguardando", 0, [[1, 12], [5, 24]], -4, "Aguardando aceite"],
    [3, "A-C pendente", 0, [[2, 1]], -3, "Análise crítica"], [7, "Recusado", 0, [[4, 2]], -60, "Encerrada"],
    [8, "Aceito", 0, [[3, 2]], -25, "Ordem de serviço gerada"], [9, "Revisado", 2, [[4, 3]], -15, "Aguardando aceite"],
    [12, "Gerar contrato", 0, [[1, 6]], -9, "Gerar contrato"], [13, "Cancelado", 0, [[3, 1]], -70, "Encerrada"],
    [16, "Salvo", 0, [[4, 1]], -2, "Aguardando aceite"], [21, "A-C Aprovado", 0, [[2, 4]], -1, "Análise crítica"],
    [5, "Aceito", 0, [[3, 3]], -90, "Concluída"], [10, "Aguardando", 0, [[1, 2]], 0, "Aguardando aceite"],
  ];
  const propostas = spec.map((s, i) => {
    const c = clientes[s[0]];
    const sol = solicitantes.find((x) => x.cliente === c.razao);
    return {
      id: 940 + i, num: 940 + i, ano, ver: s[2], ident: `${12100000 + i * 137}/${ano}`, modelo: "Proposta Modelo Padrão", centro: "MinasLab",
      status: s[1], exib: "Valor total COM Outros custos", indicacao: "Sem indicação", equip: "",
      solicitanteId: sol ? sol.id : null, envio: "Cliente", cobranca: "Cliente", resultado: "Cliente",
      emailSolProp: "", emailSolCob: "", emailSolRes: "", clienteId: c.id, unidade: "Não tem unidade",
      emailCliProp: c.email, emailCliNF: c.email, emailCliRes: c.email,
      criacao: dia(s[4]), validade: dia(s[4] + 30), ciclo: "Faturado", parcelas: 1, tipoPeriodo: "Por dia Fixo", cobrarDia: "10",
      primeiroPag: dia(s[4] + 40), tipoContrato: "Contrato Padrão", condicoes: "28 dias após emissão da NF", cobrancaNa: "Assinatura do certificado",
      obs: "", obsFin: "", itens: s[3].map(([sid, qtd]) => ({ sid, qtd, params: servico(sid).params.slice() })), outros: i % 3 === 0 ? 150 : 0,
      resp: RESP[i % 3], statusProc: s[5], views: i % 4,
      revs: s[2] ? [{ ver: s[2], motivo: "Ajuste de parâmetros a pedido do cliente", em: dia(s[4] + 2), por: RESP[0] }] : [],
      docs: [], aceite: s[1] === "Aceito" ? { data: dia(s[4] + 5), nome: c.resp, obs: "" } : null,
    };
  });
  return { versao: 1, clientes, solicitantes, propostas, alertas: [] };
}
