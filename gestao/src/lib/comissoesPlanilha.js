// Importação da planilha antiga de comissões ("Base de Cálculo
// comissionamento Comercial"): uma linha por proposta, 1% do valor da
// proposta, com "Pago"/"Não pago" e o mês da folha em que foi pago.
//
// Vira, no sistema:
//  - PAGAMENTOS (histórico): as linhas "Pago", um registro por colaborador e
//    mês da folha (sem mês na planilha: um por mês da proposta, marcado).
//  - SALDO da planilha: as linhas "Não pago", que aparecem em "A pagar" e são
//    pagas pelo mesmo botão de sempre.
//  - quem não está cadastrado na comissão entra "fora do cálculo" (só o
//    histórico e o saldo; não gera comissão nova).
// Os ids são fixos (proposta + linha), então importar de novo o mesmo arquivo
// regrava os mesmos registros em vez de duplicar.

import { centavos } from "./comissoes.js";

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
export const normNome = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const pad = (n) => String(n).padStart(2, "0");
const slug = (s) => normNome(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Data do Excel (número de série ou texto) → "AAAA-MM-DD". */
export function dataPlanilha(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return "";
}

/** "00000002/2026.0" → "00000002/2026" (o ".0" é a revisão da proposta). */
export const numeroProposta = (v) => {
  const m = String(v ?? "").trim().match(/^(\d+)\/(\d{4})/);
  return m ? `${m[1].padStart(8, "0")}/${m[2]}` : String(v ?? "").trim();
};

const num = (v) => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").replace(/[R$\s]/g, "");
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return isFinite(n) ? n : 0;
};

/** Acha a aba e as colunas pelos títulos e devolve as linhas limpas. */
export function lerLinhasPlanilha(abas) {
  for (const [aba, linhas] of Object.entries(abas || {})) {
    const iCab = (linhas || []).findIndex((l) => (l || []).some((c) => normNome(c) === "COLABORADOR"));
    if (iCab < 0) continue;
    const cab = linhas[iCab].map(normNome);
    const col = (...nomes) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
    const C = {
      colab: col("COLABORADOR"), data: col("DATA CRIACAO", "DATA"), contrato: col("CONTRATO", "PROPOSTA"), cliente: col("CLIENTE"),
      total: col("TOTAL"), comissao: col("R$ COMISSAO", "COMISSAO"), folha: col("MES FOLHA"), pagamento: col("PAGAMENTO"),
    };
    if (C.contrato < 0 || C.comissao < 0 || C.pagamento < 0) continue;
    const out = [];
    for (let i = iCab + 1; i < linhas.length; i++) {
      const l = linhas[i] || [];
      const colaborador = String(l[C.colab] ?? "").replace(/\s+/g, " ").trim();
      const proposta = numeroProposta(l[C.contrato]);
      if (!colaborador || !proposta) continue;
      const folhaTxt = normNome(l[C.folha]);
      const folhaMes = MESES.indexOf(folhaTxt) + 1;
      out.push({
        linha: i + 1, colaborador, proposta, data: dataPlanilha(l[C.data]), cliente: String(l[C.cliente] ?? "").trim(),
        base: centavos(num(l[C.total])), valor: centavos(num(l[C.comissao])),
        pago: normNome(l[C.pagamento]) === "PAGO", folhaMes: folhaMes > 0 ? folhaMes : 0,
      });
    }
    return { aba, linhas: out };
  }
  throw new Error("Não achei a aba com as colunas COLABORADOR, CONTRATO, R$ COMISSÃO e PAGAMENTO.");
}

/** Usuário do CRM com o mesmo nome (sem acento, espaço e caixa). */
function acharCRM(nome, pessoasCRM) {
  const n = normNome(nome);
  const exato = pessoasCRM.find((p) => normNome(p.nome) === n);
  if (exato) return exato;
  const [pri, ...resto] = n.split(" ");
  const ult = resto.at(-1);
  return pessoasCRM.find((p) => { const q = normNome(p.nome).split(" "); return q[0] === pri && (!ult || q.at(-1) === ult); }) || null;
}

/**
 * Monta o que será gravado. Devolve { colaboradores (novos), pagamentos,
 * saldos, resumo (por pessoa), alertas }.
 */
