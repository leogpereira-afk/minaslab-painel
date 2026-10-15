// Serviços Gerados: o status de pagamento de cada OS bate com o título (recebimento) ligado a ela?
// Vale para M Lab e MinasLab. Só calcula e lista; não altera nada. Mesmo formato dos itens do fechamento.
const arred = (n) => Math.round(Number(n || 0) * 100) / 100;
const maiusc = (v) => String(v ?? "").toUpperCase().trim();
const moedaBR = (n) => arred(n).toFixed(2).replace(".", ",");

function item(id, titulo, severidade, lista, extra = {}) {
  return { id, titulo, severidade: lista.length ? severidade : "ok", quantidade: lista.length, valor: arred(lista.reduce((s, x) => s + (x.valor || 0), 0)), lista, ...extra };
}

// Linhas agrupadas (várias OS numa cobrança) vêm com `grupo_itens`: cada OS é conferida por si.
const desagrupar = (servicos) => servicos.flatMap((s) => (Array.isArray(s.grupo_itens) && s.grupo_itens.length ? s.grupo_itens : [s]));

export function conferirStatusPagamento({ servicos = [], recebimentos = [], empresaId, hoje }) {
  const dia = String(hoje || new Date().toISOString()).slice(0, 10);
  const titulos = new Map(recebimentos.filter((r) => !r.apagado).map((r) => [r.id, r]));
  const faturadas = desagrupar(servicos).filter((s) => !s.apagado && (!empresaId || s.empresa_id === empresaId) && maiusc(s.status_faturamento) === "FATURADO");
  const linha = (s, extra = "") => ({ texto: `${s.os_numero} · NF ${s.numero_nf || "—"} · ${s.cliente || "Sem cliente"}${extra}`, valor: arred(s.valor_faturar) });

  const tituloPagoOsNao = [], osPagaTituloAberto = [], tituloCancelado = [], vencidaNaoMarcada = [], pagoSemTitulo = [], emDivergencia = [];
  for (const s of faturadas) {
    const st = maiusc(s.status_pagamento);
    const t = s.recebimento_id ? titulos.get(s.recebimento_id) : null;
    if (st === "CANCELADO") continue;
    if (s.recebimento_id && !t) continue; // título fora da lista carregada (apagado ou fora do período): não dá para conferir
    if (!t) {
      if (st === "PAGO") pagoSemTitulo.push(linha(s, s.pagamento_manual ? " · baixa manual" : " · histórico do Omie"));
      else if (st === "DIVERGENCIA") emDivergencia.push(linha(s, " · sem título ligado"));
      continue;
    }
    const tt = maiusc(t.status);
    if (tt === "CANCELADO") { tituloCancelado.push(linha(s, ` · OS ${st} · título cancelado (${moedaBR(t.valor_previsto)})`)); continue; }
    if (tt === "PAGO" && st !== "PAGO") { tituloPagoOsNao.push(linha(s, ` · OS ${st} · título pago`)); continue; }
    if (st === "PAGO" && tt !== "PAGO") { osPagaTituloAberto.push(linha(s, ` · OS paga · título ${tt}`)); continue; }
    if (st === "DIVERGENCIA") { emDivergencia.push(linha(s, ` · título ${moedaBR(t.valor_previsto)} × OS ${moedaBR(s.valor_faturar)}`)); continue; }
    // Vence primeiro o vencimento do título (o cliente pode ter prorrogado no Omie).
    const venc = String(t.data_vencimento || s.data_vencimento || "").slice(0, 10);
    if (["A RECEBER", "AGUARDANDO"].includes(st) && venc && venc < dia && !["PAGO", "PARCIAL"].includes(tt)) vencidaNaoMarcada.push(linha(s, ` · venceu em ${venc.split("-").reverse().join("/")} e segue ${st}`));
  }

  const itens = [
      item("pgto-titulo-pago-os-nao", "Título pago, mas a OS não está como PAGO", "erro", tituloPagoOsNao, { dica: "O dinheiro já entrou no título; a OS precisa ficar como PAGO (a rotina horária corrige as de pagamento manual)." }),
      item("pgto-os-paga-titulo-aberto", "OS marcada como PAGO, mas o título não está pago", "erro", osPagaTituloAberto, { dica: "Alguém deu baixa na OS à mão. Confirme se o cliente pagou e baixe o título, ou volte a OS para a situação certa." }),
      item("pgto-titulo-cancelado", "Título cancelado com OS ainda faturada", "erro", tituloCancelado, { dica: "O título foi cancelado (no Omie ou no sistema) e a OS segue como se fosse receber. Refaça o título ou cancele a OS." }),
      item("pgto-vencida-sem-marca", "OS vencida que não está como VENCIDO", "erro", vencidaNaoMarcada, { dica: "A rotina horária deveria ter marcado. Se aparecer aqui por mais de uma hora, avise." }),
      item("pgto-divergencia", "OS em divergência com o título", "atencao", emDivergencia, { dica: "Valor da OS diferente do título (ou título trocado). Confira qual está certo." }),
      item("pgto-pago-sem-titulo", "OS paga sem título ligado", "atencao", pagoSemTitulo, { dica: "O pagamento não pode ser conferido com o banco: veio do histórico do Omie ou de baixa manual. Confirme que o dinheiro entrou." }),
  ];
  return {
    totalOs: faturadas.length,
    itens,
    erros: itens.filter((i) => i.severidade === "erro").length,
    atencoes: itens.filter((i) => i.severidade === "atencao").length,
  };
}
