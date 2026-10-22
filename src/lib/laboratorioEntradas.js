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
  etapaManual: "", finalizadoLab: false, finalizadoMb: "", finalizadoMbEm: "", finalizadoFq: "", finalizadoFqEm: "", liberadoCliente: false, liberadoEm: "",
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

// Etapa calculada a partir das datas (o fluxo normal).
export function etapaAutomatica(e, hoje) {
  if (e.cancelada) return "CANCELADA";
  if (e.descartado) return "DESCARTADA";
  if (e.liberadoCliente || e.liberadoEm) {
    const prazo = prazoDescarte(e);
    return prazo && hoje >= prazo ? "DESCARTE_PENDENTE" : "LIBERADA";
  }
  if (e.finalizadoLab) return "FINALIZADA";
  if (e.retiradaLabEm || e.retiradoPor?.length || e.finalizadoMbEm || e.finalizadoFqEm ||
    ["SIM", "NAO"].includes(e.finalizadoMb) || ["SIM", "NAO"].includes(e.finalizadoFq)) return "EM_ANALISE";
  return "RECEBIDA";
}
// Etapa ajustada à mão (só quem está nos dois setores ou a direção) vale por
// cima da calculada; "" volta para a automática.
export function etapa(e, hoje) {
  return e?.etapaManual && ETAPAS[e.etapaManual] ? e.etapaManual : etapaAutomatica(e, hoje);
}

/* Finalização por área: Microbiologia (MB) e Físico-Química (FQ).
   Cada uma é Sim, Não ou Não se aplica. "Finalizado pelo laboratório" sai
   delas: fecha quando todas as que se aplicam estão em Sim. Enquanto alguma
   não foi informada, vale o que já estava (registros antigos da planilha só
   tinham o "Finalizado" geral). */
export const FINALIZACAO = [["SIM", "Sim"], ["NAO", "Não"], ["NA", "Não se aplica"]];
export const AREAS_FINAL = {
  mb: { campo: "finalizadoMb", data: "finalizadoMbEm", rotulo: "Microbiologia (MB)", curto: "MB" },
  fq: { campo: "finalizadoFq", data: "finalizadoFqEm", rotulo: "Físico-Química (FQ)", curto: "FQ" },
};
// Situação da área; data lançada sem a situação conta como Sim.
export function situacaoArea(e, area) {
  const a = AREAS_FINAL[area];
  const v = e?.[a.campo];
  return FINALIZACAO.some(([k]) => k === v) ? v : e?.[a.data] ? "SIM" : "";
}
export function finalizacaoGeral(e) {
  const v = [situacaoArea(e, "mb"), situacaoArea(e, "fq")].filter((x) => x !== "NA");
  if (!v.length || v.some((x) => !x)) return v.includes("NAO") ? false : !!e?.finalizadoLab;
  return v.every((x) => x === "SIM");
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
  retiradoPor: "", retiradaDe: "", retiradaAte: "", comercialDe: "", comercialAte: "", finalizado: "", mb: "", fq: "",
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
      (!f.mb || (situacaoArea(e, "mb") || "VAZIO") === f.mb) &&
      (!f.fq || (situacaoArea(e, "fq") || "VAZIO") === f.fq) &&
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
  for (const k of ["mb", "fq"]) {
    const a = AREAS_FINAL[k];
    if (["NAO", "NA"].includes(e[a.campo]) && e[a.data]) avisos.push(`${a.rotulo}: tem data de finalização mas está como "${e[a.campo] === "NA" ? "Não se aplica" : "Não"}".`);
  }
  if (e.os && !OS_PADRAO.test(String(e.os).trim())) avisos.push("A OS não está no padrão OS000000/ano (ex.: OS001430/2026).");
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
  // Nada de "acertar" campos do outro setor aqui: gravar uma correção do
  // Administrativo não pode mexer em campo do Laboratório (o servidor recusaria).
  // Pendência de importação some quando a pessoa revisa e grava.
  r.pendencias = [];
  return r;
}

