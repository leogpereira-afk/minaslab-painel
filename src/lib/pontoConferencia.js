import { ausenciaDoDia, apurarCompetencia } from './rh/ponto.js';

// Contagens são de dias por pessoa. Lacuna não vira falta nem hora zero.
export function prepararConferencia(leitura, jornada) {
  const ausencias = leitura.registros.filter(r => ausenciaDoDia(r.d));
  const equipe = leitura.equipe.map(r => {
    const registros = leitura.registros.filter(d => d.p.id === r.p.id);
    const lacunas = leitura.lacunas.filter(d => d.p.id === r.p.id);
    const apurado = apurarCompetencia(registros.map(d => d.d), jornada);
    return { ...r, semDados: lacunas.length, ausencias: ausencias.filter(d => d.p.id === r.p.id).length,
      extrasMin: apurado.extrasMin === null && apurado.extrasDobroMin === null ? null : (apurado.extrasMin || 0) + (apurado.extrasDobroMin || 0),
      primeiroDia: r.primeiroPendente?.data || lacunas[0]?.data || registros[0]?.data };
  }).sort((a,b) => b.pendentes-a.pendentes || b.semDados-a.semDados || a.p.nome.localeCompare(b.p.nome,'pt-BR'));
  return { equipe, ausencias };
}
export function pessoaNoFiltro(r, filtro) {
  return filtro === 'pendentes' ? r.pendentes > 0 : filtro === 'semDados' ? r.semDados > 0 : filtro === 'ausencias' ? r.ausencias > 0 : true;
}
export function registroNoFiltro(leitura, p, data, filtro) {
  if (filtro === 'semDados') return leitura.lacunas.some(r => r.p.id === p.id && r.data === data);
  const r = leitura.registros.find(r => r.p.id === p.id && r.data === data);
  if (filtro === 'pendentes') return r?.pendente === true;
  if (filtro === 'ausencias') return !!r && !!ausenciaDoDia(r.d);
  return true;
}
