import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Printer, Search, Clock, Users, Coffee, AlertTriangle } from 'lucide-react';
import { Card, Segmented } from '../ui.jsx';
import { lerCfg } from '../../services/dados.js';
import { baixarPlanilha } from '../../lib/planilha.js';
import { cfgDoPonto, duracaoTexto, ausenciaDoDia, minutosPrevistosDoDia } from '../../lib/rh/ponto.js';
import { composicaoIntervalo, periodoPonto, moverPeriodo, datasPeriodo, resumirDias } from '../../lib/pontoPeriodo.js';
import './periodoPonto.css';
const horas = n => n === null || n === undefined ? '—' : duracaoTexto(n);
const curta = iso => iso.slice(8,10)+'/'+iso.slice(5,7);
const longa = iso => `${curta(iso)}/${iso.slice(0,4)}`;
const SEMANA=['dom.','seg.','ter.','qua.','qui.','sex.','sáb.'];
const opcoes=[{valor:'dia',rotulo:'Dia'},{valor:'semana',rotulo:'Semana'},{valor:'mes',rotulo:'Mês'}];
function Medida({icone:Icon, titulo, valor, nota}) {return <div className="pp-medida"><span className="pp-legenda"><Icon size={16}/>{titulo}</span><strong>{valor}</strong><small>{nota}</small></div>;}
function situacao(d, iso, hoje, jornada) {
  if(iso>hoje) return 'Futuro';
  const ausencia=d && ausenciaDoDia(d); if(ausencia) return ausencia.rotulo;
  if(!d) return minutosPrevistosDoDia(iso,jornada)===0?'Sem jornada':'Sem registro';
  if(d.emAberto) return 'Em aberto';
  const c=composicaoIntervalo(d);
  if(c.invalido) return 'Conferir intervalo';
  if(c.semIntervalo) return 'Intervalo não registrado';
  if(c.pausaPagaMin===null) return 'Conferir pausa paga';
  if(c.folhaMin===null) return 'Conferir batidas';
  return 'Registrado';
}
export default function PeriodoPonto({pessoas,ativos,pontoDia,hojeISO,competenciaSelecionada,aoMudarCompetencia,montarIndice,pessoasDoPeriodo,setAviso}) {
  const [visao,setVisao]=useState('semana');
  const [referencia,setReferencia]=useState(hojeISO);
  const [busca,setBusca]=useState('');
  const [quadro,setQuadro]=useState('ativos');
  const [pessoaId,setPessoaId]=useState('');
  const [gerandoPdf,setGerandoPdf]=useState(false);
  const [config,setConfig]=useState(null);
  const [cfgErro,setCfgErro]=useState(false);
  useEffect(()=>{let vivo=true;lerCfg().then(c=>{if(vivo)setConfig(c);}).catch(()=>{if(vivo)setCfgErro(true);});return()=>{vivo=false;};},[]);
  const jornada=useMemo(()=>cfgDoPonto(config).jornada,[config]);
  const ref=visao==='mes' && competenciaSelecionada?`${competenciaSelecionada}-01`:referencia;
  const periodo=useMemo(()=>periodoPonto(visao,ref),[visao,ref]);
  const datas=useMemo(()=>datasPeriodo(periodo),[periodo]);
  const indice=useMemo(()=>montarIndice(pessoas,pontoDia),[montarIndice,pessoas,pontoDia]);
  const candidatas=useMemo(()=>periodo?pessoasDoPeriodo(ativos,indice,periodo.de,periodo.ate,quadro).lista:[],[ativos,indice,periodo,quadro,pessoasDoPeriodo]);
  const lista=useMemo(()=>candidatas.filter(p=>p.nome?.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),[candidatas,busca]);
  const pessoa=lista.find(p=>p.id===pessoaId);
  const exibidas=pessoa?[pessoa]:lista;
  const linhas=exibidas.flatMap(p=>datas.filter(d=>d<=hojeISO).map(data=>({p,data,d:indice.porPessoa.get(p.id)?.dias.get(data)})));
  const resumo=resumirDias(linhas.flatMap(l=>l.d?[l.d]:[]));
  const pendentes=linhas.filter(l=>l.d && !ausenciaDoDia(l.d) && (l.d.emAberto || composicaoIntervalo(l.d).semIntervalo || composicaoIntervalo(l.d).efetivoMin===null || composicaoIntervalo(l.d).folhaMin===null)).length;
  const ultima=(pontoDia||[]).filter(d=>d.data>=periodo?.de && d.data<=periodo?.ate && d.atualizadoPor==='jibble').map(d=>d.atualizadoEm||'').sort().at(-1);
  const mudarRef=d=>{if(!periodoPonto('dia',d))return;setReferencia(d);aoMudarCompetencia?.(d.slice(0,7));};
  const trocar=v=>{setVisao(v);if(v==='mes')aoMudarCompetencia?.(referencia.slice(0,7));else if(visao==='mes' && referencia.slice(0,7)!==ref.slice(0,7))setReferencia(ref);};
  const titulo=periodo ? periodo.de===periodo.ate?longa(periodo.de):`${longa(periodo.de)} a ${longa(periodo.ate)}` : 'Selecione uma data';
  const registrosRelatorio=linhas.map(({p,data,d})=>{const c=composicaoIntervalo(d);return {nome:p.nome,data:longa(data),entrada:d?.entrada||'',saida:d?.saida||'',intervalo:c.pausaMin??'',pago:d?.pausaPagaMin??'',efetivo:c.efetivoMin??'',folha:c.folhaMin??'',original:c.originalJibbleMin??'',diferenca:c.diferencaMin??'',situacao:situacao(d,data,hojeISO,jornada)};});
  const baixarPdf=async()=>{
    setGerandoPdf(true);
    try {
      const {gerarPdfPonto}=await import('../../lib/pdfPonto.js');
      const doc=gerarPdfPonto({titulo,subtitulo:`${quadro} · ${pessoa?.nome||busca||'Todas as pessoas'} · ${exibidas.length} pessoa(s) · Última importação: ${ultima ? new Date(ultima).toLocaleString('pt-BR') : 'não informada'}`,registros:registrosRelatorio,jornada:jornada.dias.filter(d=>d.previstoMin>0).map(d=>`${d.nome} ${horas(d.previstoMin)}`).join(' · ')+` · ${horas(jornada.semanaMin)} semanais`});
      doc.save(`minaslab-ponto-${visao}-${periodo.de}-${periodo.ate}.pdf`);
    } catch { setAviso?.({tipo:'erro',texto:'Não foi possível gerar o PDF. Tente novamente.'}); }
    finally { setGerandoPdf(false); }
  };
  const exportar=()=>baixarPlanilha({nome:`ponto-${visao}-${periodo.de}-${periodo.ate}`,titulo:`MinasLab · ${titulo} · ${quadro} · ${pessoa?.nome||busca||'todas as pessoas'} · última importação ${ultima||'não informada'}`,colunas:[{chave:'nome',rotulo:'Pessoa'},{chave:'data',rotulo:'Dia'},{chave:'entrada',rotulo:'Entrada'},{chave:'saida',rotulo:'Saída'},{chave:'intervalo',rotulo:'Intervalo não pago (min)',tipo:'numero'},{chave:'pago',rotulo:'Intervalo pago (min)',tipo:'numero'},{chave:'efetivo',rotulo:'Trabalho efetivo (min)',tipo:'numero'},{chave:'folha',rotulo:'Horas consideradas (min, inclui extras)',tipo:'numero'},{chave:'original',rotulo:'Total de origem (min)',tipo:'numero'},{chave:'diferenca',rotulo:'Diferença para conferência (min)',tipo:'numero'},{chave:'situacao',rotulo:'Situação'}],linhas:registrosRelatorio});
  return <section className="pp-root" aria-label="Acompanhamento do ponto">
    <Card className="pp-topo">
      <div className="pp-linha"><div><span className="pp-legenda"><CalendarDays size={16}/> Acompanhamento da equipe</span><h2>{titulo}</h2></div><div className="pp-acoes sem-impressao"><button className="btn-outline" onClick={exportar} disabled={!periodo}><Download size={16}/> Excel</button><button className="btn-primary" onClick={baixarPdf} disabled={gerandoPdf || !periodo}><Printer size={16}/> {gerandoPdf?'Gerando PDF…':'Baixar PDF'}</button></div></div>
      <div className="pp-linha sem-impressao"><Segmented opcoes={opcoes} valor={visao} onChange={trocar}/><div className="pp-acoes"><button className="btn-outline" aria-label="Período anterior" onClick={()=>mudarRef(moverPeriodo(visao,ref,-1))}><ChevronLeft size={18}/></button><input aria-label="Data de referência" className="input pp-data" type={visao==='mes'?'month':'date'} value={visao==='mes'?ref.slice(0,7):ref} onChange={e=>mudarRef(visao==='mes'?`${e.target.value}-01`:e.target.value)}/><button className="btn-outline" aria-label="Próximo período" onClick={()=>mudarRef(moverPeriodo(visao,ref,1))}><ChevronRight size={18}/></button><button className="btn-ghost" onClick={()=>mudarRef(hojeISO)}>Hoje</button></div></div>
      <div className="pp-linha sem-impressao"><label className="pp-busca"><Search size={17}/><input aria-label="Buscar pessoa" placeholder="Buscar pessoa…" value={busca} onChange={e=>{setBusca(e.target.value);setPessoaId('');}}/></label><select aria-label="Quadro da equipe" className="select pp-data" value={quadro} onChange={e=>{setQuadro(e.target.value);setPessoaId('');}}><option value="ativos">Equipe atual</option><option value="todos">Todos, com histórico</option><option value="desligados">Desligados</option></select>{pessoa&&<button className="btn-outline" onClick={()=>setPessoaId('')}>← Toda a equipe</button>}</div>
      <p className="pp-fonte">Jornada de trabalho: {jornada.dias.filter(d=>d.previstoMin>0).map(d=>`${d.nome} ${horas(d.previstoMin)}`).join(' · ')} · Total semanal: <strong>{horas(jornada.semanaMin)}</strong>. O intervalo fica fora dessas horas.</p>
      <p className="pp-fonte">{pessoa?.nome||'Equipe'} · {exibidas.length} pessoa(s) · {quadro==='ativos'?'quadro atual':quadro} · Última importação do período: {ultima?new Date(ultima).toLocaleString('pt-BR'):'não informada'}</p>
    </Card>
    <div className="pp-resumo"><Medida icone={Clock} titulo="Horas consideradas" valor={horas(resumo.folhaMin)} nota="Extras já incluídas neste total"/><Medida icone={Coffee} titulo="Intervalo não pago" valor={horas(resumo.pausaMin)} nota="Somente intervalos informados"/><Medida icone={Users} titulo="Trabalho efetivo" valor={horas(resumo.efetivoMin)} nota="Sem pausas pagas ou não pagas"/><Medida icone={AlertTriangle} titulo="Conferir" valor={pendentes} nota="Intervalos ausentes ou batidas incompletas"/></div>
    {(pendentes>0 || resumo.divergencias>0 || indice.repetidos>0 || indice.orfaos.length>0 || cfgErro)&&<p role="status" className="pp-aviso">{pendentes>0&&'Totais parciais: há registros a conferir. '}{resumo.divergencias>0&&`${resumo.divergencias} dia(s) com diferença do Jibble. O painel considera somente o intervalo registrado. `}{indice.repetidos>0&&`${indice.repetidos} registro(s) repetido(s) na base; sem somar em dobro. `}{indice.orfaos.length>0&&`${indice.orfaos.length} vínculo(s) com pessoas pendentes na base. `}{cfgErro&&'Escala não carregada; referências de jornada usam o padrão do sistema.'}</p>}
    {exibidas.length===0?<Card><p>Nenhuma pessoa neste filtro. Altere a busca ou o quadro.</p></Card>:<>
      {visao==='semana'&&!pessoa&&<Card><div className="pp-grade"><table><caption className="sr-only">Semana da equipe — horas da folha por dia</caption><thead><tr><th>Pessoa</th>{datas.map(d=><th key={d}><button onClick={()=>{mudarRef(d);setVisao('dia');}}>{SEMANA[new Date(`${d}T12:00:00`).getDay()]}<br/>{curta(d)}</button></th>)}<th>Total</th></tr></thead><tbody>{exibidas.map(p=>{const ds=datas.filter(d=>d<=hojeISO).map(d=>indice.porPessoa.get(p.id)?.dias.get(d));return <tr key={p.id}><th><button onClick={()=>setPessoaId(p.id)}>{p.nome}</button></th>{datas.map(data=>{const d=indice.porPessoa.get(p.id)?.dias.get(data);return <td key={data}><button className={d?.emAberto?'pp-pendente':''} onClick={()=>{setPessoaId(p.id);mudarRef(data);setVisao('dia');}}>{data>hojeISO?'—':horas(d?composicaoIntervalo(d).folhaMin:null)}<small>{situacao(d,data,hojeISO,jornada)}</small></button></td>;})}<td><strong>{horas(resumirDias(ds.filter(Boolean)).folhaMin)}</strong></td></tr>;})}</tbody></table></div><p className="pp-fonte">Clique em um dia para detalhar as batidas e o intervalo. “Sem registro” não significa falta.</p></Card>}
      {visao==='mes'&&!pessoa&&<div className="pp-pessoas">{exibidas.map(p=>{const ds=datas.map(d=>indice.porPessoa.get(p.id)?.dias.get(d)).filter(d=>d&&d.data<=hojeISO);const r=resumirDias(ds);return <button className="pp-pessoa" key={p.id} onClick={()=>setPessoaId(p.id)}><span><strong>{p.nome}</strong><small>{r.dias} dias com registro{r.pendentes>0?` · ${r.pendentes} a conferir`:''}</small></span><span><strong>{horas(r.folhaMin)}</strong><small>total · intervalo {horas(r.pausaMin)}</small></span><ChevronRight size={18}/></button>;})}</div>}
      {(visao==='dia'||pessoa)&&<Card><h3 className="pp-subtitulo">{pessoa?.nome||'Batidas do dia'}</h3><div className="pp-grade"><table><thead><tr><th>{pessoa?'Dia':'Pessoa'}</th><th>Entrada</th><th>Saída</th><th>Intervalo não pago</th><th>Pausa paga</th><th>Trabalho efetivo</th><th>Total considerado</th><th>Total de origem</th><th>Situação</th></tr></thead><tbody>{linhas.map(({p,data,d})=>{const c=composicaoIntervalo(d);return <tr key={`${p.id}-${data}`}><th>{pessoa?longa(data):<button onClick={()=>setPessoaId(p.id)}>{p.nome}</button>}</th><td>{d?.entrada||'—'}</td><td>{d?.saida||'—'}</td><td>{horas(c.pausaMin)}</td><td>{d?horas(c.pausaPagaMin):'—'}</td><td>{horas(c.efetivoMin)}</td><td><strong>{horas(c.folhaMin)}</strong></td><td>{horas(c.originalJibbleMin)}</td><td>{situacao(d,data,hojeISO,jornada)}{c.diferencaMin!==null&&c.diferencaMin!==0&&<small>Diferença do total original: {horas(Math.abs(c.diferencaMin))} · intervalo descontado uma vez</small>}</td></tr>;})}</tbody></table></div></Card>}
    </>}
    <details className="pp-explicacao"><summary>Como os intervalos entram na conta</summary><p>Trabalho efetivo = horas registradas − intervalo não pago − pausa paga. Para o total considerado no painel, descontamos somente o intervalo não pago registrado. Não aplicamos a hora adicional da apuração do Jibble; o total original é preservado para comparação.</p><p>Sem intervalo informado, o total fica pendente. Com zero no relógio, nenhum intervalo é descontado e aparece o aviso “Intervalo não registrado”, para conferência. Pausas pagas não reduzem a remuneração. Totais incluem apenas valores conhecidos.</p></details>
  </section>;
}
