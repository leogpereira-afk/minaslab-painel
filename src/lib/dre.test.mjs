import test from 'node:test';
import assert from 'node:assert/strict';
import { montarDre, classificarCategoria, lancamentosDaCelula } from './dre.js';

const MLAB = { id: 'm', nome: 'M LAB SERVICOS LTDA', cnpj: '65.312.061/0001-30', usa_omie: false };
const MINAS = { id: 'n', nome: 'MINASLAB LTDA', cnpj: '52.657.257/0001-14', usa_omie: true };
const cat = (id, agrupamento, grupo, nome, fluxo = '01. FLUXO OPERACIONAL') => ({ id, nome, fluxo, agrupamento, grupo });
const CATS = [
  cat('rec', '01. RECEITA LÍQUIDA', '01. RECEITA', 'Serviços realizados'),
  cat('imp', '01. RECEITA LÍQUIDA', '02. IMPOSTO SOBRE RECEITA', 'Simples Nacional'),
  cat('cus', '02. CUSTOS E DESPESAS', '01. CUSTOS', 'Análises terceirizadas'),
  cat('des', '02. CUSTOS E DESPESAS', '02. DESPESAS', 'Aluguel'),
  cat('sal', '02. CUSTOS E DESPESAS', '02. DESPESAS', 'Salários'),
  cat('soc', '01. SÓCIOS', '01. CAPITAL PRÓPRIO', 'Retirada de sócios', '03. FLUXO FINANCIAMENTO'),
];
const rec = (id, valor, mais = {}) => ({ id, empresa_id: 'm', cliente: `Cliente ${id}`, categoria_id: 'rec', valor_previsto: valor, valor_recebido: 0, status: 'A RECEBER', data_vencimento: '2026-10-20', ...mais });
const des = (id, valor, categoria_id, mais = {}) => ({ id, empresa_id: 'm', fornecedor: `Fornecedor ${id}`, categoria_id, valor_original: valor, valor_pago: 0, status: 'A PAGAR', data_lancamento: '2026-10-05', data_vencimento: '2026-10-25', ...mais });
const linha = (dre, id) => dre.linhas.find((l) => l.id === id);
const OUT = 9; // índice de outubro

test('classifica pelo plano de contas', () => {
  assert.equal(classificarCategoria(CATS[0]), 'receita');
  assert.equal(classificarCategoria(CATS[1]), 'impostos');
  assert.equal(classificarCategoria(CATS[2]), 'custos');
  assert.equal(classificarCategoria(CATS[3]), 'despesas');
  assert.equal(classificarCategoria(CATS[5]), 'fora');
  assert.equal(classificarCategoria(null), 'sem');
  assert.equal(classificarCategoria({ id: 'x', nome: 'Omie 2.01' }), 'sem');
});

test('competência: receita no mês da NF de saída, despesa no mês do lançamento; linhas e subtotais', () => {
  const notas = [
    { empresa_id: 'm', numero_nf: '74', tipo: 'SAIDA', data_emissao: '2026-09-28' },
    { empresa_id: 'm', numero_nf: '74', tipo: 'ENTRADA', data_emissao: '2026-01-02' },
  ];
  const d = montarDre({
    ano: 2026, empresas: [MLAB, MINAS], empresaId: 'm', categorias: CATS, notas,
    receber: [rec('a', 1000, { numero_nf: '74' }), rec('b', 500)],
    pagar: [des('i', 60, 'imp'), des('c', 200, 'cus'), des('d', 300, 'des'), des('s', 100, 'sal'), des('r', 999, 'soc'), des('x', 40, null)],
  });
  assert.equal(linha(d, 'receita').valores[8], 1000, 'NF 74 emitida em setembro');
  assert.equal(linha(d, 'receita').valores[OUT], 500, 'sem NF: vencimento');
  assert.equal(d.aproximados, 1);
  assert.equal(linha(d, 'impostos').valores[OUT], -60);
  assert.equal(linha(d, 'receitaLiquida').valores[OUT], 440);
  assert.equal(linha(d, 'custos').valores[OUT], -200);
  assert.equal(linha(d, 'despesas').valores[OUT], -400);
  assert.deepEqual(linha(d, 'despesas').categorias.map((c) => [c.nome, c.valores[OUT]]), [['Aluguel', -300], ['Salários', -100]]);
  assert.equal(linha(d, 'semCategoria').valores[OUT], -40, 'sem categoria entra no resultado, à mostra');
  assert.equal(linha(d, 'resultado').valores[OUT], 440 - 200 - 400 - 40);
  assert.equal(linha(d, 'resultado').total, 1000 + 440 - 200 - 400 - 40);
  assert.equal(d.fora[0].rotulo, '01. SÓCIOS');
  assert.equal(d.fora[0].valores[OUT], -999, 'retirada de sócio não entra no resultado');
  assert.equal(Math.round(linha(d, 'margem').valores[OUT] * 1000) / 1000, Math.round((-200 / 440) * 1000) / 1000);
});

