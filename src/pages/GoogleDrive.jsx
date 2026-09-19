import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, FolderOpen, Plus, Search, Pencil, Trash2, Star, RefreshCw, FileText, Link as LinkIcon } from 'lucide-react';
import { carregarColecoes, listar, salvar, apagar } from '../services/dados.js';
import { getSessao, podeEditar } from '../lib/sessao.js';
import { novoId } from '../lib/format.js';
import { AREAS_DRIVE, COLECAO_DRIVE, analisarLinkDrive, filtrarAtalhosDrive, validarAtalhoDrive } from '../lib/driveAtalhos.js';
import { PageTitle, Modal, Aviso, CarregandoModulo, ErroModulo } from '../components/ui.jsx';
import './googleDrive.css';

function FormAtalho({ inicial, itens, ocupado, aoSalvar, aoFechar }) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState('');
  const link = analisarLinkDrive(form.url);
  const mudar = (campo, valor) => { setForm(atual => ({ ...atual, [campo]: valor })); setErro(''); };
  function enviar(event) {
    event.preventDefault();
    if (ocupado) return;
    const validado = validarAtalhoDrive(form, itens);
    if (validado.erro) { setErro(validado.erro); return; }
    aoSalvar(validado.registro);
  }
  return <Modal titulo={itens.some(i => i.id === inicial.id) ? 'Editar atalho' : 'Adicionar atalho'} aberto aoFechar={ocupado ? () => {} : aoFechar}>
    <form className="drive-form" onSubmit={enviar} aria-busy={ocupado}>
      <p className="text-sm text-slate-500">Dê um nome fácil de encontrar à pasta ou ao documento.</p>
      <fieldset disabled={ocupado} className="drive-form">
        <label htmlFor="drive-nome">Nome do atalho<input id="drive-nome" className="input" required maxLength={120} autoFocus placeholder="Ex.: Documentos do laboratório" value={form.nome} onChange={e => mudar('nome', e.target.value)} /></label>
        <label htmlFor="drive-url">Link do Google Drive<input id="drive-url" className="input" required inputMode="url" autoComplete="off" spellCheck={false} placeholder="Cole o link da pasta ou do arquivo" value={form.url} onChange={e => mudar('url', e.target.value)} aria-describedby="drive-link-ajuda" /></label>
        <p id="drive-link-ajuda" className="text-xs text-slate-500">{link ? `Tipo reconhecido: ${link.tipo}. O link será aberto em outra aba.` : 'Aceita pastas, arquivos, Documentos, Planilhas, Apresentações e Formulários Google.'}</p>
        <label htmlFor="drive-area">Área<select id="drive-area" className="select" value={form.area} onChange={e => mudar('area', e.target.value)}>{AREAS_DRIVE.map(area => <option key={area}>{area}</option>)}</select></label>
        <label htmlFor="drive-descricao">Descrição <span className="font-normal text-slate-400">(opcional)</span><textarea id="drive-descricao" className="input" rows={3} maxLength={400} placeholder="O que a equipe encontra aqui?" value={form.descricao} onChange={e => mudar('descricao', e.target.value)} /></label>
        <label className="drive-checkbox"><input type="checkbox" checked={form.destaque} onChange={e => mudar('destaque', e.target.checked)} /><span>Destacar entre os atalhos mais usados</span></label>
      </fieldset>
      {erro && <p role="alert" className="text-sm text-bad-700">{erro}</p>}
      <div className="drive-form-actions"><button type="button" className="btn-outline" disabled={ocupado} onClick={aoFechar}>Cancelar</button><button className="btn-primary" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar atalho'}</button></div>
    </form>
  </Modal>;
}