const ROTULOS_PLANILHA = [
  ["OS", "texto"], ["Nº amostra(s)", "texto"], ["Qtd. amostras", "numero"], ["Data recebimento", "texto"], ["Responsável recebimento", "texto"],
  ["Tipo de análise", "texto"], ["Parâmetro imediato", "texto"], ["Interno / provedor", "texto"], ["Responsável retirada", "texto"],
  ["Retirada laboratório", "texto"], ["Retirada comercial", "texto"], ["Finalizado lab.", "texto"], ["Finalizado MB", "texto"], ["Finalização MB", "texto"],
  ["Finalizado FQ", "texto"], ["Finalização FQ", "texto"], ["Liberado cliente", "texto"], ["Data liberação", "texto"], ["Prazo descarte", "texto"],
  ["Etapa", "texto"], ["Dias atendimento", "numero"], ["Observação", "texto"],
];
export const COLUNAS_PLANILHA = ROTULOS_PLANILHA.map(([rotulo, tipo], i) => ({ chave: `c${i}`, rotulo, tipo }));

export const rotuloFinal = (v) => (FINALIZACAO.find(([k]) => k === v)?.[1] ?? "");
export function linhaPlanilha(e, hoje) {
  const sn = (v) => (v === true ? "SIM" : v === false ? "NÃO" : "");
  const v = [
    e.os, e.amostras, e.qtdAmostras ?? contarAmostras(e.amostras), dataHora(e.recebidoEm), (e.recebidoPor || []).join(", "),
    (e.tipos || []).join(", "), sn(e.parametroImediato), (e.origem || []).join(", "), (e.retiradoPor || []).join(", "),
    dataHora(e.retiradaLabEm), dataHora(e.retiradaComercialEm), sn(e.finalizadoLab), rotuloFinal(situacaoArea(e, "mb")), dataHora(e.finalizadoMbEm),
    rotuloFinal(situacaoArea(e, "fq")), dataHora(e.finalizadoFqEm), sn(e.liberadoCliente || !!e.liberadoEm), dataHora(e.liberadoEm), dataHora(prazoDescarte(e)),
    ETAPAS[etapa(e, hoje)].rotulo, diasAtendimento(e, hoje), e.observacao,
  ];
  return Object.fromEntries(v.map((x, i) => [`c${i}`, x === "" || x === undefined ? null : x]));
}

/* ------------------------------------------------------------ setores
   Quem lança o quê. O servidor (ml-laboratorio) confere a mesma lista — esta
   cópia só decide o que a tela deixa editar. Observação: os dois setores. */
export const SETORES = {
  administrativo: { rotulo: "Administrativo", classe: "bg-sky-50 text-sky-800", borda: "border-sky-300" },
  laboratorio: { rotulo: "Laboratório", classe: "bg-teal-50 text-teal-800", borda: "border-teal-300" },
};
export const CAMPOS_SETOR = {
  administrativo: ["os", "amostras", "recebidoEm", "recebidoPor", "tipos", "parametroImediato", "origem", "retiradoPor", "cancelada"],
  laboratorio: ["retiradaLabEm", "retiradaComercialEm", "finalizadoLab", "finalizadoMb", "finalizadoMbEm", "finalizadoFq", "finalizadoFqEm", "liberadoCliente", "liberadoEm", "descartado", "descartadoEm"],
  ambos: ["observacao"],
  // Exige os DOIS setores (Administrativo e Laboratório) — ou a direção.
  todos: ["etapaManual"],
};
// Amostra de PROVEDOR: quem faz a retirada é o Administrativo — as datas de
// retirada passam a poder ser lançadas por ele (o Laboratório continua podendo).
export const CAMPOS_RETIRADA = ["retiradaLabEm", "retiradaComercialEm"];
export const ehProvedor = (e) => (e?.origem || []).some((o) => String(o).toUpperCase() === "PROVEDOR");
export const setorDoCampo = (campo, registro) =>
  CAMPOS_SETOR.todos.includes(campo) ? "todos"
    : CAMPOS_RETIRADA.includes(campo) && ehProvedor(registro) ? "ambos"
    : CAMPOS_SETOR.administrativo.includes(campo) ? "administrativo" : CAMPOS_SETOR.laboratorio.includes(campo) ? "laboratorio" : CAMPOS_SETOR.ambos.includes(campo) ? "ambos" : null;

