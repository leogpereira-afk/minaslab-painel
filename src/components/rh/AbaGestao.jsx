import { useMemo, useState } from 'react';
import { ArrowRight, Download, Users, ClipboardCheck, Wallet, CalendarDays } from 'lucide-react';
import { Card, SectionTitle, StatCard } from '../ui.jsx';
import { dataLonga, moedaCheia, MESES_LONGOS } from '../../lib/format.js';
import { baixarPlanilha } from '../../lib/planilha.js';
import { CATEGORIAS_GESTAO, filtrarPendencias, movimentacaoPeriodo, mesesParaRelatorio } from '../../lib/rh/gestao.js';
import './gestao.css';

const NIVEL = {erro:'Conferir primeiro',atencao:'Acompanhar',informacao:'Completar informação'};
const COLUNAS = [
  {chave:'nome',rotulo:'Pessoa'}, {chave:'categoria',rotulo:'Assunto'}, {chave:'nivel',rotulo:'Prioridade'},
  {chave:'titulo',rotulo:'Pendência'}, {chave:'detalhe',rotulo:'O que conferir'}, {chave:'prazo',rotulo:'Data de referência',tipo:'data'},
];

function Distribuicao({titulo,grupos,total}) {
  return <Card><SectionTitle titulo={titulo} sub="Quadro atual · inclui vínculos ainda não informados" />
    {!grupos.length && <p className="text-sm text-slate-500">Nenhuma pessoa no quadro.</p>}
    <ul className="space-y-4">{grupos.map(g=><li key={g.nome}>
      <div className="mb-1 flex justify-between gap-3 text-sm"><span>{g.nome}</span><strong>{g.quantidade}</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-brand" style={{width:`${total?g.quantidade/total*100:0}%`}} /></div>
    </li>)}</ul>
  </Card>;
}

