import { dataValida, periodoValido } from './relatorioFinanceiro.js';
const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
// Somente categorias explícitas. Descrições livres nunca comprovam a natureza.
const regras = {
  'APLICACOES REALIZADAS': ['aplicacoes', 'Aporte'],
  'RESGATE DE TITULOS': ['aplicacoes', 'Resgate'],
  'RESGATE DE APLICACOES': ['aplicacoes', 'Resgate'],
  'RENDIMENTO SOBRE APLICACOES IMEDIATAS': ['aplicacoes', 'Rendimento'],
  'IMPOSTOS SOBRE APLICACOES FINANCEIRAS IMEDIATAS': ['aplicacoes', 'Impostos'],
  'SAIDA DE MUTUOS SOCIOS': ['socios', 'Mútuo — saída'],
  'ENTRADA DE MUTUOS SOCIOS': ['socios', 'Mútuo — entrada'],
  'PRO LABORE': ['socios', 'Pró-labore'],
  'DISTRIBUICAO DE LUCROS': ['socios', 'Distribuição de lucros'],
  'ADIANTAMENTO A SOCIOS': ['socios', 'Adiantamento a sócios'],
  'REEMBOLSO A SOCIOS': ['socios', 'Reembolso a sócios'],
  'RETIRADA DE SOCIOS': ['socios', 'Retirada — natureza a conferir'],
};
export const naturezaPatrimonial = categoria => regras[normalizar(categoria)] || null;
const categoriaTitulo = t => t.categoria?.nome || t.categoria_texto || '';
const centavos = v => Math.round(Math.abs(Number(v)) * 100);
export function montarPatrimonial({ tipo, movimentos = [], despesas = [], recebimentos = [], empresa = '', conta = '', pessoa = '', de, ate }) {
  if (!['socios','aplicacoes'].includes(tipo) || !periodoValido(de, ate)) throw new Error('Informe um período válido.');
  const titulos = new Map([...despesas, ...recebimentos].map(t => [t.id,t]));
  const escopo = r => (!empresa || r.empresa_id === empresa) && (!conta || r.conta_bancaria_id === conta);
  const noPeriodo = data => dataValida(data) && String(data).slice(0,10) >= de && String(data).slice(0,10) <= ate;
  const candidatos = [], reconhecidos = [];
  for (const m of movimentos) {
    if (!escopo(m) || !noPeriodo(m.data_movimento)) continue;
    const vinculados = (m.conciliacoes || []).map(c => titulos.get(c.despesa_id || c.recebimento_id)).filter(Boolean);
    const nomes = [...new Set(vinculados.map(categoriaTitulo).filter(Boolean))];
    const vinculoCompleto = vinculados.length > 0 && vinculados.length === (m.conciliacoes || []).length && vinculados.every(t=>categoriaTitulo(t)) && Math.abs((m.conciliacoes || []).reduce((s,c)=>s+centavos(c.valor_conciliado || 0),0)-centavos(m.valor)) <= 1;
    const categoria = m.dados_omie?.cDesCategoria || m.categoria?.nome || (nomes.length === 1 && vinculoCompleto ? nomes[0] : '');
    const regra = naturezaPatrimonial(categoria);
    const suspeita = normalizar([categoria,m.descricao,...nomes].join(' '));
    const candidato = tipo === 'socios' ? /SOCIO|MUTUO|PRO LABORE|DISTRIBUICAO DE LUCRO/.test(suspeita) : /APLICAC|RESGATE|RENDIMENTO/.test(suspeita);
    if (!regra || regra[0] !== tipo) { if (candidato) candidatos.push({...m,motivo:'Categoria sem classificação específica; conferir na origem.'}); continue; }
    if (!['CREDITO','DEBITO'].includes(m.tipo) || m.valor == null || m.valor === '' || !Number.isFinite(Number(m.valor))) { candidatos.push({...m,motivo:'Valor ou direção do movimento inválido.'}); continue; }
    const nomesPessoas = [...new Set(vinculados.map(t => t.fornecedor || t.cliente).filter(Boolean))];
    const pessoaNome = m.dados_omie?.cRazCliente || m.dados_omie?.cDesCliente || (nomesPessoas.length === 1 ? nomesPessoas[0] : '') || 'Não identificado na origem';
    const pessoaId = `${m.empresa_id || ''}|${m.dados_omie?.nCodCliente || normalizar(pessoaNome)}`;
    reconhecidos.push({ ...m, categoria, natureza: regra[1], pessoa: pessoaNome, pessoaId, valor: centavos(m.valor)/100 });
  }
  const pessoas = [...new Map(reconhecidos.map(m => [m.pessoaId, {id:m.pessoaId,nome:m.pessoa,empresa:m.empresa?.nome || ''}])).values()].sort((a,b)=>a.nome.localeCompare(b.nome));
  const itens = reconhecidos.filter(m => !pessoa || m.pessoaId === pessoa).sort((a,b)=>a.data_movimento.localeCompare(b.data_movimento)||String(a.id).localeCompare(String(b.id)));
  const meses = new Map(), porPessoa = new Map(), porNatureza = new Map();
  const somar = (mapa,chave,m) => { const r = mapa.get(chave) || {nome:chave,entradas:0,saidas:0,registros:0}; r[m.tipo === 'CREDITO' ? 'entradas':'saidas'] += centavos(m.valor); r.registros++; mapa.set(chave,r); };
  for (const m of itens) { somar(meses,m.data_movimento.slice(0,7),m); somar(porNatureza,m.natureza,m); somar(porPessoa,m.pessoaId,m); }
  const valores = mapa => [...mapa.values()].map(r=>({...r,entradas:r.entradas/100,saidas:r.saidas/100}));
  const somas = itens.reduce((s,m)=>{s[m.tipo === 'CREDITO'?'entradas':'saidas']+=centavos(m.valor);return s;},{entradas:0,saidas:0});
  const pendentes = [...despesas,...recebimentos].filter(t => escopo(t) && !['CANCELADO','CANCELADA'].includes(t.status) && naturezaPatrimonial(categoriaTitulo(t))?.[0]===tipo && Number(t.valor_pendente)>0 && noPeriodo(t.data_vencimento || t.data_lancamento));
  return { tipo,de,ate,itens,pessoas,candidatos: pessoa ? [] : candidatos,pendentes: pessoa ? [] : pendentes,entradas:somas.entradas/100,saidas:somas.saidas/100,meses:valores(meses),naturezas:valores(porNatureza),porPessoa:valores(porPessoa).map(p=>({...p,...pessoas.find(x=>x.id===p.nome)})),saldoAplicado:null };
}
