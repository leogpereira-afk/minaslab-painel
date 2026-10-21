import {marcaMarketing} from './marketing-marcas.mjs';
// Projeção privada por empresa. Dados de outras empresas nunca são fallback.
export const CHAVE_FORTEMAIS = 'leo_marketing_fortemais';
export const CHAVE_ADMIN = 'leo_marketing_fortemais_admin';
export const CANAIS_DIRETOS=['ga4','search','perfil','instagram','google_ads','meta_ads'];
export const CATALOGO = Object.freeze({
 facebook:{nome:'Facebook',metricas:['alcance','visualizacoes','interacoes','cliques','visitas_perfil','novos_seguidores'],tabelas:{}},
 pixel:{nome:'Pixel Meta',metricas:['eventos','pageview','lead','contact'],tabelas:{eventos:['eventos']}},
 linkedin:{nome:'LinkedIn',metricas:['impressoes','cliques','reacoes','comentarios','compartilhamentos','seguidores','visitas'],tabelas:{}},
 pinterest:{nome:'Pinterest',metricas:['impressoes','cliques','salvamentos','cliques_saida','alcance'],tabelas:{}},
 ga4:{nome:'Site',metricas:['usuarios','novos_usuarios','sessoes','sessoes_engajadas','taxa_engajamento','tempo_engajamento','visualizacoes','eventos','eventos_chave','cliques_whatsapp','formularios'],tabelas:{paginas:['visualizacoes','usuarios'],canais:['sessoes','eventos_chave'],cidades:['usuarios'],dispositivos:['usuarios'],eventos:['eventos']}},
 search:{nome:'Busca Google',metricas:['cliques','impressoes','ctr','posicao'],tabelas:{consultas:['cliques','impressoes','ctr','posicao'],paginas:['cliques','impressoes','ctr','posicao'],paises:['cliques','impressoes'],dispositivos:['cliques','impressoes']}},
 perfil:{nome:'Perfil da Empresa',metricas:['impressoes_busca','impressoes_maps','cliques_site','ligacoes','rotas','conversas','reservas'],tabelas:{termos:['impressoes']}},
 instagram:{nome:'Instagram',metricas:['alcance','visualizacoes','visitas_perfil','interacoes','curtidas','comentarios','compartilhamentos','salvos','toques_links','seguidores','novos_seguidores','deixaram_seguir'],tabelas:{conteudos:['alcance','visualizacoes','interacoes','salvos','compartilhamentos'],cidades:['seguidores'],formatos:['visualizacoes','interacoes']}},
 google_ads:{nome:'Google Ads',metricas:['gasto','impressoes','cliques','ctr','cpc','conversoes','custo_conversao'],tabelas:{campanhas:['gasto','impressoes','cliques','conversoes'],termos:['cliques','gasto','conversoes']}},
 meta_ads:{nome:'Meta Ads',metricas:['gasto','alcance','impressoes','frequencia','cliques','ctr','cpc','cpm','leads','custo_lead','conversas'],tabelas:{campanhas:['gasto','alcance','cliques','leads'],anuncios:['gasto','impressoes','cliques','leads']}}
});
const arr=x=>Array.isArray(x)?x:[];
const texto=x=>typeof x==='string'?x.slice(0,240):'';
const numero=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const instante=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const dia=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&instante(x)&&new Date(x).toISOString().slice(0,10)===x?x:null;
const host=x=>{try{return new URL(x).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}};
const estados=['ok','parcial','pendente','reconectar','sem_permissao','erro','aguardando_provedor'];
const progressos=['nao_verificado','localizado','aguarda_autorizacao','bloqueado','autorizado'];
function metricas(x,chaves){return Object.fromEntries(chaves.map(k=>[k,numero(x?.[k])]))}
function intervalo(p){const inicio=dia(p?.inicio),fim=dia(p?.fim);return inicio&&fim&&inicio<=fim?{inicio,fim}:null}
function vinculo(id,f,marca){
 if(f?.empresa!==marca.id)return false;
 if(['facebook','pixel','linkedin','pinterest'].includes(id))return f.identidade?.vinculo_confirmado===true;
 if(id==='instagram')return f.identidade?.usuario?.toLowerCase()===marca.instagram;
 if(id==='ga4'||id==='search'||id==='perfil')return host(f.identidade?.site)===marca.host;
 // Mídia paga: conta deve ter sido vinculada pelo dono; o nome não prova empresa.
 return f.identidade?.vinculo_confirmado===true&&typeof f.identidade?.conta==='string'&&/^\d[\d-]{2,40}$/.test(f.identidade.conta);
}
export function projetarFonte(id,bruto,agora,marca){
 const c=CATALOGO[id],base={id,nome:c.nome,estado:'pendente',coletadoEm:null,atrasado:false,identidade:'',moeda:null,periodos:[],avisos:[]};
 if(!bruto)return base;
 if(!vinculo(id,bruto,marca))return {...base,estado:'vinculo_divergente'};
 const coletadoEm=instante(bruto.coletadoEm),estado=estados.includes(bruto.estado)?bruto.estado:'erro';
 const f={...base,estado,coletadoEm,moeda:/^[A-Z]{3}$/.test(bruto.moeda||'')?bruto.moeda:null,atrasado:!!coletadoEm&&agora-Date.parse(coletadoEm)>48*3600000,identidade:id==='instagram'?'@'+marca.instagram:id.endsWith('_ads')?'Conta '+bruto.identidade.conta:['facebook','pixel','linkedin','pinterest'].includes(id)?texto(bruto.identidade.nome)||marca.nome:marca.host};
 if(!coletadoEm||Date.parse(coletadoEm)>agora+300000)return {...f,estado:'erro',coletadoEm:null};
 if(!['ok','parcial'].includes(estado))return f;
 const vistos=new Set();
 f.periodos=arr(bruto.periodos).slice(0,12).flatMap(p=>{
  const periodo=intervalo(p);if(!periodo)return [];
  const chave=periodo.inicio+'_'+periodo.fim;if(vistos.has(chave))return [];vistos.add(chave);
  const tabelas=Object.fromEntries(Object.entries(c.tabelas).map(([nome,ks])=>[nome,arr(p.tabelas?.[nome]).slice(0,100).map(row=>({nome:texto(row.nome),...metricas(row,ks)}))]));
  const datas=new Set();const serie=arr(p.serie).slice(0,366).filter(row=>{if(!dia(row.dia)||row.dia<periodo.inicio||row.dia>periodo.fim||datas.has(row.dia))return false;datas.add(row.dia);return true}).map(row=>({dia:row.dia,...metricas(row,c.metricas)})).sort((a,b)=>a.dia.localeCompare(b.dia));
  return [{id:chave,...periodo,completo:p.completo===true,metricas:metricas(p.metricas,c.metricas),tabelas,serie}];
 }).sort((a,b)=>b.fim.localeCompare(a.fim)||b.inicio.localeCompare(a.inicio));
 if(bruto.qualidade?.amostragem)f.avisos.push('Relatório com amostragem.');
 if(bruto.qualidade?.limiar_privacidade)f.avisos.push('O provedor aplicou limites de privacidade.');
 if(bruto.qualidade?.limitado)f.avisos.push('Listagem limitada; as linhas não representam necessariamente o total.');
 return f;
}
const campos=['responsavel','conta','ativo','observacao'];
export function limparAdmin(entrada,empresa='fortemais'){
 const fontes={};for(const id of empresa==='impresilk'?Object.keys(CATALOGO):CANAIS_DIRETOS){
  const r=entrada?.fontes?.[id]||{};
  fontes[id]={...Object.fromEntries(campos.map(k=>[k,texto(r[k])])),situacao:progressos.includes(r.situacao)?r.situacao:'nao_verificado'};
 }
 return {fontes};
}
export function detalharFortemais(linhas,agora=Date.now(),empresa='fortemais'){
 const marca=marcaMarketing(empresa),chave='leo_marketing_'+empresa;
 const map=new Map(arr(linhas).map(r=>[r.chave,r.valor]));const dados=map.get(chave);
 return {versao:1,fontes:CANAIS_DIRETOS.map(id=>projetarFonte(id,map.get(chave+'_direto_'+id)||(dados?.empresa===marca.id?dados.fontes?.[id]:null),agora,marca)),administracao:limparAdmin(map.get(chave+'_admin'),empresa)};
}
export async function salvarAdminFortemais(sb,entrada,empresa='fortemais'){
 marcaMarketing(empresa);
 const admin=limparAdmin(entrada,empresa);const {error}=await sb.from('painel_cache').upsert({chave:'leo_marketing_'+empresa+'_admin',valor:admin,atualizado_em:new Date().toISOString()},{onConflict:'chave'});
 if(error)throw Error('Não foi possível salvar a administração.');return {ok:true,administracao:admin};
}
