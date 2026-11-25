// Data de hoje em São Paulo: uma regra só, em tituloVencido.js.
export { hojeSaoPaulo as hojeFinanceiro } from './tituloVencido.js';
export function liquidoBanco(itens) {
 return itens.reduce((s,x)=>{const tipo=String(x.tipo||'').toUpperCase(),n=Number(x.valor);return !['CREDITO','DEBITO'].includes(tipo)||!Number.isFinite(n)?s:s+(tipo==='CREDITO'?1:-1)*Math.abs(Math.round(n*100));},0)/100;
}
