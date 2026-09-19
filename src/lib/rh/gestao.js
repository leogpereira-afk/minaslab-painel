// Visão de gestão adaptada do Painel, Relatórios e auditorias do RH Impresilk.
// Só consulta as coleções da MinasLab. Não deduz vínculo nem altera cadastros.
import { paraNumero, ymdLocal } from '../format.js';
import { completudeDaFicha } from './completudeCadastro.js';
import { situacaoExperiencia } from './clt.js';
import { cadenciaDe, cadenciaDaPessoa, combinadoVencido } from './feedbackCadencia.js';
import { feriasEmCurso } from './ferias.js';
import { aniversariosDoAno } from './aniversarios.js';

export function dataCivil(valor) {
  const s = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(s)) return null;
  const [a,m,d] = s.slice(0,10).split('-').map(Number);
  const data = new Date(a,m-1,d,12);
  return ymdLocal(data) === s.slice(0,10) ? data : null;
}
const texto = v => String(v ?? '').trim();
const dias = (a,b) => Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()) - Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000);
const normalizar = v => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const agrupar = (pessoas, campo) => {
  const mapa = new Map();
  for (const p of pessoas) {
    const nome = texto(p[campo]) || 'Sem registro';
    mapa.set(nome, (mapa.get(nome) || 0)+1);
  }
  return [...mapa].map(([nome,quantidade])=>({nome,quantidade})).sort((a,b)=>b.quantidade-a.quantidade || a.nome.localeCompare(b.nome,'pt-BR'));
};

export const CATEGORIAS_GESTAO = { cadastro:'Cadastro', experiencia:'Experiência', feedback:'Feedback', ferias:'Férias', exames:'Exames', vencimentos:'Vencimentos', integridade:'Conferência dos dados' };

