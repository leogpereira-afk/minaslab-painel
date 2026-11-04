// Regras de Ordem de serviço e amostra, no formato do GerenciaLab:
// OS "OS01664/2026", amostra "AM00004779/2026", código de barras de 11
// dígitos, e o status que acompanha a amostra da coleta à assinatura.
// Puro e testado.

// Ordem das etapas (a OS mostra a etapa mais atrasada das suas amostras).
export const STATUS_AMOSTRA = [
  "Aguardando agendamento", "Aguardando coleta", "Em coleta", "Coletado App", "Aguardando Inspeção",
  "Laboratório", "Em Revisão", "Assinatura", "Faturamento", "Concluída", "Processo de cancelamento", "Cancelado",
];
export const PRIORIDADES = ["Padrão", "Urgente", "Prioritária Rush Time"];

export const COR_STATUS_OS = {
  "Aguardando agendamento": "default", "Aguardando coleta": "warn", "Em coleta": "warn", "Coletado App": "info", "Aguardando Inspeção": "warn",
  Laboratório: "info", "Em Revisão": "primary", Assinatura: "primary", Faturamento: "ok", Concluída: "ok", "Processo de cancelamento": "crit", Cancelado: "off",
};

export const numeroOS = (o) => `OS${String(o.num).padStart(5, "0")}/${o.ano}`;
export const referenciaAmostra = (a) => `AM${String(a.num).padStart(8, "0")}/${a.ano}`;
export const codigoBarras = (n) => String(n).padStart(11, "0");

const FINAIS = new Set(["Cancelado", "Processo de cancelamento"]);
export function statusDaOS(amostras) {
  const vivas = amostras.filter((a) => !FINAIS.has(a.status));
  if (!amostras.length) return "Aguardando agendamento";
  if (!vivas.length) return amostras.some((a) => a.status === "Processo de cancelamento") ? "Processo de cancelamento" : "Cancelado";
  return vivas.reduce((m, a) => (STATUS_AMOSTRA.indexOf(a.status) < STATUS_AMOSTRA.indexOf(m) ? a.status : m), vivas[0].status);
}

// Status de partida: coleta pelo cliente → a amostra chega para inspeção;
// pela MinasLab → aguarda a coleta. OS avulsa segue a Configuração do sistema.
export function statusInicial(contrato, config = {}, avulsa = false) {
  if (contrato?.coleta === "Cliente") return "Aguardando Inspeção";
  if (avulsa) return config.statusOsAvulsa === "Status Aguardando coleta" ? "Aguardando coleta" : "Aguardando agendamento";
  return "Aguardando coleta";
}

// Uma amostra por unidade de cada serviço (qtd 3 → 3 amostras), cada uma com
// as análises (parâmetros) que o serviço contratou.
export function amostrasDosServicos(contrato, servicos) {
  const out = [];
  for (const s of servicos) {
    const sv = contrato.servicos.find((x) => x.sid === s.sid);
    if (!sv) continue;
    for (let i = 0; i < Number(s.qtd || 0); i++) {
      out.push({
        sid: sv.sid, servico: sv.descricao, matriz: sv.matriz || "", legislacao: sv.legislacao || "",
        analises: sv.params.map((p) => ({ pid: p.id, nome: p.nome, abrev: p.abrev || "", metodo: p.metodo || "", un: p.un || "", lq: p.lq || "", acred: !!p.acred, resultado: "", etapa: "Aguardando" })),
      });
    }
  }
  return out;
}

// Monta OS + amostras a partir dos números já reservados no servidor.
export function montarOS({ contrato, servicos, numOS, numsAmostra, numsBarra, ano, status, dataColeta = "", descricao = "", prioridade = "Padrão", origem = "Agendamento", agendamentoId = null, por = "" }) {
  const base = amostrasDosServicos(contrato, servicos);
  if (!base.length) throw new Error("Selecione ao menos um serviço com quantidade.");
  if (numsAmostra.length < base.length || numsBarra.length < base.length) throw new Error("Numeração insuficiente para as amostras.");
  const os = {
    num: numOS, ano, contratoId: contrato.id, contrato: contrato.num ? `${String(contrato.num).padStart(8, "0")}/${contrato.ano}` : "",
    clienteId: contrato.clienteId, solicitanteId: contrato.solicitanteId || null, centro: contrato.centro || "", descricao, prioridade,
    origem, agendamentoId, dataColeta, resp: por, docs: [],
  };
  const amostras = base.map((a, i) => ({
    ...a, num: numsAmostra[i], ano, barra: codigoBarras(numsBarra[i]), status, prioridade,
    contratoId: contrato.id, clienteId: contrato.clienteId, identificacao: "", local: "", regiao: contrato.grupoRegional || "", respAmostra: contrato.coleta === "Cliente" ? "Cliente" : "MinasLab",
    dataColeta, dataEntrada: "", dataEntrega: "", dataAssinatura: "", campos: ["", "", "", "", "", ""],
  }));
  return { os, amostras };
}

/* ---------------- Código de barras Code 128 (conjunto B) ---------------- */

const PADROES = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");
export const PADROES_CODE128 = PADROES;

// Larguras das barras e espaços (alternando, começa com barra), com início B,
// dígito verificador e parada. Só caracteres ASCII 32–126.
export function code128(texto) {
  const v = [...String(texto)].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error("Caractere fora do Code 128 B.");
    return c - 32;
  });
  const soma = v.reduce((s, x, i) => s + x * (i + 1), 104);
  const codigos = [104, ...v, soma % 103, 106];
  return codigos.flatMap((c) => [...PADROES[c]].map(Number));
}
