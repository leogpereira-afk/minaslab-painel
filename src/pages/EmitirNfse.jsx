import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FilePlus2, Save, Search, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { finClientesListar, finNfseEmitir, finNfseEstado, finNfseListar, finNfsePreparar, finNfseRascunhoSalvar } from "../services/financeiro.js";

const hoje=()=>new Date().toISOString().slice(0,10);
const vazio=()=>({id:"",cliente_id:"",data_emissao:hoje(),data_vencimento:"",valor_total:"",codigo_servico:"",nbs:"",servico_descricao:"",aliquota_iss:"",iss_retido:false,regime_especial:"",forma_pagamento:"BOLETO",observacao:"",cliente:null});
const clienteNovo=()=>({nome:"",nome_fantasia:"",cnpj_cpf:"",inscricao_estadual:"",inscricao_municipal:"",email:"",telefone:"",cep:"",logradouro:"",numero:"",complemento:"",bairro:"",cidade:"",uf:"MG"});
const moeda=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dataBR=v=>{const p=String(v||"").slice(0,10).split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:"—"};

export default function EmitirNfse(){
  const navigate=useNavigate();
  const [estado,setEstado]=useState(null);
  const [clientes,setClientes]=useState([]);
  const [rascunhos,setRascunhos]=useState([]);
  const [form,setForm]=useState(vazio());
  const [novoCliente,setNovoCliente]=useState(false);
  const [cliente,setCliente]=useState(clienteNovo());
  const [busca,setBusca]=useState("");
  const [erro,setErro]=useState("");
  const [ok,setOk]=useState("");
  const [carregando,setCarregando]=useState(true);
  const [salvando,setSalvando]=useState(false);
  const [emitindo,setEmitindo]=useState(false);
  const [preparacao,setPreparacao]=useState(null);

  async function carregar(){setCarregando(true);setErro("");try{const [e,c,r]=await Promise.all([finNfseEstado(),finClientesListar(""),finNfseListar()]);setEstado(e);setClientes(c);setRascunhos(r);}catch(ex){setErro(ex.message)}finally{setCarregando(false)}}
  useEffect(()=>{carregar()},[]);

  const clientesFiltrados=useMemo(()=>{const q=busca.trim().toLowerCase();if(!q)return clientes.slice(0,120);return clientes.filter(x=>`${x.nome||""} ${x.nome_fantasia||""} ${x.cnpj_cpf||""}`.toLowerCase().includes(q)).slice(0,120)},[clientes,busca]);
  const selecionado=clientes.find(x=>x.id===form.cliente_id)||null;

  function limpar(){setForm(vazio());setNovoCliente(false);setCliente(clienteNovo());setPreparacao(null);setOk("");setErro("")}
  function registro(){return {...form,cliente_id:novoCliente?"":form.cliente_id,cliente:novoCliente?cliente:null,valor_total:Number(form.valor_total||0)}}
  async function preparar(){setErro("");setOk("");try{const r=await finNfsePreparar(registro());setPreparacao(r);setOk("Pré-validação concluída. Nenhuma nota foi emitida.")}catch(ex){setPreparacao(null);setErro(ex.message)}}
  async function salvar(){setSalvando(true);setErro("");setOk("");try{const r=await finNfseRascunhoSalvar(registro());setForm(v=>({...v,id:r.item.id,cliente_id:r.cliente.id,cliente:null}));setNovoCliente(false);setCliente(clienteNovo());setOk("Rascunho salvo. O cliente foi vinculado ao cadastro central da M Lab.");await carregar();}catch(ex){setErro(ex.message)}finally{setSalvando(false)}}
  async function emitir(){if(!form.id){setErro("Salve o rascunho antes de emitir.");return}if(!confirm(`Transmitir esta NFS-e no ambiente ${estado?.ambiente||"HOMOLOGACAO"}?`))return;setEmitindo(true);setErro("");setOk("");try{const r=await finNfseEmitir(form.id);setOk(r.mensagem||"NFS-e transmitida.");await carregar();}catch(ex){setErro(ex.message)}finally{setEmitindo(false)}}
  function editar(x){const d=x.nfse_dados||{};setForm({id:x.id,cliente_id:x.cliente_id||"",data_emissao:x.data_emissao||hoje(),data_vencimento:x.data_vencimento||"",valor_total:String(x.valor_total??""),codigo_servico:d.servico?.codigo||"",nbs:d.servico?.nbs||"",servico_descricao:d.servico?.descricao||"",aliquota_iss:d.tributacao?.aliquotaIss??"",iss_retido:!!d.tributacao?.issRetido,regime_especial:d.tributacao?.regimeEspecial||"",forma_pagamento:d.financeiro?.formaPagamento||"BOLETO",observacao:x.observacao||"",cliente:null});setNovoCliente(false);setCliente(clienteNovo());setPreparacao(null);window.scrollTo({top:0,behavior:"smooth"})}

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={()=>navigate("/financas/notas-fiscais")}><ArrowLeft size={18}/></button><PageTitle titulo="Emitir NFS-e — M Lab" descricao="Cliente central, rascunho fiscal, pré-validação e emissão pelo Emissor Nacional."/></div>

    <div className={`rounded-2xl border p-4 ${estado?.configurado?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 font-semibold">{estado?.configurado?<CheckCircle2 size={18}/>:<XCircle size={18}/>}Integração NFS-e Nacional · {estado?.ambiente||"HOMOLOGACAO"}</div><p className="mt-1 text-sm">Empresa emissora: <b>{estado?.empresa?.nome||"M Lab"}</b> · CNPJ {estado?.empresa?.cnpj||"—"}</p></div><div className="text-xs">{estado?.configurado?"Certificado/dados fiscais configurados":"Aguardando certificado A1 e dados fiscais nos Secrets"}</div></div>
      {!estado?.configurado&&<div className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-5">{estado?.requisitos&&Object.entries(estado.requisitos).map(([k,v])=><span key={k} className={v?"text-emerald-700":"text-amber-800"}>{v?"✓":"○"} {k}</span>)}</div>}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 p-3 text-xs text-slate-700"><ShieldCheck size={16} className="mt-0.5 shrink-0"/><span>Produção permanece bloqueada até homologação aprovada. Salvar rascunhos e cadastrar clientes não emite documento fiscal.</span></div>
    </div>

    {erro&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {ok&&<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}

    <section className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between"><div><h2 className="font-bold">{form.id?"Editar rascunho":"Nova NFS-e"}</h2><p className="text-xs text-slate-500">A NFS-e será sempre emitida pela M Lab.</p></div>{form.id&&<button className="btn-outline" onClick={limpar}><FilePlus2 size={15}/>Nova</button>}</div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="label">Cliente</span><button type="button" className="btn-outline h-8 px-3 text-xs" onClick={()=>{setNovoCliente(v=>!v);setForm(x=>({...x,cliente_id:""}));setPreparacao(null)}}><UserPlus size={14}/>{novoCliente?"Usar cliente existente":"Cadastrar cliente novo"}</button></div>
          {!novoCliente?<><div className="relative mb-2"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar por nome, fantasia ou CPF/CNPJ"/></div><select className="input" value={form.cliente_id} onChange={e=>{setForm({...form,cliente_id:e.target.value});setPreparacao(null)}}><option value="">Selecione o cliente</option>{clientesFiltrados.map(x=><option key={x.id} value={x.id}>{x.nome} · {x.cnpj_cpf||"sem documento"}</option>)}</select>{selecionado&&<div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs"><b>{selecionado.nome}</b> · {selecionado.cnpj_cpf||"—"} · origem {selecionado.origem}{selecionado.email&&<> · {selecionado.email}</>}</div>}</>:
          <div className="grid gap-3 md:grid-cols-3"><input className="input" placeholder="Razão social / Nome *" value={cliente.nome} onChange={e=>setCliente({...cliente,nome:e.target.value})}/><input className="input" placeholder="Nome fantasia" value={cliente.nome_fantasia} onChange={e=>setCliente({...cliente,nome_fantasia:e.target.value})}/><input className="input" placeholder="CPF/CNPJ *" value={cliente.cnpj_cpf} onChange={e=>setCliente({...cliente,cnpj_cpf:e.target.value})}/><input className="input" type="email" placeholder="E-mail fiscal" value={cliente.email} onChange={e=>setCliente({...cliente,email:e.target.value})}/><input className="input" placeholder="Telefone" value={cliente.telefone} onChange={e=>setCliente({...cliente,telefone:e.target.value})}/><input className="input" placeholder="CEP" value={cliente.cep} onChange={e=>setCliente({...cliente,cep:e.target.value})}/><input className="input md:col-span-2" placeholder="Logradouro" value={cliente.logradouro} onChange={e=>setCliente({...cliente,logradouro:e.target.value})}/><input className="input" placeholder="Número" value={cliente.numero} onChange={e=>setCliente({...cliente,numero:e.target.value})}/><input className="input" placeholder="Bairro" value={cliente.bairro} onChange={e=>setCliente({...cliente,bairro:e.target.value})}/><input className="input" placeholder="Cidade" value={cliente.cidade} onChange={e=>setCliente({...cliente,cidade:e.target.value})}/><input className="input" maxLength={2} placeholder="UF" value={cliente.uf} onChange={e=>setCliente({...cliente,uf:e.target.value.toUpperCase()})}/></div>}
        </div>

        <label><span className="label">Data da emissão</span><input className="input" type="date" value={form.data_emissao} onChange={e=>setForm({...form,data_emissao:e.target.value})}/></label>
        <label><span className="label">Vencimento do recebimento *</span><input className="input" type="date" value={form.data_vencimento} onChange={e=>setForm({...form,data_vencimento:e.target.value})}/></label>
        <label><span className="label">Código nacional do serviço *</span><input className="input" value={form.codigo_servico} onChange={e=>setForm({...form,codigo_servico:e.target.value})} placeholder="Ex.: código da Lista Nacional"/></label>
        <label><span className="label">NBS</span><input className="input" value={form.nbs} onChange={e=>setForm({...form,nbs:e.target.value})}/></label>
        <label className="md:col-span-2"><span className="label">Descrição do serviço *</span><textarea className="input min-h-24" value={form.servico_descricao} onChange={e=>setForm({...form,servico_descricao:e.target.value})}/></label>
        <label><span className="label">Valor da NFS-e *</span><input className="input" type="number" min="0" step="0.01" value={form.valor_total} onChange={e=>setForm({...form,valor_total:e.target.value})}/></label>
        <label><span className="label">Alíquota ISS (%)</span><input className="input" type="number" min="0" step="0.01" value={form.aliquota_iss} onChange={e=>setForm({...form,aliquota_iss:e.target.value})}/></label>
        <label><span className="label">Forma de pagamento</span><select className="input" value={form.forma_pagamento} onChange={e=>setForm({...form,forma_pagamento:e.target.value})}><option>BOLETO</option><option>PIX</option><option>TRANSFERENCIA</option><option>OUTRO</option></select></label>
        <label className="flex items-end gap-2 pb-3"><input type="checkbox" checked={form.iss_retido} onChange={e=>setForm({...form,iss_retido:e.target.checked})}/> ISS retido pelo tomador</label>
        <label className="md:col-span-2"><span className="label">Observação</span><textarea className="input min-h-20" value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/></label>
      </div>

      {preparacao&&<div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800"><b>Pré-validação OK.</b> Cliente: {preparacao.cliente?.nome}. Valor: {moeda(form.valor_total)}. Ambiente: {preparacao.ambiente}.</div>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button className="btn-outline" onClick={preparar}>Pré-validar</button><button className="btn-outline" disabled={salvando} onClick={salvar}><Save size={15}/>{salvando?"Salvando...":"Salvar rascunho"}</button><button className="btn-primary" disabled={emitindo||!form.id} onClick={emitir}><FilePlus2 size={15}/>{emitindo?"Transmitindo...":"Emitir NFS-e"}</button></div>
    </section>

    <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Rascunhos e NFS-e da M Lab</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Cliente</th><th>Emissão</th><th>Vencimento</th><th className="text-right">Valor</th><th>Status fiscal</th><th>Ambiente</th><th></th></tr></thead><tbody>{carregando?<tr><td colSpan="7" className="py-8 text-center text-slate-500">Carregando...</td></tr>:rascunhos.length===0?<tr><td colSpan="7" className="py-8 text-center text-slate-500">Nenhum rascunho NFS-e cadastrado.</td></tr>:rascunhos.map(x=><tr key={x.id} className="border-t"><td className="py-3"><b>{x.cliente?.nome||x.nome_destinatario||"—"}</b><div className="text-xs text-slate-500">{x.cliente?.cnpj_cpf||x.cnpj_destinatario||""}</div></td><td>{dataBR(x.data_emissao)}</td><td>{dataBR(x.data_vencimento)}</td><td className="text-right font-semibold">{moeda(x.valor_total)}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{x.status_fiscal||"—"}</span></td><td>{x.nfse_ambiente||"—"}</td><td className="text-right"><button className="btn-ghost" onClick={()=>editar(x)}>Abrir</button></td></tr>)}</tbody></table></div></section>
  </div>
}