function Movimentos({titulo,lista,dataCampo}) {
  return <div><h3 className="mb-3 font-semibold">{titulo} <span className="chip">{lista.length}</span></h3>
    {!lista.length && <p className="text-sm text-slate-500">Nenhum registro no período.</p>}
    <ul className="divide-y divide-slate-100">{lista.map(p=><li key={p.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{p.nome}</span><time>{dataLonga(p[dataCampo])}</time></li>)}</ul>
  </div>;
}

export default function AbaGestao({gestao,dados,hojeISO,relatorios=false,aoNavegar,setAviso}) {
  const [categoria,setCategoria]=useState('');
  const [nivel,setNivel]=useState('');
  const [busca,setBusca]=useState('');
  const [mes,setMes]=useState(hojeISO.slice(0,7));
  const [limite,setLimite]=useState(12);
  const filtradas=useMemo(()=>filtrarPendencias(gestao.pendencias,{categoria,nivel,busca}),[gestao.pendencias,categoria,nivel,busca]);
  const periodo=useMemo(()=>movimentacaoPeriodo(dados.pessoas,mes,hojeISO),[dados.pessoas,mes,hojeISO]);
  const mudarFiltro=(setter,valor)=>{setter(valor);setLimite(12);};
  const exportar=(nome,titulo,colunas,linhas)=>{
    if(!linhas.length) return setAviso({tipo:'erro',texto:'Não há registros neste recorte para baixar.'});
    try {const arquivo=baixarPlanilha({nome,titulo,colunas,linhas});setAviso({tipo:'ok',texto:`Planilha gerada: ${arquivo} · ${linhas.length} registros.`});}
    catch(e){setAviso({tipo:'erro',texto:`Não foi possível gerar a planilha: ${e.message}`});}
  };
  const baixarPendencias=()=>exportar('rh-pendencias',`Pendências do quadro e histórico · ${dataLonga(hojeISO)} · ${CATEGORIAS_GESTAO[categoria] || 'Todos os assuntos'} · ${NIVEL[nivel] || 'Todas as prioridades'}`,COLUNAS,filtradas.map(p=>({...p,categoria:CATEGORIAS_GESTAO[p.categoria],nivel:NIVEL[p.nivel]})));
  const essenciais=gestao.completudes.filter(c=>c.faltamEssenciais>0).length;
  return <div className="rh-gestao space-y-5">
    <section className="rh-gestao-capa" aria-labelledby="rh-gestao-titulo">
      <div><p className="rh-gestao-eyebrow">MINASLAB · GESTÃO DE PESSOAS</p><h2 id="rh-gestao-titulo">{relatorios?'Informação para decidir.':'Cuidar da equipe começa por enxergar.'}</h2>
        <p>{relatorios?'Relatórios com origem, período e pendências visíveis.':'Prioridades, prazos e pessoas conectados em uma única visão.'}</p></div>
      <span className="rh-gestao-data"><CalendarDays size={17} /> Quadro em {dataLonga(hojeISO)}</span>
    </section>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard rotulo="Pessoas no quadro" valor={String(gestao.ativos.length)} sub={`${gestao.deFerias.length} de férias · ${gestao.experiencias.length} com experiência a acompanhar`} icone={Users} tom="brand" onClick={()=>aoNavegar('pessoas')} />
      <StatCard rotulo="Fichas com lacunas essenciais" valor={String(essenciais)} sub="Admissão, cargo, CPF ou salário" icone={ClipboardCheck} tom={essenciais?'warn':'neutral'} onClick={()=>mudarFiltro(setCategoria,'cadastro')} />
      <StatCard rotulo="Pendências para conferir" valor={String(gestao.pendencias.length)} sub={`${gestao.pessoasComPendencias} pessoas identificadas · quadro e histórico`} icone={ClipboardCheck} tom={gestao.pendencias.some(p=>p.nivel==='erro')?'bad':'neutral'} onClick={()=>{setCategoria('');setNivel('');setBusca('');setLimite(12);}} />
      <StatCard rotulo="Salários cadastrados" valor={gestao.salarios.total==null?'Sem registro':moedaCheia(gestao.salarios.total)} sub={`${gestao.salarios.informados} de ${gestao.ativos.length} informados · não representa folha paga`} icone={Wallet} tom="neutral" />
    </div>

    {relatorios && <Card>
      <SectionTitle titulo="📊 Movimentações da equipe" sub="Admissões e desligamentos registrados no mês. O quadro e os salários acima continuam sendo os atuais." />
      <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Mês do relatório<select className="input mt-1" value={mes} onChange={e=>setMes(e.target.value)}>{mesesParaRelatorio(dados.pessoas,hojeISO).map(m=><option key={m} value={m}>{MESES_LONGOS[Number(m.slice(5))-1]} de {m.slice(0,4)}</option>)}</select></label>
        <button type="button" className="btn-outline" disabled={!periodo.admissoes.length&&!periodo.desligamentos.length} onClick={()=>exportar('rh-movimentacoes',`Movimentações · ${mes} · apurado até ${dataLonga(periodo.ate)}`,[{chave:'nome',rotulo:'Pessoa'},{chave:'movimento',rotulo:'Movimentação'},{chave:'data',rotulo:'Data',tipo:'data'}],[...periodo.admissoes.map(p=>({nome:p.nome,movimento:'Admissão',data:p.admissao})),...periodo.desligamentos.map(p=>({nome:p.nome,movimento:'Desligamento',data:p.desligadoEm}))])}><Download size={16} /> Baixar movimentações</button>
      </div>
      {(periodo.semAdmissao>0||periodo.semDesligamento>0) && <p className="mb-4 rounded-xl bg-warn-50 p-3 text-sm text-warn-800">Base incompleta: {periodo.semAdmissao} fichas sem admissão válida e {periodo.semDesligamento} desligados sem data válida. Não entram nos totais por mês.</p>}
      <div className="grid gap-6 md:grid-cols-2"><Movimentos titulo="Admissões" lista={periodo.admissoes} dataCampo="admissao"/><Movimentos titulo="Desligamentos" lista={periodo.desligamentos} dataCampo="desligadoEm"/></div>
      <p className="mt-4 text-xs text-slate-500">Fonte: datas das fichas. Recontratações sem histórico completo não podem ser reconstruídas por este relatório.</p>
    </Card>}

    <Card>
      <SectionTitle titulo="🎯 Prioridades por pessoa" sub="As ocorrências podem envolver a mesma pessoa. Cada item indica o que conferir, sem corrigir dados automaticamente." acao={<button type="button" className="btn-outline" onClick={baixarPendencias} disabled={!filtradas.length}><Download size={16} /> Baixar este recorte</button>} />
      <div className="rh-gestao-filtros">
        <label>Assunto<select className="input" value={categoria} onChange={e=>mudarFiltro(setCategoria,e.target.value)}><option value="">Todos os assuntos</option>{Object.entries(CATEGORIAS_GESTAO).map(([id,nome])=><option value={id} key={id}>{nome} ({gestao.pendencias.filter(p=>p.categoria===id).length})</option>)}</select></label>
        <label>Prioridade<select className="input" value={nivel} onChange={e=>mudarFiltro(setNivel,e.target.value)}><option value="">Todas as prioridades</option>{Object.entries(NIVEL).map(([id,nome])=><option value={id} key={id}>{nome}</option>)}</select></label>
        <label>Buscar pendência<input type="search" className="input" value={busca} onChange={e=>mudarFiltro(setBusca,e.target.value)} placeholder="Pessoa ou assunto" /></label>
      </div>
      <p className="my-3 text-sm text-slate-500" role="status">{filtradas.length} {filtradas.length === 1 ? "pendência" : "pendências"} neste recorte</p>
      {!filtradas.length && <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Nenhuma pendência neste recorte. Isso não comprova que todos os documentos e históricos estejam cadastrados.</div>}
      <ul className="space-y-3">{filtradas.slice(0,limite).map(p=><li className={`rh-pendencia rh-pendencia-${p.nivel}`} key={p.id}>
        <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className={p.nivel==='erro'?'chip-bad':p.nivel==='atencao'?'chip-warn':'chip'}>{NIVEL[p.nivel]}</span><span className="text-xs text-slate-500">{CATEGORIAS_GESTAO[p.categoria]}</span></div><h3>{p.nome} · {p.titulo}</h3><p>{p.detalhe}</p>{p.prazo && <p className="mt-1 font-medium">Referência: {dataLonga(p.prazo)}</p>}</div>
        <button type="button" className="btn-outline shrink-0" aria-label={`Conferir ${p.titulo} de ${p.nome}`} onClick={()=>aoNavegar(p.categoria==='cadastro'||p.categoria==='experiencia'||p.categoria==='integridade'?'pessoas':p.categoria,p.pessoaId)}>Conferir <ArrowRight size={15}/></button>
      </li>)}</ul>
      {filtradas.length>limite && <button type="button" className="btn-outline mt-4" onClick={()=>setLimite(n=>n+24)}>Mostrar mais ({filtradas.length-limite} restantes)</button>}
    </Card>



    <div className="grid gap-5 lg:grid-cols-2"><Distribuicao titulo="👥 Equipe por setor" grupos={gestao.setores} total={gestao.ativos.length}/><Distribuicao titulo="🤝 Vínculos informados" grupos={gestao.contratos} total={gestao.ativos.length}/></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><SectionTitle titulo="🌴 Agenda de férias" sub="Períodos em curso e próximos · retorno é o dia de voltar" acao={<button type="button" className="btn-outline" onClick={()=>aoNavegar('ferias')}>Abrir férias</button>}/>
        {!gestao.proximasFerias.length && <p className="text-sm text-slate-500">Sem períodos em curso ou futuros com datas completas.</p>}
        <ul className="divide-y divide-slate-100">{gestao.proximasFerias.slice(0,8).map(f=><li key={f.id} className="py-3"><strong className="text-sm">{dados.pessoas.find(p=>p.id===f.pessoaId)?.nome || f.pessoaNome}</strong><p className="mt-1 text-sm text-slate-500">{dataLonga(f.inicio)} → {dataLonga(f.retorno)}</p></li>)}</ul>
        {gestao.proximasFerias.length>8 && <p className="mt-3 text-sm text-slate-500">Mais {gestao.proximasFerias.length-8} períodos na aba Férias.</p>}
      </Card>
      <Card><SectionTitle titulo="🎂 Datas da equipe" sub="Aniversários e tempo de casa no mês atual"/>
        <ul className="divide-y divide-slate-100">{gestao.aniversarios.ocorrencias.filter(o=>o.dia.slice(0,7)===hojeISO.slice(0,7)).map(o=><li key={`${o.pessoaId}:${o.tipo}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><strong>{o.nome}</strong><br/>{o.tipo==='nascimento'?'Aniversário':`${o.anos} ano(s) de casa${o.conferida?'':' · admissão a conferir'}`}</span><span>{dataLonga(o.dia)}</span></li>)}</ul>
        {!gestao.aniversarios.ocorrencias.some(o=>o.dia.slice(0,7)===hojeISO.slice(0,7)) && <p className="text-sm text-slate-500">Nenhuma data neste mês entre os registros disponíveis.</p>}
        {gestao.aniversarios.semNascimento>0 && <p className="mt-3 text-xs text-slate-500">{gestao.aniversarios.semNascimento} {gestao.aniversarios.semNascimento === 1 ? "pessoa sem data de nascimento válida" : "pessoas sem data de nascimento válida"}.</p>}
      </Card>
    </div>
    <p className="text-xs leading-relaxed text-slate-500">Fonte: cadastros, férias, feedbacks, exames, vencimentos e histórico da MinasLab. Indicadores de salário não incluem encargos, benefícios ou pagamentos. Ponto permanece no módulo próprio. Decisões de vínculo e correções continuam sob conferência do RH.</p>
  </div>;
}
