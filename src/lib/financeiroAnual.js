export function periodoAnual(ano, mes = 0) {
  const a = Number(ano), m = Number(mes);
  if (!Number.isInteger(a) || a < 1900 || a > 2200 || !Number.isInteger(m) || m < 0 || m > 12) throw new Error('Ano ou mês inválido.');
  if (!m) return { de: `${a}-01-01`, ate: `${a}-12-31` };
  const mm = String(m).padStart(2,'0');
  const ultimo = new Date(Date.UTC(a,m,0)).getUTCDate();
  return { de: `${a}-${mm}-01`, ate: `${a}-${mm}-${ultimo}` };
}
export function resumoAnual(movimentos, ano, conta = '') {
  const meses=Array.from({length:12},(_,i)=>({mes:i+1,entradas:0,saidas:0,registros:0}));
  for (const m of movimentos) {
    const data=String(m.data_movimento||'').slice(0,10);
    if (!data.startsWith(`${ano}-`) || (conta && m.conta_bancaria_id!==conta)) continue;
    const alvo=meses[Number(data.slice(5,7))-1];
    if (!alvo || !['CREDITO','DEBITO'].includes(m.tipo)) continue;
    const centavos=Math.round(Math.abs(Number(m.valor||0))*100);
    if (!Number.isFinite(centavos)) continue;
    alvo[m.tipo==='CREDITO'?'entradas':'saidas']+=centavos;
    alvo.registros++;
  }
  return meses.map(m=>({...m,entradas:m.entradas/100,saidas:m.saidas/100,liquido:(m.entradas-m.saidas)/100}));
}
