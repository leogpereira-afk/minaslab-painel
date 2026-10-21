// Importa o histórico da planilha "Avaliação Técnica e Comportamental"
// (abas "Avaliação Liderança" e "Avaliação Equipe") para o Destaque do Mês.
// Regras puras (sem banco): o que a tela grava sai daqui, com testes.
//  - Liderança: uma avaliação por pessoa, mês e avaliador (10 critérios 0 a 5).
//    Linha toda zerada = ainda não preenchida: não entra.
//  - Equipe: os votos individuais viram só SOMAS por pessoa e mês (sem data,
//    hora nem ordem), como na votação do sistema. Voto da própria pessoa
//    (“Você é o colaborador…? Sim”) não entra.

import { CRITERIOS_LIDERANCA, MOTIVOS_ELIMINATORIOS } from "./destaque.js";

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
export const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const slug = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titulo = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (x) => x.toLowerCase());
const numeroMes = (s) => { const i = MESES.indexOf(norm(s).replace("Ç", "C")); return i < 0 ? null : i + 1; };

/** Ano a partir de data do Excel (número de série) ou texto ISO. */
function anoDe(v) {
  if (typeof v === "number" && v > 20000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).getUTCFullYear();
  const m = String(v ?? "").match(/(20\d\d)/);
  return m ? Number(m[1]) : null;
}

