// DEPÓSITOS DE BOLETOS PELO RELATÓRIO DO C6 (25/11/2026).
//
// O C6 credita num lançamento só ("Ref. Liq. Boleto Comp Externo") todos os boletos pagos com a mesma data de
// crédito, às vezes de clientes diferentes. Pelo valor e pela data de vencimento não dá para saber quais notas
// foram pagas (a M Lab tem várias notas de 300 e 310 vencendo nos mesmos dias). O relatório de boletos do C6,
// importado em Receber → Importar C6, grava em cada nota a data de crédito (c6_data_credito) e o valor
// liquidado (c6_valor_liquidacao, já com juros e multa). Aqui só se junta isso:
// - só créditos de boleto (liquidação ou QR Code);
// - candidatos de um crédito: notas com boleto PAGO no C6, data de crédito igual à do banco e saldo a conciliar;
// - sugere só quando a soma dos valores liquidados fecha o valor do banco no centavo;
// - a diferença entre o liquidado e o saldo da nota é juros/multa do boleto (ou desconto, se negativa).
// Quem confirma é sempre a pessoa, na tela Conciliar.
import { restanteMovimento, restanteTituloConc } from "./conciliacaoSugestao.js";

const centavos = (v) => Math.round(Number(v || 0) * 100);
const dia = (v) => String(v || "").slice(0, 10);
const ehDepositoBoleto = (m) => /liq.*boleto/i.test(String(m?.descricao || ""));
// Crédito que pode ser boleto: o depósito de liquidação e o boleto pago por QR Code ("Pix qr code recebido"),
// como a NF 168 em 16/11. PIX comum fica de fora, para não casar com um boleto de mesmo valor no mesmo dia.
const podeSerBoleto = (m) => ehDepositoBoleto(m) || /boleto|qr ?code/i.test(String(m?.descricao || ""));

function boletosDoDia(receber, data, usados) {
  const lista = [];
  for (const t of receber) {
    if (usados.has(t.id) || t?.apagado || ["CANCELADO", "CANCELADA"].includes(String(t?.status || "").toUpperCase())) continue;
    if (String(t?.c6_status || "").toUpperCase() !== "PAGO" || dia(t?.c6_data_credito) !== data) continue;
    const restante = centavos(restanteTituloConc(t, "CREDITO"));
    if (restante <= 0) continue;
    const liquidacao = centavos(t.c6_valor_liquidacao) > 0 ? centavos(t.c6_valor_liquidacao) : restante;
    lista.push({ titulo: t, restante, liquidacao });
  }
  return lista;
}

// Menor conjunto de boletos cuja soma liquidada é exatamente o alvo (em centavos).
function fechar(boletos, alvo, maxCandidatos = 24) {
  const lista = boletos.slice(0, maxCandidatos);
  for (let tam = 1; tam <= lista.length; tam++) {
    let achado = null;
    const busca = (ini, soma, escolhidos) => {
      if (achado) return;
      if (escolhidos.length === tam) { if (soma === alvo) achado = escolhidos.slice(); return; }
      for (let k = ini; k < lista.length && !achado; k++) {
        if (soma + lista[k].liquidacao > alvo) continue;
        escolhidos.push(k);
        busca(k + 1, soma + lista[k].liquidacao, escolhidos);
        escolhidos.pop();
      }
    };
    busca(0, 0, []);
    if (achado) return achado.map((k) => lista[k]);
  }
  return null;
}

// Mapa movimento.id -> { itens: [{ titulo, restante, liquidacao, juros }], total }.
export function sugerirBoletosC6(movimentos = [], receber = []) {
  const usados = new Set();
  const r = new Map();
  // Maiores primeiro: o crédito que junta mais boletos escolhe antes dos créditos de um boleto só.
  const pendentes = movimentos
    .filter((m) => m?.tipo === "CREDITO" && podeSerBoleto(m) && restanteMovimento(m) > 0.005)
    .sort((a, b) => dia(a.data_movimento).localeCompare(dia(b.data_movimento)) || restanteMovimento(b) - restanteMovimento(a));
  for (const m of pendentes) {
    const escolhidos = fechar(boletosDoDia(receber, dia(m.data_movimento), usados), centavos(restanteMovimento(m)));
    if (!escolhidos) continue;
    escolhidos.forEach((b) => usados.add(b.titulo.id));
    r.set(m.id, {
      itens: escolhidos.map((b) => ({ titulo: b.titulo, restante: b.restante / 100, liquidacao: b.liquidacao / 100, juros: (b.liquidacao - b.restante) / 100 })),
      total: escolhidos.reduce((s, b) => s + b.liquidacao, 0) / 100,
    });
  }
  return r;
}

// Depósitos de boleto pendentes que o relatório C6 importado não explica: sinal de que falta importar o relatório.
export function depositosBoletoSemC6(movimentos = [], sugestoes = new Map()) {
  return movimentos.filter((m) => m?.tipo === "CREDITO" && ehDepositoBoleto(m) && restanteMovimento(m) > 0.005 && !sugestoes.has(m.id));
}
