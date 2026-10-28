import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { ArrowRight,Building2,Check,ChevronRight,ClipboardList,FileText,History,Mail,MessageCircle,Paperclip,Pencil,RefreshCw,Reply,Save,Search,Send,UserRoundPlus,X } from 'lucide-react'
import { Link,useNavigate } from 'react-router-dom'
import { PageShell } from '../../components/ui/PageShell'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PeriodSelect } from '../../components/ui/PeriodFilter'
import { currentPeriod, inPeriod, yearsFrom, type PeriodFilter } from '../../lib/period'

type Atendimento={id:string;lead_id:string|null;cliente_id:string|null;contato_id:string|null;ocorrido_em:string;canal:string|null;assunto:string|null;resumo:string|null;external_id:string|null;source_system:string;usuario_id:string|null}
type Lead={id:string;nome:string|null;telefone_whatsapp:string|null;origem:string|null;assunto:string|null;status:string|null;tipo_analise:string|null;responsavel_id:string|null;data_primeiro_atendimento:string|null;resumo:string|null;cliente_convertido_id:string|null;contato_convertido_id:string|null;email_contato?:string|null;empresa_contato?:string|null;chatpro_situacao?:'ABERTO'|'FINALIZADO'|null;chatpro_aberto_em?:string|null;chatpro_finalizado_em?:string|null;chatpro_finalizado_por?:string|null;chatpro_responsavel?:string|null;chatpro_protocolo?:string|null;chatpro_motivo?:string|null;chatpro_nps?:string|null;chatpro_setor?:string|null}
type Cliente={id:string;nome_fantasia:string|null;razao_social:string|null;telefone_principal:string|null;email_principal:string|null}
type Contato={id:string;cliente_id:string;nome:string;telefone:string|null;whatsapp:string|null;email:string|null}
type Interacao={id:string;lead_id:string|null;cliente_id:string|null;contato_id:string|null;ocorrido_em:string;descricao:string;tipo:string|null;source_system?:string|null;external_id?:string|null;phone_e164?:string|null;direction?:'RECEIVED'|'SENT'|null;message_kind?:'TEXT'|'AUDIO'|'IMAGE'|'VIDEO'|'DOCUMENT'|'OTHER'|null;message_text?:string|null;media_url?:string|null;media_mime?:string|null;media_name?:string|null;delivery_status?:string|null}
type Perfil={id:string;nome:string|null;ativo:boolean}
type Oportunidade={id:string;cliente_id:string|null;titulo:string|null;status:string|null;estagio:string|null}
type Proposta={id:string;cliente_id:string|null;oportunidade_id:string|null;numero_proposta:string|null;status:string|null;valor:number|null}
type Contrato={id:string;cliente_id:string|null;numero_contrato:string|null;status:string|null;proposta_origem_referencia:string|null}
type Lista={tipo:string;valor:string}
type MotivoChat={id:string;nome:string|null;ativo:boolean|null}
type Anexo={nome:string;tipo?:string|null;tamanho?:number|null;caminho:string}
type EmailMsg={id:string;lead_id:string|null;message_id:string;direcao:'RECEIVED'|'SENT';de_email:string|null;de_nome:string|null;para:string[];cc:string[];assunto:string|null;texto:string|null;texto_resumido:string|null;anexos:Anexo[];recebido_em:string}
type Composer={para:string;cc:string;assunto:string;texto:string;responderA:string}
type UsuarioChat={id:string;nome:string|null;perfil_id:string|null;ativo:boolean|null}
type Grupo={nome:string}
type Thread={key:string;lead:Lead|null;atendimento:Atendimento|null;cliente:Cliente|null;contato:Contato|null;nome:string;fone:string;status:string;quando:string;resumo:string;chatpro:boolean;situacao:'ABERTO'|'FINALIZADO'|null;setor:string|null;email:boolean}

const statuses=['NOVO CONTATO','EM ATENDIMENTO','QUALIFICADO','CONVERTIDO','ENCERRADO']
const time=(v:string)=>new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(v))
const day=(v:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v))
const isChat=(a:Atendimento|null)=>!!a&&(String(a.source_system).toUpperCase()==='CHATPRO'||String(a.canal).toUpperCase()==='WHATSAPP')
const phoneDigits=(v:string)=>String(v||'').replace(/\D/g,'')
// Setor do atendimento no ChatPro; sem setor conta como Comercial.
const ehComercial=(setor:string|null)=>!setor||/^comercial/i.test(setor.trim())
// Abre um anexo guardado no armazenamento ("bucket:caminho") por um link temporário.
async function abrirAnexo(caminho:string){const i=caminho.indexOf(':');const{data,error}=await supabase.storage.from(caminho.slice(0,i)).createSignedUrl(caminho.slice(i+1),600);if(error||!data?.signedUrl){window.alert('Não foi possível abrir o anexo.');return}window.open(data.signedUrl,'_blank','noopener')}
const tamanhoArq=(n?:number|null)=>!n?'':n<1024*1024?`${Math.max(1,Math.round(n/1024))} KB`:`${(n/1024/1024).toFixed(1).replace('.',',')} MB`
const nomeArquivo=(n:string)=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'_').slice(-80)

