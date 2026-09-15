import { FileSpreadsheet } from "lucide-react";

const esperar=(ms=80)=>new Promise(r=>setTimeout(r,ms));
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function tabela(){return document.querySelector('table.min-w-\\[1470px\\]')}
function pagina(){
 const t=tabela();if(!t)return null;
 const rodape=t.closest("section")?.querySelector("div.border-t.px-3.py-2");
 const anterior=rodape?.querySelector("button:has(svg.lucide-chevron-left)");
 const proxima=rodape?.querySelector("button:has(svg.lucide-chevron-right)");
 const indicador=[...(rodape?.querySelectorAll("span")||[])].find(x=>/^\s*\d+\s*\/\s*\d+\s*$/.test(x.textContent||""));
 const m=(indicador?.textContent||"1 / 1").match(/(\d+)\s*\/\s*(\d+)/);
 return {atual:Number(m?.[1]||1),total:Number(m?.[2]||1),anterior,proxima};
}
function linhasVisiveis(){
 const t=tabela();if(!t)return [];
 return [...t.querySelectorAll("tbody tr")].filter(r=>r.cells.length>=14).map(r=>{
  const c=[...r.cells];
  return [c[1],c[2],c[3],c[4],c[5],c[6],c[7],c[8],c[9],c[10],c[11],c[12]].map(x=>(x?.innerText||"").replace(/\s+/g," ").trim());
 });
}
async function irPrimeira(){let p=pagina();while(p&&p.atual>1&&p.anterior&&!p.anterior.disabled){p.anterior.click();await esperar();p=pagina()}}
async function exportar(){
 const t=tabela();if(!t){alert("A tabela de Serviços Gerados não foi encontrada.");return}
 const botao=document.activeElement;if(botao instanceof HTMLButtonElement)botao.disabled=true;
 try{
  const original=pagina()?.atual||1;await irPrimeira();
  const dados=[];let p=pagina();
  while(p){dados.push(...linhasVisiveis());if(p.atual>=p.total||!p.proxima||p.proxima.disabled)break;p.proxima.click();await esperar();p=pagina()}
  await irPrimeira();for(let i=1;i<original;i++){const q=pagina();if(!q?.proxima||q.proxima.disabled)break;q.proxima.click();await esperar()}
  const headers=["Contrato","OS","Empresa","Cliente","NF","Faturamento","Pagamento","Data da Recepção","Emissão","Vencimento","Valor","Origem"];
  const empresa=[...document.querySelectorAll("select")].find(s=>[...s.options].some(o=>o.textContent==="Todas as empresas"))?.selectedOptions?.[0]?.textContent||"Todas as empresas";
  const visao=[...document.querySelectorAll("button.rounded-full")].find(b=>b.className.includes("bg-blue-600"))?.textContent||"Todos";
  const busca=document.querySelector('input[placeholder^="Buscar por OS"]')?.value||"";
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Serviços Gerados"><Table><Row><Cell><Data ss:Type="String">Serviços Gerados</Data></Cell></Row><Row><Cell><Data ss:Type="String">Empresa: ${esc(empresa)} | Visão: ${esc(visao)} | Busca: ${esc(busca||"—")} | Registros: ${dados.length}</Data></Cell></Row><Row>${headers.map(h=>`<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("")}</Row>${dados.map(r=>`<Row>${r.map((v,i)=>i===10?`<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`:`<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
  const blob=new Blob([xml],{type:"application/vnd.ms-excel;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`Servicos_Gerados_${new Date().toLocaleDateString("en-CA")}.xml`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){alert(e?.message||"Não foi possível gerar o Excel de Serviços Gerados.")}finally{if(botao instanceof HTMLButtonElement)botao.disabled=false}
}
export default function ServicosGeradosPrintButton(){return <button type="button" className="btn-outline" onClick={exportar}><FileSpreadsheet size={16}/>Baixar Excel</button>}
