// Números do CRM, já somados no servidor (Edge Function ml-comercial, só leitura).
import { COMERCIAL } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";

const chamar = (action, corpo = {}) => comCracha(COMERCIAL, { action, ...corpo });

export const resumoCRM = (meses = 36) => chamar("resumo", { meses });
export const propostasSemResponsavel = (mes) => chamar("semResponsavel", { mes });
export const cockpitCRM = () => chamar("cockpit");
export const funilCRM = (meses = 6) => chamar("funil", { meses });
export const carteiraCRM = () => chamar("carteira");
export const licitacoesCRM = () => chamar("licitacoes");
export const npsCRM = () => chamar("nps");
export const setoresCRM = (mes) => chamar("setores", { mes });
export const labPainelCRM = () => chamar("labPainel");
