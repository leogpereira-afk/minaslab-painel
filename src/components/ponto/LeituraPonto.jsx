import { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, Coffee } from 'lucide-react';
import { duracaoTexto } from '../../lib/rh/ponto.js';
import { composicaoIntervalo } from '../../lib/pontoPeriodo.js';
import { leituraPonto, situacaoPonto } from '../../lib/pontoLeitura.js';
import './leituraPonto.css';
import { prepararConferencia, pessoaNoFiltro, registroNoFiltro } from '../../lib/pontoConferencia.js';

const horas = n => n == null ? '—' : duracaoTexto(n);
const dataCurta = d => `${d.slice(8,10)}/${d.slice(5,7)}`;
const nomeDia = d => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
const plural = (n,um,muitos) => `${n} ${n===1?um:muitos}`;

function Registro({p,data,d,hoje,jornada,individual,aoAbrirAjustes}) {
  const c=composicaoIntervalo(d);
  const status=situacaoPonto(d,data,hoje,jornada);
  const composicao=c.efetivoMin!==null && c.pausaMin!==null && c.pausaPagaMin!==null && c.registradasMin>0;
  return <details className="pl-registro">
    <summary>
      <span className="pl-registro-nome"><strong>{individual?dataCurta(data):p.nome}</strong><small>{individual?nomeDia(data):dataCurta(data)} · {status}</small></span>
      <span className="pl-batidas">{d?.entrada||'—'} <ArrowRight size={13}/> {d?.saida||'—'}</span>
      <span className="pl-intervalo"><Coffee size={14}/><span>{horas(c.pausaMin)}<small>intervalo</small></span></span>
      <span className="pl-total"><strong>{horas(c.folhaMin)}</strong><small>consideradas</small></span><ChevronRight size={16} className="pl-chevron"/>
    </summary>
    <div className="pl-registro-corpo">
      {aoAbrirAjustes && <button className="btn-outline mb-3 sem-impressao" onClick={() => aoAbrirAjustes(p.id,data)}>Abrir ajustes deste dia <ArrowRight size={14}/></button>}
      {composicao&&<div className="pl-composicao"><p>Composição do tempo registrado <strong>{horas(c.registradasMin)}</strong></p><div className="pl-composicao-barra" aria-hidden="true"><i style={{width:`${100*c.efetivoMin/c.registradasMin}%`}}/><i className="pl-paga" style={{width:`${100*c.pausaPagaMin/c.registradasMin}%`}}/><i className="pl-pausa" style={{width:`${100*c.pausaMin/c.registradasMin}%`}}/></div><div className="pl-legenda-composicao"><span>Trabalho efetivo {horas(c.efetivoMin)}</span><span>Pausa paga {horas(c.pausaPagaMin)}</span><span>Intervalo não pago {horas(c.pausaMin)}</span></div></div>}
      <dl className="pl-detalhes"><div><dt>Entrada</dt><dd>{d?.entrada||'—'}</dd></div><div><dt>Saída</dt><dd>{d?.saida||'—'}</dd></div><div><dt>Intervalo não pago</dt><dd>{horas(c.pausaMin)}</dd></div><div><dt>Pausa paga</dt><dd>{horas(c.pausaPagaMin)}</dd></div><div><dt>Trabalho efetivo</dt><dd>{horas(c.efetivoMin)}</dd></div><div><dt>Horas consideradas</dt><dd>{horas(c.folhaMin)}</dd></div><div><dt>Total de origem</dt><dd>{horas(c.originalJibbleMin)}</dd></div><div><dt>Situação</dt><dd>{status}</dd></div></dl>
      {c.diferencaMin!==null&&c.diferencaMin!==0&&<p className="pl-nota">Diferença da origem: {c.diferencaMin>0?'+':'−'}{horas(Math.abs(c.diferencaMin))}. O painel desconta o intervalo uma única vez; o total original está preservado.</p>}
      {!d&&<p className="pl-nota">Não há registro deste dia no recorte. Isso não confirma falta.</p>}
    </div>
  </details>;
}

