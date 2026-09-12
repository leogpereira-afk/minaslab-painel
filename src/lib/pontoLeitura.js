import { ausenciaDoDia, minutosPrevistosDoDia } from './rh/ponto.js';
import { composicaoIntervalo, resumirDias } from './pontoPeriodo.js';

export function situacaoPonto(d, iso, hoje, jornada) {
  if (iso > hoje) return 'Futuro';
  if (d?.emAberto) return 'Em aberto';
  const ausencia = d && ausenciaDoDia(d);
  if (ausencia) return ausencia.rotulo;
  if (!d) return minutosPrevistosDoDia(iso, jornada) === 0 ? 'Sem jornada' : 'Sem dados';
  const c = composicaoIntervalo(d);
  if (c.invalido) return 'Conferir intervalo';
  if (c.semIntervalo) return 'Intervalo não registrado';
  if (c.pausaPagaMin === null) return 'Conferir pausa paga';
  if (c.folhaMin === null) return 'Conferir batidas';
  return 'Registrado';
}

export function leituraPonto({ pessoas, datas, porPessoa, hoje, jornada }) {
  const lacunas = pessoas.flatMap(p => datas.filter(data => data <= hoje && minutosPrevistosDoDia(data, jornada) > 0 && !porPessoa.get(p.id)?.dias.has(data)).map(data => ({p,data})));
  const registros = pessoas.flatMap(p => datas.filter(data => data <= hoje).flatMap(data => {
    const d = porPessoa.get(p.id)?.dias.get(data);
    if (!d) return [];
    const c = composicaoIntervalo(d);
    const pendente = d.emAberto === true || (!ausenciaDoDia(d) && (c.semIntervalo || c.efetivoMin === null || c.folhaMin === null || c.invalido));
    return [{ p, data, d, c, pendente, situacao: situacaoPonto(d, data, hoje, jornada) }];
  }));
  const porDia = datas.map(data => {
    const rs = registros.filter(r => r.data === data);
    return { data, futuro: data > hoje, util: minutosPrevistosDoDia(data, jornada) > 0, registros: rs.length, ...resumirDias(rs.map(r => r.d)), pendentes: rs.filter(r => r.pendente).length, parcial: rs.some(r => r.pendente) || lacunas.some(r => r.data === data) };
  });
  const equipe = pessoas.map(p => {
    const rs = registros.filter(r => r.p.id === p.id);
    return { p, registros: rs.length, ...resumirDias(rs.map(r => r.d)), pendentes: rs.filter(r => r.pendente).length, primeiroPendente: rs.find(r => r.pendente) };
  });
  return {
    registros, porDia, equipe, lacunas,
    resumo: resumirDias(registros.map(r => r.d)),
    pendentes: registros.filter(r => r.pendente),
    divergencias: registros.filter(r => r.c.diferencaMin !== null && r.c.diferencaMin !== 0),
    diasComDados: porDia.filter(d => d.registros > 0).length,
    diasUteisSemDados: porDia.filter(d => !d.futuro && d.util && d.registros === 0),
    escalaDia: Math.max(60, ...porDia.map(d => d.folhaMin ?? 0)),
    escalaPessoa: Math.max(60, ...equipe.map(p => p.folhaMin ?? 0)),
  };
}