function Atalho({ item, editavel, ocupado, aoEditar, aoRemover, aoDestacar }) {
  const link = analisarLinkDrive(item.url);
  const Icone = link?.tipo === 'Pasta' ? FolderOpen : FileText;
  return <article className={`drive-card ${item.destaque ? 'drive-card-destaque' : ''}`}>
    <div className="drive-card-top"><span className="drive-file-icon"><Icone size={22} aria-hidden="true" /></span><span className="drive-type">{link?.tipo || 'Link a corrigir'}</span>{item.destaque && <span className="drive-star-label"><Star size={13} fill="currentColor" aria-hidden="true" />Destaque</span>}</div>
    <h3>{link ? <a href={link.url} target="_blank" rel="noopener noreferrer">{item.nome}<ArrowUpRight size={18} aria-hidden="true" /></a> : item.nome}</h3>
    <p className="drive-description">{item.descricao || `Atalho de ${item.area || 'Geral'}.`}</p>
    <div className="drive-card-bottom">{link ? <a className="drive-open" href={link.url} target="_blank" rel="noopener noreferrer">Abrir no Drive <ArrowUpRight size={15} aria-hidden="true" /></a> : <span className="text-sm text-bad-700">{editavel ? 'Edite para corrigir o endereço.' : 'Peça à equipe para corrigir o endereço.'}</span>}
      {editavel && <div className="drive-card-actions"><button type="button" disabled={ocupado} onClick={() => aoDestacar(item)} aria-pressed={item.destaque === true} aria-label={`${item.destaque ? 'Retirar destaque de' : 'Destacar'} ${item.nome}`} title={item.destaque ? 'Retirar destaque' : 'Destacar'}><Star size={17} fill={item.destaque ? 'currentColor' : 'none'} /></button><button type="button" disabled={ocupado} onClick={() => aoEditar(item)} aria-label={`Editar ${item.nome}`} title="Editar"><Pencil size={17} /></button><button type="button" disabled={ocupado} onClick={() => aoRemover(item)} aria-label={`Remover atalho ${item.nome}`} title="Remover atalho"><Trash2 size={17} /></button></div>}
    </div>
  </article>;
}