// Valor para comparar: null e false são o mesmo "não", texto aparado, lista como texto.
const comparavel = (v) => {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (v === null || v === undefined || v === false || v === "") return "";
  return String(v).trim();
};
export function camposAlterados(antes, depois) {
  const todos = [...CAMPOS_SETOR.administrativo, ...CAMPOS_SETOR.laboratorio, ...CAMPOS_SETOR.ambos, ...CAMPOS_SETOR.todos];
  return todos.filter((c) => comparavel(antes?.[c]) !== comparavel(depois?.[c]));
}
// Campos que este usuário mudou mas não pode (lista vazia = pode gravar).
export function camposBloqueados(antes, depois, setores = []) {
  return camposAlterados(antes, depois).filter((c) => {
    const s = setorDoCampo(c, depois);
    if (s === "todos") return !podeAjustarEtapa(setores);
    return s === "ambos" ? !setores.length : !setores.includes(s);
  });
}
export const podeAjustarEtapa = (setores = []) => setores.includes("administrativo") && setores.includes("laboratorio");

/* ------------------------------------------------------------ cores
   Cada pessoa e cada tipo de análise com uma cor fixa (a mesma em toda a tela
   e para todo mundo). Nomes conhecidos têm cor reservada para não repetir;
   nome novo cai numa cor pela soma das letras. */
export const PALETA = [
  "bg-rose-100 text-rose-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800", "bg-orange-100 text-orange-800", "bg-cyan-100 text-cyan-800", "bg-lime-100 text-lime-800",
  "bg-fuchsia-100 text-fuchsia-800", "bg-indigo-100 text-indigo-800", "bg-teal-100 text-teal-800", "bg-pink-100 text-pink-800",
  "bg-yellow-100 text-yellow-800", "bg-blue-100 text-blue-800", "bg-red-100 text-red-800", "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800", "bg-stone-200 text-stone-800", "bg-emerald-200 text-emerald-900", "bg-sky-200 text-sky-900",
  "bg-rose-200 text-rose-900", "bg-amber-200 text-amber-900", "bg-violet-200 text-violet-900", "bg-cyan-200 text-cyan-900",
];
/* ------------------------------------------------------------ pessoas
   "Recebido por" e "Retirado por" são usuários do sistema (ml_contas). Nome
   que não tem conta = colaborador já desligado: continua aparecendo nos
   registros antigos, mas não é oferecido para lançamento novo. */
const CONECTORES = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
const palavras = (n) => semAcento(n).toUpperCase().split(/\s+/).filter(Boolean);

// Nome da planilha ("JOSE ROBERTO", "THAYNÁ") → conta cujo nome começa por essas palavras. Só casa se for uma conta só.
export function casarPessoa(nomePlanilha, contas = []) {
  const alvo = palavras(nomePlanilha).filter((w) => !CONECTORES.has(w));
  if (!alvo.length) return null;
  const achadas = contas.filter((c) => {
    const ws = palavras(c.nome).filter((w) => !CONECTORES.has(w));
    return alvo.every((w, k) => ws[k] === w);
  });
  return achadas.length === 1 ? achadas[0] : null;
}

