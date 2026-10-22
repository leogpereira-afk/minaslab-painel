// LABORATÓRIO · ENTRADAS DE AMOSTRAS — regras puras (sem tela, sem rede), para
// o teste entrar por aqui. Substitui a planilha PROTOCOLO DE ENTRADAS DE
// AMOSTRAS: cada linha da planilha é um registro da coleção "lab_entradas".
//
// O que a planilha não fazia e passa a ser conta do sistema:
//   - a ETAPA da amostra (recebida → em análise → finalizada → liberada →
//     descartada) sai das datas, ninguém precisa digitar;
//   - o DESCARTE (5 dias depois da liberação) vira alerta quando vence;
//   - amostra parada há mais de PRAZO_ALERTA_DIAS sem liberação aparece em
//     destaque (a mediana medida na planilha foi 6 dias; 75% saem em até 11).
//
// Datas ficam como texto "AAAA-MM-DDTHH:MM" no horário de Brasília (é o valor
// do <input type="datetime-local">). Nunca passam por toISOString: depois das
// 21h o dia viraria amanhã.

export const COLECAO_ENTRADAS = "lab_entradas";
export const DIAS_DESCARTE = 5;
export const PRAZO_ALERTA_DIAS = 10;

export const TIPOS_ANALISE = ["ÁGUA", "ALIMENTO", "EFLUENTE", "SOLO", "AR", "CQ"];
export const ORIGENS = ["INTERNO", "PROVEDOR"];
// Listas da planilha (validação de dados das colunas). Nomes novos digitados na
// tela entram nas opções sozinhos, porque as opções também vêm dos registros.
export const RESPONSAVEIS_RECEBIMENTO = ["ANA CLÁUDIA", "CAROLINE", "JOSE ROBERTO", "LIDIANY", "LUCAS", "RUTH", "SARA", "THAYNÁ", "VERA LUCIA"];
export const RESPONSAVEIS_RETIRADA = ["ANDERSON", "BRENDA", "GIOVANNA", "JOSUE", "RUTH", "SABLA", "SARA", "VICTORIA"];

export const ETAPAS = {
  RECEBIDA: { rotulo: "Recebida", classe: "bg-blue-100 text-blue-700" },
  EM_ANALISE: { rotulo: "Em análise", classe: "bg-amber-100 text-amber-700" },
  FINALIZADA: { rotulo: "Finalizada", classe: "bg-violet-100 text-violet-700" },
  LIBERADA: { rotulo: "Liberada", classe: "bg-emerald-100 text-emerald-700" },
  DESCARTE_PENDENTE: { rotulo: "Descartar", classe: "bg-red-100 text-red-700" },
  DESCARTADA: { rotulo: "Descartada", classe: "bg-slate-100 text-slate-600" },
  CANCELADA: { rotulo: "Cancelada", classe: "bg-slate-100 text-slate-500 line-through" },
};

export const ENTRADA_VAZIA = {
  id: "", os: "", amostras: "", recebidoEm: "", recebidoPor: [], tipos: [], parametroImediato: false,
  origem: ["INTERNO"], retiradoPor: [], retiradaLabEm: "", retiradaComercialEm: "", observacao: "",
  finalizadoLab: false, finalizadoMbEm: "", finalizadoFqEm: "", liberadoCliente: false, liberadoEm: "",
  descartado: false, descartadoEm: "", cancelada: false, pendencias: [],
};

const dois = (n) => String(n).padStart(2, "0");
export function agoraLocal(d = new Date()) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
export const diaDe = (v) => String(v || "").slice(0, 10);

