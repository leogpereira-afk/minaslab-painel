import { dataValida, periodoValido } from './relatorioFinanceiro.js';
const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
// Somente categorias explícitas. Descrições livres nunca comprovam a natureza.
// Os rótulos vão para a tela e para o PDF: sem travessão (regra da casa, com teste).
const regras = {
  'APLICACOES REALIZADAS': ['aplicacoes', 'Aporte'],
  'RESGATE DE TITULOS': ['aplicacoes', 'Resgate'],
  'RESGATE DE APLICACOES': ['aplicacoes', 'Resgate'],
  'RENDIMENTO SOBRE APLICACOES IMEDIATAS': ['aplicacoes', 'Rendimento'],
  'IMPOSTOS SOBRE APLICACOES FINANCEIRAS IMEDIATAS': ['aplicacoes', 'Impostos'],
  'SAIDA DE MUTUOS SOCIOS': ['socios', 'Saída de mútuo'],
  'ENTRADA DE MUTUOS SOCIOS': ['socios', 'Entrada de mútuo'],
  'PRO LABORE': ['socios', 'Pró-labore'],
  'DISTRIBUICAO DE LUCROS': ['socios', 'Distribuição de lucros'],
  'ADIANTAMENTO A SOCIOS': ['socios', 'Adiantamento a sócios'],
  'REEMBOLSO A SOCIOS': ['socios', 'Reembolso a sócios'],
  'RETIRADA DE SOCIOS': ['socios', 'Retirada (natureza a conferir)'],
};
export const naturezaPatrimonial = categoria => regras[normalizar(categoria)] || null;
// Ordem fixa das naturezas: chips e legendas não trocam de lugar quando o filtro muda.
const ordemDe = tipo => Object.freeze([...new Set(Object.values(regras).filter(r => r[0] === tipo).map(r => r[1]))]);
export const NATUREZAS_PATRIMONIAIS = Object.freeze({ aplicacoes: ordemDe('aplicacoes'), socios: ordemDe('socios') });
// Sentido natural de cada natureza de aplicação na conta corrente. Movimento no
// sentido contrário (estorno) entra negativo na soma da própria natureza.
export const SENTIDO_APLICACAO = Object.freeze({ Aporte: 'DEBITO', Resgate: 'CREDITO', Rendimento: 'CREDITO', Impostos: 'DEBITO' });
const CAMPO_APLICACAO = { Aporte: 'aportes', Resgate: 'resgates', Rendimento: 'rendimentos', Impostos: 'impostos' };
export const MOTIVOS_PATRIMONIAIS = Object.freeze({
  semCategoria: 'Categoria sem classificação específica; conferir na origem.',
  movimentoInvalido: 'Valor ou direção do movimento inválido.',
  saldoDataInvalida: 'Data do saldo inválida.',
  saldoValorInvalido: 'Valor do saldo inválido.',
  saldoFuturo: 'Data do saldo depois de hoje.',
});
const categoriaTitulo = t => t.categoria?.nome || t.categoria_texto || '';
const centavos = v => Math.round(Math.abs(Number(v)) * 100);
const reais = c => (c || 0) / 100; // (c || 0) evita o -0, que o Intl escreveria "-R$ 0,00"
const dia10 = v => String(v ?? '').slice(0, 10);
const diaLocal = () => new Date().toLocaleDateString('en-CA');
const dentroDaFaixa = d => d >= '1900-01-01' && d <= '2200-12-31';
const proximoMes = mes => { const [a, m] = mes.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`; };
const ordenarMov = (a, b) => a.data_movimento.localeCompare(b.data_movimento) || String(a.id).localeCompare(String(b.id));
const valorValido = v => v != null && v !== '' && Number.isFinite(Number(v));
const sinalAplicacao = m => (m.tipo === SENTIDO_APLICACAO[m.natureza] ? 1 : -1);
// Soma líquida de uma natureza de aplicação, em centavos.
const somaNatureza = (lista, natureza) => lista.reduce((t, m) => (m.natureza === natureza ? t + sinalAplicacao(m) * centavos(m.valor) : t), 0);
const resumoValores = lista => ({ quantidade: lista.length, total: reais(lista.reduce((t, m) => t + centavos(m.valor), 0)) });

// Um item por mês, do primeiro movimento (ou do primeiro saldo informado, que a
// tela desenha como ponto) até o mês de hoje, ou até o último movimento se houver
// algum datado depois de hoje: nada é descartado calado. Mês sem movimento entra
// com zeros: a base cobre aquele mês, então o zero foi medido.
function montarEvolucao(lista, tipo, mesHoje, mesInicioExtra = null) {
  if (!lista.length && !mesInicioExtra) return [];
  const porMes = new Map();
  let primeiro = mesInicioExtra, ultimo = mesInicioExtra;
  for (const m of lista) {
    const mes = dia10(m.data_movimento).slice(0, 7);
    if (!primeiro || mes < primeiro) primeiro = mes;
    if (!ultimo || mes > ultimo) ultimo = mes;
    const s = porMes.get(mes) || { aportes: 0, resgates: 0, rendimentos: 0, impostos: 0, saidas: 0, entradas: 0, registros: 0 };
    if (tipo === 'aplicacoes') s[CAMPO_APLICACAO[m.natureza]] += sinalAplicacao(m) * centavos(m.valor);
    else s[m.tipo === 'CREDITO' ? 'entradas' : 'saidas'] += centavos(m.valor);
    s.registros++;
    porMes.set(mes, s);
  }
  // Sem aporte nem resgate reconhecido, não existe capital para desenhar: null, nunca R$ 0,00.
  const temCapital = tipo === 'aplicacoes' && lista.some(m => m.natureza === 'Aporte' || m.natureza === 'Resgate');
  const fim = ultimo > mesHoje ? ultimo : mesHoje, saida = [];
  let acumulado = 0;
  for (let mes = primeiro; mes <= fim; mes = proximoMes(mes)) {
    const s = porMes.get(mes) || { aportes: 0, resgates: 0, rendimentos: 0, impostos: 0, saidas: 0, entradas: 0, registros: 0 };
    if (tipo === 'aplicacoes') {
      acumulado += s.aportes - s.resgates;
      saida.push({ mes, aportes: reais(s.aportes), resgates: reais(s.resgates), rendimentos: reais(s.rendimentos), impostos: reais(s.impostos), capital: temCapital ? reais(acumulado) : null, registros: s.registros });
    } else {
      const liquido = s.saidas - s.entradas;
      acumulado += liquido;
      saida.push({ mes, saidas: reais(s.saidas), entradas: reais(s.entradas), liquido: reais(liquido), acumulado: reais(acumulado), registros: s.registros });
    }
  }
  return saida;
}

export function montarPatrimonial({ tipo, movimentos = [], despesas = [], recebimentos = [], empresa = '', conta = '', pessoa = '', de, ate, saldosInformados = [], hoje = diaLocal() }) {
  if (!['socios','aplicacoes'].includes(tipo) || !periodoValido(de, ate)) throw new Error('Informe um período válido.');
  const aplicacoes = tipo === 'aplicacoes';
  const dia = dataValida(hoje) ? dia10(hoje) : diaLocal();
  const titulos = new Map([...(despesas || []), ...(recebimentos || [])].map(t => [t.id,t]));
  const escopo = r => (!empresa || r.empresa_id === empresa) && (!conta || r.conta_bancaria_id === conta);
  const dentroDoPeriodo = data => dataValida(data) && dia10(data) >= de && dia10(data) <= ate;
  const noPeriodoMov = m => dentroDoPeriodo(m.data_movimento);
  // Classifica o histórico inteiro; o período só recorta depois. Evolução e saldo
  // precisam de todas as datas. Nas aplicações entram também movimentos fora do
  // escopo, para provar se um saldo informado em outro escopo vale aqui.
  const reconhecidosBase = [], candidatosEscopo = [], suspeitosBase = [];
  let baseDesde = null; // primeiro movimento do escopo, de qualquer categoria: desde quando a base mede
  for (const m of movimentos || []) {
    if (!m || !dataValida(m.data_movimento) || !dentroDaFaixa(dia10(m.data_movimento))) continue;
    const noEscopo = escopo(m);
    if (noEscopo && (!baseDesde || dia10(m.data_movimento) < baseDesde)) baseDesde = dia10(m.data_movimento);
    if (!noEscopo && !aplicacoes) continue;
    const vinculados = (m.conciliacoes || []).map(c => titulos.get(c.despesa_id || c.recebimento_id)).filter(Boolean);
    const nomes = [...new Set(vinculados.map(categoriaTitulo).filter(Boolean))];
    const vinculoCompleto = vinculados.length > 0 && vinculados.length === (m.conciliacoes || []).length && vinculados.every(t=>categoriaTitulo(t)) && Math.abs((m.conciliacoes || []).reduce((s,c)=>s+centavos(c.valor_conciliado || 0),0)-centavos(m.valor)) <= 1;
    const categoria = m.dados_omie?.cDesCategoria || m.categoria?.nome || (nomes.length === 1 && vinculoCompleto ? nomes[0] : '');
    const regra = naturezaPatrimonial(categoria);
    // A observação da Omie (cObservacoes) só ajuda a SUSPEITAR: a descrição do
    // movimento é o favorecido (ex.: o próprio banco) e escondia "resgate" na observação.
    const suspeita = normalizar([categoria,m.descricao,m.dados_omie?.cObservacoes,...nomes].join(' '));
    const candidato = tipo === 'socios' ? /SOCIO|MUTUO|PRO LABORE|DISTRIBUICAO DE LUCRO/.test(suspeita) : /APLICAC|RESGATE|RENDIMENTO/.test(suspeita);
    if (!regra || regra[0] !== tipo) { if (candidato && noEscopo) candidatosEscopo.push({...m,motivo:MOTIVOS_PATRIMONIAIS.semCategoria}); if (candidato && aplicacoes) suspeitosBase.push(m); continue; }
    if (!['CREDITO','DEBITO'].includes(m.tipo) || !valorValido(m.valor)) { if (noEscopo) candidatosEscopo.push({...m,motivo:MOTIVOS_PATRIMONIAIS.movimentoInvalido}); continue; }
    const nomesPessoas = [...new Set(vinculados.map(t => t.fornecedor || t.cliente).filter(Boolean))];
    const pessoaNome = m.dados_omie?.cRazCliente || m.dados_omie?.cDesCliente || (nomesPessoas.length === 1 ? nomesPessoas[0] : '') || 'Não identificado na origem';
    const pessoaId = `${m.empresa_id || ''}|${m.dados_omie?.nCodCliente || normalizar(pessoaNome)}`;
    reconhecidosBase.push({ ...m, categoria, natureza: regra[1], pessoa: pessoaNome, pessoaId, valor: centavos(m.valor)/100 });
  }
  const reconhecidos = reconhecidosBase.filter(escopo);
  const reconhecidosPeriodo = reconhecidos.filter(noPeriodoMov);
  const candidatos = candidatosEscopo.filter(noPeriodoMov);
  const pessoas = [...new Map(reconhecidosPeriodo.map(m => [m.pessoaId, {id:m.pessoaId,nome:m.pessoa,empresa:m.empresa?.nome || ''}])).values()].sort((a,b)=>a.nome.localeCompare(b.nome));
  const itens = reconhecidosPeriodo.filter(m => !pessoa || m.pessoaId === pessoa).sort(ordenarMov);
  const historico = reconhecidos.filter(m => !pessoa || m.pessoaId === pessoa).sort(ordenarMov);
  const meses = new Map(), porPessoa = new Map(), porNatureza = new Map();
  const somar = (mapa,chave,m) => { const r = mapa.get(chave) || {nome:chave,entradas:0,saidas:0,registros:0}; r[m.tipo === 'CREDITO' ? 'entradas':'saidas'] += centavos(m.valor); r.registros++; mapa.set(chave,r); };
  for (const m of itens) { somar(meses,m.data_movimento.slice(0,7),m); somar(porNatureza,m.natureza,m); somar(porPessoa,m.pessoaId,m); }
  const valores = mapa => [...mapa.values()].map(r=>({...r,entradas:r.entradas/100,saidas:r.saidas/100,quantidade:r.registros}));
  const somas = itens.reduce((s,m)=>{s[m.tipo === 'CREDITO'?'entradas':'saidas']+=centavos(m.valor);return s;},{entradas:0,saidas:0});
  const pendentes = [...(despesas || []),...(recebimentos || [])].filter(t => escopo(t) && !['CANCELADO','CANCELADA'].includes(t.status) && naturezaPatrimonial(categoriaTitulo(t))?.[0]===tipo && Number(t.valor_pendente)>0 && dentroDoPeriodo(t.data_vencimento || t.data_lancamento));
  const naturezas = valores(porNatureza);

  // Chips. Natureza: período + empresa/conta/sócio, na ordem fixa. Sócio: período +
  // empresa/conta, IGNORANDO o filtro de sócio (senão o chip clicado apagaria os outros).
  const ordem = NATUREZAS_PATRIMONIAIS[tipo];
  const chipsNaturezas = [...naturezas].sort((a,b)=>(ordem.indexOf(a.nome)+1 || 99)-(ordem.indexOf(b.nome)+1 || 99)).map(n=>({nome:n.nome,quantidade:n.registros,entradas:n.entradas,saidas:n.saidas}));
  const porPessoaPeriodo = new Map();
  for (const m of reconhecidosPeriodo) somar(porPessoaPeriodo, m.pessoaId, m);
  const chipsPessoas = [...porPessoaPeriodo.entries()].map(([id,r])=>{const p = pessoas.find(x=>x.id===id);return {id,nome:p?.nome || '',empresa:p?.empresa || '',quantidade:r.registros,entradas:reais(r.entradas),saidas:reais(r.saidas),ativo:id===pessoa};}).sort((a,b)=>(b.saidas+b.entradas)-(a.saidas+a.entradas) || a.nome.localeCompare(b.nome));
  if (pessoa && !chipsPessoas.some(p => p.id === pessoa)) {
    const ultimoDaPessoa = historico[historico.length - 1];
    if (ultimoDaPessoa) chipsPessoas.push({id:pessoa,nome:ultimoDaPessoa.pessoa,empresa:ultimoDaPessoa.empresa?.nome || '',quantidade:0,entradas:0,saidas:0,ativo:true});
  }

  let saldo = null, capitalAportado = null, possiveisResgates = null, escopoSaldo = null;
  const saldosValidos = [], saldosIgnorados = [];
  if (aplicacoes) {
    escopoSaldo = { empresa_id: empresa, conta_bancaria_id: conta };
    // Posição de HOJE: movimento com data depois de hoje fica na evolução, mas não no capital.
    const historicoAteHoje = historico.filter(m => dia10(m.data_movimento) <= dia);
    if (historicoAteHoje.some(m => m.natureza === 'Aporte' || m.natureza === 'Resgate')) capitalAportado = reais(somaNatureza(historicoAteHoje, 'Aporte') - somaNatureza(historicoAteHoje, 'Resgate'));
    // Créditos sem categoria que parecem aplicação: prováveis resgates. Ficam FORA
    // dos totais e do capital; o escopo é empresa/conta (candidato não tem favorecido).
    const creditosSuspeitos = candidatosEscopo.filter(m => m.tipo === 'CREDITO' && valorValido(m.valor)).sort(ordenarMov);
    possiveisResgates = { ...resumoValores(creditosSuspeitos), primeiraData: creditosSuspeitos.length ? dia10(creditosSuspeitos[0].data_movimento) : null, ultimaData: creditosSuspeitos.length ? dia10(creditosSuspeitos[creditosSuspeitos.length - 1].data_movimento) : null, noPeriodo: resumoValores(creditosSuspeitos.filter(noPeriodoMov)), itens: creditosSuspeitos };
    // Saldo informado vale na visão do MESMO escopo (empresa, conta, sem filtro de
    // favorecido) ou de escopo com exatamente as mesmas aplicações reconhecidas. Saldo
    // consolidado não vira saldo de uma conta sem aplicação: seria número falso.
    const conjuntoVista = new Set(historico);
    const origemDoSaldo = (e, c) => {
      // A conta, quando informada, já diz a empresa: saldo gravado com a conta vale em qualquer
      // vista daquela conta. Sem conta, vale a empresa (vazia = consolidado de todas).
      const mesmaVista = c ? c === conta : !conta && e === empresa;
      if (mesmaVista && !pessoa) return 'exato';
      if (empresa && !c && e !== empresa) return null; // consolidado de outra empresa: a base recebida cobre só a filtrada
      const doEscopoDoSaldo = m => (!e || m.empresa_id === e) && (!c || m.conta_bancaria_id === c);
      // Crédito sem categoria que parece aplicação, dentro do escopo do saldo e fora desta vista,
      // pode ser outra aplicação que o saldo inclui: aí não se prova que é o mesmo dinheiro.
      if (suspeitosBase.some(m => doEscopoDoSaldo(m) && !escopo(m))) return null;
      const doRegistro = reconhecidosBase.filter(doEscopoDoSaldo);
      return doRegistro.length > 0 && doRegistro.length === conjuntoVista.size && doRegistro.every(m => conjuntoVista.has(m)) ? 'equivalente' : null;
    };
    for (const s of saldosInformados || []) {
      if (!s || typeof s !== 'object') continue;
      const e = String(s.empresa_id || ''), c = String(s.conta_bancaria_id || '');
      const origem = origemDoSaldo(e, c);
      if (!origem) continue;
      const data = dia10(s.data), bruto = { id: s.id ?? null, data: s.data ?? null, valor: s.valor ?? null };
      const valor = typeof s.valor === 'number' ? s.valor : typeof s.valor === 'string' && s.valor.trim() !== '' ? Number(s.valor) : NaN;
      if (!dataValida(data) || !dentroDaFaixa(data)) { saldosIgnorados.push({ ...bruto, motivo: MOTIVOS_PATRIMONIAIS.saldoDataInvalida }); continue; }
      if (!Number.isFinite(valor) || valor < 0) { saldosIgnorados.push({ ...bruto, motivo: MOTIVOS_PATRIMONIAIS.saldoValorInvalido }); continue; }
      if (data > dia) { saldosIgnorados.push({ ...bruto, motivo: MOTIVOS_PATRIMONIAIS.saldoFuturo }); continue; }
      saldosValidos.push({ id: s.id ?? null, data, valor: (Math.round(valor * 100) || 0) / 100, observacao: String(s.observacao ?? ''), atualizadoPor: String(s.atualizadoPor ?? ''), atualizadoEm: String(s.atualizadoEm ?? ''), empresa_id: e, conta_bancaria_id: c, mes: data.slice(0, 7), origem });
    }
    // Na mesma data, o saldo EXATO do recorte ganha do equivalente (fica por último = vale).
    const pesoOrigem = s => (s.origem === 'exato' ? 1 : 0);
    saldosValidos.sort((a, b) => a.data.localeCompare(b.data) || pesoOrigem(a) - pesoOrigem(b) || a.atualizadoEm.localeCompare(b.atualizadoEm) || String(a.id ?? '').localeCompare(String(b.id ?? '')));
    const ultimo = saldosValidos[saldosValidos.length - 1];
    if (ultimo) {
      // O saldo do extrato fecha o dia: movimento do mesmo dia já está nele.
      const depois = m => { const d = dia10(m.data_movimento); return d > ultimo.data && d <= dia; };
      const janela = historico.filter(depois);
      const aportes = somaNatureza(janela, 'Aporte'), resgates = somaNatureza(janela, 'Resgate');
      const { mes: _mes, origem, ...informado } = ultimo;
      /* A estimativa é um PISO: o rendimento que acontece dentro da aplicação só aparece
         no próximo extrato. Resgatar tudo (principal mais rendimento) depois do extrato deixa
         a conta abaixo de zero, e isso não é saldo: estimadoHoje vira null e a tela pede um
         extrato mais recente. */
      const bruto = Math.round(ultimo.valor * 100) + aportes - resgates;
      saldo = { informado, origem, hoje: dia, aportesDepois: reais(aportes), resgatesDepois: reais(resgates), movimentosDepois: janela.filter(m => m.natureza === 'Aporte' || m.natureza === 'Resgate').length, estimadoHoje: bruto < 0 ? null : reais(bruto), estimadoBruto: reais(bruto), abaixoDeZero: bruto < 0, anteriorABase: !!baseDesde && ultimo.data < baseDesde, possiveisResgatesDepois: resumoValores(creditosSuspeitos.filter(depois)) };
    }
  }
  // Ponto de saldo antes do primeiro movimento estica o começo da evolução, mas nunca
  // para antes do início da base: ali o zero não teria sido medido.
  const mesBase = baseDesde ? baseDesde.slice(0, 7) : null;
  const mesesDeSaldo = mesBase ? saldosValidos.map(s => s.mes).filter(mes => mes >= mesBase) : [];
  const evolucao = montarEvolucao(historico, tipo, dia.slice(0, 7), mesesDeSaldo.length ? mesesDeSaldo.reduce((a, b) => (b < a ? b : a)) : null);
  return { tipo,de,ate,itens,pessoas,candidatos: pessoa ? [] : candidatos,pendentes: pessoa ? [] : pendentes,entradas:somas.entradas/100,saidas:somas.saidas/100,meses:valores(meses),naturezas,porPessoa:valores(porPessoa).map(p=>({...p,...pessoas.find(x=>x.id===p.nome)})),saldoAplicado:null,
    hoje: dia, baseDesde, noPeriodo: { de, ate, mesDe: de.slice(0, 7), mesAte: ate.slice(0, 7) }, evolucao, saldo, saldosInformados: saldosValidos, saldosIgnorados, escopoSaldo, capitalAportado, possiveisResgates, chips: { naturezas: chipsNaturezas, pessoas: chipsPessoas } };
}
