import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const texto=v=>String(v??"").trim()||"—";
const data=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";
const esperar=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cabecalhos=["Contrato","OS","Empresa","Cliente","NF","Faturamento","Pagamento","Data da Recepção","Emissão","Vencimento","Valor","Origem"];

const dataRecepcao=x=>{
 if(!x?.grupo_faturamento)return data(x?.data_os);
 const datas=[...new Set((x.grupo_itens||[]).map(s=>s.data_os).filter(Boolean))];
 return datas.length===1?data(datas[0]):datas.length>1?"Várias":"—";
};

function linhasDosItens(itens){
 const individuais=itens.flatMap(x=>x?.grupo_faturamento&&Array.isArray(x.grupo_itens)&&x.grupo_itens.length?x.grupo_itens:[x]);
 return individuais.map(x=>({
  valores:[
   texto(x.contrato_proposta),texto(x.os_numero),texto(x.empresa?.nome),texto(x.cliente),
   texto(x.numero_nf),texto(x.status_faturamento),texto(x.status_pagamento),dataRecepcao(x),
   data(x.data_emissao),data(x.data_vencimento),Number(x.valor_faturar||x.valor_original)||0,
   texto(x.pagamento_origem)
  ],
  valorNumerico:true
 }));
}

function localizarTabela(){
 return [...document.querySelectorAll("table")].find(t=>{
  const titulos=[...t.querySelectorAll("thead th")].map(th=>(th.textContent||"").trim());
  return titulos.some(v=>/contrato/i.test(v))&&titulos.some(v=>/^os$/i.test(v));
 });
}

function linhasDaTabela(tabela){
 if(!tabela)return [];
 return [...tabela.querySelectorAll("tbody tr")].filter(r=>r.cells.length>=13).map(r=>{
  const c=[...r.cells],inicio=c.length>=14?1:0;
  return {valores:c.slice(inicio,inicio+12).map(x=>(x?.innerText||"").replace(/\s+/g," ").trim()||"—"),valorNumerico:false};
 });
}

function paginaDaTabela(tabela){
 const area=tabela?.closest("section")||tabela?.parentElement?.parentElement;
 const indicador=[...(area?.querySelectorAll("span")||[])].find(x=>/^\s*\d+\s*\/\s*\d+\s*$/.test(x.textContent||""));
 const partes=(indicador?.textContent||"1 / 1").match(/(\d+)\s*\/\s*(\d+)/);
 const botoes=[...(area?.querySelectorAll("button")||[])];
 const anterior=botoes.find(b=>b.querySelector("svg.lucide-chevron-left"));
 const proxima=botoes.find(b=>b.querySelector("svg.lucide-chevron-right"));
 return {atual:Number(partes?.[1]||1),total:Number(partes?.[2]||1),anterior,proxima};
}

async function aguardarPagina(tabela,paginaAnterior){
 for(let i=0;i<20;i++){
  await esperar(50);
  if(paginaDaTabela(tabela).atual!==paginaAnterior)return;
 }
}

async function irParaPrimeira(tabela){
 let pagina=paginaDaTabela(tabela);
 while(pagina.atual>1&&pagina.anterior&&!pagina.anterior.disabled){
  const anterior=pagina.atual;
  pagina.anterior.click();
  await aguardarPagina(tabela,anterior);
  pagina=paginaDaTabela(tabela);
 }
}

async function linhasDeTodasAsPaginas(){
 const tabela=localizarTabela();
 if(!tabela)return [];
 const paginaOriginal=paginaDaTabela(tabela).atual;
 await irParaPrimeira(tabela);
 const linhas=[];
 let pagina=paginaDaTabela(tabela);
 while(true){
  linhas.push(...linhasDaTabela(tabela));
  if(pagina.atual>=pagina.total||!pagina.proxima||pagina.proxima.disabled)break;
  const anterior=pagina.atual;
  pagina.proxima.click();
  await aguardarPagina(tabela,anterior);
  const novaPagina=paginaDaTabela(tabela);
  if(novaPagina.atual===anterior)break;
  pagina=novaPagina;
 }
 await irParaPrimeira(tabela);
 for(let numero=1;numero<paginaOriginal;numero++){
  const atual=paginaDaTabela(tabela);
  if(!atual.proxima||atual.proxima.disabled)break;
  atual.proxima.click();
  await aguardarPagina(tabela,atual.atual);
 }
 return linhas;
}

function criarPlanilha({linhas,empresa,visao,busca}){
 const conteudo=linhas.map(({valores,valorNumerico})=>`<Row>${valores.map((v,i)=>{
  if(i===10&&valorNumerico)return `<Cell ss:StyleID="Moeda"><Data ss:Type="Number">${Number(v)||0}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${esc(texto(v))}</Data></Cell>`;
 }).join("")}</Row>`).join("");
 const resumo=`Empresa: ${empresa||"Todas as empresas"} | Visão: ${visao||"Todos"} | Busca: ${busca||"—"} | Registros: ${linhas.length}`;
 return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Titulo"><Font ss:Bold="1" ss:Size="14"/></Style>
  <Style ss:ID="Cabecalho"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Moeda"><NumberFormat ss:Format="R$ #,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Serviços Gerados"><Table>
  <Row><Cell ss:StyleID="Titulo"><Data ss:Type="String">Serviços Gerados</Data></Cell></Row>
  <Row><Cell ss:MergeAcross="11"><Data ss:Type="String">${esc(resumo)}</Data></Cell></Row>
  <Row>${cabecalhos.map(h=>`<Cell ss:StyleID="Cabecalho"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("")}</Row>
  ${conteudo}
 </Table></Worksheet>
</Workbook>`;
}

function baixar(blob,nome){
 if(navigator.msSaveOrOpenBlob){navigator.msSaveOrOpenBlob(blob,nome);return}
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=nome;link.style.display="none";
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}

export default function ServicosGeradosPrintButton({itens,empresa,visao,busca}){
 const [baixando,setBaixando]=useState(false);
 async function exportar(){
  if(baixando)return;
  setBaixando(true);
  try{
   const fonte=Array.isArray(itens)&&itens.length?itens:Array.isArray(window.__minaslabServicosGeradosExport)?window.__minaslabServicosGeradosExport:[];
   const linhas=fonte.length?linhasDosItens(fonte):await linhasDeTodasAsPaginas();
   if(!linhas.length)throw new Error("Não há serviços para exportar com os filtros atuais.");
   const xml=criarPlanilha({linhas,empresa,visao,busca});
   const blob=new Blob(["\ufeff",xml],{type:"application/vnd.ms-excel;charset=utf-8"});
   const dia=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
   baixar(blob,`Servicos_Gerados_${dia}.xls`);
  }catch(e){
   alert(e?.message||"Não foi possível gerar o Excel de Serviços Gerados.");
  }finally{
   setBaixando(false);
  }
 }
 return <button type="button" className="btn-secondary text-xs" onClick={exportar} disabled={baixando}><FileSpreadsheet size={14}/>{baixando?"Gerando...":"Baixar Excel"}</button>
}
