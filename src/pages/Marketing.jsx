import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { PageTitle, Segmented, Card, CarregandoModulo, ErroModulo } from '../components/ui.jsx';
import { ResumoMarketing, DetalheCanal, ConexoesMarketing } from '../components/marketing/CanaisMarketing.jsx';
import { CANAIS_MARKETING, horaMarketing } from '../lib/marketing.mjs';
import { ehDirecao } from '../lib/sessao.js';
import { chamarMarketing } from '../services/marketing.js';
import MarketingAcoes from './MarketingAcoes.jsx';

const ABAS = [{ valor: 'visao-geral', rotulo: 'Visão geral' }, { valor: 'canais', rotulo: 'Canais' }, { valor: 'conexoes', rotulo: 'Conexões' }, { valor: 'acoes', rotulo: 'Ações' }];
export default function Marketing() {
  const direcao = ehDirecao();
  const [params, setParams] = useSearchParams();
  const aba = direcao && ABAS.some(a => a.valor === params.get('aba')) ? params.get('aba') : direcao ? 'visao-geral' : 'acoes';
  const canal = CANAIS_MARKETING.some(c => c.id === params.get('canal')) ? params.get('canal') : 'ga4';
  const [dados, setDados] = useState(null), [carregando, setCarregando] = useState(true), [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(''), [aviso, setAviso] = useState(''), [lista, setLista] = useState(null);
  const trava = useRef(false), montado = useRef(true);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try { const d = await chamarMarketing('painel'); if (montado.current) setDados(d); return true; }
    catch (e) { if (montado.current) setErro(e.message); return false; }
    finally { if (montado.current) setCarregando(false); }
  }, []);
  useEffect(() => { montado.current = true; if (direcao) carregar(); else setCarregando(false); return () => { montado.current = false; }; }, [carregar, direcao]);
  function navegar(nova, fonte) { const p = new URLSearchParams(params); p.set('aba', nova); if (fonte) p.set('canal', fonte); setParams(p); setLista(null); }
  async function executar(fonte, fn) {
    if (trava.current) return;
    trava.current = true; setOcupado(fonte); setAviso(''); setErro('');
    try { await fn(); } catch (e) { if (montado.current) setErro(e.message); }
    finally { trava.current = false; if (montado.current) setOcupado(''); }
  }
  const coletar = fonte => executar(fonte, async () => {
    const r = await chamarMarketing('coletar', { fonte });
    const atualizou = await carregar();
    if (montado.current) setAviso(!atualizou ? 'Coleta recebida. Tente atualizar a leitura para consultar os novos indicadores.' : r.estado === 'ok' ? 'Coleta concluída. A leitura foi atualizada.' : 'Coleta parcial recebida. Confira a cobertura no canal.');
  });
  const listar = fonte => executar('listar-' + fonte, async () => { const r = await chamarMarketing('listar', { fonte }); if (montado.current) setLista({ fonte, ativos: r.ativos || [], limitado: r.limitado }); });
  const selecionar = (fonte, ativo) => executar('vincular-' + fonte, async () => { await chamarMarketing('vincular', { fonte, ativo }); if (montado.current) { setLista(null); setAviso('Conta vinculada. Colete os indicadores para confirmar o acesso.'); } await carregar(); });
  return <div className="space-y-4">
    <PageTitle titulo="Marketing" descricao="Presença digital, conexões e ações da MinasLab em um só lugar." acao={direcao && aba !== 'acoes' && <button className="btn-outline" disabled={carregando || !!ocupado} onClick={carregar}><RefreshCw size={16} className={carregando ? 'animate-spin' : ''} /> {carregando ? 'Atualizando…' : 'Atualizar leitura'}</button>} />
    {direcao && <Segmented opcoes={ABAS} valor={aba} onChange={nova => navegar(nova)} className="w-full sm:w-fit" />}
    {aba === 'acoes' ? <MarketingAcoes /> : <>
      {aviso && <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-800" role="status">{aviso}</div>}
      {erro && dados && <Card role="alert" className="border-amber-200 bg-amber-50 text-sm"><p>{erro}</p><p className="mt-1 text-amber-900">Os dados da última leitura foram preservados.</p></Card>}
      {carregando && !dados ? <CarregandoModulo /> : !dados ? <ErroModulo mensagem={erro || 'Não foi possível carregar os indicadores.'} aoTentar={carregar} /> : <>
        {aba === 'visao-geral' && <ResumoMarketing dados={dados} abrirCanal={fonte => navegar('canais', fonte)} abrirConexoes={() => navegar('conexoes')} />}
        {aba === 'canais' && <><label className="block text-xs font-medium text-slate-500 sm:hidden">Canal<select className="select mt-1 w-full" value={canal} onChange={e => navegar('canais', e.target.value)}>{CANAIS_MARKETING.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><div className="hidden sm:block"><Segmented opcoes={CANAIS_MARKETING.map(c => ({ valor: c.id, rotulo: c.nome }))} valor={canal} onChange={fonte => navegar('canais', fonte)} /></div><DetalheCanal key={canal} canalId={canal} dados={dados} ocupado={ocupado} coletar={coletar} abrirConexoes={() => navegar('conexoes')} /></>}
        {aba === 'conexoes' && <ConexoesMarketing dados={dados} ocupado={ocupado} coletar={coletar} listar={listar} selecionar={selecionar} lista={lista} erro={erro} fecharLista={() => setLista(null)} />}
        <p className="text-xs leading-relaxed text-slate-500">Leitura do painel: {horaMarketing(dados.lidoEm)}. “Atualizar leitura” consulta os dados recebidos. Para buscar novos dados na fonte, use “Coletar indicadores”.</p>
      </>}
    </>}
  </div>;
}
