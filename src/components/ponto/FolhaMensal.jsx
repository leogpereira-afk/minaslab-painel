import { Fragment, useMemo, useState } from "react";
import { Printer, Save } from "lucide-react";
import { rhFolhaSalvar } from "../../services/dados.js";
import { duracaoTexto, ausenciaDoDia } from "../../lib/rh/ponto.js";
import { Card, Empty } from "../ui.jsx";
import BancoHorasFuncionario from "../rh/BancoHorasFuncionario.jsx";

const nomesMes=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const rotulo=c=>{const[a,m]=String(c).split("-");return nomesMes[Number(m)-1]? `${nomesMes[Number(m)-1]} de ${a}`:c};
const dataBR=s=>{const p=String(s||"").split("-");return p.length===3?`${p[2]}/${p[1]}`:"—"};
const hora=(...vs)=>vs.find(v=>v!=null&&String(v).trim())||"—";
const minutos=d=>Number(d.trabalhadoMin??d.trackedMin??0);
const semana=iso=>Math.floor((Number(String(iso||"").slice(8,10))-1)/7)+1;
const previsto=d=>{const x=new Date(String(d.data||"")+"T12:00:00").getDay();return x===0||x===6?0:x===5?420:480};
const diaSemana=iso=>{const d=new Date(String(iso||"")+"T12:00:00");return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR",{weekday:"long"})};
const fimDeSemana=iso=>{const d=new Date(String(iso||"")+"T12:00:00").getDay();return d===0||d===6};
const ehFeriado=d=>Boolean(d.feriado||d.isHoliday||String(d.tipoDia||"").toLowerCase().includes("feriado")||String(d.ocorrencia||"").toLowerCase().includes("feriado"));
const classeDia=d=>ehFeriado(d)?"bg-rose-100":fimDeSemana(d.data)?"bg-slate-100":"";

export default function FolhaMensal({pessoas=[],pontoDia=[],competencia,editavel}){
 const[pessoaId,setPessoaId]=useState(""); const[mensagem,setMensagem]=useState("");
 const pessoa=pessoas.find(p=>p.id===pessoaId);
 const linhas=useMemo(()=>pontoDia.filter(d=>d.pessoaId===pessoaId&&String(d.data||"").startsWith(competencia)).sort((a,b)=>String(a.data).localeCompare(String(b.data))),[pontoDia,pessoaId,competencia]);
 const linhasFolha=useMemo(()=>{
  const [ano,mes]=String(competencia).split("-").map(Number);
  if(!ano||!mes)return linhas;
  const ultimo=new Date(ano,mes,0).getDate(), porData=new Map(linhas.map(d=>[d.data,d]));
  return Array.from({length:ultimo},(_,i)=>{
    const data=`${ano}-${String(mes).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;
    return porData.get(data)||{id:`vazio_${data}`,data,pessoaId};
  });
 },[linhas,competencia,pessoaId]);
 const total=linhas.reduce((n,d)=>n+minutos(d),0), normais=linhas.reduce((n,d)=>n+Math.min(minutos(d),previsto(d)),0), extras=linhas.reduce((n,d)=>n+Math.max(0,minutos(d)-previsto(d)),0);
 const porSemana=useMemo(()=>{const m=new Map();for(const d of linhasFolha){const s=semana(d.data);if(!m.has(s))m.set(s,[]);m.get(s).push(d)}return[...m.entries()].sort((a,b)=>a[0]-b[0])},[linhasFolha]);
 async function fechar(){if(!pessoa)return setMensagem("Selecione um funcionário.");try{const folha=await rhFolhaSalvar({pessoaId:pessoa.id,empresa:pessoa.empresa||"",competencia,status:"FECHADA",dadosSnapshot:{pessoa,competencia,linhas,totalMinutos:total,geradoEm:new Date().toISOString()}});setMensagem(`Folha de ${rotulo(competencia)} salva e preservada.`);return folha}catch(e){setMensagem(e.message)}}
 return <div className="space-y-4"><Card>
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-base font-semibold text-slate-900">Folha de Ponto Mensal</h2><p className="text-xs text-slate-500">Registros do mês · {rotulo(competencia)}</p></div><div className="flex flex-wrap gap-2"><select aria-label="Pessoa da folha mensal" className="select" value={pessoaId} onChange={e=>setPessoaId(e.target.value)}><option value="">Selecione o funcionário</option>{pessoas.filter(p=>p.ativo!==false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome))).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select><button type="button" className="btn-outline" onClick={()=>window.print()} disabled={!pessoa||!linhas.length}><Printer size={15}/> Imprimir / PDF</button>{editavel&&<button type="button" className="btn-primary" onClick={fechar} disabled={!pessoa||!linhas.length}><Save size={15}/> Salvar folha mensal</button>}</div></div>
  <p className="mb-3 text-xs text-slate-500">Modelo mensal alinhado à planilha oficial da MinasLab. Horários e ocorrências continuam vindo dos dados reais do Ponto.</p>{mensagem&&<p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{mensagem}</p>}
  {!pessoa?<Empty>Selecione um funcionário para visualizar a folha.</Empty>:<div className="overflow-x-auto"><div className="min-w-[980px] rounded-xl border bg-white p-4" style={{borderColor:"var(--hairline)"}}>
   <h3 className="mb-3 text-lg font-bold">Folhas de Ponto Mensais</h3>
   <div className="mb-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-sm"><strong>Mês</strong><span>{rotulo(competencia)}</span><strong>Membro</strong><span>{pessoa.nome}</span><strong>Código</strong><span>{pessoa.matricula||"—"}</span><strong>Gerente(s)</strong><span>{pessoa.gestorNome||"—"}</span></div>
   <div className="mb-2 flex gap-5 border-y py-2 text-xs font-medium" style={{borderColor:"var(--hairline)"}}><span>Legenda</span><span className="rounded px-2 py-1 bg-rose-100">Feriado</span><span className="rounded px-2 py-1 bg-slate-100">Dia de descanso / fim de semana</span><span>Férias</span></div>
   <table className="w-full border-collapse text-xs"><thead><tr className="border-y text-left">{["DATA","DIA","PRIMEIRA ENTRADA","Almoço 1h Início","Almoço 1h Fim","ÚLTIMA SAÍDA","HRS FOLHA PAG.","HRS NORMAIS","HORAS EXTRAS DIÁRIAS","TOTAL DE HORAS"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>
   {porSemana.map(([s,dias])=>{const st=dias.reduce((n,d)=>n+minutos(d),0),sn=dias.reduce((n,d)=>n+Math.min(minutos(d),previsto(d)),0),se=dias.reduce((n,d)=>n+Math.max(0,minutos(d)-previsto(d)),0);return <Fragment key={s}><tr className="border-b bg-slate-50 font-semibold"><td className="p-2" colSpan={6}>Semana {s}</td><td className="p-2">{duracaoTexto(st)}</td><td className="p-2">{duracaoTexto(sn)}</td><td className="p-2">{duracaoTexto(se)}</td><td className="p-2">{duracaoTexto(st-sn)}</td></tr>{dias.map(d=>{const t=minutos(d),p=previsto(d),n=Math.min(t,p),e=Math.max(0,t-p),oc=d.emAberto?"Em aberto":ausenciaDoDia(d)?.rotulo||d.ocorrencia||"";return <tr key={d.id||d.data} className={`border-b ${classeDia(d)}`}><td className="p-2">{dataBR(d.data)}</td><td className="p-2 capitalize">{diaSemana(d.data)}</td><td className="p-2">{oc||hora(d.entrada,d.primeiraEntrada)}</td><td className="p-2">{hora(d.inicioAlmoco,d.inicioIntervalo)}</td><td className="p-2">{hora(d.fimAlmoco,d.fimIntervalo)}</td><td className="p-2">{hora(d.saida,d.ultimaSaida)}</td><td className="p-2">{duracaoTexto(t)}</td><td className="p-2">{duracaoTexto(n)}</td><td className="p-2">{duracaoTexto(e)}</td><td className="p-2">{duracaoTexto(t-p)}</td></tr>})}</Fragment>})}
   <tr className="border-t-2 font-bold"><td className="p-2" colSpan={6}>Total de Horas</td><td className="p-2">{duracaoTexto(total)}</td><td className="p-2">{duracaoTexto(normais)}</td><td className="p-2">{duracaoTexto(extras)}</td><td className="p-2">{duracaoTexto(total-normais)}</td></tr></tbody></table>
   <div className="mt-4 grid gap-2 text-sm md:grid-cols-2"><div><strong>Total de Horas:</strong> {duracaoTexto(total)}</div><div><strong>Jornada semanal:</strong> {pessoa.horasSemanais||"—"}</div><div className="md:col-span-2"><strong>Horário previsto:</strong> {pessoa.jornada||"—"}</div></div>
   <div className="mt-8 border-t pt-8 text-center text-sm">ASSINATURA DO COLABORADOR: ________________________________________________</div>
  </div></div>}
 </Card>{pessoa&&<div className="sem-impressao"><BancoHorasFuncionario pessoa={pessoa} editavel={editavel}/></div>}</div>
}