export function AtendimentosInbox(){
 const {profile,hasPermission}=useAuth(),canWrite=hasPermission('crm.write'),navigate=useNavigate()
 const[atendimentos,setAtendimentos]=useState<Atendimento[]>([]),[leads,setLeads]=useState<Lead[]>([]),[clientes,setClientes]=useState<Cliente[]>([]),[contatos,setContatos]=useState<Contato[]>([]),[interacoes,setInteracoes]=useState<Interacao[]>([]),[perfis,setPerfis]=useState<Perfil[]>([])
 const[oportunidades,setOportunidades]=useState<Oportunidade[]>([]),[propostas,setPropostas]=useState<Proposta[]>([]),[contratos,setContratos]=useState<Contrato[]>([]),[listas,setListas]=useState<Lista[]>([]),[grupos,setGrupos]=useState<Grupo[]>([])
 const[selectedKey,setSelectedKey]=useState<string|null>(null),[q,setQ]=useState(''),[tab,setTab]=useState('ABERTOS'),[resp,setResp]=useState(''),[syncing,setSyncing]=useState(false),[syncMsg,setSyncMsg]=useState(''),[setorFiltro,setSetorFiltro]=useState('')
 const[motivosChat,setMotivosChat]=useState<MotivoChat[]>([]),[usuariosChat,setUsuariosChat]=useState<UsuarioChat[]>([]),[acaoChat,setAcaoChat]=useState<''|'FINALIZAR'|'TRANSFERIR'|'ARQUIVO'>(''),[motivoSel,setMotivoSel]=useState(''),[perfilSel,setPerfilSel]=useState(''),[arquivo,setArquivo]=useState<File|null>(null),[legenda,setLegenda]=useState(''),[chatBusy,setChatBusy]=useState(false),[chatMsg,setChatMsg]=useState<{ok:boolean;texto:string}|null>(null)
 const[emailLeads,setEmailLeads]=useState<Map<string,string>>(new Map()),[emails,setEmails]=useState<EmailMsg[]>([]),[composer,setComposer]=useState<Composer|null>(null),[emailArq,setEmailArq]=useState<File|null>(null),[emailBusy,setEmailBusy]=useState(false),[emailMsg,setEmailMsg]=useState<{ok:boolean;texto:string}|null>(null),[emailAberto,setEmailAberto]=useState<string|null>(null),[period,setPeriod]=useState<PeriodFilter>(currentPeriod),[detailTab,setDetailTab]=useState('CONVERSAS'),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
 const[editingInfo,setEditingInfo]=useState(false),[editingClass,setEditingClass]=useState(false),[editingContact,setEditingContact]=useState(false)
 const[contactName,setContactName]=useState(''),[contactPhone,setContactPhone]=useState(''),[contactEmail,setContactEmail]=useState(''),[contactCompany,setContactCompany]=useState(''),[contactClientId,setContactClientId]=useState('')
 const[conversationMessages,setConversationMessages]=useState<Interacao[]>([]),[conversationLoading,setConversationLoading]=useState(false),[conversationError,setConversationError]=useState('')
 const messageScrollRef=useRef<HTMLDivElement|null>(null)
 const[infoStatus,setInfoStatus]=useState('NOVO CONTATO'),[infoOrigem,setInfoOrigem]=useState(''),[infoResponsavel,setInfoResponsavel]=useState('')
 const[classTipos,setClassTipos]=useState<string[]>([]),[classAssunto,setClassAssunto]=useState(''),[classEtapa,setClassEtapa]=useState(''),[classServico,setClassServico]=useState('')

 async function load(){
  setLoading(true);setError('')
  const[a,l,c,ct,i,p,o,pr,co,li,g]=await Promise.all([
   supabase.from('atendimentos').select('id,lead_id,cliente_id,contato_id,ocorrido_em,canal,assunto,resumo,external_id,source_system,usuario_id').order('ocorrido_em',{ascending:false}).limit(3000),
   supabase.from('leads').select('id,nome,telefone_whatsapp,origem,assunto,status,tipo_analise,responsavel_id,data_primeiro_atendimento,resumo,cliente_convertido_id,contato_convertido_id,email_contato,empresa_contato,chatpro_situacao,chatpro_aberto_em,chatpro_finalizado_em,chatpro_finalizado_por,chatpro_responsavel,chatpro_protocolo,chatpro_motivo,chatpro_nps,chatpro_setor').is('deleted_at',null).order('data_primeiro_atendimento',{ascending:false}).limit(3000),
   supabase.from('clientes').select('id,nome_fantasia,razao_social,telefone_principal,email_principal').is('deleted_at',null).limit(5000),
   supabase.from('contatos').select('id,cliente_id,nome,telefone,whatsapp,email').is('deleted_at',null).eq('ativo',true).limit(5000),
   supabase.from('interacoes').select('id,lead_id,cliente_id,contato_id,ocorrido_em,descricao,tipo').order('ocorrido_em',{ascending:true}).limit(7000),
   supabase.from('profiles').select('id,nome,ativo').order('nome'),
   supabase.from('oportunidades').select('id,cliente_id,titulo,status,estagio').is('deleted_at',null).limit(3000),
   supabase.from('propostas').select('id,cliente_id,oportunidade_id,numero_proposta,status,valor').is('deleted_at',null).limit(3000),
   supabase.from('contratos').select('id,cliente_id,numero_contrato,status,proposta_origem_referencia').is('deleted_at',null).limit(3000),
   supabase.from('crm_listas').select('tipo,valor').eq('ativo',true).in('tipo',['ORIGEM_ATENDIMENTO','ETAPA_PIPELINE','OPORTUNIDADE_SERVICO']).order('ordem'),
   supabase.from('grupos').select('nome').eq('ativo',true).is('deleted_at',null).order('nome')
  ])
  const e=a.error||l.error||c.error||ct.error||i.error||p.error||o.error||pr.error||co.error||li.error||g.error
  if(e)setError(e.message);else{
   setAtendimentos((a.data??[]) as Atendimento[]);setLeads((l.data??[]) as Lead[]);setClientes((c.data??[]) as Cliente[]);setContatos((ct.data??[]) as Contato[]);setInteracoes((i.data??[]) as Interacao[]);setPerfis((p.data??[]) as Perfil[]);setOportunidades((o.data??[]) as Oportunidade[]);setPropostas((pr.data??[]) as Proposta[]);setContratos((co.data??[]) as Contrato[]);setListas((li.data??[]) as Lista[]);setGrupos((g.data??[]) as Grupo[])
  }
  const[mc,uc,em]=await Promise.all([supabase.from('chatpro_motivos').select('id,nome,ativo').order('nome'),supabase.from('chatpro_usuarios').select('id,nome,perfil_id,ativo').order('nome'),supabase.from('email_mensagens').select('lead_id,recebido_em').not('lead_id','is',null).order('recebido_em',{ascending:false}).limit(5000)])
  if(!em.error){const mapa=new Map<string,string>();for(const r of (em.data??[]) as {lead_id:string;recebido_em:string}[])if(!mapa.has(r.lead_id))mapa.set(r.lead_id,r.recebido_em);setEmailLeads(mapa)}
  if(!mc.error)setMotivosChat((mc.data??[]) as MotivoChat[]);if(!uc.error)setUsuariosChat((uc.data??[]) as UsuarioChat[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[])

 const threads=useMemo<Thread[]>(()=>{
  const result:Thread[]=[]
  for(const lead of leads){
   const related=atendimentos.filter(a=>a.lead_id===lead.id).sort((x,y)=>+new Date(y.ocorrido_em)-+new Date(x.ocorrido_em))
   const atendimento=related[0]??null
   const contato=lead.contato_convertido_id?contatos.find(x=>x.id===lead.contato_convertido_id)??null:null
   const cliente=lead.cliente_convertido_id?clientes.find(x=>x.id===lead.cliente_convertido_id)??null:(contato?clientes.find(x=>x.id===contato.cliente_id)??null:null)
   const fone=lead.telefone_whatsapp||contato?.whatsapp||contato?.telefone||cliente?.telefone_principal||''
   const ultEmail=emailLeads.get(lead.id);const quandoBase=atendimento?.ocorrido_em||lead.data_primeiro_atendimento||new Date(0).toISOString()
   result.push({key:`lead:${lead.id}`,lead,atendimento,cliente,contato,nome:lead.nome||contato?.nome||cliente?.nome_fantasia||cliente?.razao_social||fone||'Atendimento sem identificação',fone,status:lead.status||'NOVO CONTATO',quando:ultEmail&&ultEmail>quandoBase?ultEmail:quandoBase,resumo:atendimento?.resumo||lead.resumo||lead.assunto||'Atendimento comercial',chatpro:related.some(isChat)||String(lead.origem||'').toUpperCase().includes('CHATPRO')||!!lead.chatpro_situacao,situacao:lead.chatpro_situacao??null,setor:lead.chatpro_setor??null,email:!!ultEmail||String(lead.origem||'').toUpperCase()==='E-MAIL'})
  }
  for(const a of atendimentos){
   if(a.lead_id&&leads.some(l=>l.id===a.lead_id))continue
   const contato=contatos.find(x=>x.id===a.contato_id)??null
   const cliente=clientes.find(x=>x.id===a.cliente_id)??(contato?clientes.find(x=>x.id===contato.cliente_id)??null:null)
   const fone=contato?.whatsapp||contato?.telefone||cliente?.telefone_principal||a.external_id?.replace(/^CHATPRO:/,'')||''
   result.push({key:`att:${a.id}`,lead:null,atendimento:a,cliente,contato,nome:contato?.nome||cliente?.nome_fantasia||cliente?.razao_social||fone||'Contato sem identificação',fone,status:cliente?'CLIENTE CADASTRADO':'NOVO CONTATO',quando:a.ocorrido_em,resumo:a.resumo||a.assunto||'Mensagem recebida',chatpro:isChat(a),situacao:null,setor:null,email:false})
  }
  return result.sort((x,y)=>+new Date(y.quando)-+new Date(x.quando))
 },[leads,atendimentos,clientes,contatos,emailLeads])

 useEffect(()=>{if(!selectedKey&&threads[0])setSelectedKey(threads[0].key)},[threads,selectedKey])
 const selected=threads.find(t=>t.key===selectedKey)??threads[0]??null
 const selectedClientId=selected?.lead?.cliente_convertido_id||selected?.cliente?.id||null
 const selectedOpps=selectedClientId?oportunidades.filter(x=>x.cliente_id===selectedClientId):[]
 const selectedOpp=selectedOpps[0]??null
 const selectedProps=selectedClientId?propostas.filter(x=>x.cliente_id===selectedClientId):[]
 const selectedContracts=selectedClientId?contratos.filter(x=>x.cliente_id===selectedClientId):[]
 const origins=listas.filter(x=>x.tipo==='ORIGEM_ATENDIMENTO').map(x=>x.valor)
 const pipelineStages=listas.filter(x=>x.tipo==='ETAPA_PIPELINE').map(x=>x.valor)
 const services=listas.filter(x=>x.tipo==='OPORTUNIDADE_SERVICO').map(x=>x.valor)
 const analysisTypes=grupos.map(x=>x.nome)
 const loadConversation=useCallback(async()=>{
  if(!selected?.chatpro){setConversationMessages([]);setConversationError('');return}
  const filters:string[]=[]
  const digits=phoneDigits(selected.fone)
  if(digits)filters.push(`phone_e164.eq.+${digits}`)
  if(selected.lead?.id)filters.push(`lead_id.eq.${selected.lead.id}`)
  if(selected.contato?.id)filters.push(`contato_id.eq.${selected.contato.id}`)
  if(selectedClientId)filters.push(`cliente_id.eq.${selectedClientId}`)
  if(filters.length===0){setConversationMessages([]);return}
  setConversationLoading(true)
  const{data,error:e}=await supabase.from('interacoes').select('id,lead_id,cliente_id,contato_id,ocorrido_em,descricao,tipo,source_system,external_id,phone_e164,direction,message_kind,message_text,media_url,media_mime,media_name,delivery_status').eq('source_system','CHATPRO').or(filters.join(',')).order('ocorrido_em',{ascending:true}).limit(500)
  if(e)setConversationError(e.message)
  else{setConversationMessages((data??[]) as Interacao[]);setConversationError('')}
  setConversationLoading(false)
 },[selected?.key,selected?.chatpro,selected?.fone,selected?.lead?.id,selected?.contato?.id,selectedClientId])
 useEffect(()=>{void loadConversation();if(!selected?.chatpro)return;const timer=window.setInterval(()=>void loadConversation(),10000);return()=>window.clearInterval(timer)},[loadConversation,selected?.chatpro])
 useEffect(()=>{messageScrollRef.current?.scrollTo({top:messageScrollRef.current.scrollHeight,behavior:'smooth'})},[conversationMessages.length,emails.length,selectedKey,detailTab])
 const legacyMessages=selected?interacoes.filter(x=>{const same=(selected.lead&&x.lead_id===selected.lead.id)||(selected.contato&&x.contato_id===selected.contato.id)||(selectedClientId&&x.cliente_id===selectedClientId);return same&&(String(x.tipo||'').toUpperCase().includes('WHATS')||x.descricao.toUpperCase().includes('CHATPRO'))}):[]
 const messages=selected?.chatpro?conversationMessages:legacyMessages
 const history=selected?interacoes.filter(x=>(selected.lead&&x.lead_id===selected.lead.id)||(selectedClientId&&x.cliente_id===selectedClientId)).sort((x,y)=>+new Date(y.ocorrido_em)-+new Date(x.ocorrido_em)):[]
 const companyPending=(t:Thread)=>!t.lead?.cliente_convertido_id&&!t.cliente&&String(t.lead?.assunto||'').toLowerCase().includes('selecionar empresa')
 const periodThreads=useMemo(()=>threads.filter(t=>inPeriod(t.quando,period)),[threads,period]),years=useMemo(()=>yearsFrom(threads.map(t=>t.quando)),[threads])
 const matchTab=(t:Thread,kind:string)=>{const status=t.status.toUpperCase(),clientId=t.lead?.cliente_convertido_id||t.cliente?.id,hasProposal=!!clientId&&propostas.some(p=>p.cliente_id===clientId);if(kind==='TODOS')return true;if(kind==='ABERTOS')return t.situacao==='ABERTO';if(kind==='FINALIZADOS')return t.situacao==='FINALIZADO';if(kind==='EMAIL')return t.email
  // Abas comerciais: só atendimentos do Comercial (Financeiro, Qualidade etc. ficam de fora).
  if(!ehComercial(t.setor))return false
  return (kind==='EMPRESA'&&companyPending(t))||(kind==='NOVOS'&&status.includes('NOVO'))||(kind==='ANDAMENTO'&&(status.includes('ATENDIMENTO')||status.includes('QUALIFIC')))||(kind==='PROPOSTAS'&&hasProposal)||(kind==='FECHADOS'&&status.includes('CONVERT'))||(kind==='ENCERRADOS'&&status.includes('ENCERR'))}
 const matchResp=(t:Thread)=>(!resp||(resp==='SEM'?!t.lead?.responsavel_id:t.lead?.responsavel_id===resp))&&(!setorFiltro||(setorFiltro==='COMERCIAL'?ehComercial(t.setor):(t.setor||'')===setorFiltro))
 const setores=useMemo(()=>[...new Set(threads.map(t=>t.setor).filter((x):x is string=>!!x&&!ehComercial(x)))].sort(),[threads])
 const filtered=periodThreads.filter(t=>{const text=`${t.nome} ${t.fone} ${t.resumo} ${t.lead?.assunto||''} ${t.lead?.empresa_contato||''} ${t.lead?.chatpro_protocolo||''}`.toLowerCase();return(!q||text.includes(q.toLowerCase()))&&matchResp(t)&&matchTab(t,tab)})
 const count=(kind:string)=>periodThreads.filter(t=>matchResp(t)&&matchTab(t,kind)).length
 // E-mails do atendimento (caixa da Hostinger), junto da conversa.
 const leadSel=selected?.lead?.id||''
 const carregarEmails=useCallback(async()=>{
  if(!leadSel){setEmails([]);return}
  const{data,error:e}=await supabase.from('email_mensagens').select('id,lead_id,message_id,direcao,de_email,de_nome,para,cc,assunto,texto,texto_resumido,anexos,recebido_em').eq('lead_id',leadSel).order('recebido_em',{ascending:true}).limit(200)
  if(!e)setEmails((data??[]) as EmailMsg[])
 },[leadSel])
 useEffect(()=>{void carregarEmails();setComposer(null);setEmailMsg(null);setEmailArq(null);setEmailAberto(null)},[carregarEmails])
 const emailDoContato=selected?(selected.lead?.email_contato||selected.contato?.email||selected.cliente?.email_principal||''):''
 function novoEmail(base?:EmailMsg){
  const ass=base?.assunto||selected?.lead?.assunto||''
  setComposer({para:base?(base.direcao==='RECEIVED'?base.de_email||'':base.para[0]||''):emailDoContato,cc:'',assunto:base?(/^re:/i.test(ass)?ass:`Re: ${ass}`):'',texto:'',responderA:base?.message_id||''})
  setEmailMsg(null);setEmailArq(null)
 }
 async function enviarEmail(){
  if(!selected?.lead||!composer)return
  if(emailArq&&emailArq.size>16*1024*1024){setEmailMsg({ok:false,texto:'O anexo passa de 16 MB.'});return}
  setEmailBusy(true);setEmailMsg(null)
  let anexo=''
  if(emailArq){
   anexo=`${selected.lead.id}/email-${Date.now()}-${nomeArquivo(emailArq.name)}`
   const up=await supabase.storage.from('chatpro-envios').upload(anexo,emailArq,{contentType:emailArq.type||undefined,upsert:false})
   if(up.error){setEmailMsg({ok:false,texto:`Não foi possível subir o anexo: ${up.error.message}`});setEmailBusy(false);return}
  }
  const{data,error:e}=await supabase.functions.invoke('email-atendimento',{body:{acao:'enviar',lead_id:selected.lead.id,para:composer.para,cc:composer.cc,assunto:composer.assunto,texto:composer.texto,responder_a:composer.responderA||undefined,anexo:anexo||undefined}})
  if(e||!data?.ok)setEmailMsg({ok:false,texto:data?.erro||e?.message||'O e-mail não foi enviado.'})
  else{setComposer(null);setEmailArq(null);setEmailMsg({ok:true,texto:'E-mail enviado.'});await carregarEmails()}
  setEmailBusy(false)
 }
 // Ações que mudam a conversa no ChatPro (função chatpro-chat no servidor).
 const perfisNoChat=perfis.filter(p=>p.ativo&&usuariosChat.some(u=>u.perfil_id===p.id&&u.ativo!==false))
 function abrirAcaoChat(k:''|'FINALIZAR'|'TRANSFERIR'|'ARQUIVO'){setAcaoChat(a=>a===k?'':k);setChatMsg(null);setMotivoSel('');setPerfilSel('');setArquivo(null);setLegenda('')}
 async function chamarChat(corpo:Record<string,unknown>,sucesso:string){
  const{data,error:e}=await supabase.functions.invoke('chatpro-chat',{body:corpo})
  if(e||!data?.ok){setChatMsg({ok:false,texto:data?.erro||e?.message||'O ChatPro não respondeu.'});return false}
  setChatMsg({ok:true,texto:sucesso});return true
 }
 async function finalizarNoChat(){
  if(!selected?.lead||!motivoSel)return
  setChatBusy(true)
  if(await chamarChat({acao:'finalizar',lead_id:selected.lead.id,motivo_id:motivoSel},'Atendimento finalizado no ChatPro.')){setAcaoChat('');await load()}
  setChatBusy(false)
 }
 async function transferirNoChat(perfilId=perfilSel){
  if(!selected?.lead||!perfilId)return false
  setChatBusy(true)
  const nome=perfis.find(p=>p.id===perfilId)?.nome||'atendente'
  const ok=await chamarChat({acao:'atribuir',lead_id:selected.lead.id,perfil_id:perfilId},`Conversa transferida para ${nome} no ChatPro.`)
  if(ok){setAcaoChat('');await load()}
  setChatBusy(false);return ok
 }
 async function enviarArquivoChat(){
  if(!selected?.lead||!arquivo)return
  if(arquivo.size>16*1024*1024){setChatMsg({ok:false,texto:'O arquivo passa de 16 MB.'});return}
  setChatBusy(true);setChatMsg(null)
  const caminho=`${selected.lead.id}/${Date.now()}-${nomeArquivo(arquivo.name)}`
  const up=await supabase.storage.from('chatpro-envios').upload(caminho,arquivo,{contentType:arquivo.type||undefined,upsert:false})
  if(up.error){setChatMsg({ok:false,texto:`Não foi possível subir o arquivo: ${up.error.message}`});setChatBusy(false);return}
  if(await chamarChat({acao:'enviar_arquivo',lead_id:selected.lead.id,caminho,legenda:legenda.trim()},`"${arquivo.name}" enviado pelo WhatsApp.`)){setAcaoChat('');setArquivo(null);setLegenda('');await load()}
  setChatBusy(false)
 }
 // Confere no ChatPro quais atendimentos já foram finalizados (a rotina também roda a cada 30 min).
 async function syncChatPro(){
  setSyncing(true);setSyncMsg('')
  const[{data,error:e}]=await Promise.all([supabase.functions.invoke('chatpro-chat',{body:{acao:'sessoes',rapido:true}}),supabase.functions.invoke('email-atendimento',{body:{acao:'buscar'}})])
  if(e||!data?.ok)setSyncMsg(`Não foi possível sincronizar com o ChatPro${e?`: ${e.message}`:data?.erro?`: ${data.erro}`:''}.`)
  else{const s=data.sessoes||{};setSyncMsg(`ChatPro conferido: ${s.conferidas??0} atendimento(s) em aberto verificados, ${s.finalizadas_no_chatpro??0} já finalizado(s).`);await load()}
  setSyncing(false)
 }
 async function updateLead(patch:Partial<Lead>){if(!selected?.lead||!canWrite)return;const{error:e}=await supabase.from('leads').update({...patch,updated_by:profile?.id??null}).eq('id',selected.lead.id);if(e)setError(e.message);else await load()}
 function startInfoEdit(){if(!selected?.lead||!canWrite)return;setInfoStatus(selected.lead.status||'NOVO CONTATO');setInfoOrigem(selected.lead.origem||'');setInfoResponsavel(selected.lead.responsavel_id||'');setEditingInfo(true)}
 function startContactEdit(){
  if(!selected||!canWrite)return
  setContactName(selected.contato?.nome||selected.lead?.nome||selected.nome||'')
  setContactPhone(selected.contato?.whatsapp||selected.contato?.telefone||selected.lead?.telefone_whatsapp||selected.fone||'')
  setContactEmail(selected.contato?.email||selected.lead?.email_contato||selected.cliente?.email_principal||'')
  setContactCompany(selected.lead?.empresa_contato||selected.cliente?.nome_fantasia||selected.cliente?.razao_social||'')
  setContactClientId(selectedClientId||'')
  setEditingContact(true)
 }
 async function saveContact(){
  if(!selected||!canWrite)return
  const name=contactName.trim(),phone=contactPhone.trim(),email=contactEmail.trim(),company=contactCompany.trim()
  if(!name){setError('Informe o nome do contato.');return}
  setSaving(true);setError('')
  const clientId=contactClientId||selectedClientId
  const chosenClient=clientes.find(c=>c.id===clientId)
  const chosenCompany=chosenClient?.nome_fantasia||chosenClient?.razao_social||company
  let contactId=selected.contato?.id||null
  if(clientId){
   const{data:linkedContactId,error:contactError}=await supabase.rpc('crm_link_or_create_contact',{p_cliente_id:clientId,p_nome:name,p_telefone:phone||null,p_email:email||null,p_funcao_papel:'Solicitante',p_principal:true})
   if(contactError){setError(contactError.message);setSaving(false);return}
   contactId=linkedContactId?String(linkedContactId):contactId
  }
  if(selected.lead){
   const{error:leadError}=await supabase.from('leads').update({nome:name,telefone_whatsapp:phone||null,email_contato:email||null,empresa_contato:chosenCompany||null,cliente_convertido_id:clientId||selected.lead.cliente_convertido_id||null,contato_convertido_id:contactId,updated_by:profile?.id??null}).eq('id',selected.lead.id)
   if(leadError){setError(leadError.message);setSaving(false);return}
  }
  setEditingContact(false);await load();setSaving(false)
 }
 function startClassEdit(){if(!selected?.lead||!canWrite)return;setClassTipos(String(selected.lead.tipo_analise||'').split(',').map(x=>x.trim()).filter(Boolean));setClassAssunto(selected.lead.assunto||'');setClassEtapa(selectedOpp?.estagio||'');setClassServico(selectedOpp?.titulo||'');setEditingClass(true)}
 async function saveInfo(){if(!selected?.lead||!canWrite)return;setSaving(true);setError('');const mudouResp=!!infoResponsavel&&infoResponsavel!==selected.lead.responsavel_id;const{error:e}=await supabase.from('leads').update({status:infoStatus,origem:infoOrigem||null,responsavel_id:infoResponsavel||null,updated_by:profile?.id??null}).eq('id',selected.lead.id);if(e)setError(e.message);else{if(mudouResp&&selected.lead.chatpro_situacao==='ABERTO'&&perfisNoChat.some(p=>p.id===infoResponsavel))await transferirNoChat(infoResponsavel);await supabase.from('interacoes').insert({lead_id:selected.lead.id,cliente_id:selectedClientId,usuario_id:profile?.id??null,tipo:'EDICAO',descricao:'Informações do atendimento atualizadas pela central de Atendimentos.'});setEditingInfo(false);await load()}setSaving(false)}
 async function saveClass(){if(!selected?.lead||!canWrite)return;setSaving(true);setError('');const{error:leadError}=await supabase.from('leads').update({tipo_analise:classTipos.length?classTipos.join(', '):null,assunto:classAssunto||null,updated_by:profile?.id??null}).eq('id',selected.lead.id);if(leadError){setError(leadError.message);setSaving(false);return}if(selectedOpp){const{error:oppError}=await supabase.from('oportunidades').update({estagio:classEtapa||selectedOpp.estagio,titulo:classServico||selectedOpp.titulo}).eq('id',selectedOpp.id);if(oppError){setError(`Classificação do atendimento salva, mas a oportunidade não pôde ser atualizada: ${oppError.message}`);setSaving(false);return}}await supabase.from('interacoes').insert({lead_id:selected.lead.id,cliente_id:selectedClientId,usuario_id:profile?.id??null,tipo:'EDICAO',descricao:'Classificação comercial atualizada pela central de Atendimentos.'});setEditingClass(false);await load();setSaving(false)}
 async function convertToClient(){
  if(!selected?.lead||!canWrite)return
  if(selected.lead.cliente_convertido_id){navigate(`/clientes/${selected.lead.cliente_convertido_id}`);return}
  setSaving(true);setError('')
  const lead=selected.lead
  const contactNameValue=lead.nome?.trim()||selected.nome||selected.fone||'Contato sem nome'
  const companyName=lead.empresa_contato?.trim()||contactNameValue
  const phone=lead.telefone_whatsapp||selected.fone||null
  const email=lead.email_contato||null
  const {data,error:createError}=await supabase.from('clientes').insert({razao_social:companyName,nome_fantasia:companyName,telefone_principal:phone,email_principal:email,origem:lead.origem||null,status_comercial:'PROSPECT',observacoes_comerciais:[lead.assunto,lead.resumo].filter(Boolean).join(' — ')||null,responsavel_comercial_id:lead.responsavel_id||profile?.id||null,ativo:true,created_by:profile?.id??null}).select('id').single()
  if(createError){setError(createError.message);setSaving(false);return}
  const clientId=String(data.id)
  const{data:contactData,error:contactError}=await supabase.from('contatos').insert({cliente_id:clientId,nome:contactNameValue,telefone:phone,whatsapp:phone,email,funcao_papel:'Solicitante',principal:true,ativo:true,source_system:'CRM',created_by:profile?.id??null}).select('id').single()
  if(contactError){
   await supabase.from('clientes').delete().eq('id',clientId)
   setError(`O cliente não foi convertido porque o Contato/Solicitante não pôde ser criado: ${contactError.message}`);setSaving(false);return
  }
  const contactId=String(contactData.id)
  const {error:linkError}=await supabase.from('leads').update({cliente_convertido_id:clientId,contato_convertido_id:contactId,updated_by:profile?.id??null}).eq('id',lead.id)
  if(linkError){
   await supabase.from('contatos').delete().eq('id',contactId)
   const {error:rollbackError}=await supabase.from('clientes').delete().eq('id',clientId)
   setError(rollbackError?`O vínculo falhou e o cliente criado não pôde ser revertido: ${rollbackError.message}`:`Conversão desfeita porque o vínculo com o atendimento falhou: ${linkError.message}`)
   setSaving(false);return
  }
  const {error:historyError}=await supabase.from('interacoes').insert({lead_id:lead.id,cliente_id:clientId,contato_id:contactId,usuario_id:profile?.id??null,tipo:'CONVERSAO',descricao:'Atendimento convertido em cliente com Contato/Solicitante principal.'})
  if(historyError)setError(`Cliente convertido, mas o registro da timeline falhou: ${historyError.message}`)
  await load();setSaving(false)
 }

 if(loading)return <PageShell title="Atendimentos" description="Central comercial e ChatPro."><div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Carregando atendimentos...</div></PageShell>
 return <PageShell title="Atendimentos" description="Centralize conversas, preserve o histórico comercial e acompanhe o atendimento até contrato." action={<div className="flex flex-wrap gap-2"><Link to="/atendimentos/relatorio" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700"><History className="h-3.5 w-3.5"/>Relatório por atendente</Link><Link to="/primeiro-atendimento" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><UserRoundPlus className="h-3.5 w-3.5"/>Novo Atendimento</Link></div>}>
  {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
  <div className="rounded-xl border bg-white p-2.5 shadow-sm"><div className="flex flex-col gap-2 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome, telefone, mensagem ou assunto..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs outline-none focus:border-slate-200"/></div><PeriodSelect value={period} onChange={setPeriod} years={years}/><select value={resp} onChange={e=>setResp(e.target.value)} aria-label="Responsável" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="">Todos os responsáveis</option><option value="SEM">Sem responsável</option>{perfis.filter(x=>x.ativo).map(x=><option key={x.id} value={x.id}>{x.nome||'Usuário'}</option>)}</select><select value={setorFiltro} onChange={e=>setSetorFiltro(e.target.value)} aria-label="Setor" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="">Todos os setores</option><option value="COMERCIAL">Comercial</option>{setores.map(x=><option key={x} value={x}>{x}</option>)}</select><button onClick={()=>void syncChatPro()} disabled={syncing} title="Confere no ChatPro quem finalizou cada atendimento" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"><MessageCircle className="h-3.5 w-3.5"/>{syncing?'Sincronizando...':'Sincronizar ChatPro'}</button><button onClick={()=>void load()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5"/>Atualizar</button></div><div className="mt-2 flex gap-1 overflow-x-auto border-t pt-2">{[['ABERTOS','Em aberto'],['FINALIZADOS','Finalizados'],['EMAIL','E-mail'],['TODOS','Todos'],['EMPRESA','Empresa a definir'],['NOVOS','Novos'],['ANDAMENTO','Em andamento'],['PROPOSTAS','Propostas'],['FECHADOS','Fechados'],['ENCERRADOS','Encerrados']].map(([k,label])=><button key={k} onClick={()=>setTab(k)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ${tab===k?'bg-blue-50 text-blue-700 ring-1 ring-blue-100':'text-slate-600 hover:bg-slate-50'}`}>{label}<span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{count(k)}</span></button>)}</div>{syncMsg&&<div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">{syncMsg}</div>}</div>

  <div className="grid min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:h-[calc(100dvh-220px)] xl:max-h-[760px] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
   <aside className="min-h-0 border-r"><div className="h-full min-h-0 overflow-y-auto">{filtered.length===0?<div className="p-6 text-center text-xs text-slate-500">Nenhum atendimento encontrado.</div>:filtered.map(t=><button key={t.key} onClick={()=>{setSelectedKey(t.key);setDetailTab('CONVERSAS');setEditingInfo(false);setEditingClass(false);setEditingContact(false);setAcaoChat('');setChatMsg(null)}} className={`w-full border-b px-3 py-3 text-left ${selected?.key===t.key?'bg-slate-100 ring-1 ring-inset ring-slate-300':'hover:bg-slate-50'}`}><div className="flex gap-2.5"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.chatpro?'bg-emerald-100 text-emerald-600':'bg-slate-100 text-slate-600'}`}>{t.chatpro?<MessageCircle className="h-4 w-4"/>:<ClipboardList className="h-4 w-4"/>}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="truncate text-xs">{t.nome}</strong><span className="text-[10px] text-slate-400">{time(t.quando)}</span></div><div className="mt-0.5 truncate text-[11px] text-slate-500">{t.resumo}</div><div className="mt-1.5 flex flex-wrap gap-1">{companyPending(t)&&<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Empresa a definir</span>}{t.chatpro&&<span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">ChatPro</span>}{t.email&&<span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">E-mail</span>}{t.setor&&!ehComercial(t.setor)&&<span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">{t.setor}</span>}{t.situacao==='ABERTO'&&<span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Em aberto</span>}{t.situacao==='FINALIZADO'&&<span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700" title={t.lead?.chatpro_finalizado_em?`Finalizado em ${day(t.lead.chatpro_finalizado_em)} ${time(t.lead.chatpro_finalizado_em)}`:undefined}>Finalizado{t.lead?.chatpro_motivo?` · ${t.lead.chatpro_motivo}`:''}</span>}{(t.lead?.responsavel_id||t.lead?.chatpro_responsavel)&&<span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">{perfis.find(x=>x.id===t.lead?.responsavel_id)?.nome||t.lead?.chatpro_responsavel}</span>}{t.status.toUpperCase().includes('NOVO')&&t.chatpro&&<span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">Novo via WhatsApp</span>}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px]">{t.lead?.cliente_convertido_id||t.cliente?'Cliente vinculado':'Não cadastrado'}</span></div></div></div></button>)}</div></aside>

   <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r">{selected?<><header className="shrink-0 flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2.5"><div className={`grid h-9 w-9 place-items-center rounded-full ${selected.chatpro?'bg-emerald-100 text-emerald-600':'bg-blue-50 text-blue-700'}`}>{selected.chatpro?<MessageCircle className="h-4 w-4"/>:<ClipboardList className="h-4 w-4"/>}</div><div><strong className="text-sm">{selected.nome}</strong><div className="text-[11px] text-slate-500">{selected.chatpro?'ChatPro · ':''}{selected.lead?.cliente_convertido_id||selected.cliente?'Cliente vinculado':'Primeiro contato'} · {selected.fone||'telefone não informado'}</div></div></div><div className="flex flex-wrap gap-1.5">{selected.lead&&!selected.lead.cliente_convertido_id&&canWrite&&<button onClick={()=>void convertToClient()} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving?'Convertendo...':'Converter em Cliente'}</button>}{selected.lead&&<Link to={`/leads/${selected.lead.id}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-blue-700">Avançar no fluxo <ArrowRight className="h-3.5 w-3.5"/></Link>}</div></header>
    <div className="shrink-0 flex gap-1 overflow-x-auto border-b px-3">{[['CONVERSAS','Conversas'],['DADOS','Dados do Atendimento'],['HISTORICO','Histórico'],['PROPOSTAS','Propostas'],['CONTRATOS','Contratos']].map(([k,label])=><button key={k} onClick={()=>setDetailTab(k)} className={`whitespace-nowrap border-b-2 px-2.5 py-2.5 text-xs font-semibold ${detailTab===k?'border-emerald-600 text-emerald-700':'border-transparent text-slate-500'}`}>{label}</button>)}</div>
    <div ref={messageScrollRef} className="h-0 min-h-0 flex-1 overflow-y-scroll overscroll-contain bg-slate-50/30 p-4 [scrollbar-gutter:stable]">{detailTab==='CONVERSAS'&&<><div className="mb-4 text-center text-[10px] text-slate-400">{day(selected.quando)}</div>{conversationError?<div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Não foi possível atualizar a conversa: {conversationError}</div>:null}{messages.length===0&&emails.length===0?<div className="grid h-56 place-items-center rounded-xl border border-dashed bg-white px-5 text-center text-xs text-slate-500"><div><MessageCircle className="mx-auto mb-2 h-6 w-6 text-slate-300"/>{conversationLoading?'Carregando conversa...':selected.chatpro?'Nenhuma mensagem encontrada para este telefone. A atualização ocorre automaticamente.':selected.email?'Nenhum e-mail ligado a este atendimento ainda.':'Este atendimento é anterior à caixa ChatPro. O histórico comercial foi preservado e pode ser visto nas abas Dados e Histórico.'}</div></div>:<div className="space-y-2">{[...messages.map(m=>({em:m.ocorrido_em,m,e:null as EmailMsg|null})),...emails.map(e=>({em:e.recebido_em,m:null as Interacao|null,e}))].sort((a,b)=>+new Date(a.em)-+new Date(b.em)).map(({m,e})=>{if(e){const sent=e.direcao==='SENT';const completo=emailAberto===e.id;const corpo=(completo?e.texto:e.texto_resumido||e.texto)||'';return <div key={`e:${e.id}`} className={`flex ${sent?'justify-end':'justify-start'}`}><div className={`w-full max-w-[86%] rounded-xl border px-3 py-2 text-xs shadow-sm ${sent?'border-sky-200 bg-sky-50':'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-1.5 font-semibold text-slate-800"><Mail className="h-3.5 w-3.5 shrink-0 text-sky-600"/><span className="truncate">{e.assunto||'(sem assunto)'}</span></div><div className="mt-0.5 truncate text-[10px] text-slate-500">{sent?`Para: ${e.para.join(', ')}`:`De: ${e.de_nome?`${e.de_nome} <${e.de_email}>`:e.de_email}`}{e.cc.length?` · Cc: ${e.cc.join(', ')}`:''}</div></div>{!sent&&canWrite&&<button onClick={()=>novoEmail(e)} title="Responder" className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-white px-1.5 py-1 text-[10px] font-semibold text-sky-700"><Reply className="h-3 w-3"/>Responder</button>}</div>{corpo&&<div className="mt-1.5 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-slate-700">{corpo}</div>}{e.texto&&e.texto_resumido&&e.texto.length>e.texto_resumido.length+20&&<button onClick={()=>setEmailAberto(completo?null:e.id)} className="mt-1 text-[10px] font-semibold text-sky-700">{completo?'Mostrar só a mensagem':'Mostrar e-mail completo (com histórico)'}</button>}{e.anexos?.length>0&&<div className="mt-1.5 flex flex-wrap gap-1">{e.anexos.map((a,i)=><button key={i} onClick={()=>void abrirAnexo(a.caminho)} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"><Paperclip className="h-3 w-3 shrink-0"/><span className="truncate">{a.nome}</span>{a.tamanho?<span className="font-normal text-slate-400">{tamanhoArq(a.tamanho)}</span>:null}</button>)}</div>}<div className="mt-1 text-right text-[9px] text-slate-400">{day(e.recebido_em)} {time(e.recebido_em)}</div></div></div>}if(!m)return null;const sent=m.direction==='SENT'||m.descricao.includes('Enviada:');const kind=m.message_kind||'TEXT';const text=m.message_text||m.descricao.replace(/^ChatPro \| (Recebida|Enviada):\s*/,'');return <div key={m.id} className={`flex ${sent?'justify-end':'justify-start'}`}><div className={`max-w-[82%] rounded-xl px-3 py-2 text-xs shadow-sm ${sent?'bg-emerald-100':'border border-slate-200 bg-white'}`}>{kind==='IMAGE'&&m.media_url&&<a href={m.media_url} target="_blank" rel="noreferrer"><img src={m.media_url} alt={m.media_name||'Imagem recebida'} loading="lazy" className="mb-2 max-h-64 rounded-lg object-contain"/></a>}{kind==='AUDIO'&&m.media_url&&<audio controls preload="none" src={m.media_url} className="mb-1 max-w-full"/>}{kind==='VIDEO'&&m.media_url&&<video controls preload="metadata" src={m.media_url} className="mb-2 max-h-64 max-w-full rounded-lg"/>}{(kind==='DOCUMENT'||kind==='OTHER')&&m.media_url&&<a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 font-semibold text-slate-700"><FileText className="h-4 w-4"/><span className="truncate">{m.media_name||'Abrir anexo'}</span></a>}{text&&<div className="whitespace-pre-wrap break-words">{text}</div>}<div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-400"><span>{time(m.ocorrido_em)}</span>{sent&&m.delivery_status&&<span>· {m.delivery_status}</span>}</div></div></div>})}</div>}</>}
    {detailTab==='DADOS'&&<div className="space-y-2.5"><Info title="Nome" value={selected.lead?.nome||selected.nome}/><Info title="Telefone / WhatsApp" value={selected.lead?.telefone_whatsapp||selected.fone||'Não informado'}/><Info title="Origem" value={selected.lead?.origem||selected.atendimento?.source_system||'Não informada'}/><Info title="Assunto" value={selected.lead?.assunto||selected.atendimento?.assunto||'Não informado'}/><Info title="Escopo / tipo de análise" value={selected.lead?.tipo_analise||'Não definido'}/><Info title="Resumo preservado" value={selected.lead?.resumo||selected.atendimento?.resumo||'Sem resumo cadastrado'}/></div>}
    {detailTab==='HISTORICO'&&<div className="space-y-2">{history.length===0?<Empty text="Nenhum histórico adicional registrado."/>:history.map(h=><div key={h.id} className="rounded-xl border bg-white p-3"><div className="text-[10px] text-slate-400">{day(h.ocorrido_em)} {time(h.ocorrido_em)} · {h.tipo||'INTERAÇÃO'}</div><div className="mt-1.5 text-xs text-slate-700">{h.descricao}</div></div>)}</div>}
    {detailTab==='PROPOSTAS'&&<div className="space-y-2">{selectedProps.length===0?<Empty text="Ainda não há proposta vinculada a este cliente."/>:selectedProps.map(p=><Link key={p.id} to={`/propostas/${p.id}`} className="block rounded-xl border bg-white p-3 hover:border-slate-200"><div className="text-xs font-semibold">Proposta {p.numero_proposta||'sem número'}</div><div className="mt-1 text-[11px] text-slate-500">{p.status||'Sem status'}{p.valor!=null?` · ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.valor)}`:''}</div></Link>)}</div>}
    {detailTab==='CONTRATOS'&&<div className="space-y-2">{selectedContracts.length===0?<Empty text="Ainda não há contrato vinculado a este cliente."/>:selectedContracts.map(c=><div key={c.id} className="rounded-xl border bg-white p-3"><div className="text-xs font-semibold">Contrato {c.numero_contrato||c.proposta_origem_referencia||'sem número'}</div><div className="mt-1 text-[11px] text-slate-500">{c.status||'Sem status'}</div></div>)}</div>}</div>
    <div className="shrink-0 border-t bg-white p-3">{composer?<div className="space-y-1.5 rounded-lg border border-sky-200 bg-sky-50/40 p-2.5">
     <div className="flex items-center justify-between"><strong className="flex items-center gap-1.5 text-xs text-slate-800"><Mail className="h-3.5 w-3.5 text-sky-600"/>{composer.responderA?'Responder por e-mail':'Novo e-mail'}</strong><button onClick={()=>setComposer(null)} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Fechar"><X className="h-3.5 w-3.5"/></button></div>
     <div className="grid gap-1.5 sm:grid-cols-2"><input value={composer.para} onChange={e=>setComposer({...composer,para:e.target.value})} placeholder="Para (e-mail)" className="control" aria-label="Para"/><input value={composer.cc} onChange={e=>setComposer({...composer,cc:e.target.value})} placeholder="Cc (opcional)" className="control" aria-label="Cópia"/></div>
     <input value={composer.assunto} onChange={e=>setComposer({...composer,assunto:e.target.value})} placeholder="Assunto" className="control" aria-label="Assunto"/>
     <textarea value={composer.texto} onChange={e=>setComposer({...composer,texto:e.target.value})} rows={5} placeholder="Escreva a mensagem..." className="control resize-y" aria-label="Mensagem"/>
     <div className="flex flex-wrap items-center justify-between gap-2"><label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-600"><Paperclip className="h-3.5 w-3.5"/>{emailArq?emailArq.name:'Anexar arquivo'}<input type="file" className="hidden" onChange={e=>setEmailArq(e.target.files?.[0]??null)}/></label><button disabled={emailBusy||!composer.para.trim()||!composer.assunto.trim()||!composer.texto.trim()} onClick={()=>void enviarEmail()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5"/>{emailBusy?'Enviando...':'Enviar e-mail'}</button></div>
     <p className="text-[10px] text-slate-500">Sai pela caixa da MinasLab e fica também em Enviados no webmail.</p>
    </div>:<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500"><span>{selected.chatpro?'WhatsApp: responda pelo ChatPro. As mensagens aparecem aqui automaticamente.':'Conversas por WhatsApp e e-mail aparecem aqui.'}</span>{selected.lead&&canWrite&&<button onClick={()=>novoEmail()} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700"><Mail className="h-3.5 w-3.5"/>Novo e-mail</button>}</div>}
    {emailMsg&&<div className={`mt-1.5 rounded-lg px-2 py-1.5 text-[11px] ${emailMsg.ok?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-700'}`}>{emailMsg.texto}</div>}</div></>:<div className="grid h-full place-items-center text-xs text-slate-500">Selecione um atendimento.</div>}</main>

   <aside className="min-h-0 overflow-y-auto p-4">{selected&&<div className="space-y-4"><section><SectionTitle title="Informações do Atendimento" editing={editingInfo} canEdit={!!selected.lead&&canWrite} onEdit={startInfoEdit} onCancel={()=>setEditingInfo(false)} onSave={()=>void saveInfo()} saving={saving}/><div className="mt-2 space-y-2">{editingInfo&&selected.lead?<><Row label="Status"><select value={infoStatus} onChange={e=>setInfoStatus(e.target.value)} className="control">{statuses.map(x=><option key={x}>{x}</option>)}</select></Row><Row label="Origem"><select value={infoOrigem} onChange={e=>setInfoOrigem(e.target.value)} className="control"><option value="">Não informada</option>{origins.map(x=><option key={x}>{x}</option>)}</select></Row><Row label="Canal"><Box>{selected.chatpro?'WhatsApp':'Atendimento comercial'}</Box></Row><Row label="Responsável"><select value={infoResponsavel} onChange={e=>setInfoResponsavel(e.target.value)} className="control"><option value="">Não definido</option>{perfis.filter(x=>x.ativo).map(x=><option key={x.id} value={x.id}>{x.nome||'Usuário'}</option>)}</select></Row></>:<><Row label="Status"><Box>{selected.lead?.status||selected.status}</Box></Row><Row label="Origem"><Box>{selected.lead?.origem||selected.atendimento?.source_system||'Não informada'}</Box></Row><Row label="Canal"><Box>{selected.chatpro?'WhatsApp':'Atendimento comercial'}</Box></Row><Row label="Responsável"><Box>{perfis.find(x=>x.id===selected.lead?.responsavel_id)?.nome||'Não definido'}</Box></Row></>}<Row label="Criação"><Box>{day(selected.quando)} {time(selected.quando)}</Box></Row></div></section>
    {selected.lead&&selected.chatpro&&<section className="border-t pt-4"><h3 className="text-xs font-bold text-slate-800">Atendimento no ChatPro</h3><div className="mt-2 space-y-2">{selected.lead.chatpro_situacao?<><Row label="Situação"><Box>{selected.lead.chatpro_situacao==='FINALIZADO'?'Finalizado':'Em aberto'}</Box></Row>{selected.lead.chatpro_setor&&<Row label="Setor"><Box>{selected.lead.chatpro_setor}</Box></Row>}<Row label="Atendente"><Box>{selected.lead.chatpro_responsavel||'Não atribuído'}</Box></Row>{selected.lead.chatpro_aberto_em&&<Row label="Aberto em"><Box>{day(selected.lead.chatpro_aberto_em)} {time(selected.lead.chatpro_aberto_em)}</Box></Row>}{selected.lead.chatpro_situacao==='FINALIZADO'&&<><Row label="Finalizado"><Box>{selected.lead.chatpro_finalizado_em?`${day(selected.lead.chatpro_finalizado_em)} ${time(selected.lead.chatpro_finalizado_em)}`:'—'}</Box></Row><Row label="Por"><Box>{selected.lead.chatpro_finalizado_por||'Não informado'}</Box></Row><Row label="Motivo"><Box>{selected.lead.chatpro_motivo||'Sem motivo'}</Box></Row></>}{selected.lead.chatpro_protocolo&&<Row label="Protocolo"><Box>{selected.lead.chatpro_protocolo}</Box></Row>}{selected.lead.chatpro_nps&&<Row label="NPS"><Box>{selected.lead.chatpro_nps}</Box></Row>}</>:<p className="text-[11px] text-slate-500">Conversa ainda não identificada no ChatPro.</p>}
     {canWrite&&<div className="grid grid-cols-3 gap-1.5 pt-1">{(['FINALIZAR','TRANSFERIR','ARQUIVO'] as const).map(k=>{const aberto=selected.lead?.chatpro_situacao==='ABERTO';const off=k!=='ARQUIVO'&&!aberto;return <button key={k} disabled={off||chatBusy} title={off?'Só para conversas em aberto':undefined} onClick={()=>abrirAcaoChat(k)} className={`rounded-lg border px-1.5 py-1.5 text-[10.5px] font-semibold disabled:text-slate-300 ${acaoChat===k?'border-blue-300 bg-blue-50 text-blue-700':'text-slate-700'}`}>{k==='FINALIZAR'?'Finalizar':k==='TRANSFERIR'?'Transferir':'Enviar arquivo'}</button>})}</div>}
     {acaoChat==='FINALIZAR'&&<div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2"><select value={motivoSel} onChange={e=>setMotivoSel(e.target.value)} className="control" aria-label="Motivo da finalização"><option value="">Motivo da finalização...</option>{motivosChat.filter(m=>m.ativo!==false).map(m=><option key={m.id} value={m.id}>{m.nome||'Motivo'}</option>)}</select><button disabled={!motivoSel||chatBusy} onClick={()=>void finalizarNoChat()} className="w-full rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{chatBusy?'Finalizando...':'Finalizar no ChatPro'}</button></div>}
     {acaoChat==='TRANSFERIR'&&<div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2"><select value={perfilSel} onChange={e=>setPerfilSel(e.target.value)} className="control" aria-label="Transferir para"><option value="">Transferir para...</option>{perfisNoChat.map(p=><option key={p.id} value={p.id}>{p.nome||'Usuário'}</option>)}</select><button disabled={!perfilSel||chatBusy} onClick={()=>void transferirNoChat()} className="w-full rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{chatBusy?'Transferindo...':'Transferir no ChatPro'}</button><p className="text-[10px] text-slate-500">Só aparecem pessoas com usuário no ChatPro.</p></div>}
     {acaoChat==='ARQUIVO'&&<div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={e=>setArquivo(e.target.files?.[0]??null)} className="block w-full text-[11px]" aria-label="Arquivo para enviar"/><textarea value={legenda} onChange={e=>setLegenda(e.target.value)} rows={2} maxLength={900} placeholder="Mensagem junto do arquivo (opcional). Ex.: Segue a proposta 123." className="control resize-none"/><button disabled={!arquivo||chatBusy} onClick={()=>void enviarArquivoChat()} className="w-full rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{chatBusy?'Enviando...':'Enviar pelo WhatsApp'}</button><p className="text-[10px] text-slate-500">PDF, imagem, Word ou Excel até 16 MB. Vai para o cliente pelo ChatPro, na conversa dele.</p></div>}
     {chatMsg&&<div className={`rounded-lg px-2 py-1.5 text-[11px] ${chatMsg.ok?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-700'}`}>{chatMsg.texto}</div>}
    </div></section>}
    <section className="border-t pt-4"><SectionTitle title="Dados do Contato" editing={editingContact} canEdit={canWrite} onEdit={startContactEdit} onCancel={()=>setEditingContact(false)} onSave={()=>void saveContact()} saving={saving}/><div className="mt-2 space-y-2">{editingContact?<><Row label="Nome"><input value={contactName} onChange={e=>setContactName(e.target.value)} className="control"/></Row><Row label="Telefone"><input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} className="control"/></Row><Row label="E-mail"><input type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} className="control"/></Row><Row label="Empresa"><select value={contactClientId} onChange={e=>{const value=e.target.value;setContactClientId(value);const c=clientes.find(item=>item.id===value);setContactCompany(c?.nome_fantasia||c?.razao_social||'')}} className="control"><option value="">Selecione a empresa correta...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social||'Cliente sem nome'}</option>)}</select></Row></>:<><Row label="Nome"><Box>{selected.contato?.nome||selected.lead?.nome||selected.nome}</Box></Row><Row label="Telefone"><Box>{selected.contato?.whatsapp||selected.contato?.telefone||selected.lead?.telefone_whatsapp||selected.fone||'Não informado'}</Box></Row><Row label="E-mail"><Box>{selected.contato?.email||selected.lead?.email_contato||selected.cliente?.email_principal||'Não informado'}</Box></Row><Row label="Empresa"><Box>{selected.lead?.empresa_contato||selected.cliente?.nome_fantasia||selected.cliente?.razao_social||'Não informada'}</Box></Row></>}</div></section>
    <section className="border-t pt-4"><SectionTitle title="Classificação" editing={editingClass} canEdit={!!selected.lead&&canWrite} onEdit={startClassEdit} onCancel={()=>setEditingClass(false)} onSave={()=>void saveClass()} saving={saving}/><div className="mt-2 space-y-2">{editingClass&&selected.lead?<><Row label="Tipo"><div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">{analysisTypes.map(x=><label key={x} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-[11px] text-slate-700"><input type="checkbox" checked={classTipos.includes(x)} onChange={()=>setClassTipos(current=>current.includes(x)?current.filter(item=>item!==x):[...current,x])} className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600"/><span>{x}</span></label>)}</div></Row><Row label="Assunto"><input value={classAssunto} onChange={e=>setClassAssunto(e.target.value)} placeholder="Digite o assunto" className="control"/></Row><Row label="Etapa"><select disabled={!selectedOpp} value={classEtapa} onChange={e=>setClassEtapa(e.target.value)} className="control disabled:bg-slate-50 disabled:text-slate-400"><option value="">{selectedOpp?'Não definida':'Crie a oportunidade primeiro'}</option>{pipelineStages.map(x=><option key={x}>{x}</option>)}</select></Row><Row label="Serviço"><select disabled={!selectedOpp} value={classServico} onChange={e=>setClassServico(e.target.value)} className="control disabled:bg-slate-50 disabled:text-slate-400"><option value="">{selectedOpp?'Não definido':'Crie a oportunidade primeiro'}</option>{services.map(x=><option key={x}>{x}</option>)}</select></Row></>:<><Row label="Tipo"><Box>{selected.lead?.tipo_analise||'Não definido'}</Box></Row><Row label="Assunto"><Box>{selected.lead?.assunto||selected.atendimento?.assunto||'Não definido'}</Box></Row><Row label="Etapa"><Box>{selectedOpp?.estagio||'Novo atendimento'}</Box></Row><Row label="Serviço"><Box>{selectedOpp?.titulo||'Não definido'}</Box></Row></>}</div></section>
    <section className="border-t pt-4"><h3 className="text-xs font-bold text-slate-800">Ações rápidas</h3><div className="mt-2 grid grid-cols-2 gap-1.5">{selected.lead?<Link to={`/leads/${selected.lead.id}`} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white"><ArrowRight className="h-3.5 w-3.5"/>Cliente → Oportunidade</Link>:null}<Link to="/propostas" className="quick"><FileText className="h-3.5 w-3.5"/>Propostas</Link><Link to="/contratos" className="quick"><Building2 className="h-3.5 w-3.5"/>Contratos</Link><Link to="/tarefas/cadastro" className="quick"><History className="h-3.5 w-3.5"/>Agendar tarefa</Link><button disabled={!selected.lead||!canWrite} onClick={()=>void updateLead({status:'ENCERRADO'})} className="quick disabled:text-slate-300"><Check className="h-3.5 w-3.5"/>Encerrar</button></div></section></div>}</aside>
  </div>
  <FlowCards/>
  <style>{`.control{width:100%;border:1px solid rgb(226 232 240);border-radius:.5rem;padding:.375rem .5rem;font-size:.75rem;line-height:1rem;background:white;outline:none}.control:focus{border-color:rgb(148 163 184)}.quick{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;border:1px solid rgb(226 232 240);border-radius:.5rem;padding:.375rem .5rem;font-size:.6875rem;line-height:1rem;font-weight:600;color:rgb(51 65 85)}`}</style>
 </PageShell>
}

function FlowCards(){const cards=[
 {n:'1',title:'Atendimento',desc:'Mensagem / cadastro',cls:'border-emerald-100 bg-emerald-50 text-emerald-700'},
 {n:'2',title:'Cliente',desc:'Converter ou vincular',cls:'border-slate-200 bg-blue-50 text-blue-700'},
 {n:'3',title:'Oportunidade',desc:'Qualificar negociação',cls:'border-violet-100 bg-violet-50 text-violet-700'},
 {n:'4',title:'Proposta',desc:'Serviços e valores',cls:'border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700'},
 {n:'5',title:'Negociação',desc:'Acompanhar aceite',cls:'border-orange-100 bg-orange-50 text-orange-700'},
 {n:'6',title:'Contrato',desc:'Continuidade comercial',cls:'border-green-100 bg-green-50 text-green-700'},
 {n:'7',title:'Execução',desc:'OS e coleta',cls:'border-sky-100 bg-sky-50 text-sky-700'}]
 return <section className="rounded-2xl border bg-white px-4 py-3 shadow-sm"><div className="mb-2.5 text-sm font-bold text-slate-900">Fluxo completo no CRM — os dados anteriores continuam preservados</div><div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">{cards.map((c,idx)=><div key={c.n} className="flex shrink-0 items-center gap-1.5"><div className={`min-w-[150px] rounded-xl border px-3 py-2.5 ${c.cls}`}><div className="text-xs font-bold">{c.n}. {c.title}</div><div className="mt-0.5 text-[11px] text-slate-500">{c.desc}</div></div>{idx<cards.length-1&&<ChevronRight className="h-4 w-4 shrink-0 text-blue-400"/>}</div>)}</div></section>}
function SectionTitle({title,editing,canEdit,onEdit,onCancel,onSave,saving}:{title:string;editing:boolean;canEdit:boolean;onEdit:()=>void;onCancel:()=>void;onSave:()=>void;saving:boolean}){return <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-bold text-slate-800">{title}</h3>{canEdit&&(editing?<div className="flex gap-1"><button onClick={onCancel} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold text-slate-600"><X className="h-3 w-3"/>Cancelar</button><button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-1.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"><Save className="h-3 w-3"/>{saving?'Salvando...':'Salvar'}</button></div>:<button onClick={onEdit} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-1 text-[10px] font-semibold text-blue-700"><Pencil className="h-3 w-3"/>Editar</button>)}</div>}
function Row({label,children}:{label:string;children:React.ReactNode}){return <div className="grid grid-cols-[76px_1fr] items-center gap-1.5"><span className="text-[11px] text-slate-500">{label}</span>{children}</div>}
function Box({children}:{children:React.ReactNode}){return <div className="rounded-md border bg-slate-50 px-2 py-1.5 text-xs text-slate-700">{children}</div>}
function Info({title,value}:{title:string;value:string}){return <div className="rounded-xl border bg-white p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</div><div className="mt-1.5 whitespace-pre-wrap text-xs text-slate-700">{value}</div></div>}
function Empty({text}:{text:string}){return <div className="rounded-xl border border-dashed bg-white p-6 text-center text-xs text-slate-500">{text}</div>}