export function montarGestao(dados, hojeISO, radar = { vigentes:[], emRisco:[], semData:[] }) {
  const hoje = dataCivil(hojeISO);
  if (!hoje) throw new Error('Data de referência inválida.');
  const pessoas = dados.pessoas || [];
  // Mesma base da lista atual; divergências do cadastro ficam explícitas na auditoria.
  const ativos = pessoas.filter(p=>p.ativo !== false);
  const porId = new Map(pessoas.map(p=>[p.id,p]));
  const pendencias = [];
  const adicionar = (p, categoria, titulo, detalhe, nivel='atencao', prazo='', registroId='') => {
    pendencias.push({ id:`${categoria}:${p?.id || 'sem-pessoa'}:${registroId}:${titulo}`, pessoaId:p?.id || '', nome:p?.nome || 'Pessoa não localizada', categoria, titulo, detalhe, nivel, prazo });
  };
  const ferias = dados.ferias || [];
  const feedbacks = dados.feedbacks || [];
  const experiencias = [];
  const deFerias = new Set();
  let salariosCentavos=0, salariosInformados=0;
  const completudes = [];
  for (const p of ativos) {
    const c = completudeDaFicha(p);
    completudes.push({pessoaId:p.id,...c});
    if (c.faltamEssenciais) adicionar(p,'cadastro','Completar campos essenciais',c.faltam.filter(f=>f.peso==='essencial').map(f=>f.rotulo).join(' · '));
    const adm = dataCivil(p.admissao);
    if (p.admissao && !adm) adicionar(p,'integridade','Conferir data de admissão','A data não existe no calendário.','erro');
    if (adm && adm>hoje) adicionar(p,'cadastro','Admissão futura no quadro atual','Confira a data e se esta pessoa já integra a equipe.');
    if (p.desligadoEm) adicionar(p,'integridade','Ativo com data de desligamento','Confira a situação na ficha; o painel não altera o vínculo.','erro');
    const salario = paraNumero(p.salario);
    if (salario>0) { salariosCentavos+=Math.round(salario*100); salariosInformados++; }
    // O cadastro de contrato manda. Não tratar PJ/estágio/freelancer como CLT.
    const contrato = normalizar(p.tipoContrato);
    const exp = adm ? situacaoExperiencia(p,hoje) : null;
    if (exp) {
      experiencias.push({pessoaId:p.id,nome:p.nome,...exp});
      if (exp.situacao!=='primeiro-periodo') adicionar(p,'experiencia','Conferir experiência',exp.situacao==='expirou' ? 'Prazo de referência ultrapassado. Confira a decisão na ficha.' : 'Prepare a conversa e confira a decisão de prorrogação ou efetivação.',exp.situacao==='expirou'?'erro':'atencao',ymdLocal(exp.fim));
    }
    const meusFeedbacks = feedbacks.filter(f=>f.pessoaId===p.id);
    const cadencia = cadenciaDe(meusFeedbacks, adm && adm<=hoje ? p.admissao : null,hoje,cadenciaDaPessoa({emExperiencia:!!exp,comPlanoAberto:p.planoAberto===true}));
    if (cadencia.situacao==='atrasado') adicionar(p,'feedback','Conversa de acompanhamento pendente',`Cadência ultrapassada há ${Math.abs(cadencia.diasParaProximo)} dias.`);
    for (const f of meusFeedbacks.filter(f=>combinadoVencido(f,hoje))) adicionar(p,'feedback','Retomar combinado vencido','Confira o combinado e registre o desfecho na aba Feedback.','atencao',f.combinadoPrazo,f.id);
    const minhasFerias = ferias.filter(f=>f.pessoaId===p.id && f.status!=='cancelada');
    if (minhasFerias.some(f=>feriasEmCurso(f,hoje))) deFerias.add(p.id);
    // Ausência de histórico não é dívida de férias; a conferência é explícita.
    if (!minhasFerias.length && adm && dias(hoje,adm)>=365 && (!contrato || contrato==='clt')) adicionar(p,'ferias','Conferir histórico de férias','Há pelo menos um ano de admissão e nenhum período registrado. Isso não comprova saldo nem férias vencidas.','informacao');
    for (const f of minhasFerias) {
      const ini=dataCivil(f.inicio),ret=dataCivil(f.retorno);
      if (!ini || !ret || ret<=ini) adicionar(p,'ferias','Conferir datas das férias','Informe início e retorno válidos, com retorno após o início.','erro','',f.id);
      else if (f.status==='concluida' && ini>hoje) adicionar(p,'ferias','Férias concluídas com início futuro','Confira o período e a situação registrada.','erro',f.inicio,f.id);
    }
    for (let i=0;i<minhasFerias.length;i++) for(let j=i+1;j<minhasFerias.length;j++) {
      const a=minhasFerias[i],b=minhasFerias[j];
      const ai=dataCivil(a.inicio), ar=dataCivil(a.retorno), bi=dataCivil(b.inicio),br=dataCivil(b.retorno);
      if(ai && ar && bi && br && ar>ai && br>bi && ai<br && bi<ar) adicionar(p,'ferias','Períodos de férias sobrepostos','Confira os dois registros antes de planejar a ausência.','erro',a.inicio,`${a.id}:${b.id}`);
    }
    if (!(radar.vigentes || []).some(e=>e.pessoaId===p.id)) adicionar(p,'exames','Sem exame registrado','Confira quais exames se aplicam à pessoa; ausência de registro não comprova regularidade.','informacao');
    if (p.gestorId && !porId.has(p.gestorId)) adicionar(p,'integridade','Gestor não localizado','O vínculo aponta para uma ficha que não está nesta base.','atencao');
  }
  for (const e of [...(radar.emRisco || []),...(radar.semData || [])]) {
    const p=porId.get(e.pessoaId); if(!p || p.ativo===false) continue;
    adicionar(p,'exames',e.dias==null?'Exame sem validade':e.dias<0?'Exame vencido':'Renovar exame',`${e.tipo || 'Exame'} · ${e.dias==null?'confira a validade':e.dias<0?`${-e.dias} dias após a validade`:`vence em ${e.dias} dias`}`,e.dias!=null&&e.dias<0?'erro':'atencao',e.vence || e.validade || '',e.id);
  }
  for (const v of dados.vencimentos || []) {
    const p=porId.get(v.pessoaId); if(!p || p.ativo===false) continue;
    const data=dataCivil(v.vence),restam=data?dias(data,hoje):null;
    if(restam==null || restam<=60) adicionar(p,'vencimentos',restam==null?'Vencimento sem data válida':restam<0?'Documento ou capacitação vencida':'Renovar documento ou capacitação',`${v.tipo || 'Registro'}${v.descricao ? ` · ${v.descricao}` : ''}`,restam!=null&&restam<0?'erro':'atencao',data?ymdLocal(data):'',v.id);
  }
  for (const [colecao,categoria] of [['ferias','ferias'],['feedbacks','feedback'],['exames','exames'],['vencimentos','vencimentos'],['historico','integridade']]) {
    for (const r of dados[colecao] || []) if (!porId.has(r.pessoaId)) adicionar(null,'integridade','Registro sem pessoa localizada',`${CATEGORIAS_GESTAO[categoria]} · ${r.pessoaNome || 'sem nome'} · registro ${r.id || 'sem ID'}. Confira o vínculo, sem associar pelo nome automaticamente.`,'erro','',`${colecao}:${r.id}`);
  }
  for (const p of pessoas.filter(p=>p.ativo===false && !dataCivil(p.desligadoEm))) adicionar(p,'integridade','Desligamento sem data válida','O histórico de movimentações fica incompleto até conferir a data.');
  const cpfs=new Map();
  for (const p of pessoas) {
    const cpf=texto(p.cpf).replace(/\D/g,''); if(cpf.length!==11) continue;
    if(!cpfs.has(cpf)) cpfs.set(cpf,[]); cpfs.get(cpf).push(p);
  }
  for (const grupo of cpfs.values()) if(grupo.length>1) for(const p of grupo) adicionar(p,'integridade','CPF repetido em mais de uma ficha','Confira se são cadastros duplicados ou histórico de recontratação. Não exclua sem revisar os vínculos.','erro');
  const ordem={erro:0,atencao:1,informacao:2};
  pendencias.sort((a,b)=>ordem[a.nivel]-ordem[b.nivel] || (a.prazo || '9999').localeCompare(b.prazo || '9999') || a.nome.localeCompare(b.nome,'pt-BR'));
  return { hojeISO,ativos,pendencias,experiencias,deFerias:[...deFerias],completudes,
    pessoasComPendencias:new Set(pendencias.filter(p=>p.pessoaId).map(p=>p.pessoaId)).size,
    salarios:{total:salariosInformados?salariosCentavos/100:null,informados:salariosInformados,semRegistro:ativos.length-salariosInformados},
    setores:agrupar(ativos,'setor'),contratos:agrupar(ativos,'tipoContrato'),
    aniversarios:aniversariosDoAno(ativos,hoje.getFullYear()),
    proximasFerias:ferias.filter(f=>f.status==='marcada' && ativos.some(p=>p.id===f.pessoaId) && dataCivil(f.inicio) && dataCivil(f.retorno)>dataCivil(f.inicio) && f.retorno>hojeISO).sort((a,b)=>a.inicio.localeCompare(b.inicio)),
  };
}

