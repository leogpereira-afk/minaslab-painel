import test from "node:test";
import assert from "node:assert/strict";
import { resumoNcs, resumoProdutividade } from "./labResumo.js";
import { pautaDaApresentacao } from "./ata.js";
import { slidesDoModelo } from "./modelosApresentacao.js";

const ncs = [
  { mes: "2026-09", tipo: "Temperatura", setor: "Recepção", situacao: "aberta" },
  { mes: "2026-09", tipo: "Ensaio repetido (retrabalho)", setor: "Microbiologia", situacao: "encerrada" },
  { mes: "2026-09", tipo: "Temperatura", setor: "Recepção", situacao: "tratada", retrabalho: true },
  { mes: "2026-08", tipo: "Outro", situacao: "aberta" },
  { mes: "2026-10", tipo: "Outro", situacao: "aberta" },
];

test("NCs do mês: retrabalho, abertas até o mês e contagem por tipo", () => {
  const r = resumoNcs(ncs, "2026-09");
  assert.equal(r.total, 3);
  assert.equal(r.retrabalho, 2);
  assert.equal(r.abertas, 3); // 2 de setembro + 1 de agosto; outubro não entra
  assert.deepEqual(r.porTipo[0], { nome: "Temperatura", n: 2 });
});

test("produtividade: totais e % de ensaios repetidos", () => {
  const r = resumoProdutividade([
    { mes: "2026-09", pessoaId: "a", nome: "A", ensaios: 100, laudos: 20, retrabalhos: 5 },
    { mes: "2026-09", pessoaId: "b", nome: "B", ensaios: 300, laudos: 0, retrabalhos: 3 },
    { mes: "2026-09", pessoaId: "c", nome: "C", ensaios: "", laudos: "", retrabalhos: "" },
    { mes: "2026-08", pessoaId: "a", nome: "A", ensaios: 999 },
  ], "2026-09");
  assert.deepEqual(r.pessoas.map((x) => x.nome), ["B", "A"]);
  assert.equal(r.ensaios, 400);
  assert.equal(r.pctRetrabalho, 2);
});

test("reunião do laboratório vira ata com prazos, NCs e produtividade", () => {
  const ctx = {
    mes: "2026-09", valores: { mes: "Setembro de 2026", mesAnterior: "Agosto de 2026", mesSeguinte: "Outubro de 2026", ano: "2026" },
    lab: { os: { andamento: 84, atrasadas: 31, vencendo: 5, lista: [] }, porMes: { "2026-09": { recebidas: 120, concluidas: 100 } }, parceiros: { aguardando: 7, atrasados: 2 } },
    ncs: resumoNcs(ncs, "2026-09"),
    produtividade: resumoProdutividade([{ mes: "2026-09", pessoaId: "a", nome: "A", ensaios: 50, laudos: 10, retrabalhos: 1 }], "2026-09"),
    ata: [], anterior: [],
  };
  const p = pautaDaApresentacao(slidesDoModelo("laboratorio"), ctx);
  assert.ok(!p.some((x) => /\{\w+\}/.test(x.titulo + x.corpo)));
  const prazos = p.find((x) => x.titulo === "Prazos e ordens de serviço").corpo;
  assert.match(prazos, /84 ordens de serviço em andamento, 31 com prazo vencido e 5 vencendo/);
  assert.match(prazos, /120 OS recebidas e 100 concluídas/);
  assert.match(p.find((x) => x.titulo.startsWith("Não conformidades")).corpo, /3 não conformidades no mês, 2 com retrabalho; 3 ainda em aberto/);
  assert.match(p.find((x) => x.titulo.startsWith("Produtividade")).corpo, /50 ensaios e emitidos 10 laudos ou relatórios; 2% dos ensaios/);
});
