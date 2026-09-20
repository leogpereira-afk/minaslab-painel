export function hojeFinanceiro(data = new Date()) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(data).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
export function liquidoBanco(itens) {
 return itens.reduce((s,x)=>{const tipo=String(x.tipo||'').toUpperCase(),n=Number(x.valor);return !['CREDITO','DEBITO'].includes(tipo)||!Number.isFinite(n)?s:s+(tipo==='CREDITO'?1:-1)*Math.abs(Math.round(n*100));},0)/100;
}
