import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const texto=v=>String(v??"").trim()||"—";
const data=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";
const dataRecepcao=x=>{
 if(!x?.grupo_faturamento)return data(x?.data_os);
 const datas=[...new Set((x.grupo_itens||[]).map(s=>s.data_os).filter(Boolean))];
 return datas.length===1?data(datas[0]):datas.length>1?"Várias":"—";
};
const celulaTexto=v=>`<Cell><Data ss:Type="String">${esc(texto(v))}</Data></Cell>`;
const celulaNumero=v=>`<Cell ss:StyleID="Moeda"><Data ss:Type="Number">${Number(v)||0}</Data></Cell>`;

function criarPlanilha({itens,empresa,visao,busca}){
 const cabecalhos=["Contrato","OS","Empresa","Cliente","NF","Faturamento","Pagamento","Data da Recepção","Emissão","Vencimento","Valor","Origem"];
 const linhas=itens.map(x=>`<Row>${[
  texto(x.contrato_proposta),
  texto(x.os_numero),
  texto(x.empresa?.nome),
  texto(x.cliente),
  texto(x.numero_nf),
  texto(x.status_faturamento),
  texto(x.status_pagamento),
  dataRecepcao(x),
  data(x.data_emissao),
  data(x.data_vencimento)
 ].map(celulaTexto).join("")}${celulaNumero(x.valor_faturar||x.valor_original)}${celulaTexto(x.pagamento_origem)}</Row>`).join("");
 const resumo=`Empresa: ${empresa||"Todas as empresas"} | Visão: ${visao||"Todos"} | Busca: ${busca||"—"} | Registros: ${itens.length}`;
 return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Titulo"><Font ss:Bold="1" ss:Size="14"/></Style>
  <Style ss:ID="Cabecalho"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Moeda"><NumberFormat ss:Format="R$ #,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Serviços Gerados">
  <Table>
   <Row><Cell ss:StyleID="Titulo"><Data ss:Type="String">Serviços Gerados</Data></Cell></Row>
   <Row><Cell ss:MergeAcross="11"><Data ss:Type="String">${esc(resumo)}</Data></Cell></Row>
   <Row>${cabecalhos.map(h=>`<Cell ss:StyleID="Cabecalho"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("")}</Row>
   ${linhas}
  </Table>
 </Worksheet>
</Workbook>`;
}

function baixar(blob,nome){
 if(navigator.msSaveOrOpenBlob){navigator.msSaveOrOpenBlob(blob,nome);return}
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;
 link.download=nome;
 link.style.display="none";
 document.body.appendChild(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ServicosGeradosPrintButton({itens=[],empresa,visao,busca}){
 const [baixando,setBaixando]=useState(false);
 function exportar(){
  if(baixando)return;
  setBaixando(true);
  try{
   if(!itens.length)throw new Error("Não há serviços para exportar com os filtros atuais.");
   const xml=criarPlanilha({itens,empresa,visao,busca});
   const blob=new Blob(["\ufeff",xml],{type:"application/vnd.ms-excel;charset=utf-8"});
   const dia=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
   baixar(blob,`Servicos_Gerados_${dia}.xls`);
  }catch(e){
   alert(e?.message||"Não foi possível gerar o Excel de Serviços Gerados.");
  }finally{
   setBaixando(false);
  }
 }
 return <button type="button" className="btn-secondary text-xs" onClick={exportar} disabled={baixando||!itens.length} title={!itens.length?"Não há serviços para exportar":undefined}><FileSpreadsheet size={14}/>{baixando?"Gerando...":"Baixar Excel"}</button>
}
