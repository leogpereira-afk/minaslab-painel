import { useState } from 'react';
import { ArrowUpRight, RefreshCw, Link2, ExternalLink, BarChart3 } from 'lucide-react';
import { Card, Empty, StatCard, SectionTitle, Modal } from '../ui.jsx';
import { CANAIS_MARKETING, ROTULOS_METRICAS as ROTULOS, TABELAS_MARKETING, STATUS_MARKETING, formatarMetrica, horaMarketing, periodoMarketing, periodoDaFonte, provedorDoCanal, dataMarketing } from '../../lib/marketing.mjs';

const LOGOS = { ga4: 'googleanalytics.svg', search: 'google.png', perfil: 'perfil.png', instagram: 'instagram.svg', google_ads: 'googleads.png', meta_ads: 'meta.svg' };
const CENTRAL = 'https://leogpereira-afk.github.io/vida-leo/?mkt=minaslab#marketing';

export function EstadoFonte({ fonte }) {
  const texto = fonte?.atrasado ? 'Leitura há mais de 48 h' : STATUS_MARKETING[fonte?.estado] || 'Aguardando leitura';
  return <span className={fonte?.estado === 'ok' && !fonte?.atrasado ? 'chip-ok' : 'chip'}>{texto}</span>;
}
function Identidade({ canal }) {

  return <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white"><img src={`${import.meta.env.BASE_URL}marketing/logos/${LOGOS[canal.id]}`} alt="" className="h-8 w-8 object-contain" /></span><div><h3 className="font-display font-semibold text-slate-900">{canal.nome}</h3><p className="text-xs text-slate-500">{canal.origem}</p></div></div>;
}
export function ResumoMarketing({ dados, abrirCanal, abrirConexoes }) {
  const fontes = dados?.fontes || [];
  const confirmadas = fontes.filter(f => ['ok', 'parcial'].includes(f.estado)).length;
  return <div className="space-y-4">
    <Card className="flex flex-wrap items-center justify-between gap-3 !py-3">
      <div><h2 className="font-display font-semibold">Presença digital da MinasLab</h2><p className="mt-1 text-sm text-slate-500">{confirmadas} de 6 canais com leitura disponível. Abra um canal para ver os detalhes.</p></div>
      <button className="btn-outline" onClick={abrirConexoes}><Link2 size={16} /> Ver conexões</button>
    </Card>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {CANAIS_MARKETING.map(canal => {
        const fonte = fontes.find(f => f.id === canal.id), periodo = periodoDaFonte(fonte);
        return <Card key={canal.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><button type="button" className="rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" onClick={() => abrirCanal(canal.id)} aria-label={`Abrir ${canal.nome}`}><Identidade canal={canal} /></button><EstadoFonte fonte={fonte} /></div>
          <div><p className="text-xs font-medium text-slate-500">{ROTULOS[canal.principal]}</p><p className="mt-1 font-display text-3xl font-semibold tnum text-slate-900">{formatarMetrica(canal.principal, periodo?.metricas?.[canal.principal], fonte?.moeda)}</p><p className="mt-1 text-xs text-slate-500">{periodoMarketing(periodo)}</p></div>
          <div className="mt-auto flex items-end justify-between gap-3 border-t pt-3"><p className="text-xs text-slate-500">Coleta<br />{horaMarketing(fonte?.coletadoEm)}</p><button className="btn-ghost shrink-0" onClick={() => abrirCanal(canal.id)} aria-label={`Ver detalhes de ${canal.nome}`}>Detalhes <ArrowUpRight size={16} /></button></div>
        </Card>;
      })}
    </div>
    <p className="text-xs leading-relaxed text-slate-500">Cada canal mantém seu próprio período e fonte. “—” indica dado não informado. Os números de plataformas diferentes não são somados.</p>
  </div>;
}
function Tabela({ titulo, linhas, moeda, primeira = 'nome' }) {
  if (!linhas?.length) return null;
  const colunas = Object.keys(linhas[0]).filter(k => k !== primeira && linhas.some(l => typeof l[k] === 'number'));
  if (!colunas.length) return null;
  return <details className="card overflow-hidden"><summary className="cursor-pointer p-4 font-display font-semibold">{titulo} <span className="ml-2 text-xs font-normal text-slate-500">{linhas.length} registros disponíveis</span></summary><div className="overflow-x-auto border-t"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th scope="col" className="p-3">{primeira === 'dia' ? 'Data' : 'Nome'}</th>{colunas.map(k => <th scope="col" className="whitespace-nowrap p-3 text-right" key={k}>{ROTULOS[k] || k}</th>)}</tr></thead><tbody>{linhas.map((linha, i) => <tr key={i} className="border-t"><th scope="row" className="max-w-xs break-words p-3 text-left font-normal">{primeira === 'dia' ? dataMarketing(linha.dia) : linha.nome}</th>{colunas.map(k => <td key={k} className="whitespace-nowrap p-3 text-right tnum">{formatarMetrica(k, linha[k], moeda)}</td>)}</tr>)}</tbody></table></div></details>;
}
export function DetalheCanal({ canalId, dados, ocupado, coletar, abrirConexoes }) {
  const [periodoId, setPeriodoId] = useState('');
  const canal = CANAIS_MARKETING.find(c => c.id === canalId) || CANAIS_MARKETING[0];
  const fonte = dados?.fontes?.find(f => f.id === canal.id), periodo = periodoDaFonte(fonte, periodoId);
  const chaves = Object.keys(periodo?.metricas || {}), extras = chaves.filter(k => !canal.destaque.includes(k));
  const faltantes = chaves.filter(k => typeof periodo?.metricas?.[k] !== 'number');
  const vinculo = dados?.conexoes?.fontes?.[canal.id];
  const autorizado = dados?.conexoes?.provedores?.[provedorDoCanal(canal.id)]?.autorizado;
  const serie = (periodo?.serie || []).filter(row => typeof row[canal.principal] === 'number');
  const maximo = Math.max(1, ...serie.map(row => row[canal.principal]));
  return <div className="space-y-4">
    <Card><div className="flex flex-wrap items-center justify-between gap-3"><Identidade canal={canal} /><EstadoFonte fonte={fonte} /></div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-slate-600">{fonte?.identidade || 'Conta ainda não validada'}</p><p className="mt-1 text-xs text-slate-500">Coletado em {horaMarketing(fonte?.coletadoEm)}</p></div>
        <div className="flex flex-wrap items-end gap-2">{fonte?.periodos?.length > 1 ? <label className="text-xs text-slate-500">Período<select className="input mt-1" value={periodo?.id || ''} onChange={e => setPeriodoId(e.target.value)}>{fonte.periodos.map(p => <option key={p.id} value={p.id}>{periodoMarketing(p)}</option>)}</select></label> : <span className="py-2 text-xs text-slate-500">{periodoMarketing(periodo)}</span>}
          <button className="btn-primary" disabled={ocupado || !vinculo?.ativo || !autorizado} onClick={() => coletar(canal.id)}><RefreshCw size={16} /> {ocupado === canal.id ? 'Coletando…' : 'Coletar indicadores'}</button></div>
      </div>
    </Card>
    {!periodo ? <Empty><p>Não há indicadores confirmados para este canal.</p><button className="btn-outline mt-3" onClick={abrirConexoes}>Conferir conexão</button></Empty> : <>
      {!periodo.completo && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O período ainda não está completo. Os valores podem mudar.</p>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{canal.destaque.map(k => <StatCard key={k} rotulo={ROTULOS[k]} valor={formatarMetrica(k, periodo.metricas[k], fonte.moeda)} sub={periodo.metricas[k] == null ? 'Não informado pela fonte' : periodoMarketing(periodo)} />)}</div>
      <p className="text-xs leading-relaxed text-slate-500">{canal.nota}</p>
      {extras.some(k => periodo.metricas[k] != null) && <details className="card"><summary className="cursor-pointer p-4 font-display font-semibold">Mais indicadores</summary><dl className="grid gap-4 border-t p-4 sm:grid-cols-2 xl:grid-cols-4">{extras.filter(k => periodo.metricas[k] != null).map(k => <div key={k}><dt className="text-xs text-slate-500">{ROTULOS[k] || k}</dt><dd className="mt-1 font-display text-lg font-semibold tnum">{formatarMetrica(k, periodo.metricas[k], fonte.moeda)}</dd></div>)}</dl></details>}
      {serie.length > 1 && <Card><SectionTitle titulo="Evolução diária" sub={ROTULOS[canal.principal]} /><div className="flex h-36 items-end gap-1" role="img" aria-label={`Evolução diária de ${ROTULOS[canal.principal]}; valores na tabela abaixo.`}>{serie.map(row => <div key={row.dia} className="flex h-full min-w-0 flex-1 items-end" title={`${dataMarketing(row.dia)}: ${formatarMetrica(canal.principal, row[canal.principal], fonte.moeda)}`}><div className="w-full rounded-t bg-brand/80" style={{ height: `${row[canal.principal] / maximo * 100}%`, minHeight: row[canal.principal] > 0 ? 2 : 0 }} /></div>)}</div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{dataMarketing(serie[0].dia)}</span><span>{dataMarketing(serie.at(-1).dia)}</span></div></Card>}
      <Tabela titulo="Valores por dia" linhas={periodo.serie} moeda={fonte.moeda} primeira="dia" />
      {Object.entries(periodo.tabelas || {}).map(([nome, linhas]) => <Tabela key={nome} titulo={TABELAS_MARKETING[nome] || nome} linhas={linhas} moeda={fonte.moeda} />)}
      <details className="card"><summary className="cursor-pointer p-4 text-sm font-medium">Cobertura desta leitura</summary><div className="space-y-2 border-t p-4 text-xs leading-relaxed text-slate-500"><p>Os detalhamentos exibidos são os que a fonte retornou nesta coleta; uma tabela vazia não significa resultado zero.</p>{fonte.avisos?.map(aviso => <p key={aviso}>{aviso}</p>)}{faltantes.length > 0 && <p>Não informados nesta leitura: {faltantes.map(k => ROTULOS[k] || k).join(', ')}.</p>}</div></details>
    </>}
  </div>;
}
export function ConexoesMarketing({ dados, ocupado, coletar, listar, selecionar, lista, fecharLista, erro }) {
  const [ativo, setAtivo] = useState('');
  const provedores = dados?.conexoes?.provedores || {}, fontes = dados?.conexoes?.fontes || {};
  return <div className="space-y-4">
    <div className="grid gap-3 lg:grid-cols-3">{[['google', 'Google', 'Site, busca e Perfil da Empresa'], ['meta', 'Meta', 'Instagram e anúncios'], ['google_ads', 'Google Ads', 'Relatórios de anúncios']].map(([id, titulo, descricao]) => {
      const status = provedores[id];
      return <Card key={id}><div className="flex flex-wrap justify-between gap-2"><h2 className="font-display font-semibold">{titulo}</h2><span className={status?.autorizado ? 'chip-ok' : 'chip'}>{status?.autorizado ? 'Autorizado' : 'Pendente'}</span></div><p className="mt-2 text-sm text-slate-500">{descricao}</p><p className="mt-2 text-xs text-slate-500">{status?.autorizado ? 'Autorização existente. Cada coleta confirma o acesso ao canal.' : status?.configurado ? 'É necessário autorizar o acesso.' : 'Conexão ainda não configurada.'}</p><a className="btn-outline mt-4" href={CENTRAL} target="_blank" rel="noreferrer">Gerenciar autorização <ExternalLink size={14} /></a></Card>;
    })}</div>
    <p className="text-xs leading-relaxed text-slate-500">A autorização de Google e Meta continua na Central do Léo, em uma nova aba. As contas vinculadas, os indicadores e as coletas são gerenciados aqui. Depois de autorizar, use “Atualizar leitura”.</p>
    <div className="grid gap-3 md:grid-cols-2">{CANAIS_MARKETING.map(canal => {
      const status = fontes[canal.id], fonte = dados?.fontes?.find(f => f.id === canal.id), autorizado = provedores[provedorDoCanal(canal.id)]?.autorizado;
      return <Card key={canal.id}><div className="flex flex-wrap items-start justify-between gap-2"><Identidade canal={canal} /><EstadoFonte fonte={fonte} /></div><p className="mt-4 break-words text-sm">{status?.ativo?.nome || 'Nenhuma conta vinculada'}</p>{status?.ativo?.id && <p className="mt-1 break-all text-xs text-slate-400">{status.ativo.id}</p>}<p className="mt-2 text-xs text-slate-500">Última tentativa: {horaMarketing(status?.tentativaEm)}{status?.resultado && ` · ${STATUS_MARKETING[status.resultado] || 'Revisar conexão'}`}</p><div className="mt-4 flex flex-wrap gap-2"><button className="btn-outline" disabled={ocupado || !autorizado} onClick={() => { setAtivo(''); listar(canal.id); }}><Link2 size={15} /> Selecionar conta</button><button className="btn-primary" disabled={ocupado || !status?.ativo || !autorizado} onClick={() => coletar(canal.id)}><RefreshCw size={15} /> {ocupado === canal.id ? 'Coletando…' : 'Coletar indicadores'}</button></div></Card>;
    })}</div>
    {lista && <Modal aberto titulo={`Vincular ${CANAIS_MARKETING.find(c => c.id === lista.fonte)?.nome}`} aoFechar={fecharLista}>{erro && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{erro}</p>}<p className="mb-3 text-sm text-slate-500">Selecione somente a conta da MinasLab. {lista.fonte.endsWith('_ads') ? 'Ao vincular, você confirma que a conta de anúncios pertence à MinasLab.' : 'O servidor confere o site ou perfil antes de salvar.'}</p>{lista.ativos.length ? <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); selecionar(lista.fonte, ativo); }}><label className="min-w-0 flex-1 text-sm">Conta<select className="input mt-1 w-full" value={ativo} onChange={e => setAtivo(e.target.value)} required><option value="">Selecione…</option>{lista.ativos.map(a => <option key={a.id} value={a.id}>{a.nome} · {a.id}</option>)}</select></label><button className="btn-primary" disabled={ocupado || !ativo} type="submit">Vincular à MinasLab</button></form> : <Empty>Nenhuma conta elegível encontrada nesta autorização.</Empty>}{lista.limitado && <p className="mt-3 text-xs text-amber-800">A listagem é parcial. Algumas contas não puderam ser consultadas.</p>}</Modal>}
    <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><BarChart3 className="shrink-0" size={16} /> Coletar indicadores consulta os relatórios. Esse comando não cria publicações nem altera campanhas.</p>
  </div>;
}
