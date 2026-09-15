import { Printer } from "lucide-react";

function imprimir(){
 const tabela=document.querySelector('table.min-w-\\[1470px\\]');
 if(!tabela){window.print();return}
 const clone=tabela.cloneNode(true);
 clone.querySelectorAll('input,select,button').forEach(el=>el.remove());
 const cab=clone.querySelector('thead');if(cab?.rows?.length>1)cab.deleteRow(1);
 [...clone.rows].forEach(r=>{if(r.cells.length>=14){r.deleteCell(13);r.deleteCell(0)}});
 const pag=document.querySelector('select.h-7.rounded-md.border');
 const totalTexto=pag?.closest('div')?.parentElement?.previousElementSibling?.textContent||'';
 const titulo=document.querySelector('h1')?.textContent||'Serviços Gerados';
 const ativo=[...document.querySelectorAll('button.rounded-full')].find(b=>b.className.includes('bg-blue-600'))?.textContent||'Todos';
 const empresa=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.textContent==='Todas as empresas'))?.selectedOptions?.[0]?.textContent||'Todas as empresas';
 const w=window.open('','_blank','noopener,noreferrer');if(!w)return;
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#111;margin:0}h1{font-size:18px;margin:0}.meta{font-size:10px;color:#475569;margin:3px 0 10px}.summary{font-size:10px;border:1px solid #cbd5e1;background:#f8fafc;padding:6px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:7.5px}th,td{border:1px solid #cbd5e1;padding:3px;vertical-align:top}th{background:#f1f5f9;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}svg{display:none}</style></head><body><h1>Serviços Gerados</h1><div class="meta">MinasLab / M Lab · Gerado em ${new Date().toLocaleString('pt-BR')}</div><div class="summary"><b>Empresa:</b> ${empresa} &nbsp; | &nbsp; <b>Visão:</b> ${ativo} &nbsp; | &nbsp; ${totalTexto}</div>${clone.outerHTML}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);w.document.close();
}
export default function ServicosGeradosPrintButton(){return <button type="button" className="btn-outline" onClick={imprimir}><Printer size={16}/>Imprimir relatório</button>}