function somarDias(dia, n) {
  const [a, m, d] = dia.split("-").map(Number);
  const r = new Date(Date.UTC(a, m - 1, d + n));
  return r.toISOString().slice(0, 10);
}
export function diasEntreDias(a, b) {
  if (!a || !b) return null;
  const [y1, m1, d1] = diaDe(a).split("-").map(Number);
  const [y2, m2, d2] = diaDe(b).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// "2026-10-13T11:40" → "13/10/2026 11:40". Hora 00:00 é "sem hora" (a planilha
// guardava só o dia na maioria das linhas) e não aparece.
export function dataHora(v) {
  const s = String(v || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return "";
  const [a, m, d] = s.slice(0, 10).split("-");
  const h = s.slice(11, 16);
  return `${d}/${m}/${a}${h && h !== "00:00" ? ` ${h}` : ""}`;
}

export const prazoDescarte = (e) => (e?.liberadoEm ? somarDias(diaDe(e.liberadoEm), DIAS_DESCARTE) : "");

export function etapa(e, hoje) {
  if (e.cancelada) return "CANCELADA";
  if (e.descartado) return "DESCARTADA";
  if (e.liberadoCliente || e.liberadoEm) {
    const prazo = prazoDescarte(e);
    return prazo && hoje >= prazo ? "DESCARTE_PENDENTE" : "LIBERADA";
  }
  if (e.finalizadoLab) return "FINALIZADA";
  if (e.retiradaLabEm || e.retiradoPor?.length || e.finalizadoMbEm || e.finalizadoFqEm) return "EM_ANALISE";
  return "RECEBIDA";
}

export const emAberto = (et) => ["RECEBIDA", "EM_ANALISE", "FINALIZADA"].includes(et);

// Dias corridos da recepção até a liberação (ou até hoje, se ainda aberta).
export function diasAtendimento(e, hoje) {
  if (!e.recebidoEm) return null;
  const fim = e.liberadoEm || (emAberto(etapa(e, hoje)) ? hoje : "");
  const d = diasEntreDias(e.recebidoEm, fim);
  return d === null || d < 0 ? null : d;
}

export function atrasada(e, hoje) {
  const et = etapa(e, hoje);
  const d = diasAtendimento(e, hoje);
  return emAberto(et) && d !== null && d > PRAZO_ALERTA_DIAS;
}

// "150/151-2026" → 2; "276/.../286-2026" → 11. O último grupo "20xx" é o ano.
export function contarAmostras(texto) {
  const nums = String(texto || "").match(/\d+/g) || [];
  if (nums.length > 1 && /^20\d\d$/.test(nums[nums.length - 1])) nums.pop();
  return nums.length || (String(texto || "").trim() ? 1 : 0);
}

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const contem = (valor, termo) => !termo || semAcento(valor).includes(semAcento(termo).trim());
const naFaixa = (v, de, ate) => {
  if (!de && !ate) return true;
  const d = diaDe(v);
  if (!d) return false;
  return (!de || d >= de) && (!ate || d <= ate);
};
const simNao = (v, f) => !f || (f === "SIM" ? v === true : v !== true);

export const FILTROS_VAZIOS = {
  os: "", amostras: "", recebidoDe: "", recebidoAte: "", recebidoPor: "", tipo: "", imediato: "", origem: "",
  retiradoPor: "", retiradaDe: "", retiradaAte: "", comercialDe: "", comercialAte: "", finalizado: "",
  mbDe: "", mbAte: "", fqDe: "", fqAte: "", liberado: "", liberadoDe: "", liberadoAte: "", etapa: "", observacao: "",
};

export function filtrar(lista, { filtros = FILTROS_VAZIOS, busca = "", aba = "TODAS", hoje }) {
  const f = { ...FILTROS_VAZIOS, ...filtros };
  return lista.filter((e) => {
    const et = etapa(e, hoje);
    if (aba === "ABERTAS" && !emAberto(et)) return false;
    if (aba === "ATRASADAS" && !atrasada(e, hoje)) return false;
    if (aba === "IMEDIATO" && !(e.parametroImediato && emAberto(et))) return false;
    if (aba === "PENDENCIAS" && !e.pendencias?.length) return false;
    if (!["TODAS", "ABERTAS", "ATRASADAS", "IMEDIATO", "PENDENCIAS"].includes(aba) && et !== aba) return false;
    if (busca) {
      const tudo = [e.os, e.amostras, e.observacao, ...(e.recebidoPor || []), ...(e.retiradoPor || []), ...(e.tipos || [])].join(" ");
      if (!contem(tudo, busca)) return false;
    }
    return contem(e.os, f.os) && contem(e.amostras, f.amostras) && contem(e.observacao, f.observacao) &&
      naFaixa(e.recebidoEm, f.recebidoDe, f.recebidoAte) &&
      (!f.recebidoPor || (e.recebidoPor || []).includes(f.recebidoPor)) &&
      (!f.tipo || (e.tipos || []).includes(f.tipo)) &&
      simNao(e.parametroImediato, f.imediato) &&
      (!f.origem || (e.origem || []).includes(f.origem)) &&
      (!f.retiradoPor || (e.retiradoPor || []).includes(f.retiradoPor)) &&
      naFaixa(e.retiradaLabEm, f.retiradaDe, f.retiradaAte) &&
      naFaixa(e.retiradaComercialEm, f.comercialDe, f.comercialAte) &&
      simNao(e.finalizadoLab, f.finalizado) &&
      naFaixa(e.finalizadoMbEm, f.mbDe, f.mbAte) &&
      naFaixa(e.finalizadoFqEm, f.fqDe, f.fqAte) &&
      simNao(e.liberadoCliente || !!e.liberadoEm, f.liberado) &&
      naFaixa(e.liberadoEm, f.liberadoDe, f.liberadoAte) &&
      (!f.etapa || et === f.etapa);
  });
}

// Mais novas primeiro; sem data vão para o fim. Empate: número da OS.
const numOs = (os) => { const m = String(os || "").match(/(\d+)\D+(\d{4})/); return m ? Number(m[2]) * 1e6 + Number(m[1]) : 0; };
export const ordenar = (lista) => [...lista].sort((a, b) =>
  (b.recebidoEm || "").localeCompare(a.recebidoEm || "") || numOs(b.os) - numOs(a.os));

export function contagens(lista, hoje) {
  const c = { TODAS: lista.length, ABERTAS: 0, ATRASADAS: 0, IMEDIATO: 0, PENDENCIAS: 0 };
  for (const k of Object.keys(ETAPAS)) c[k] = 0;
  for (const e of lista) {
    const et = etapa(e, hoje);
    c[et] += 1;
    if (emAberto(et)) c.ABERTAS += 1;
    if (atrasada(e, hoje)) c.ATRASADAS += 1;
    if (e.parametroImediato && emAberto(et)) c.IMEDIATO += 1;
    if (e.pendencias?.length) c.PENDENCIAS += 1;
  }
  return c;
}

// Média de dias de atendimento das liberadas nos últimos 30 dias.
export function tempoMedio(lista, hoje) {
  const desde = somarDias(hoje, -30);
  const dias = lista.filter((e) => e.liberadoEm && diaDe(e.liberadoEm) >= desde)
    .map((e) => diasEntreDias(e.recebidoEm, e.liberadoEm)).filter((d) => d !== null && d >= 0);
  return dias.length ? Math.round((dias.reduce((s, d) => s + d, 0) / dias.length) * 10) / 10 : null;
}

export function opcoesDe(lista, campo, base = []) {
  const s = new Set(base);
  for (const e of lista) for (const v of e[campo] || []) if (v) s.add(v);
  return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Conferência antes de gravar: erros impedem, avisos só alertam.
export function validar(e, lista = []) {
  const erros = [], avisos = [];
  if (!String(e.os || "").trim()) erros.push("Informe o número da OS.");
  if (!e.recebidoEm) erros.push("Informe a data de recebimento.");
  if (!e.tipos?.length) erros.push("Escolha ao menos um tipo de análise.");
  const ordem = [["retiradaLabEm", "retirada do laboratório"], ["finalizadoMbEm", "finalização MB"], ["finalizadoFqEm", "finalização FQ"], ["liberadoEm", "liberação"]];
  for (const [c, nome] of ordem) {
    if (e[c] && e.recebidoEm && e[c] < e.recebidoEm) avisos.push(`A data de ${nome} está antes do recebimento.`);
  }
  const os = String(e.os || "").trim().toUpperCase();
  if (os && lista.some((x) => x.id !== e.id && String(x.os || "").trim().toUpperCase() === os && !x.cancelada)) {
    avisos.push(`Já existe outra entrada com a OS ${e.os}.`);
  }
  return { erros, avisos };
}

// O que vai para o banco: textos aparados, flags coerentes com as datas.
export function normalizarParaSalvar(e) {
  const r = { ...ENTRADA_VAZIA, ...e };
  r.os = String(r.os || "").trim();
  r.amostras = String(r.amostras || "").trim();
  r.observacao = String(r.observacao || "").trim();
  r.qtdAmostras = contarAmostras(r.amostras);
  if (r.liberadoEm) r.liberadoCliente = true;
  if (r.finalizadoMbEm || r.finalizadoFqEm || r.liberadoCliente) r.finalizadoLab = r.finalizadoLab || !!r.liberadoCliente;
  if (r.descartadoEm) r.descartado = true;
  // Pendência de importação some quando a pessoa revisa e grava.
  r.pendencias = [];
  return r;
}

export const COLUNAS_PLANILHA = [
  { chave: "c0", rotulo: "OS", tipo: "texto" }, { chave: "c1", rotulo: "Nº amostra(s)", tipo: "texto" }, { chave: "c2", rotulo: "Qtd. amostras", tipo: "numero" },
  { chave: "c3", rotulo: "Data recebimento", tipo: "texto" }, { chave: "c4", rotulo: "Responsável recebimento", tipo: "texto" }, { chave: "c5", rotulo: "Tipo de análise", tipo: "texto" },
  { chave: "c6", rotulo: "Parâmetro imediato", tipo: "texto" }, { chave: "c7", rotulo: "Interno / provedor", tipo: "texto" }, { chave: "c8", rotulo: "Responsável retirada", tipo: "texto" },
  { chave: "c9", rotulo: "Retirada laboratório", tipo: "texto" }, { chave: "c10", rotulo: "Retirada comercial", tipo: "texto" }, { chave: "c11", rotulo: "Finalizado lab.", tipo: "texto" },
  { chave: "c12", rotulo: "Finalização MB", tipo: "texto" }, { chave: "c13", rotulo: "Finalização FQ", tipo: "texto" }, { chave: "c14", rotulo: "Liberado cliente", tipo: "texto" },
  { chave: "c15", rotulo: "Data liberação", tipo: "texto" }, { chave: "c16", rotulo: "Prazo descarte", tipo: "texto" }, { chave: "c17", rotulo: "Etapa", tipo: "texto" },
  { chave: "c18", rotulo: "Dias atendimento", tipo: "numero" }, { chave: "c19", rotulo: "Observação", tipo: "texto" },
];

export function linhaPlanilha(e, hoje) {
  const sn = (v) => (v === true ? "SIM" : v === false ? "NÃO" : "");
  const v = [
    e.os, e.amostras, e.qtdAmostras ?? contarAmostras(e.amostras), dataHora(e.recebidoEm), (e.recebidoPor || []).join(", "),
    (e.tipos || []).join(", "), sn(e.parametroImediato), (e.origem || []).join(", "), (e.retiradoPor || []).join(", "),
    dataHora(e.retiradaLabEm), dataHora(e.retiradaComercialEm), sn(e.finalizadoLab), dataHora(e.finalizadoMbEm),
    dataHora(e.finalizadoFqEm), sn(e.liberadoCliente || !!e.liberadoEm), dataHora(e.liberadoEm), dataHora(prazoDescarte(e)),
    ETAPAS[etapa(e, hoje)].rotulo, diasAtendimento(e, hoje), e.observacao,
  ];
  return Object.fromEntries(v.map((x, i) => [`c${i}`, x === "" || x === undefined ? null : x]));
}
