import { minutosEntre, minutosTrabalhados, intervaloNaoRegistrado } from './rh/ponto.js';
const numero = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const data = s => new Date(`${s}T12:00:00`);
export function periodoPonto(visao, referencia) {
  const d=data(referencia); if(Number.isNaN(+d)) return null;
  if(visao==='mes') return {de:iso(new Date(d.getFullYear(),d.getMonth(),1)),ate:iso(new Date(d.getFullYear(),d.getMonth()+1,0))};
  if(visao==='semana') {d.setDate(d.getDate()-((d.getDay()+6)%7));const de=iso(d);d.setDate(d.getDate()+6);return {de,ate:iso(d)};}
  return {de:iso(d),ate:iso(d)};
}
export function moverPeriodo(visao, referencia, passo) {
  const d=data(referencia);if(Number.isNaN(+d)) return referencia;
  if(visao==='mes') {const dia=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+passo);d.setDate(Math.min(dia,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}
  else d.setDate(d.getDate()+passo*(visao==='semana'?7:1));
  return iso(d);
}
export function datasPeriodo(p) {
  if(!p) return [];const out=[];const d=data(p.de);
  while(iso(d)<=p.ate && out.length<32){out.push(iso(d));d.setDate(d.getDate()+1);}return out;
}
// Trabalho efetivo exclui TODAS as pausas. Folha do Jibble já inclui as regras
// de remuneração; nunca subtrair novamente o intervalo desse total.
export function composicaoIntervalo(d={}) {
  const registradasMin=numero(d.trackedMin) ?? minutosEntre(d.entrada,d.saida);
  const pausaMin=numero(d.pausaMin);
  const pausaPagaMin=d.pausaPagaMin === undefined ? 0 : numero(d.pausaPagaMin);
  const folhaMin=minutosTrabalhados(d);
  const invalido=pausaMin!==null && (pausaMin<0 || pausaPagaMin<0 || (registradasMin!==null && pausaMin+pausaPagaMin>registradasMin));
  const efetivoMin=d.emAberto===true || invalido || registradasMin===null || pausaMin===null || pausaPagaMin===null ? null : registradasMin-pausaMin-pausaPagaMin;
  const originalJibbleMin=numero(d.trabalhadoMin);
  const diferencaMin=folhaMin===null || originalJibbleMin===null ? null : folhaMin-originalJibbleMin;
  const semIntervalo=intervaloNaoRegistrado(d);
  return {registradasMin,pausaMin,pausaPagaMin,efetivoMin,folhaMin,diferencaMin,originalJibbleMin,semIntervalo,invalido};
}
export function resumirDias(dias) {
  const valores=dias.map(composicaoIntervalo);
  const soma=chave=>{const vs=valores.map(v=>v[chave]).filter(v=>v!==null);return vs.length?vs.reduce((a,b)=>a+b,0):null;};
  return {folhaMin:soma('folhaMin'),pausaMin:soma('pausaMin'),efetivoMin:soma('efetivoMin'),dias:dias.length,divergencias:valores.filter(v=>v.diferencaMin!==null && v.diferencaMin!==0).length,pendentes:valores.filter(v=>v.semIntervalo || v.folhaMin===null || v.efetivoMin===null).length};
}
