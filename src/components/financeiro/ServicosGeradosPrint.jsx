import { forwardRef } from "react";

const moeda=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const data=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";
const textoStatus=s=>String(s||"—").replaceAll("_"," ");
const dataRecepcao=x=>{if(!x?.grupo_faturamento)return data(x?.data_os);const ds=[...new Set((x.grupo_itens||[]).map(s=>s.data_os).filter(Boolean))];return ds.length===1?data(ds[0]):ds.length>1?"Várias":"—"};

const ServicosGeradosPrint=forwardRef(function ServicosGeradosPrint({itens=[],empresa="Todas as empresas",aba="Todos",filtrosAtivos=false},ref){
 const total=itens.reduce((s,x)=>s+Number(x.valor_faturar??x.valor_original??0),0);
 const gerado=new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"});
 return <div ref={ref} className="servicos-print-report" aria-hidden="true">
  <style>{`@media screen{.servicos-print-report{display:none}}@media print{@page{size:A4 landscape;margin:8mm}body *{visibility:hidden!important}.servicos-print-report,.servicos-print-report *{visibility:visible!important}.servicos-print-report{display:block!important;position:absolute;inset:0;width:100%;background:#fff;color:#111;font-family:Arial,sans-serif}.servicos-print-report table{width:100%;border-collapse:collapse;font-size:7.5pt}.servicos-print-report th,.servicos-print-report td{border:1px solid #cbd5e1;padding:3px 4px;vertical-align:top}.servicos-print-report th{background:#f1f5f9;text-align:left}.servicos-print-report thead{display:table-header-group}.servicos-print-report tr{break-inside:avoid}.servicos-print-report .print-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px}.servicos-print-report h1{font-size:16pt;margin:0}.servicos-print-report p{margin:2px 0;font-size:8pt}.servicos-print-report .right{text-align:right}.servicos-print-report .summary{margin:6px 0 10px;padding:5px 7px;border:1px solid #cbd5e1;background:#f8fafc;font-size:8pt}.servicos-print-report .footer{margin-top:6px;font-size:7pt;color:#64748b}}`}</style>
  <div className="print-head"><div><h1>Serviços Gerados</h1><p>MinasLab / M Lab — relatório financeiro</p></div><div className="right"><p>Gerado em {gerado}</p><p>{itens.length} registro(s)</p></div></div>
  <div className="summary"><b>Empresa:</b> {empresa} &nbsp; | &nbsp; <b>Visão:</b> {aba} &nbsp; | &nbsp; <b>Filtros:</b> {filtrosAtivos?"aplicados":"nenhum"} &nbsp; | &nbsp; <b>Total:</b> {moeda(total)}</div>
  <table><thead><tr><th>Contrato</th><th>OS</th><th>Empresa</th><th>Cliente</th><th>NF</th><th>Faturamento</th><th>Pagamento</th><th>Recepção</th><th>Emissão</th><th>Vencimento</th><th className="right">Valor</th><th>Origem</th></tr></thead><tbody>{itens.map(x=><tr key={x.id}><td>{x.contrato_proposta||"—"}</td><td>{x.grupo_faturamento?`${x.quantidade_os||x.grupo_itens?.length||0} OS`:x.os_numero||"—"}</td><td>{x.empresa?.nome||"—"}</td><td>{x.cliente||"—"}</td><td>{x.numero_nf||"—"}</td><td>{textoStatus(x.status_faturamento)}</td><td>{textoStatus(x.status_pagamento)}</td><td>{dataRecepcao(x)}</td><td>{data(x.data_emissao)}</td><td>{data(x.data_vencimento)}</td><td className="right">{moeda(x.valor_faturar??x.valor_original)}</td><td>{x.pagamento_origem||"—"}</td></tr>)}</tbody><tfoot><tr><td colSpan="10"><b>Total dos registros filtrados</b></td><td className="right"><b>{moeda(total)}</b></td><td/></tr></tfoot></table>
  <p className="footer">Este relatório respeita a empresa, a visão/status, a busca e os filtros de coluna ativos na tela. A paginação visual não limita a impressão.</p>
 </div>
});
export default ServicosGeradosPrint;