/** Fluxos do período; o quadro e salários atuais nunca viram históricos fictícios. */
export function movimentacaoPeriodo(pessoas, mes, hojeISO) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido.');
  const inicio=`${mes}-01`;
  const [ano,m]=mes.split('-').map(Number);
  const fim=ymdLocal(new Date(ano,m,0,12));
  const ate=fim<hojeISO?fim:hojeISO;
  const dentro=v=>!!dataCivil(v) && String(v).slice(0,10)>=inicio && String(v).slice(0,10)<=ate;
  return {inicio,fim,ate,futuro:inicio>hojeISO,
    admissoes:pessoas.filter(p=>dentro(p.admissao)),
    desligamentos:pessoas.filter(p=>dentro(p.desligadoEm)),
    semAdmissao:pessoas.filter(p=>!dataCivil(p.admissao)).length,
    semDesligamento:pessoas.filter(p=>p.ativo===false&&!dataCivil(p.desligadoEm)).length,
  };
}

/** Filtro único para a lista e a planilha. */
export function filtrarPendencias(pendencias,{categoria='',nivel='',busca=''}={}) {
  const termo=normalizar(busca);
  return pendencias.filter(p=>(!categoria||p.categoria===categoria)&&(!nivel||p.nivel===nivel)&&(!termo||normalizar(`${p.nome} ${p.titulo} ${p.detalhe}`).includes(termo)));
}

/** Anos do cadastro e ano atual, sem oferecer meses futuros. */
export function mesesParaRelatorio(pessoas, hojeISO) {
  const atual=hojeISO.slice(0,7);
  const anos=new Set([hojeISO.slice(0,4)]);
  for(const p of pessoas) for(const campo of ['admissao','desligadoEm']) {
    if(dataCivil(p[campo]) && String(p[campo]).slice(0,10)<=hojeISO) anos.add(String(p[campo]).slice(0,4));
  }
  return [...anos].flatMap(ano=>Array.from({length:12},(_,m)=>`${ano}-${String(m+1).padStart(2,'0')}`)).filter(m=>m<=atual).sort().reverse();
}
