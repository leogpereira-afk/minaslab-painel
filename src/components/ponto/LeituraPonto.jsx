import { useMemo } from 'react';
import { ArrowRight, AlertCircle, Info, ChevronRight, Clock3, Coffee, CheckCircle2 } from 'lucide-react';
import { duracaoTexto } from '../../lib/rh/ponto.js';
import { composicaoIntervalo } from '../../lib/pontoPeriodo.js';
import { leituraPonto, situacaoPonto } from '../../lib/pontoLeitura.js';
import './leituraPonto.css';

const horas = n => n == null ? '—' : duracaoTexto(n);
const dataCurta = d => `${d.slice(8,10)}/${d.slice(5,7)}`;
const nomeDia = d => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
const iniciais = nome => nome.trim().split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('');
const plural = (n,um,muitos) => `${n} ${n===1?um:muitos}`;

function Registro({p,data,d,hoje,jornada,individual}) {
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
      {composicao&&<div className="pl-composicao"><p>Composição do tempo registrado <strong>{horas(c.registradasMin)}</strong></p><div className="pl-composicao-barra" aria-hidden="true"><i style={{width:`${100*c.efetivoMin/c.registradasMin}%`}}/><i className="pl-paga" style={{width:`${100*c.pausaPagaMin/c.registradasMin}%`}}/><i className="pl-pausa" style={{width:`${100*c.pausaMin/c.registradasMin}%`}}/></div><div className="pl-legenda-composicao"><span>Trabalho efetivo {horas(c.efetivoMin)}</span><span>Pausa paga {horas(c.pausaPagaMin)}</span><span>Intervalo não pago {horas(c.pausaMin)}</span></div></div>}
      <dl className="pl-detalhes"><div><dt>Entrada</dt><dd>{d?.entrada||'—'}</dd></div><div><dt>Saída</dt><dd>{d?.saida||'—'}</dd></div><div><dt>Intervalo não pago</dt><dd>{horas(c.pausaMin)}</dd></div><div><dt>Pausa paga</dt><dd>{horas(c.pausaPagaMin)}</dd></div><div><dt>Trabalho efetivo</dt><dd>{horas(c.efetivoMin)}</dd></div><div><dt>Horas consideradas</dt><dd>{horas(c.folhaMin)}</dd></div><div><dt>Total de origem</dt><dd>{horas(c.originalJibbleMin)}</dd></div><div><dt>Situação</dt><dd>{status}</dd></div></dl>
      {c.diferencaMin!==null&&c.diferencaMin!==0&&<p className="pl-nota">Diferença da origem: {c.diferencaMin>0?'+':'−'}{horas(Math.abs(c.diferencaMin))}. O painel desconta o intervalo uma única vez; o total original está preservado.</p>}
      {!d&&<p className="pl-nota">Não há registro deste dia no recorte. Isso não confirma falta.</p>}
    </div>
  </details>;
}

