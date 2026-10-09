// Fechamento do mês da M Lab: cruza banco × títulos e diz, item a item, o que está em ordem e o que falta.
// Tudo calculado no navegador a partir do que a conciliação já carrega; nada aqui altera dado.
import { repassesPorMes, restanteMovimento, sugerirLotes } from "./conciliacaoSugestao.js";

const arred = (n) => Math.round(Number(n || 0) * 100) / 100;
const dia = (v) => String(v || "").slice(0, 10);
const noMes = (data, mes) => dia(data).slice(0, 7) === mes;
const cancelado = (t) => ["CANCELADO", "CANCELADA"].includes(String(t?.status || "").toUpperCase()) || t?.apagado;
const absVal = (m) => Math.abs(Number(m?.valor || 0));

export function fimDoMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

function item(id, titulo, severidade, lista, valor, extra = {}) {
  return { id, titulo, severidade: lista.length ? severidade : "ok", quantidade: lista.length, valor: arred(valor), lista, ...extra };
}

export function montarFechamento({ movimentos = [], receber = [], pagar = [], mes, hoje }) {
  const fim = fimDoMes(mes);
  const mesFechado = fim < dia(hoje);
  const sev = (fechado) => (fechado ? "erro" : "atencao");

  const movsMes = movimentos.filter((m) => noMes(m.data_movimento, mes));
  const pendente = (m) => !m.conciliado && absVal(m) > 0.005;
  const pendMes = movsMes.filter(pendente);
  const pendAntes = movimentos.filter((m) => pendente(m) && dia(m.data_movimento) < `${mes}-01`);

  const linhaMov = (m) => ({
    texto: `${dia(m.data_movimento).split("-").reverse().join("/")} · ${m.tipo === "CREDITO" ? "Entrada" : "Saída"} · ${m.descricao || "Sem descrição"}`,
    valor: restanteMovimento(m),
  });

  // Entradas e saídas do mês: quanto já está conciliado e quanto falta.
  const resumo = {};
  for (const [chave, tipo] of [["entradas", "CREDITO"], ["saidas", "DEBITO"]]) {
    const ms = movsMes.filter((m) => m.tipo === tipo);
    const total = ms.reduce((s, m) => s + absVal(m), 0);
    const falta = ms.reduce((s, m) => s + (m.conciliado ? 0 : restanteMovimento(m)), 0);
    resumo[chave] = { quantidade: ms.length, total: arred(total), pendente: arred(falta), conciliado: arred(total - falta), pendentes: ms.filter(pendente).length };
  }

  // Título pago (ou com valor recebido/pago) sem o banco correspondente: a baixa existe, o dinheiro não foi visto no extrato.
  const pagoSemBanco = [];
  for (const [lista, tipo] of [[receber, "REC"], [pagar, "DESP"]]) {
    for (const t of lista) {
      if (cancelado(t)) continue;
      const pago = Number(tipo === "REC" ? t.valor_recebido : t.valor_pago) || 0;
      const conc = Number(t.valor_conciliado) || 0;
      if (pago > 0.005 && conc < pago - 0.005) {
        pagoSemBanco.push({
          texto: `${tipo === "REC" ? "Recebimento" : "Despesa"} · ${t.numero_nf ? `NF ${t.numero_nf} · ` : ""}${t.cliente ?? t.fornecedor ?? "Sem nome"} · pago em ${dia(t.data_pagamento).split("-").reverse().join("/") || "data não informada"}${t.origem ? ` · origem ${t.origem}` : ""}`,
          valor: arred(pago - conc),
        });
      }
    }
  }

  const pendTodos = movimentos.filter(pendente);
  const lotes = sugerirLotes(pendTodos, receber, "CREDITO");
  const emLote = new Set(lotes.flatMap((l) => l.movimentos.map((x) => x.id)));
  const repasses = repassesPorMes(pendTodos.filter((m) => !emLote.has(m.id)), "minaslab").filter((r) => r.mes === mes);
  const listaRepasses = repasses.flatMap((r) => r.movimentos.map(linhaMov));

  const abertosVencidos = receber.filter((t) => !cancelado(t) && ["VENCIDO", "A RECEBER", "PARCIAL"].includes(String(t.status || "").toUpperCase()) && dia(t.data_vencimento) && dia(t.data_vencimento) <= fim && Number(t.valor_previsto) - Number(t.valor_conciliado || 0) > 0.005);

  const parciaisMov = movimentos.filter((m) => pendente(m) && restanteMovimento(m) < absVal(m) - 0.005);
  const parciaisTit = [...receber, ...pagar].filter((t) => !cancelado(t) && Number(t.valor_conciliado) > 0.005 && String(t.status || "").toUpperCase() !== "PAGO" && Number(t.valor_conciliado) < Number(t.valor_previsto ?? t.valor_original) - 0.005);

  const grupos = new Map();
  for (const m of movsMes) {
    const k = [m.conta_bancaria_id, dia(m.data_movimento), arred(m.valor), String(m.descricao || "").trim().toLowerCase()].join("|");
    grupos.set(k, [...(grupos.get(k) || []), m]);
  }
  const duplicados = [...grupos.values()].filter((g) => g.length > 1 && g.some(pendente));

  const semNada = movimentos.filter((m) => m.conciliado && !(m.conciliacoes || []).length && !m.classificacao_bancaria && absVal(m) > 0.005);

  const itens = [
    item("pendentes-mes", "Movimentos do banco ainda sem conciliar neste mês", sev(mesFechado), pendMes.map(linhaMov), pendMes.reduce((s, m) => s + restanteMovimento(m), 0), { acao: { rotulo: "Conciliar agora", to: "/financas/conciliacao-mlab" } }),
    item("pendentes-antes", "Pendências de meses anteriores", "erro", pendAntes.map(linhaMov), pendAntes.reduce((s, m) => s + restanteMovimento(m), 0), { acao: { rotulo: "Conciliar agora", to: "/financas/conciliacao-mlab" } }),
    item("pago-sem-banco", "Títulos pagos sem o dinheiro no extrato", "erro", pagoSemBanco, pagoSemBanco.reduce((s, x) => s + x.valor, 0), { dica: "A baixa existe, mas não há movimento do banco ligado. Confira se o dinheiro entrou (outra conta, dinheiro) ou se a baixa foi indevida." }),
    item("repasses", "Repasses da MinasLab deste mês sem NF", sev(mesFechado), listaRepasses, repasses.reduce((s, r) => s + r.total, 0), { acao: { rotulo: "Emitir NFS-e do mês", to: "/financas/conciliacao-mlab" }, dica: "Emita a NFS-e para a MinasLab com o total repassado e depois concilie tudo de uma vez." }),
    item("sem-vinculo", "Marcados como conciliados, mas sem vínculo nem classificação", "erro", semNada.map(linhaMov), semNada.reduce((s, m) => s + absVal(m), 0), { dica: "Inconsistência de dado: o movimento diz conciliado, mas não há com o quê." }),
    item("parciais", "Conciliações parciais (sobra ou falta valor)", "atencao", [...parciaisMov.map((m) => ({ ...linhaMov(m), texto: `Movimento · ${linhaMov(m).texto}` })), ...parciaisTit.map((t) => ({ texto: `Título · ${t.numero_nf ? `NF ${t.numero_nf} · ` : ""}${t.cliente ?? t.fornecedor ?? "Sem nome"}`, valor: arred(Number(t.valor_previsto ?? t.valor_original) - Number(t.valor_conciliado)) }))], [...parciaisMov.map(restanteMovimento), ...parciaisTit.map((t) => Number(t.valor_previsto ?? t.valor_original) - Number(t.valor_conciliado))].reduce((s, v) => s + v, 0), { dica: "Normalmente é juros, multa ou desconto que faltou registrar." }),
    item("duplicados", "Possíveis lançamentos duplicados no banco (com pendência)", "atencao", duplicados.flatMap((g) => g.map((m) => ({ ...linhaMov(m), texto: `${g.length}× · ${linhaMov(m).texto}` }))), 0, { dica: "Mesma conta, data, valor e descrição. Pode ser legítimo; confira antes de conciliar." }),
    item("vencidos", "Recebimentos vencidos ou ainda em aberto até o fim do mês", "atencao", abertosVencidos.map((t) => ({ texto: `NF ${t.numero_nf || "s/n"} · ${t.cliente ?? "Sem nome"} · vence ${dia(t.data_vencimento).split("-").reverse().join("/")}`, valor: arred(Number(t.valor_previsto) - Number(t.valor_conciliado || 0)) })), abertosVencidos.reduce((s, t) => s + Number(t.valor_previsto) - Number(t.valor_conciliado || 0), 0), { dica: "Não é erro: é o que ainda falta receber." }),
  ];
  const erros = itens.filter((i) => i.severidade === "erro").length;
  const atencoes = itens.filter((i) => i.severidade === "atencao").length;
  return { mes, fim, mesFechado, resumo, itens, erros, atencoes, emOrdem: erros === 0 && atencoes === 0 };
}
