// Gera uma OS com as amostras no servidor: reserva os números (OS, amostra,
// código de barras) num passo atômico, grava a OS e as amostras em lote e,
// se veio de um agendamento do Plano de Coleta, marca o agendamento.
// Usado pelo Plano de Coleta (Contratos) e por "Criar Ordem de serviço".

import { configSistema } from "./dados.jsx";
import { montarOS, statusInicial } from "./ordens.js";

const inicio = (v) => Math.max(0, (Number(v) || 1) - 1);

export async function gerarOS(ctx, { contrato, servicos, agendamento = null, descricao = "", prioridade = "Padrão", por = "" }) {
  const { dados, salvar, salvarLote, reservar } = ctx;
  const cfg = configSistema(dados);
  const ano = new Date().getFullYear();
  const qtd = servicos.reduce((s, x) => s + (Number(x.qtd) || 0), 0);
  if (!qtd) throw new Error("Selecione ao menos um serviço com quantidade.");
  const [numOS] = await reservar(`os:${ano}`, inicio(cfg.numeroInicialOS));
  const numsAmostra = await reservar(`amostra:${ano}`, inicio(cfg.numeroInicialAmostra), qtd);
  const numsBarra = await reservar("amostra", inicio(cfg.codigoBarrasInicial), qtd);
  const avulsa = !agendamento;
  const { os, amostras } = montarOS({
    contrato, servicos, numOS, numsAmostra, numsBarra, ano, status: statusInicial(contrato, cfg, avulsa),
    dataColeta: agendamento?.data || "", descricao: descricao || agendamento?.identificacao || "", prioridade,
    origem: avulsa ? "Avulsa" : "Plano de Coleta", agendamentoId: agendamento?.id || null, por,
  });
  const osSalva = await salvar("ordens", os, { numerar: true, motivo: avulsa ? "OS avulsa" : `Agendamento de ${agendamento.data}` });
  await salvarLote("amostras", amostras.map((a) => ({ ...a, osId: osSalva.id, os: `OS${String(os.num).padStart(5, "0")}/${ano}` })), { numerar: true });
  if (agendamento) {
    await salvar("contratos", { ...contrato, agendamentos: contrato.agendamentos.map((a) => (a.id === agendamento.id ? { ...a, status: "OS gerada", osId: osSalva.id } : a)) });
  } else {
    // OS avulsa também consome o saldo do contrato: registra como agendamento já com OS.
    const ag = { id: `ag${Date.now().toString(36)}`, data: "", identificacao: descricao || "OS avulsa", periodo: "", servicos: servicos.filter((s) => Number(s.qtd) > 0).map((s) => ({ sid: s.sid, qtd: Number(s.qtd) })), status: "OS gerada", osId: osSalva.id };
    await salvar("contratos", { ...contrato, agendamentos: [...(contrato.agendamentos || []), ag] });
  }
  return osSalva;
}
