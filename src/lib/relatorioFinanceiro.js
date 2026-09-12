// A mesma base alimenta a leitura na tela, o PDF e as planilhas.
export const moedaRelatorio = v => v == null || v === '' || !Number.isFinite(Number(v)) ? 'Não informado' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataRelatorio = v => String(v || '').slice(0, 10).split('-').reverse().join('/') || 'Não informada';
export function dataValida(v) {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function periodoValido(de, ate) {
  return dataValida(de) && dataValida(ate) && de <= ate && de >= '1900-01-01' && ate <= '2200-12-31';
}
export function periodoAnterior(de, ate) {
  if (!periodoValido(de, ate)) return null;
  const inicio = new Date(`${de}T00:00:00Z`).getTime();
  const fim = new Date(`${ate}T00:00:00Z`).getTime();
  const dia = 86400000;
  return { de: new Date(inicio - (fim - inicio + dia)).toISOString().slice(0, 10), ate: new Date(inicio - dia).toISOString().slice(0, 10) };
}
const cents = v => Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : 0;
const cancelado = r => ['CANCELADO', 'CANCELADA'].includes(String(r.status || '').toUpperCase());
const chaveData = (r, banco) => String(banco ? r.data_movimento || '' : r.data_vencimento || r.data_lancamento || '').slice(0, 10);
const contaId = r => r.conta_bancaria_id || r.conta_bancaria?.id || r.conta?.id;
const noEscopo = (r, empresa, conta) => (!empresa || r.empresa_id === empresa) && (!conta || contaId(r) === conta);
export function variacaoFinanceira(atual, anterior, registrosAnteriores) {
  if (!registrosAnteriores) return null;
  const valor = (cents(atual) - cents(anterior)) / 100;
  return { valor, percentual: anterior === 0 ? null : valor / Math.abs(anterior) * 100 };
}
function totalBanco(lista) {
  let entradas = 0, saidas = 0, validos = 0;
  for (const m of lista) {
    if (!['CREDITO', 'DEBITO'].includes(m.tipo) || m.valor == null || m.valor === '' || !Number.isFinite(Number(m.valor))) continue;
    if (m.tipo === 'CREDITO') entradas += Math.abs(cents(m.valor));
    else saidas += Math.abs(cents(m.valor));
    validos++;
  }
  return { entradas: entradas / 100, saidas: saidas / 100, liquido: (entradas - saidas) / 100, registros: lista.length, validos, naoConciliados: lista.filter(m => !m.conciliado).length, invalidos: lista.length - validos };
}
export function movimentosPorMes(lista) {
  const meses = new Map();
  for (const m of lista) {
    if (!dataValida(m.data_movimento)) continue;
    const mes = chaveData(m, true).slice(0, 7), itens = meses.get(mes) || [];
    itens.push(m); meses.set(mes, itens);
  }
  return [...meses].sort(([a], [b]) => a.localeCompare(b)).map(([mes, itens]) => ({ mes, itens, ...totalBanco(itens) }));
}
function totalTitulos(lista, campoOriginal, campoPago, hoje) {
  const ativos = lista.filter(r => !cancelado(r));
  const soma = campo => ativos.reduce((s, r) => s + cents(r[campo]), 0) / 100;
  return { total: soma(campoOriginal), liquidado: soma(campoPago), pendente: soma('valor_pendente'), vencido: ativos.filter(r => dataValida(r.data_vencimento) && r.data_vencimento.slice(0, 10) < hoje && cents(r.valor_pendente) > 0).reduce((s, r) => s + cents(r.valor_pendente), 0) / 100, registros: lista.length, cancelados: lista.length - ativos.length };
}
export function montarRelatorioFinanceiro({ movimentos = [], recebimentos = [], despesas = [], empresa = '', conta = '', de, ate, hoje = new Date().toLocaleDateString('en-CA') }) {
  if (!periodoValido(de, ate)) throw new Error('Informe um período válido: a data inicial deve ser anterior ou igual à final.');
  const filtrar = (lista, banco, p) => lista.filter(r => { const data = chaveData(r, banco); return noEscopo(r, empresa, conta) && dataValida(data) && data >= p.de && data <= p.ate; }).sort((a, b) => chaveData(a, banco).localeCompare(chaveData(b, banco)) || String(a.id || '').localeCompare(String(b.id || '')));
  const periodo = { de, ate }, anterior = periodoAnterior(de, ate);
  const bancos = filtrar(movimentos, true, periodo), receber = filtrar(recebimentos, false, periodo), pagar = filtrar(despesas, false, periodo);
  const banco = totalBanco(bancos), bancoAnterior = totalBanco(filtrar(movimentos, true, anterior));
  const categorias = new Map();
  for (const d of pagar.filter(r => !cancelado(r))) {
    const nome = d.categoria?.nome || d.categoria_texto || 'Sem categoria';
    const c = categorias.get(nome) || { nome, total: 0, pendente: 0, registros: 0 };
    c.total += cents(d.valor_original); c.pendente += cents(d.valor_pendente); c.registros++; categorias.set(nome, c);
  }
  const pagarResumo = totalTitulos(pagar, 'valor_original', 'valor_pago', hoje);
  const semData = [[movimentos, true], [recebimentos, false], [despesas, false]].reduce((s, [lista, tipo]) => s + lista.filter(r => noEscopo(r, empresa, conta) && !dataValida(chaveData(r, tipo))).length, 0);
  const semConta = conta ? [...recebimentos, ...despesas].filter(r => (!empresa || r.empresa_id === empresa) && !contaId(r) && dataValida(chaveData(r, false)) && chaveData(r, false) >= de && chaveData(r, false) <= ate).length : 0;
  return { periodo, anterior, banco, bancoAnterior, bancos, receber, pagar, receberResumo: totalTitulos(receber, 'valor_previsto', 'valor_recebido', hoje), pagarResumo,
    meses: movimentosPorMes(bancos),
    categorias: [...categorias.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)).map(c => ({ ...c, total: c.total / 100, pendente: c.pendente / 100, participacao: pagarResumo.total > 0 ? c.total / (pagarResumo.total * 100) * 100 : null })),
    qualidade: { semData, semConta, semVencimento: [...receber, ...pagar].filter(r => !r.data_vencimento).length, semCategoria: pagar.filter(r => !cancelado(r) && !r.categoria?.nome && !r.categoria_texto).length },
    hoje, periodoEmAberto: ate > hoje,
  };
}
export function notasRelatorio(r) {
  const notas = [
    'Banco: entradas e saídas pela data do movimento. Inclui transferências, empréstimos e outras movimentações; o líquido não é lucro nem saldo disponível.',
    'Títulos: selecionados pelo vencimento; sem vencimento, usa a data de lançamento. Liquidado e pendente mostram a situação atual desses títulos, não um fechamento histórico.',
    'Despesas por categoria: valor original dos títulos selecionados, sem cancelados. Não representa somente pagamentos nem um DRE por competência.',
    `Comparação bancária: ${dataRelatorio(r.anterior.de)} a ${dataRelatorio(r.anterior.ate)}, janela imediatamente anterior com a mesma quantidade de dias. Ausência de registros não comprova ausência de movimento.`,
  ];
  if (r.periodoEmAberto) notas.push('O período inclui datas futuras. A leitura ainda é parcial; a variação percentual fica suspensa até o fim do intervalo.');
  if (r.banco.naoConciliados) notas.push(`${r.banco.naoConciliados} movimentos do período aguardam conciliação. Conferir documentos antes de fechar os números.`);
  if (r.qualidade.semData) notas.push(`${r.qualidade.semData} registros da base selecionada não têm data válida para enquadramento e ficaram fora do período.`);
  if (r.qualidade.semConta) notas.push(`${r.qualidade.semConta} títulos do período estão sem conta vinculada e ficaram fora do filtro bancário.`);
  if (r.qualidade.semVencimento) notas.push(`${r.qualidade.semVencimento} títulos foram selecionados pela data de lançamento por não terem vencimento.`);
  if (r.qualidade.semCategoria) notas.push(`${r.qualidade.semCategoria} despesas do período estão sem categoria.`);
  if (r.banco.invalidos) notas.push(`${r.banco.invalidos} movimentos têm valor ou tipo inválido: constam no extrato detalhado e não foram somados.`);
  if (r.receberResumo.cancelados + r.pagarResumo.cancelados) notas.push(`${r.receberResumo.cancelados + r.pagarResumo.cancelados} títulos cancelados constam no detalhe, fora dos totais e categorias.`);
  return notas;
}
export function celulaCsvFinanceiro(v) {
  const texto = String(v ?? '');
  // Conteúdo textual não vira fórmula ao abrir uma planilha.
  const seguro = typeof v === 'string' && /^[\s]*[=+@-]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}