/** Liga o nome da planilha a uma pessoa do RH (primeiro e último nome); sem par, cria um id da planilha. */
export function casarPessoa(nome, elenco) {
  const t = norm(nome).split(" ").filter(Boolean);
  if (!t.length) return null;
  const mesmoPrimeiro = elenco.filter((p) => norm(p.nome).split(" ")[0] === t[0]);
  // Primeiro nome único no RH basta; se houver mais de um, precisa bater mais um nome (≥ 4 letras).
  const achados = mesmoPrimeiro.length === 1 ? mesmoPrimeiro
    : mesmoPrimeiro.filter((p) => { const u = norm(p.nome).split(" "); return t.slice(1).some((x) => x.length >= 4 && u.includes(x)); });
  if (achados.length === 1) return { id: achados[0].id, nome: achados[0].nome, doRH: true };
  return { id: `plan_${slug(nome)}`, nome: String(nome).replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR"), doRH: false };
}

function colunas(cab, regras) {
  const n = cab.map((c) => norm(c));
  const out = {};
  for (const [k, teste] of Object.entries(regras)) out[k] = n.findIndex(teste);
  return out;
}

function motivoEliminatorio(criterio, motivo) {
  const c = norm(criterio);
  if (!c || c.startsWith("NAO, ESTA APTO") || c === "NAO") return "";
  if (c.includes("ATESTADO") || c.includes("DOCUMENT")) return "Não entregou documento no prazo";
  if (c.includes("OUTRO") && /FERIAS|AFAST/.test(norm(motivo))) return "Férias ou afastamento no mês";
  const igual = MOTIVOS_ELIMINATORIOS.find((m) => norm(m) === c || c.startsWith(norm(m).slice(0, 18)));
  return igual || "Outro motivo";
}

const comentarioUtil = (t) => {
  const s = String(t ?? "").trim();
  if (s.length < 15) return "";
  if (/^(referente ao |avalia[cç][aã]o |m[eê]s de )?(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(\s*(\/|de)\s*\d{4})?\.?$/i.test(s)) return "";
  return s.slice(0, 500);
};

export function importarPlanilha(abas, elenco, anoPadrao = new Date().getFullYear(), sessao = null) {
  // O avaliador da planilha com o mesmo primeiro nome de quem está importando vira o próprio login
  // (assim a avaliação aparece como "sua" e não duplica se a pessoa abrir a ficha).
  const primeiro = (x) => norm(x).split(" ")[0] || "";
  const avaliadorDe = (nome) => (sessao?.usuario && primeiro(nome) && primeiro(nome) === primeiro(sessao.nome))
    ? { avaliador: sessao.usuario, avaliadorNome: sessao.nome } : null;
  const avisos = [];
  const pessoas = new Map();
  const pessoa = (nome) => { const p = casarPessoa(nome, elenco); if (p) pessoas.set(p.id, p); return p; };

  // ---------------- liderança
  const lideranca = [];
  const abaL = Object.entries(abas).find(([n]) => norm(n).includes("LIDERANCA"))?.[1] || [];
  if (abaL.length) {
    const cab = abaL[0] || [];
    const c = colunas(cab, { mes: (x) => x === "MES", data: (x) => x.startsWith("DATA"), nome: (x) => x.includes("NOME"), aval: (x) => x.startsWith("AVALIADOR"), elim: (x) => x.includes("ELIMINAT"), motivo: (x) => x === "MOTIVO", p1: (x) => /^P1\b/.test(x) });
    for (const [i, r] of abaL.slice(1).entries()) {
      if (!r?.[c.nome]) continue;
      const mm = numeroMes(r[c.mes]);
      if (!mm) { avisos.push(`Liderança, linha ${i + 2}: mês “${r[c.mes] ?? ""}” não reconhecido.`); continue; }
      const ano = anoDe(r[c.data]) || anoPadrao;
      const mes = `${ano}-${String(mm).padStart(2, "0")}`;
      const notasArr = CRITERIOS_LIDERANCA.map((_, k) => { const v = r[c.p1 + k]; return v === null || v === undefined || v === "" ? null : Math.max(0, Math.min(5, Number(v))); });
      const elim = motivoEliminatorio(r[c.elim], r[c.motivo]);
      const p = pessoa(r[c.nome]);
      const avaliadorNome = titulo(r[c.aval] || "Planilha");
      if (!elim && notasArr.every((v) => !v)) { avisos.push(`Liderança ${mes}: ${p.nome} (${avaliadorNome}) está toda em branco ou zerada — não importada.`); continue; }
      const zeros = notasArr.filter((v) => v === 0).length;
      if (!elim && zeros && zeros < 10) avisos.push(`Liderança ${mes}: ${p.nome} (${avaliadorNome}) tem ${zeros} critério(s) com nota 0 — confira se foi nota mesmo ou se ficou em branco.`);
      const notas = Object.fromEntries(CRITERIOS_LIDERANCA.map((cr, k) => [cr.id, notasArr[k]]).filter(([, v]) => v !== null));
      const meu = avaliadorDe(r[c.aval]);
      const avaliador = meu ? meu.avaliador : `plan:${slug(avaliadorNome)}`;
      lideranca.push({
        id: `${mes}_${p.id}_${avaliador}`, mes, pessoaId: p.id, nome: p.nome, avaliador, avaliadorNome: meu ? meu.avaliadorNome : avaliadorNome,
        notas: elim && notasArr.every((v) => !v) ? {} : notas, eliminatorio: elim,
        obs: [r[c.motivo] && !/f[eé]rias/i.test(String(r[c.motivo])) ? String(r[c.motivo]) : "", "Importada da planilha"].filter(Boolean).join(" · "),
        importado: true,
      });
    }
  }

  // ---------------- equipe (somas por pessoa e mês)
  const porMes = {};
  const abaE = Object.entries(abas).find(([n]) => norm(n).includes("EQUIPE"))?.[1] || [];
  if (abaE.length) {
    const cab = abaE[0] || [];
    const c = colunas(cab, { nome: (x) => x === "COLABORADOR", mes: (x) => x === "MES", data: (x) => x.startsWith("CARIMBO"), eu: (x) => x.startsWith("VOCE E O COLABORADOR"), n1: (x) => x.startsWith("AVALIACAO DA EQUIPE"), com: (x) => x.includes("COMENTARIO") });
    for (const [i, r] of abaE.slice(1).entries()) {
      if (!r?.[c.nome]) continue;
      if (norm(r[c.eu]) === "SIM") continue; // a própria pessoa
      const notas = [0, 1, 2, 3, 4].map((k) => r[c.n1 + k]);
      if (notas.some((v) => v === null || v === "" || !isFinite(Number(v)))) continue;
      const ns = notas.map((v) => Math.max(0, Math.min(10, Math.round(Number(v)))));
      const com = String(r[c.com] ?? "");
      const p = pessoa(r[c.nome]);
      const mm = numeroMes(r[c.mes]);
      if (!mm) { avisos.push(`Equipe, linha ${i + 2}: mês não reconhecido.`); continue; }
      if (ns.every((v) => v <= 1) && /n[aã]o (estava|esteve|conviv)|ausente|n[aã]o trabalh/i.test(com)) {
        avisos.push(`Equipe ${MESES[mm - 1].toLowerCase()}: um voto em ${p.nome} com notas ${ns.join(", ")} e o comentário “${com.slice(0, 60)}” foi deixado de fora (quem votou não conviveu com a pessoa).`);
        continue;
      }
      const ano = anoDe(r[c.data]) || anoPadrao;
      const mes = `${ano}-${String(mm).padStart(2, "0")}`;
      const m = (porMes[mes] ??= { pessoas: new Map(), equipe: {}, comentarios: {} });
      m.pessoas.set(p.id, { id: p.id, nome: p.nome });
      const s = m.equipe[p.id] || { n: 0, soma: [0, 0, 0, 0, 0] };
      m.equipe[p.id] = { n: s.n + 1, soma: s.soma.map((x, k) => x + ns[k]) };
      const cu = comentarioUtil(com);
      if (cu) (m.comentarios[p.id] ??= []).push(cu);
    }
  }
  const pesquisas = Object.entries(porMes).sort().map(([mes, m]) => {
    const [a, mm] = mes.split("-");
    const nomeMes = MESES[Number(mm) - 1].toLowerCase().replace("marco", "março");
    // Comentários embaralhados: a ordem da planilha não fica guardada.
    const comentarios = Object.fromEntries(Object.entries(m.comentarios).map(([k, l]) => [k, [...l].sort(() => Math.random() - 0.5)]));
    return {
      id: `pimp${a}${mm}`, titulo: `Destaque do Mês · ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${a} (planilha)`, mes,
      modo: "importada", status: "encerrada", minimo: 3,
      avaliados: [...m.pessoas.values()], lideres: [], codigos: [],
      somas: { equipe: m.equipe, gestao: {}, comentarios, sugestoes: [] }, usados: {}, validos: [],
      totalVotos: Math.max(0, ...Object.values(m.equipe).map((x) => x.n)),
      criadaEm: `${mes}-28T12:00:00.000Z`, encerradaEm: `${mes}-28T12:00:00.000Z`, importada: true,
    };
  });

  return { lideranca, pesquisas, pessoas: [...pessoas.values()], avisos };
}