// Todas as pessoas que aparecem na tela: contas (ativas e inativas) + nomes antigos sem conta.
export function montarPessoas(contas = [], entradas = []) {
  const porNome = new Map();
  for (const c of contas) porNome.set(c.nome, { nome: c.nome, usuario: c.usuario, ativo: c.ativo !== false, conta: true });
  for (const e of entradas) for (const n of [...(e.recebidoPor || []), ...(e.retiradoPor || [])]) {
    if (n && !porNome.has(n)) porNome.set(n, { nome: n, usuario: "", ativo: false, conta: false });
  }
  const lista = [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  // Nome curto: o menor começo do nome (em palavras) que não repete entre as pessoas.
  const todas = lista.map((p) => palavras(p.nome).filter((w) => !CONECTORES.has(w)));
  for (const [i, p] of lista.entries()) {
    const ws = todas[i];
    let k = 1;
    while (k < ws.length && todas.some((o, j) => j !== i && o.slice(0, k).join(" ") === ws.slice(0, k).join(" "))) k += 1;
    const original = String(p.nome).split(/\s+/).filter((w) => !CONECTORES.has(semAcento(w).toUpperCase()));
    p.curto = original.slice(0, k).join(" ") || p.nome;
    p.cor = PALETA[i % PALETA.length];
  }
  const mapa = new Map(lista.map((p) => [p.nome, p]));
  return {
    lista,
    ativas: lista.filter((p) => p.conta && p.ativo),
    curto: (n) => mapa.get(n)?.curto || n,
    cor: (n) => mapa.get(n)?.cor || PALETA[0],
    desligado: (n) => !!n && !mapa.get(n)?.ativo,
  };
}

// Cor por nome sem lista (usada onde a lista de pessoas não está à mão).
export function corPessoa(nome) {
  let h = 0;
  for (const ch of String(nome || "").toUpperCase()) h = (h * 31 + ch.codePointAt(0)) % 9973;
  return PALETA[h % PALETA.length];
}
const CORES_ORIGEM = { INTERNO: "bg-teal-100 text-teal-800", PROVEDOR: "bg-orange-100 text-orange-800" };
export const corOrigem = (o) => CORES_ORIGEM[String(o || "").toUpperCase()] || "bg-slate-100 text-slate-700";
const CORES_TIPO = {
  "ÁGUA": "bg-sky-100 text-sky-800", ALIMENTO: "bg-amber-100 text-amber-800", EFLUENTE: "bg-stone-200 text-stone-800",
  SOLO: "bg-orange-100 text-orange-800", AR: "bg-slate-100 text-slate-700", CQ: "bg-violet-100 text-violet-800",
};
export const corTipo = (t) => CORES_TIPO[String(t || "").toUpperCase()] || "bg-slate-100 text-slate-700";

/* ------------------------------------------------------------ OS
   Padrão da casa: OS + número com 6 dígitos + /ano  →  OS001430/2026.
   Aceita "1430", "1430/2026", "1430-2026", "OS1430/2026", "os 001430/2026".
   Sem ano (ou ano impossível) usa o ano de referência (o do recebimento).
   Mais de uma OS na mesma célula vira "OS001091/2026 / OS001143/2026". */
const ANO_OS_MIN = 2020;
export function formatarOS(texto, anoRef = new Date().getFullYear()) {
  const t = String(texto ?? "").trim();
  if (!t) return { os: "", aviso: "" };
  const partes = [...t.matchAll(/(\d+)(?:\s*[/\\-]\s*(\d{2,5}))?/g)];
  if (!partes.length) return { os: t, aviso: `OS “${t}” sem número` };
  let aviso = "";
  const oss = partes.map(([, num, ano]) => {
    let a = ano ? Number(ano.length === 2 ? `20${ano}` : ano) : null;
    if (a !== null && (a < ANO_OS_MIN || a > new Date().getFullYear() + 1)) { aviso = `OS “${t}”: ano ${ano} trocado por ${anoRef}`; a = null; }
    return `OS${String(Number(num)).padStart(6, "0")}/${a ?? anoRef}`;
  });
  return { os: [...new Set(oss)].join(" / "), aviso };
}
export const OS_PADRAO = /^OS\d{6}\/\d{4}( \/ OS\d{6}\/\d{4})*$/;