export default function LeituraPonto({pessoas,datas,indice,hoje,jornada,visao,pessoa,abrirPessoa,abrirDia,abrirRegistro}) {
  const leitura=useMemo(()=>leituraPonto({pessoas,datas,porPessoa:indice.porPessoa,hoje,jornada}),[pessoas,datas,indice,hoje,jornada]);
  const {resumo,pendentes,divergencias,diasUteisSemDados}=leitura;
  const parcial=pendentes.length>0||leitura.lacunas.length>0;
  const primeiraPendencia=pendentes[0];
  const primeiraDiferenca=divergencias[0];
  return <div className="pl-painel">
    <section className="pl-numeros" aria-label="Leitura das horas do período">
      <div className="pl-numero-principal"><span>Horas consideradas {parcial&&<em>base parcial</em>}</span><strong>{horas(resumo.folhaMin)}</strong><small>{plural(leitura.registros.length,'registro diário','registros diários')} · horas extras incluídas</small></div>
      <div className="pl-numero-apoio"><Coffee size={17}/><div><span>Intervalo não pago</span><strong>{horas(resumo.pausaMin)}</strong><small>Somente o registrado</small></div></div>
      <div className="pl-numero-apoio"><Clock3 size={17}/><div><span>Trabalho efetivo</span><strong>{horas(resumo.efetivoMin)}</strong><small>Sem pausas pagas ou não pagas</small></div></div>
    </section>
    <section className="pl-visual" aria-label="Distribuição e qualidade dos registros">
      <div className="pl-historico">
        <div className="pl-titulo-secao"><div><h3>O período, dia a dia</h3><p>{plural(leitura.diasComDados,'dia com informação','dias com informação')} · total de horas conhecidas por dia</p></div><span>horas</span></div>
        <div className="pl-grafico-scroll" tabIndex={0} aria-label="Gráfico de horas por dia; use os botões para detalhar">
          <div className="pl-grafico" style={{minWidth:visao==='mes'?Math.max(600,datas.length*30):undefined}}>
            <div className="pl-eixo" aria-hidden="true"><span>{horas(leitura.escalaDia)}</span><span>0h</span></div>
            <div className="pl-colunas" style={{gridTemplateColumns:`repeat(${Math.max(1,datas.length)},minmax(0,1fr))`}}>
              {leitura.porDia.map(d=><button key={d.data} className={`pl-coluna ${d.futuro?'pl-futuro':''} ${d.parcial&&d.folhaMin!==null?'pl-parcial':''}`} onClick={()=>abrirDia(d.data)} aria-label={`${dataCurta(d.data)}: ${d.futuro?'futuro':d.registros?`${horas(d.folhaMin)}, ${d.registros} registros${d.parcial?', total parcial':''}`:'sem dados'}`} title={`${dataCurta(d.data)} · ${d.registros?horas(d.folhaMin):d.futuro?'Futuro':'Sem dados'} · ${d.registros} registros${d.parcial?', base parcial':''}`}>
                <span className="pl-area-barra"><span className="pl-barra" style={{height:`${d.folhaMin===null?0:100*d.folhaMin/leitura.escalaDia}%`}}/><span className="pl-barra-valor">{d.futuro?'':d.folhaMin===null?'—':visao==='mes'?'':horas(d.folhaMin)}</span>{d.folhaMin===null&&<i className="pl-sem-dado" aria-hidden="true"/>}</span>
                <span className="pl-dia-numero">{visao==='mes'?d.data.slice(8,10):dataCurta(d.data)}</span><small>{visao==='mes'?'':nomeDia(d.data)}</small>
              </button>)}
            </div>
          </div>
        </div>
        <p className="pl-nota"><span className="pl-chave-barra"/>Horas consideradas <span className="pl-chave-parcial"/>Base parcial <span className="pl-chave-vazio">—</span>Sem dados / futuro</p>
      </div>
      <aside className="pl-atencao"><h3>Como ler este período</h3>
        {diasUteisSemDados.length>0&&<button className="pl-observacao" onClick={()=>abrirDia(diasUteisSemDados[0].data)}><Info size={18}/><span><strong>{plural(diasUteisSemDados.length,'dia da escala sem dados','dias da escala sem dados')}</strong><small>Confira a última importação antes de interpretar o total.</small></span><ChevronRight size={15}/></button>}
        {diasUteisSemDados.length===0&&leitura.lacunas.length>0&&<button className="pl-observacao" onClick={()=>abrirRegistro(leitura.lacunas[0])}><Info size={18}/><span><strong>Nem todas as pessoas têm dados</strong><small>Há dias sem registro individual. Isso não confirma falta.</small></span><ChevronRight size={15}/></button>}
        {primeiraPendencia?<button className="pl-observacao pl-alerta" onClick={()=>abrirRegistro(primeiraPendencia)}><AlertCircle size={18}/><span><strong>{plural(pendentes.length,'registro a conferir','registros a conferir')}</strong><small>Intervalo ausente ou batida incompleta. Abrir o primeiro.</small></span><ChevronRight size={15}/></button>:<p className="pl-observacao"><CheckCircle2 size={18}/><span><strong>{leitura.registros.length?'Sem pendência nos registros recebidos':'Ainda sem registros neste recorte'}</strong><small>{leitura.registros.length?'Confira também os dias sem informação.':'Selecione outro período ou confira a importação.'}</small></span></p>}
        {primeiraDiferenca&&<button className="pl-observacao" onClick={()=>abrirRegistro(primeiraDiferenca)}><Info size={18}/><span><strong>{plural(divergencias.length,'diferença da origem','diferenças da origem')}</strong><small>O intervalo é descontado uma vez. Compare com o Jibble.</small></span><ChevronRight size={15}/></button>}
      </aside>
    </section>
    {visao!=='dia'&&!pessoa?<section className="pl-equipe"><div className="pl-titulo-secao"><div><h3>A equipe no período</h3><p>Horas conhecidas por pessoa · selecione para ver dias e batidas</p></div><span>{pessoas.length} pessoas</span></div>
      {leitura.equipe.map(r=><button className="pl-pessoa" key={r.p.id} onClick={()=>abrirPessoa(r.p.id)}><span className="pl-avatar" aria-hidden="true">{iniciais(r.p.nome)}</span><span className="pl-pessoa-nome"><strong>{r.p.nome}</strong><small>{r.registros?`${plural(r.registros,'registro diário','registros diários')}${r.pendentes?` · ${r.pendentes} a conferir`:''}`:'Sem registros no período'}</small></span><span className="pl-comparacao" aria-hidden="true"><i style={{width:`${100*(r.folhaMin??0)/leitura.escalaPessoa}%`}}/></span><span className="pl-pessoa-total">{horas(r.folhaMin)}</span><ChevronRight size={16}/></button>)}
      <p className="pl-nota">Comparação dos registros disponíveis. Diferenças de horas não representam uma avaliação de produtividade.</p>
    </section>:<section className="pl-equipe"><div className="pl-titulo-secao"><div><h3>{pessoa?.nome||'As batidas do dia'}</h3><p>Entrada, saída e intervalo juntos · abra uma linha para conferir a composição</p></div></div>{pessoas.flatMap(p=>datas.filter(data=>data<=hoje).map(data=><Registro key={`${p.id}-${data}`} p={p} data={data} d={indice.porPessoa.get(p.id)?.dias.get(data)} hoje={hoje} jornada={jornada} individual={!!pessoa}/>))}</section>}
  </div>;
}
