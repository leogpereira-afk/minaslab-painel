import { useEffect, useMemo, useState } from "react";
import { Layers3, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import ServicosGerados from "./ServicosGerados.jsx";
import { servicosGeradosListar } from "../services/servicosGerados.js";
import { financeiroOpcoes } from "../services/financeiro.js";
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const moeda=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const data=v=>v?String(v).slice(0,10):"";
const dig=v=>String(v||"").replace(/\D/g,"");
const chaveCliente=x=>dig(x.cnpj_cpf)||String(x.cliente||"").trim().toUpperCase();

async function grupoApi(corpo){
  const resp=await comCracha(`${API}/ml-financeiro-servicos-grupar`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(corpo)});
  const body=await resp.json().catch(()=>null);
  if(!resp.ok)throw new Error(body?.erro||body?.message||mensagemDoStatus(resp.status));
  return body||{};
}

export default function ServicosGeradosAgrupado(){
  const [gestao,setGestao]=useState(false),[grupos,setGrupos]=useState([]),[empresas,setEmpresas]=useState([]),[grupo,setGrupo]=useState(null),[edit,setEdit]=useState(null),[modoAdd,setModoAdd]=useState(false),[dados,setDados]=useState([]),[busca,setBusca]=useState(""),[selecionados,setSelecionados]=useState([]),[erro,setErro]=useState(""),[ok,setOk]=useState(""),[salvando,setSalvando]=useState(false);

  async function carregarGrupos(){const r=await grupoApi({action:"listarGrupos"});setGrupos(r.grupos||[]);if(r.empresas?.length)setEmpresas(r.empresas)}
  async function abrirGestao(){setErro("");setGestao(true);try{await carregarGrupos()}catch(e){setErro(e.message)}}
  async function abrirGrupo(g){setErro("");try{const r=await grupoApi({action:"obterGrupo",grupoId:g.id});setGrupo(r.grupo);setEdit({...r.grupo,empresa_id:r.grupo.empresa_id||"",data_vencimento:data(r.grupo.data_vencimento),data_emissao:data(r.grupo.data_emissao),numero_nf:r.grupo.numero_nf||"",forma_pagamento:r.grupo.forma_pagamento||"",status_faturamento:r.grupo.status_faturamento||"",referencia_pagamento:r.grupo.referencia_pagamento||""});setModoAdd(false);setSelecionados([])}catch(e){setErro(e.message)}}
  useEffect(()=>{if(!gestao)return;financeiroOpcoes().then(r=>{if(r.empresas?.length)setEmpresas(r.empresas)}).catch(()=>{})},[gestao]);
  async function abrirAdicionar(){setErro("");setBusca("");setSelecionados([]);setModoAdd(true);try{const r=await servicosGeradosListar({busca:""});setDados(r.itens||[])}catch(e){setErro(e.message)}}

  const idsAgrupados=useMemo(()=>new Set(grupos.flatMap(g=>(g.itens||[]).map(x=>x.id))),[grupos]);
  const elegiveis=useMemo(()=>dados.filter(x=>!x.grupo_faturamento&&!idsAgrupados.has(x.id)&&x.status_faturamento==="PRONTO PARA FATURAR"&&x.empresa_id===grupo?.empresa_id&&chaveCliente(x)===String(grupo?.cliente_chave||"").toUpperCase()),[dados,idsAgrupados,grupo]);
  const filtrados=useMemo(()=>{const q=busca.trim().toLowerCase();return elegiveis.filter(x=>!q||`${x.os_numero} ${x.cliente} ${x.cnpj_cpf||""} ${x.contrato_proposta||""}`.toLowerCase().includes(q))},[elegiveis,busca]);

  async function salvarGrupo(){
    if(!grupo||salvando)return;
    const qtd=grupo.itens?.length||0;
    if(!window.confirm(`Esta alteração será aplicada às ${qtd} OS deste grupo.\n\nDeseja continuar?`))return;
    setSalvando(true);setErro("");setOk("");
    try{const r=await grupoApi({action:"editarGrupo",grupoId:grupo.id,campos:{empresa_id:edit.empresa_id,data_vencimento:edit.data_vencimento,data_emissao:edit.data_emissao,numero_nf:edit.numero_nf,referencia_pagamento:edit.referencia_pagamento,forma_pagamento:edit.forma_pagamento,status_faturamento:edit.status_faturamento}});setGrupo(r.grupo);setEdit({...r.grupo,data_vencimento:data(r.grupo.data_vencimento),data_emissao:data(r.grupo.data_emissao),numero_nf:r.grupo.numero_nf||"",forma_pagamento:r.grupo.forma_pagamento||"",status_faturamento:r.grupo.status_faturamento||"",referencia_pagamento:r.grupo.referencia_pagamento||""});await carregarGrupos();setOk(`Alteração aplicada às ${r.quantidade||qtd} OS do grupo.`)}catch(e){setErro(e.message)}finally{setSalvando(false)}
  }
  async function adicionar(){if(!selecionados.length||salvando)return;if(!window.confirm(`Adicionar ${selecionados.length} OS a este grupo?\n\nOs dados compartilhados do grupo serão aplicados às novas OS.`))return;setSalvando(true);setErro("");try{await grupoApi({grupoId:grupo.id,servicoIds:selecionados});await carregarGrupos();const r=await grupoApi({action:"obterGrupo",grupoId:grupo.id});setGrupo(r.grupo);setModoAdd(false);setSelecionados([]);setOk(`${selecionados.length} OS adicionada(s) ao grupo. Total recalculado automaticamente.`)}catch(e){setErro(e.message)}finally{setSalvando(false)}}
  async function remover(item){if(salvando)return;const qtd=grupo.itens?.length||0;const aviso=qtd<=2?"Como o grupo ficará com menos de duas OS, o agrupamento será encerrado.":"O valor total do grupo será recalculado.";if(!window.confirm(`Remover a OS ${item.os_numero} deste grupo?\n\n${aviso}`))return;setSalvando(true);setErro("");try{const r=await grupoApi({action:"desagruparItem",servicoId:item.id});await carregarGrupos();if(r.grupoEncerrado){setGrupo(null);setEdit(null);setOk("Agrupamento encerrado e as OS voltaram a ficar individuais.")}else{const novo=await grupoApi({action:"obterGrupo",grupoId:grupo.id});setGrupo(novo.grupo);setEdit(v=>({...v,...novo.grupo,data_vencimento:data(novo.grupo.data_vencimento),data_emissao:data(novo.grupo.data_emissao)}));setOk(`OS ${item.os_numero} removida. Total do grupo recalculado.`)}}catch(e){setErro(e.message)}finally{setSalvando(false)}}

  return <div className="space-y-3">
    {ok&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}
    {erro&&!gestao&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    <div className="flex justify-end"><button className="btn-secondary" onClick={abrirGestao}><Layers3 size={16}/>Gerenciar grupos de OS</button></div>
    <ServicosGerados/>

    {gestao&&<div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/35"><div className="h-full w-full max-w-5xl overflow-y-auto bg-white shadow-2xl">
      <div className="sticky top-0 z-20 flex items-start justify-between border-b bg-white p-5"><div><h2 className="text-xl font-bold text-slate-900">Grupos de Serviços Gerados</h2><p className="text-sm text-slate-500">Edite uma vez os dados compartilhados, adicione OS que ficaram de fora ou remova uma OS do grupo.</p></div><button className="p-2" onClick={()=>{setGestao(false);setGrupo(null);setErro("")}}><X size={20}/></button></div>
      <div className="space-y-4 p-5">
        {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {!grupo&&<div className="rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Cliente</th><th>Empresa</th><th>OS</th><th>Referência</th><th className="text-right">Total</th><th></th></tr></thead><tbody>{grupos.map(g=><tr key={g.id} className="border-t"><td className="p-3 font-semibold">{g.cliente_nome}</td><td>{g.empresa?.nome||"—"}</td><td>{g.itens?.length||0}</td><td>{g.referencia_pagamento||"—"}</td><td className="text-right font-semibold">{moeda(g.valor_total)}</td><td className="p-3 text-right"><button className="btn-secondary" onClick={()=>abrirGrupo(g)}><Pencil size={14}/>Gerenciar</button></td></tr>)}</tbody></table>{!grupos.length&&<div className="p-8 text-center text-sm text-slate-500">Nenhum agrupamento aberto.</div>}</div>}

        {grupo&&!modoAdd&&<>
          <div className="flex items-center justify-between"><button className="text-sm font-semibold text-blue-600" onClick={()=>{setGrupo(null);setEdit(null)}}>← Voltar aos grupos</button><button className="btn-primary" onClick={abrirAdicionar}><Plus size={15}/>Adicionar OS ao grupo</button></div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><b>{grupo.cliente_nome}</b> · {grupo.itens?.length||0} OS · Total <b>{moeda(grupo.valor_total)}</b><div className="mt-1 text-xs">Os campos abaixo são compartilhados por todo o grupo.</div></div>
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">Empresa<select className="input mt-1 w-full" value={edit?.empresa_id||""} onChange={e=>setEdit(v=>({...v,empresa_id:e.target.value}))}>{empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Data de vencimento<input type="date" className="input mt-1 w-full" value={edit?.data_vencimento||""} onChange={e=>setEdit(v=>({...v,data_vencimento:e.target.value}))}/></label>
            <label className="text-xs font-semibold text-slate-600">Data de emissão<input type="date" className="input mt-1 w-full" value={edit?.data_emissao||""} onChange={e=>setEdit(v=>({...v,data_emissao:e.target.value}))}/></label>
            <label className="text-xs font-semibold text-slate-600">Informação / Nº da NF<input className="input mt-1 w-full" value={edit?.numero_nf||""} onChange={e=>setEdit(v=>({...v,numero_nf:e.target.value}))}/></label>
            <label className="text-xs font-semibold text-slate-600">Referência para pagamento<input className="input mt-1 w-full" value={edit?.referencia_pagamento||""} onChange={e=>setEdit(v=>({...v,referencia_pagamento:e.target.value}))}/></label>
            <label className="text-xs font-semibold text-slate-600">Forma de pagamento<input className="input mt-1 w-full" value={edit?.forma_pagamento||""} onChange={e=>setEdit(v=>({...v,forma_pagamento:e.target.value}))} placeholder="Ex.: BOLETO, PIX, TRANSFERÊNCIA"/></label>
            <label className="text-xs font-semibold text-slate-600">Status<select className="input mt-1 w-full" value={edit?.status_faturamento||""} onChange={e=>setEdit(v=>({...v,status_faturamento:e.target.value}))}><option value="">—</option><option value="AGUARDANDO">Aguardando</option><option value="PRONTO PARA FATURAR">Pronto para faturar</option><option value="FATURADO">Faturado</option><option value="NAO FATURAR">Não faturar</option><option value="CANCELADO">Cancelado</option></select></label>
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={salvando} onClick={salvarGrupo}>{salvando?"Aplicando...":`Salvar para as ${grupo.itens?.length||0} OS`}</button></div>
          <div className="rounded-xl border"><table className="w-full text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">OS</th><th>Serviço</th><th>Valor individual</th><th></th></tr></thead><tbody>{(grupo.itens||[]).map(x=><tr key={x.id} className="border-t"><td className="p-3 font-semibold">{x.os_numero}</td><td>{x.servico||"—"}</td><td>{moeda(x.valor_faturar||x.valor_original)}</td><td className="p-3 text-right"><button className="inline-flex items-center gap-1 text-red-600" disabled={salvando} onClick={()=>remover(x)}><Trash2 size={13}/>Remover do grupo</button></td></tr>)}</tbody></table></div>
        </>}

        {grupo&&modoAdd&&<>
          <div className="flex items-center justify-between"><button className="text-sm font-semibold text-blue-600" onClick={()=>setModoAdd(false)}>← Voltar ao grupo</button><div className="text-sm text-slate-500">{selecionados.length} selecionada(s)</div></div>
          <div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input w-full pl-9" placeholder="Buscar OS, cliente ou contrato..." value={busca} onChange={e=>setBusca(e.target.value)}/></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Somente OS <b>Pronto para faturar</b>, do mesmo cliente/CNPJ e da mesma empresa aparecem aqui. Uma OS já agrupada não pode entrar em outro grupo.</div>
          <div className="max-h-[55vh] overflow-auto rounded-xl border"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50 text-left text-slate-500"><tr><th className="p-3"></th><th>OS</th><th>Cliente</th><th>Serviço</th><th className="text-right">Valor</th></tr></thead><tbody>{filtrados.map(x=><tr key={x.id} className={`border-t ${selecionados.includes(x.id)?"bg-blue-50":""}`}><td className="p-3"><input type="checkbox" checked={selecionados.includes(x.id)} onChange={()=>setSelecionados(v=>v.includes(x.id)?v.filter(id=>id!==x.id):[...v,x.id])}/></td><td className="font-semibold">{x.os_numero}</td><td>{x.cliente}</td><td>{x.servico||"—"}</td><td className="p-3 text-right font-semibold">{moeda(x.valor_faturar||x.valor_original)}</td></tr>)}</tbody></table>{!filtrados.length&&<div className="p-8 text-center text-sm text-slate-500">Nenhuma OS elegível encontrada para este grupo.</div>}</div>
          <div className="flex justify-end"><button className="btn-primary" disabled={salvando||!selecionados.length} onClick={adicionar}>{salvando?"Adicionando...":`Adicionar ${selecionados.length||""} OS ao grupo`}</button></div>
        </>}
      </div>
    </div></div>}
  </div>
}
