import { useEffect, useMemo, useState } from "react";
import { Layers3, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ServicosGerados from "./ServicosGerados.jsx";
import { servicosGeradosListar } from "../services/servicosGerados.js";
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const moeda=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dig=v=>String(v||"").replace(/\D/g,"");
const chaveCliente=x=>dig(x.cnpj_cpf)||String(x.cliente||"").trim().toUpperCase();

async function criarGrupo(servicoIds,referenciaPagamento=""){
  const resp=await comCracha(`${API}/ml-financeiro-servicos-grupar`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({servicoIds,referenciaPagamento})});
  const body=await resp.json().catch(()=>null);
  if(!resp.ok)throw new Error(body?.erro||body?.message||mensagemDoStatus(resp.status));
  return body.grupo;
}

export default function ServicosGeradosAgrupado(){
  const navigate=useNavigate();
  const [aberto,setAberto]=useState(false),[dados,setDados]=useState([]),[selecionados,setSelecionados]=useState([]),[busca,setBusca]=useState(""),[referencia,setReferencia]=useState(""),[erro,setErro]=useState(""),[ok,setOk]=useState(""),[salvando,setSalvando]=useState(false);
  useEffect(()=>{if(!aberto)return;setErro("");servicosGeradosListar({busca:""}).then(r=>setDados(r.itens||[])).catch(e=>setErro(e.message))},[aberto]);
  const elegiveis=useMemo(()=>dados.filter(x=>x.status_faturamento!=="FATURADO"&&!["NAO FATURAR","CANCELADO"].includes(x.status_faturamento)),[dados]);
  const filtrados=useMemo(()=>{const q=busca.trim().toLowerCase();return elegiveis.filter(x=>!q||`${x.os_numero} ${x.cliente} ${x.cnpj_cpf||""} ${x.contrato_proposta||""}`.toLowerCase().includes(q))},[elegiveis,busca]);
  const itens=useMemo(()=>elegiveis.filter(x=>selecionados.includes(x.id)),[elegiveis,selecionados]);
  const total=itens.reduce((s,x)=>s+Number(x.valor_faturar||x.valor_original||0),0);
  const primeiro=itens[0];
  const empresa=primeiro?.empresa;
  const usaOmie=!!empresa?.usa_omie;
  const podeAdicionar=x=>!primeiro||(x.empresa_id===primeiro.empresa_id&&chaveCliente(x)===chaveCliente(primeiro));
  function alternar(x){setErro("");if(selecionados.includes(x.id)){setSelecionados(v=>v.filter(id=>id!==x.id));return}if(!podeAdicionar(x)){setErro("Para uma única nota/recebimento, selecione somente OS da mesma empresa de emissão e do mesmo cliente/CNPJ.");return}setSelecionados(v=>[...v,x.id])}
  function fechar(){setAberto(false);setSelecionados([]);setBusca("");setReferencia("");setErro("")}
  async function continuar(){if(itens.length<2){setErro("Selecione pelo menos duas OS para faturar juntas.");return}if(usaOmie&&!referencia.trim()){setErro("Informe a Referência para pagamento/Pedido Omie que será comum às OS selecionadas.");return}setSalvando(true);setErro("");try{const g=await criarGrupo(selecionados,referencia.trim());if(g.usaOmie){setOk(`${itens.length} OS agrupadas. A referência Omie ${referencia.trim()} foi aplicada ao grupo para a conferência de pagamento.`);fechar();return}const vencimentos=[...new Set(itens.map(x=>x.data_vencimento).filter(Boolean))];const formas=[...new Set(itens.map(x=>x.forma_pagamento).filter(Boolean))];const sintetico={id:g.id,grupo_faturamento_id:g.id,empresa_id:primeiro.empresa_id,cliente:primeiro.cliente,cnpj_cpf:primeiro.cnpj_cpf,valor_faturar:total,valor_original:total,data_vencimento:vencimentos.length===1?vencimentos[0]:"",forma_pagamento:formas.length===1?formas[0]:"BOLETO",contrato_proposta:[...new Set(itens.map(x=>x.contrato_proposta).filter(Boolean))].join(", "),os_numero:itens.map(x=>x.os_numero).join(", "),observacao:`Faturamento agrupado das OS: ${itens.map(x=>x.os_numero).join(", ")}`,servicos_agrupados:itens};navigate("/financas/notas-fiscais/emitir",{state:{servicoGerado:sintetico}})}catch(e){setErro(e.message)}finally{setSalvando(false)}}
  return <div className="space-y-3">
    {ok&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}
    <div className="flex justify-end"><button className="btn-primary" onClick={()=>setAberto(true)}><Layers3 size={16}/>Agrupar OS / faturar juntas</button></div>
    <ServicosGerados/>
    {aberto&&<div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35"><div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5"><div><h2 className="text-xl font-bold text-slate-900">Faturar OS selecionadas</h2><p className="text-sm text-slate-500">Agrupe várias OS do mesmo cliente em uma única nota/recebimento.</p></div><button className="p-2" onClick={fechar}><X size={20}/></button></div><div className="space-y-4 p-5">
      {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      <div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input w-full pl-9" placeholder="Buscar cliente, CNPJ ou OS..." value={busca} onChange={e=>setBusca(e.target.value)}/></div>
      {itens.length>0&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><b>{itens.length} OS selecionadas</b> · {primeiro.cliente} · Total <b>{moeda(total)}</b><div className="mt-1 text-xs">Somente OS deste mesmo cliente e empresa podem entrar neste grupo.</div></div>}
      <div className="max-h-[52vh] overflow-auto rounded-xl border"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50 text-left text-slate-500"><tr><th className="p-3"></th><th>OS</th><th>Cliente</th><th>Empresa</th><th className="text-right">Valor</th></tr></thead><tbody>{filtrados.map(x=><tr key={x.id} className={`border-t ${selecionados.includes(x.id)?"bg-blue-50":""} ${!podeAdicionar(x)&&primeiro?"opacity-45":""}`}><td className="p-3"><input type="checkbox" checked={selecionados.includes(x.id)} disabled={!podeAdicionar(x)&&!!primeiro} onChange={()=>alternar(x)}/></td><td className="whitespace-nowrap font-semibold">{x.os_numero}</td><td className="max-w-[260px] truncate pr-3">{x.cliente}</td><td className="whitespace-nowrap pr-3">{x.empresa?.nome||"—"}</td><td className="whitespace-nowrap p-3 text-right font-semibold">{moeda(x.valor_faturar||x.valor_original)}</td></tr>)}</tbody></table></div>
      {itens.length>0&&usaOmie&&<label className="block text-xs font-semibold text-slate-600">Referência para pagamento / Pedido Omie<input className="input mt-1 w-full" value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Informe a referência comum do faturamento no Omie"/><span className="font-normal text-slate-400">Esta referência será aplicada a todas as OS selecionadas.</span></label>}
      {itens.length>0&&!usaOmie&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">M LAB: será preparada <b>uma única NFS-e</b> no total de <b>{moeda(total)}</b>. Após a autorização, todas as {itens.length} OS ficarão vinculadas à mesma nota e à mesma Conta a Receber.</div>}
    </div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4"><button className="btn-secondary" onClick={fechar}>Cancelar</button><button className="btn-primary" disabled={salvando||itens.length<2} onClick={continuar}>{salvando?"Preparando...":usaOmie?"Agrupar com referência Omie":"Continuar para NFS-e única"}</button></div></div></div>}
  </div>
}