export default function GoogleDrive() {
  const [itens, setItens] = useState(null), [erro, setErro] = useState(''), [tentativa, setTentativa] = useState(0);
  const [form, setForm] = useState(null), [remover, setRemover] = useState(null), [ocupado, setOcupado] = useState(false), [aviso, setAviso] = useState(null);
  const [busca, setBusca] = useState(''), [area, setArea] = useState(''), [destaques, setDestaques] = useState(false);
  const trava = useRef(false);
  const editavel = podeEditar();
  useEffect(() => {
    let vivo = true;
    setErro('');
    (tentativa ? listar(COLECAO_DRIVE) : carregarColecoes([COLECAO_DRIVE]).then(r => {
      if (r._recusadas.includes(COLECAO_DRIVE)) throw new Error('Seu acesso não permite consultar os atalhos.');
      return r[COLECAO_DRIVE];
    })).then(dados => { if (vivo) setItens(dados); }).catch(e => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [tentativa]);
  const visiveis = useMemo(() => filtrarAtalhosDrive(itens || [], { busca, area, destaques }), [itens, busca, area, destaques]);
  const areas = useMemo(() => [...new Set((itens || []).map(i => i.area || 'Geral'))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [itens]);
  const grupos = [...new Set(visiveis.map(i => i.area || 'Geral'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  function limpar() { setBusca(''); setArea(''); setDestaques(false); }
  function novo() { setForm({ id: novoId('drv'), nome: '', url: '', area: area || 'Geral', descricao: '', destaque: false }); }
  async function gravar(registro, fechar = true) {
    if (trava.current || !podeEditar()) return;
    trava.current = true; setOcupado(true); setAviso(null);
    try {
      const salvo = await salvar(COLECAO_DRIVE, { ...registro, atualizadoPor: getSessao()?.usuario, atualizadoEm: new Date().toISOString() });
      setItens(atual => [...atual.filter(i => i.id !== salvo.id), salvo]);
      if (fechar) { setForm(null); limpar(); }
      setAviso({ tipo: 'ok', texto: 'Atalho salvo na nuvem.' });
    } catch (e) { setAviso({ tipo: 'erro', texto: e.message }); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function excluir() {
    if (trava.current || !podeEditar()) return;
    trava.current = true; setOcupado(true); setAviso(null);
    try {
      await apagar(COLECAO_DRIVE, remover.id);
      setItens(atual => atual.filter(i => i.id !== remover.id)); setRemover(null);
      setAviso({ tipo: 'ok', texto: 'Atalho removido. O arquivo continua no Google Drive.' });
    } catch (e) { setAviso({ tipo: 'erro', texto: e.message }); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <div className="drive-page">
    <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
    <PageTitle titulo="Google Drive" descricao="Pastas e documentos da equipe." acao={editavel && <button className="btn-primary" disabled={ocupado || !itens} onClick={novo}><Plus size={17} />Adicionar atalho</button>} />

    {erro ? <ErroModulo mensagem={erro} aoTentar={() => setTentativa(t => t + 1)} /> : itens === null ? <CarregandoModulo /> : <>
      {itens.length > 0 && <div className="drive-summary" aria-label="Visões dos atalhos"><button onClick={() => { setDestaques(false); setArea(''); }} aria-pressed={!destaques && !area}><span>Todos os atalhos</span><strong>{itens.length}</strong></button><button onClick={() => { setDestaques(true); setArea(''); }} aria-pressed={destaques}><span><Star size={15} aria-hidden="true" /> Em destaque</span><strong>{itens.filter(i => i.destaque).length}</strong></button><div><span>Áreas com atalhos</span><strong>{areas.length}</strong></div></div>}
      {itens.length > 0 ? <>
        <div className="drive-filters"><label className="drive-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar atalhos" placeholder="Buscar por nome, descrição ou área" value={busca} onChange={e => setBusca(e.target.value)} /></label><label className="sr-only" htmlFor="drive-filtro-area">Filtrar por área</label><select id="drive-filtro-area" className="select" value={area} onChange={e => setArea(e.target.value)}><option value="">Todas as áreas</option>{areas.map(a => <option key={a}>{a}</option>)}</select><button className="btn-outline" disabled={ocupado} onClick={() => setTentativa(t => t + 1)} aria-label="Atualizar lista de atalhos" title="Atualizar lista"><RefreshCw size={17} /></button></div>
        <p className="drive-results" role="status">{visiveis.length} de {itens.length} {itens.length === 1 ? 'atalho' : 'atalhos'}{destaques ? ' · Em destaque' : ''}{(busca || area || destaques) && <button type="button" onClick={limpar}>Limpar filtros</button>}</p>
        {grupos.map(grupo => <section key={grupo} className="drive-group" aria-label={grupo}><div className="drive-group-heading"><h2>{grupo}</h2><span>{visiveis.filter(i => (i.area || 'Geral') === grupo).length}</span></div><div className="drive-grid">{visiveis.filter(i => (i.area || 'Geral') === grupo).map(item => <Atalho key={item.id} item={item} editavel={editavel} ocupado={ocupado} aoEditar={i => setForm({ ...i, descricao: i.descricao || '', area: i.area || 'Geral', destaque: i.destaque === true })} aoRemover={setRemover} aoDestacar={i => gravar({ ...i, destaque: !i.destaque }, false)} />)}</div></section>)}
        {!visiveis.length && <div className="drive-empty"><Search size={28} aria-hidden="true" /><h2>Nenhum atalho neste filtro</h2><p>Tente outro termo ou veja todos os atalhos cadastrados.</p><button className="btn-outline" onClick={limpar}>Ver todos os atalhos</button></div>}
      </> : <div className="drive-empty drive-empty-compact"><LinkIcon size={24} aria-hidden="true" /><div><h2>Nenhum atalho cadastrado</h2><p>{editavel ? 'Clique em Adicionar atalho para começar.' : 'Os atalhos cadastrados pela equipe aparecerão aqui.'}</p></div></div>}
      <p className="drive-permissions">O acesso aos arquivos segue as permissões do Google Drive.</p>
    </>}
    {form && <FormAtalho key={form.id} inicial={form} itens={itens} ocupado={ocupado} aoSalvar={gravar} aoFechar={() => setForm(null)} />}
    {remover && <Modal titulo="Remover atalho" aberto aoFechar={ocupado ? () => {} : () => setRemover(null)}><p>Remover o atalho <strong>{remover.nome}</strong> desta central? O arquivo ou a pasta continua no Google Drive.</p><div className="drive-form-actions mt-5"><button className="btn-outline" disabled={ocupado} onClick={() => setRemover(null)}>Cancelar</button><button className="btn-primary" disabled={ocupado} onClick={excluir}>{ocupado ? 'Removendo…' : 'Remover atalho'}</button></div></Modal>}
  </div>;
}