export default function LeituraPonto({pessoas,datas,indice,hoje,jornada,visao,pessoa,abrirPessoa,abrirDia,aoAbrirAjustes}) {
  const [filtro,setFiltro]=useState('todos');
  const leitura=useMemo(()=>leituraPonto({pessoas,datas,porPessoa:indice.porPessoa,hoje,jornada}),[pessoas,datas,indice,hoje,jornada]);
  const conferencia=useMemo(()=>prepararConferencia(leitura,jornada),[leitura,jornada]);
  const equipe=conferencia.equipe.filter(r=>pessoaNoFiltro(r,filtro));
  const parcial=leitura.pendentes.length>0||leitura.lacunas.length>0;
  const individual=!!pessoa||visao==='dia';
  const rotuloTodos=individual?'Todos os registros':'Todas as pessoas';
  const recortes=[['todos',rotuloTodos,individual?pessoas.length*datas.filter(d=>d<=hoje).length:pessoas.length],['pendentes','Registros a conferir',leitura.pendentes.length],['semDados','Dias sem dados',leitura.lacunas.length],['ausencias','Ausências lançadas',conferencia.ausencias.length]];
  const diasVisiveis=pessoas.flatMap(p=>datas.filter(data=>data<=hoje&&registroNoFiltro(leitura,p,data,filtro)).map(data=>({p,data})));
  return <div className="pc-conferencia">
    <div className="pc-filtros sem-impressao" aria-label="Filtrar conferência">{recortes.map(([id,nome,n])=><button key={id} aria-pressed={filtro===id} onClick={()=>setFiltro(id)} className={id==='pendentes'&&n?'pc-filtro-atencao':''}><span>{nome}</span><strong>{n}</strong></button>)}</div>
    <div className="pc-resumo"><span><strong>{horas(leitura.resumo.folhaMin)}</strong> horas consideradas no período</span><span>Intervalo no período: <strong>{horas(leitura.resumo.pausaMin)}</strong></span><span>{plural(leitura.registros.length,'dia recebido','dias recebidos')}</span>{parcial&&<span className="chip-warn">Total parcial</span>}</div>
    <p className="pc-ajuda">{filtro==='semDados'?'Dias da escala sem informação por pessoa. Confira a importação; ausência de registro não confirma falta.':filtro==='pendentes'?`Batidas incompletas ou intervalos a conferir. ${individual?'Abra o dia para ver os detalhes.':'Selecione a pessoa para ver os dias.'}`:filtro==='ausencias'?'Somente ausências registradas: faltas, atestados, justificativas, férias e folgas.':individual?'Abra um dia para conferir horários, intervalos e ajustes.':'Pendências primeiro. Clique no nome para conferir os dias e abrir os ajustes.'}</p>
    {visao!=='dia'&&!pessoa?<div className="pc-tabela-scroll"><table className="pc-tabela"><caption className="sr-only">Conferência de ponto por pessoa</caption><thead><tr><th>Pessoa</th><th>Dias recebidos</th><th>Horas consideradas</th><th>Extras apuradas</th><th>A conferir</th><th>Sem dados</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{equipe.map(r=><tr key={r.p.id}><th scope="row"><button onClick={()=>abrirPessoa(r.p.id)}>{r.p.nome}<ChevronRight size={14}/></button>{r.p.ativo===false&&<small>Desligado · histórico</small>}</th><td>{r.registros}</td><td>{horas(r.folhaMin)}</td><td>{horas(r.extrasMin)}</td><td>{r.pendentes?<button className="pc-alerta" onClick={()=>{abrirPessoa(r.p.id);setFiltro('pendentes');}}>{r.pendentes} registro(s)</button>:<span className="pc-neutro">—</span>}</td><td>{r.semDados?<button className="pc-lacuna" onClick={()=>{abrirPessoa(r.p.id);setFiltro('semDados');}}>{r.semDados} dia(s)</button>:<span className="pc-neutro">—</span>}</td><td><button className="pc-abrir" onClick={()=>abrirPessoa(r.p.id)} aria-label={`Conferir ${r.p.nome}`}>Conferir</button></td></tr>)}</tbody></table>{!equipe.length&&<p className="pc-empty">Nenhuma pessoa neste filtro.</p>}</div>:<section className="pc-dias"><h3>{pessoa?.nome||'Registros do dia'}</h3>{diasVisiveis.map(({p,data})=><Registro key={`${p.id}-${data}`} p={p} data={data} d={indice.porPessoa.get(p.id)?.dias.get(data)} hoje={hoje} jornada={jornada} individual={!!pessoa} aoAbrirAjustes={aoAbrirAjustes}/>)}{!diasVisiveis.length&&<p className="pc-empty">Nenhum dia neste filtro. Selecione “{rotuloTodos}” para ver os demais registros.</p>}</section>}
    <p className="pc-rodape">Horas extras já estão incluídas nas horas consideradas. Os filtros destacam ocorrências; totais, gráficos e exportações abrangem o período e as pessoas selecionadas.</p>
    <details className="pc-grafico"><summary>Ver distribuição de horas por dia</summary><div className="pl-grafico-scroll"><div className="pl-grafico" style={{minWidth:Math.max(360,datas.length*28)}}><div className="pl-colunas" style={{gridTemplateColumns:`repeat(${Math.max(1,datas.length)},minmax(0,1fr))`}}>{leitura.porDia.map(d=><button key={d.data} className={`pl-coluna ${d.parcial?'pl-parcial':''}`} onClick={()=>{setFiltro('todos');abrirDia(d.data);}} aria-label={`Abrir ${dataCurta(d.data)}: ${d.futuro?'Futuro':horas(d.folhaMin)}`}><span className="pl-area-barra"><span className="pl-barra" style={{height:`${100*(d.folhaMin??0)/leitura.escalaDia}%`}}/></span><span className="pl-dia-numero">{dataCurta(d.data)}</span></button>)}</div></div></div><p className="pc-rodape">Totais conhecidos por dia. Barras listradas indicam base parcial.</p></details>
    {leitura.divergencias.length>0&&<details className="pc-grafico"><summary>{plural(leitura.divergencias.length,'diferença para o total de origem','diferenças para o total de origem')}</summary><p className="pc-ajuda">O painel usa o intervalo registrado. Estas diferenças permitem conferir a composição e não representam, sozinhas, erro na batida.</p>{leitura.divergencias.map(({p,data})=><button className="pc-diferenca" key={`${p.id}-${data}`} onClick={()=>{setFiltro('todos');abrirPessoa(p.id);abrirDia(data);}}>{p.nome} · {dataCurta(data)}<ChevronRight size={14}/></button>)}</details>}
  </div>;
}