test('competência na MinasLab: data de emissão da Omie quando não acha a NF', () => {
  const d = montarDre({ ano: 2026, empresas: [MLAB, MINAS], empresaId: 'n', categorias: CATS, notas: [],
    receber: [rec('o', 700, { empresa_id: 'n', dados_omie: { data_emissao: '15/07/2026' } })], pagar: [] });
  assert.equal(linha(d, 'receita').valores[6], 700);
  assert.equal(d.aproximados, 0);
});

test('caixa: pelas baixas não estornadas; sem baixa, pela data de pagamento (conciliado); cancelado fica fora', () => {
  const d = montarDre({ ano: 2026, regime: 'caixa', empresas: [MLAB, MINAS], empresaId: 'm', categorias: CATS, notas: [],
    receber: [
      rec('a', 300, { status: 'PAGO', valor_recebido: 300, data_pagamento: '2026-11-03' }),
      rec('b', 400, { status: 'PARCIAL', baixas: [{ valor: 100, data_pagamento: '2026-10-01' }, { valor: 50, data_pagamento: '2026-10-02', estornada: true }] }),
      rec('c', 999, { status: 'CANCELADO', valor_recebido: 999, data_pagamento: '2026-10-01' }),
    ],
    pagar: [des('d', 80, 'des', { status: 'PAGO', valor_pago: 80, data_pagamento: '2026-10-30' })] });
  assert.equal(linha(d, 'receita').valores[OUT], 100);
  assert.equal(linha(d, 'receita').valores[10], 300);
  assert.equal(linha(d, 'despesas').valores[OUT], -80);
});

test('consolidado: tira os dois lados das operações entre as empresas e informa quanto tirou', () => {
  const d = montarDre({ ano: 2026, empresas: [MLAB, MINAS], empresaId: '', categorias: CATS, notas: [],
    receber: [rec('a', 1000, { cnpj_cpf: '52657257000114' }), rec('b', 500)],
    pagar: [des('x', 1200, 'cus', { empresa_id: 'n', cnpj_cpf: '65.312.061/0001-30' }), des('y', 100, 'des', { empresa_id: 'n' })] });
  assert.equal(linha(d, 'receita').valores[OUT], 500);
  assert.equal(linha(d, 'custos').valores[OUT], 0);
  assert.equal(linha(d, 'despesas').valores[OUT], -100);
  assert.deepEqual(d.eliminado, { receita: 1000, despesa: 1200 });
  assert.equal(d.aproximados, 1, 'a receita tirada (entre empresas) não conta como aproximada; só a b');
  const so = montarDre({ ano: 2026, empresas: [MLAB, MINAS], empresaId: 'm', categorias: CATS, notas: [], receber: [rec('a', 1000, { cnpj_cpf: '52657257000114' })], pagar: [] });
  assert.equal(linha(so, 'receita').valores[OUT], 1000, 'na empresa sozinha a receita da MinasLab conta');
});

test('fora do ano não entra; somas em centavos; clique na célula lista os lançamentos', () => {
  const d = montarDre({ ano: 2026, empresas: [MLAB], empresaId: 'm', categorias: CATS, notas: [],
    receber: [rec('a', 0.1), rec('b', 0.2), rec('c', 50, { data_vencimento: '2025-12-31' })], pagar: [] });
  assert.equal(linha(d, 'receita').valores[OUT], 0.3);
  assert.equal(linha(d, 'receita').total, 0.3);
  const l = lancamentosDaCelula(d, 'receita', OUT);
  assert.deepEqual(l.map((x) => x.id).sort(), ['a', 'b']);
  assert.equal(lancamentosDaCelula(d, 'receita', null).length, 2, 'null = ano inteiro');
});