export function planoImportacao(linhas, { colabs = [], pessoasCRM = [], arquivo = "planilha" } = {}) {
  const porPessoa = new Map();
  const colaboradores = [];
  for (const l of linhas) {
    const chave = normNome(l.colaborador);
    if (porPessoa.has(chave)) continue;
    const crm = acharCRM(l.colaborador, pessoasCRM);
    let c = colabs.find((x) => crm && x.crmId === crm.id) || colabs.find((x) => normNome(x.nome) === chave);
    if (!c) {
      const datas = linhas.filter((x) => normNome(x.colaborador) === chave).map((x) => x.data).filter(Boolean).sort();
      const desde = datas[0] || "2026-01-01";
      c = { id: `com_plan_${slug(l.colaborador)}`, tipo: "colaborador", nome: chave, crmId: crm?.id || "", desde, taxas: [{ desde, pct: 1 }], ativo: false, origem: "planilha" };
      colaboradores.push(c);
    }
    porPessoa.set(chave, c);
  }

  const pagos = new Map();
  const saldos = new Map();
  for (const l of linhas) {
    const c = porPessoa.get(normNome(l.colaborador));
    const item = {
      id: `plan-${l.proposta.replace("/", "-")}-l${l.linha}`, os: "", proposta: l.proposta, cliente: l.cliente, emissao: l.data,
      competencia: l.data.slice(0, 7), base: l.base, pct: l.base ? centavos((l.valor / l.base) * 100) : 1, valor: l.valor, planilha: true,
    };
    if (l.pago) {
      const ano = l.data.slice(0, 4) || "2026";
      const ref = l.folhaMes ? `${ano}-${pad(l.folhaMes)}` : `sem-${l.data.slice(0, 7)}`;
      const id = `plan-pg-${c.id}-${ref}`;
      if (!pagos.has(id)) {
        pagos.set(id, {
          id, tipo: "pagamento", colaboradorId: c.id, nome: c.nome, planilha: true,
          pagoEm: l.folhaMes ? `${ano}-${pad(l.folhaMes)}-01` : `${l.data.slice(0, 7)}-01`,
          obs: l.folhaMes ? `Importado da ${arquivo} (folha de ${MESES[l.folhaMes - 1].toLowerCase().replace("marco", "março")})` : `Importado da ${arquivo}: pago, mas sem o mês da folha na planilha`,
          itens: [],
        });
      }
      pagos.get(id).itens.push({ osId: item.id, os: "", proposta: item.proposta, cliente: item.cliente, emissao: item.emissao, competencia: item.competencia, base: item.base, pct: item.pct, valor: item.valor, planilha: true });
    } else {
      const id = `plan-saldo-${c.id}`;
      if (!saldos.has(id)) saldos.set(id, { id, tipo: "saldo", colaboradorId: c.id, nome: c.nome, origem: arquivo, itens: [] });
      saldos.get(id).itens.push(item);
    }
  }
  const pagamentos = [...pagos.values()].map((p) => ({
    ...p, total: centavos(p.itens.reduce((s, i) => s + i.valor, 0)),
    competencias: [...new Set(p.itens.map((i) => i.competencia).filter(Boolean))].sort(),
  }));

  // Conferência: a mesma proposta paga duas vezes à mesma pessoa, ou paga a duas pessoas.
  const alertas = [];
  const porProp = new Map();
  for (const l of linhas) { if (!porProp.has(l.proposta)) porProp.set(l.proposta, []); porProp.get(l.proposta).push(l); }
  for (const [prop, ls] of porProp) {
    const pagas = ls.filter((l) => l.pago);
    const pessoas = [...new Set(pagas.map((l) => normNome(l.colaborador)))];
    if (pessoas.length > 1) alertas.push({ tipo: "duasPessoas", proposta: prop, texto: `Paga a ${pessoas.length} pessoas (${pagas.map((l) => `${l.colaborador} ${l.valor.toFixed(2).replace(".", ",")}`).join(" e ")})`, valor: 0 });
    else if (pagas.length > 1) {
      const iguais = pagas.filter((l) => l.base === pagas[0].base && l.data === pagas[0].data).length > 1;
      alertas.push({ tipo: iguais ? "repetida" : "maisDeUma", proposta: prop, texto: `${pagas[0].colaborador}: ${pagas.length} linhas pagas${iguais ? " iguais (mesmo valor e data)" : ""}`, valor: iguais ? centavos(pagas.slice(1).reduce((s, l) => s + l.valor, 0)) : 0 });
    }
  }

  const resumo = [...porPessoa.entries()].map(([chave, c]) => {
    const ls = linhas.filter((l) => normNome(l.colaborador) === chave);
    return {
      nome: c.nome, novo: colaboradores.includes(c), semCRM: !c.crmId,
      pagas: ls.filter((l) => l.pago).length, pago: centavos(ls.filter((l) => l.pago).reduce((s, l) => s + l.valor, 0)),
      abertas: ls.filter((l) => !l.pago).length, aPagar: centavos(ls.filter((l) => !l.pago).reduce((s, l) => s + l.valor, 0)),
    };
  }).sort((a, b) => b.pago + b.aPagar - (a.pago + a.aPagar));

  return { colaboradores, pagamentos, saldos: [...saldos.values()], resumo, alertas };
}
