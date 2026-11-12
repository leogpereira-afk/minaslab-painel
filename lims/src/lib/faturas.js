// Faturas (Contas a receber). Como no GerenciaLab, a fatura nasce com a OS:
// uma fatura por OS, com o valor das amostras dela. Contrato parcelado não
// gera fatura por OS (as parcelas saem do próprio contrato).

import { referenciaAmostra } from "./ordens.js";
import { valorAmostra } from "./laboratorio.js";
import { isoDia } from "./formato.js";

// Prazo pela condição de pagamento ("Boleto bancário, 10 dias" → 10; sem número → 30).
export const diasPagamento = (cond) => { const m = String(cond || "").match(/(\d+)\s*dias?\b/i); return m ? Number(m[1]) : 30; };

export const faturaPorOS = (cfg, contrato) => cfg.sistemaFaturamento !== "Não" && contrato?.ciclo !== "Parcelado" && contrato?.tipoContrato !== "Contrato Parcelado";

export function faturaDaOS({ os, amostras, contrato, hoje = new Date() }) {
  const vivas = amostras.filter((a) => a.status !== "Cancelado");
  return {
    origem: "OS", osId: os.id, os: os.numero || amostras[0]?.os || "", clienteId: os.clienteId, contratoId: contrato?.id || null, contrato: os.contrato || "",
    amostraIds: vivas.map((a) => a.id), referencia: vivas.map(referenciaAmostra).join(", "),
    descricao: `${amostras[0]?.os || "OS"} · ${vivas.length} amostra(s)`,
    valor: Math.round(vivas.reduce((t, a) => t + valorAmostra(contrato, a), 0) * 100) / 100,
    venc: isoDia(diasPagamento(contrato?.condicoes), hoje), forma: contrato?.condicoes || "", status: "Em aberto",
  };
}

// Amostras cobertas por uma fatura (novas: por OS; antigas: uma amostra).
export const amostrasDaFatura = (dados, r) => (r.amostraIds?.length ? r.amostraIds : r.amostraId ? [r.amostraId] : []).map((id) => dados.amostras.find((a) => a.id === id)).filter(Boolean);

export const faturaDaAmostra = (dados, a) => dados.contas_receber.find((r) => r.status !== "Cancelado" && r.status !== "Agrupada" && ((r.amostraIds || []).includes(a.id) || r.amostraId === a.id))
  || dados.contas_receber.filter((r) => r.status === "Agrupada" && ((r.amostraIds || []).includes(a.id) || r.amostraId === a.id)).map((r) => dados.contas_receber.find((g) => g.id === r.grupoId)).find(Boolean);
