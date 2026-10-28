import test from "node:test";
import assert from "node:assert/strict";
import { mesDaFolha, pagamentosDeComissao, propostasDoPagamento, itensDaComissao, pessoaDoNome, aplicarComissao, recibosPorComissao } from "./recibosComissao.js";

const PG = { id: "pg1", tipo: "pagamento", nome: "PESSOA TESTE", pagoEm: "2026-11-05", folha: "2026-10", total: 12.5, itens: [
  { proposta: "001/2026", cliente: "Cliente A", valor: 5 }, { proposta: "001/2026", cliente: "Cliente A", valor: 2.5 }, { proposta: "002/2026", cliente: "Cliente B", valor: 5 },
] };
const VAZIO = { nome: "", cpf: "", valor: "", competencia: "", itens: [] };

test("mês da folha: o informado ou o da data", () => {
  assert.equal(mesDaFolha(PG), "2026-10");
  assert.equal(mesDaFolha({ pagoEm: "2026-09-01" }), "2026-09");
});

test("lista só pagamentos com valor, mais recentes primeiro", () => {
  const l = pagamentosDeComissao([{ tipo: "colaborador" }, { tipo: "pagamento", total: 0, pagoEm: "2026-12-01" }, { ...PG, id: "a", folha: "2026-08" }, PG]);
  assert.deepEqual(l.map((p) => p.id), ["pg1", "a"]);
  const fora = pagamentosDeComissao([{ tipo: "excluido", crmId: "x1" }, { ...PG, colaboradorId: "auto_x1" }, { ...PG, id: "b", colaboradorId: "auto_x2" }]);
  assert.deepEqual(fora.map((p) => p.id), ["b"]);
});

test("agrupa por proposta", () => {
  assert.deepEqual(propostasDoPagamento(PG).map((x) => [x.proposta, x.valor]), [["001/2026", 7.5], ["002/2026", 5]]);
  assert.equal(itensDaComissao(PG).length, 1);
  assert.match(itensDaComissao(PG)[0].descricao, /2 propostas.*outubro de 2026/);
  assert.equal(itensDaComissao(PG, { detalhar: true }).length, 2);
});

test("acha a pessoa do cadastro só quando não há dúvida", () => {
  const pessoas = [{ nome: "Pessoa Teste da Silva", cpf: "1" }, { nome: "Outra Pessoa", cpf: "2" }];
  assert.equal(pessoaDoNome(pessoas, "PESSOA TESTE")?.cpf, "1");
  assert.equal(pessoaDoNome([...pessoas, { nome: "Pessoa Teste Souza" }], "PESSOA TESTE"), null);
});

test("recibo vazio fica preenchido; trazer de novo não duplica", () => {
  const d = aplicarComissao(VAZIO, PG, { pessoas: [{ nome: "Pessoa Teste da Silva", cpf: "111" }] });
  assert.equal(d.nome, "Pessoa Teste da Silva");
  assert.equal(d.cpf, "111");
  assert.equal(d.valor, "12,50");
  assert.equal(d.competencia, "outubro de 2026");
  assert.equal(d.dataPagamento, "2026-11-05");
  assert.match(d.referenteLivre, /comissão/);
  const d2 = aplicarComissao(d, PG, { detalhar: true });
  assert.equal(d2.itens.length, 2);
  assert.equal(d2.valor, "12,50");
  assert.equal(recibosPorComissao([{ id: "r1", dados: d2 }]).get("pg1").id, "r1");
});

test("recibo com salário já digitado: soma a comissão se o total era a soma", () => {
  const d = { ...VAZIO, nome: "Fulano", valor: "1.000,00", itens: [{ descricao: "Remuneração", valor: "1.000,00", tipo: "credito" }] };
  const r = aplicarComissao(d, PG);
  assert.equal(r.nome, "Fulano");
  assert.equal(r.referenteLivre, undefined);
  assert.equal(r.valor, "1.012,50");
  const manual = aplicarComissao({ ...d, valor: "900,00" }, PG);
  assert.equal(manual.valor, "900,00");
});
