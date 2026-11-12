import test from "node:test";
import assert from "node:assert/strict";
import { proximoCodigo, somaDiasUteis, prazoResposta, prazoConfirmacao, proximaEtapa, faltaParaSeguir, alertasPrazo } from "../../supabase/functions/_shared/reclamacoes-regras.mjs";

test("protocolo RRC sequencial por ano, com três dígitos", () => {
  assert.equal(proximoCodigo([], 2026), "RRC 001/2026");
  assert.equal(proximoCodigo(["RRC 001/2026", "RRC 007/2026", "RRC 012/2025"], 2026), "RRC 008/2026");
  assert.equal(proximoCodigo(["RRC 012/2025"], 2026), "RRC 001/2026");
});

test("dias úteis pulam sábado e domingo", () => {
  assert.equal(somaDiasUteis("2026-11-12", 2), "2026-11-16"); // qui → seg
  assert.equal(somaDiasUteis("2026-11-13", 2), "2026-11-17"); // sex → ter
  assert.equal(prazoConfirmacao("2026-11-14"), "2026-11-17"); // sáb → ter
});

test("prazo de resposta por classificação (dias corridos)", () => {
  assert.equal(prazoResposta("2026-11-12", "CRITICA"), "2026-11-17");
  assert.equal(prazoResposta("2026-11-12", "ALTA"), "2026-11-22");
  assert.equal(prazoResposta("2026-11-12", "MEDIA"), "2026-11-27");
  assert.equal(prazoResposta("2026-11-12", "BAIXA"), "2026-12-12");
});

test("improcedente pula a investigação", () => {
  assert.equal(proximaEtapa({ etapa: "VALIDACAO", procedente: false }), "RESPOSTA");
  assert.equal(proximaEtapa({ etapa: "VALIDACAO", procedente: true }), "INVESTIGACAO");
  assert.equal(proximaEtapa({ etapa: "ENCERRADA" }), null);
});

test("o que falta para seguir", () => {
  assert.match(faltaParaSeguir({ etapa: "RECEBIDA", descricao: "x", cliente_nome: "C", classificacao: "CRITICA" }, "VALIDACAO"), /ação imediata/);
  assert.equal(faltaParaSeguir({ etapa: "RECEBIDA", descricao: "x", cliente_nome: "C", classificacao: "MEDIA" }, "VALIDACAO"), null);
  assert.match(faltaParaSeguir({ etapa: "VALIDACAO", procedente: true, validacao: "ok" }, "INVESTIGACAO"), /confirmado/);
  assert.match(faltaParaSeguir({ etapa: "VALIDACAO" }, "RESPOSTA"), /procede/);
  const base = { etapa: "RESPOSTA", resposta: "r", respondida_em: "2026-11-12", analisado_por: "ana", aprovado_por: "leo", encerramento: "ok" };
  assert.equal(faltaParaSeguir(base, "ENCERRADA"), null);
  assert.match(faltaParaSeguir({ ...base, envolvidos: ["ana"] }, "ENCERRADA"), /envolvido/);
});

test("alertas de prazo", () => {
  const r = { etapa: "VALIDACAO", prazo_confirmacao: "2026-11-10", prazo_resposta: "2026-11-20" };
  assert.deepEqual(alertasPrazo(r, "2026-11-12"), ["confirmação atrasada"]);
  assert.deepEqual(alertasPrazo({ ...r, confirmada_em: "2026-11-09" }, "2026-11-25"), ["resposta atrasada"]);
  assert.deepEqual(alertasPrazo({ ...r, etapa: "ENCERRADA" }, "2026-12-30"), []);
});
