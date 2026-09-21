import { Fragment, useEffect, useMemo, useState } from "react";
import { Printer, Save } from "lucide-react";
import { rhBancoListar, rhFolhaSalvar } from "../../services/dados.js";
import { duracaoTexto, ausenciaDoDia, minutosPrevistosDoDia } from "../../lib/rh/ponto.js";
import { Card, Empty } from "../ui.jsx";
import BancoHorasFuncionario from "../rh/BancoHorasFuncionario.jsx";

const nomesMes=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const rotulo=c=>{const[a,m]=String(c).split("-");return nomesMes[Number(m)-1]? `${nomesMes[Number(m)-1]} de ${a}`:c};
const periodo=c=>{const[a,m]=String(c).split("-").map(Number);if(!a||!m)return c;const u=new Date(a,m,0).getDate(),mm=String(m).padStart(2,"0");return `01 ${nomesMes[m-1]} ${a} - ${String(u).padStart(2,"0")} ${nomesMes[m-1]} ${a}`};
const hms=min=>{const n=Math.round(Number(min)||0),s=n<0?"-":"";const a=Math.abs(n);return `${s}${String(Math.floor(a/60)).padStart(2,"0")}:${String(a%60).padStart(2,"0")}:00`};
const dataBR=s=>{const p=String(s||"").split("-");return p.length===3?`${p[2]}/${p[1]}`:"—"};
const hora=(...vs)=>vs.find(v=>v!=null&&String(v).trim())||"—";
const minutos=d=>Number(d.trabalhadoMin??d.trackedMin??0);
const semana=iso=>Math.floor((Number(String(iso||"").slice(8,10))-1)/7)+1;
const diaSemana=iso=>{const d=new Date(String(iso||"")+"T12:00:00");return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR",{weekday:"long"})};
const fimDeSemana=iso=>{const d=new Date(String(iso||"")+"T12:00:00").getDay();return d===0||d===6};
const ehFeriado=d=>Boolean(d.feriado||d.isHoliday||String(d.tipoDia||"").toLowerCase().includes("feriado")||String(d.ocorrencia||"").toLowerCase().includes("feriado"));
const classeDia=d=>ehFeriado(d)?"bg-orange-100":ausenciaDoDia(d)?.tipo==="ferias"?"bg-sky-100":fimDeSemana(d.data)?"bg-green-100":"";

export default function FolhaMensal({pessoas=[],pontoDia=[],competencia,editavel}){
 const[pessoaId,setPessoaId]=useState(""); const[mensagem,setMensagem]=useState(""); const[movimentosBanco,setMovimentosBanco]=useState(null);
 const pessoa=pessoas.find(p=>p.id===pessoaId);
 useEffect(()=>{let vivo=true;if(!pessoaId){setMovimentosBanco(null);return()=>{vivo=false}};rhBancoListar({pessoaId}).then(r=>{if(vivo)setMovimentosBanco(r.movimentos||[])}).catch(()=>{if(vivo)setMovimentosBanco(null)});return()=>{vivo=false}},[pessoaId]);
 const previsto=d=>{const a=ausenciaDoDia(d);if(ehFeriado(d)||(a&&!a.desconta))return 0;return minutosPrevistosDoDia(d.data,pessoa?.jornada)??0};
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
 const total=linhas.reduce((n,d)=>n+minutos(d),0), normais=linhas.reduce((n,d)=>n+Math.min(minutos(d),previsto(d)),0), extras=linhas.reduce((n,d)=>n+Math.max(0,minutos(d)-previsto(d)),0), saldoMes=linhas.reduce((n,d)=>n+minutos(d)-previsto(d),0);
 const saldoAcumulado=useMemo(()=>{
  if(!pessoaId||movimentosBanco===null)return null;
  const limite=`${competencia}-31`;
  const movimentos=movimentosBanco.filter(m=>String(m.data_movimento||m.dataMovimento||"")<=limite&&m.origem!=="APURACAO_PONTO").reduce((n,m)=>n+Number(m.credito_minutos??m.creditoMinutos??0)-Number(m.debito_minutos??m.debitoMinutos??0),0);
  if(String(competencia)<"2026-09")return movimentos;
  const apurado=pontoDia.filter(d=>d.pessoaId===pessoaId&&String(d.data||"")>="2026-09-01"&&String(d.data||"")<=limite).reduce((n,d)=>n+minutos(d)-previsto(d),0);
  return movimentos+apurado;
 },[pessoaId,competencia,movimentosBanco,pontoDia,pessoa?.jornada]);
 const porSemana=useMemo(()=>{const m=new Map();for(const d of linhasFolha){const s=semana(d.data);if(!m.has(s))m.set(s,[]);m.get(s).push(d)}return[...m.entries()].sort((a,b)=>a[0]-b[0])},[linhasFolha]);
 async function fechar(){if(!pessoa)return setMensagem("Selecione um funcionário.");try{const folha=await rhFolhaSalvar({pessoaId:pessoa.id,empresa:pessoa.empresa||"",competencia,status:"FECHADA",dadosSnapshot:{pessoa,competencia,linhas,totalMinutos:total,saldoMesMinutos:saldoMes,saldoAcumuladoMinutos:saldoAcumulado,geradoEm:new Date().toISOString()}});setMensagem(`Folha de ${rotulo(competencia)} salva e preservada.`);return folha}catch(e){setMensagem(e.message)}}
 return <div className="space-y-4"><Card>
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-base font-semibold text-slate-900">Folha de Ponto Mensal</h2><p className="text-xs text-slate-500">Registros do mês · {rotulo(competencia)}</p></div><div className="flex flex-wrap gap-2"><select aria-label="Pessoa da folha mensal" className="select" value={pessoaId} onChange={e=>setPessoaId(e.target.value)}><option value="">Selecione o funcionário</option>{pessoas.filter(p=>p.ativo!==false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome))).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select><button type="button" className="btn-outline" onClick={()=>window.print()} disabled={!pessoa||!linhas.length}><Printer size={15}/> Imprimir / PDF</button>{editavel&&<button type="button" className="btn-primary" onClick={fechar} disabled={!pessoa||!linhas.length}><Save size={15}/> Salvar folha mensal</button>}</div></div>
  <p className="mb-3 text-xs text-slate-500">Modelo mensal alinhado à planilha oficial da MinasLab. Horários e ocorrências continuam vindo dos dados reais do Ponto.</p>{mensagem&&<p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{mensagem}</p>}
  {!pessoa?<Empty>Selecione um funcionário para visualizar a folha.</Empty>:<div className="overflow-x-auto"><div className="min-w-[980px] rounded-xl border bg-white p-4" style={{borderColor:"var(--hairline)"}}>
   <h3 className="mb-2 text-xl font-extrabold text-orange-500">Folhas de Ponto Mensais</h3>
   <div className="mb-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-sm"><strong>Mês</strong><span>{periodo(competencia)}</span><strong>Membro</strong><span>{pessoa.nome}</span><strong>Código</strong><span>{pessoa.matricula||"—"}</span><strong>Gerente(s)</strong><span>{pessoa.gestorNome||"—"}</span></div>
   <div className="mb-1 flex items-stretch text-xs font-medium"><span className="px-2 py-1">Legenda</span><span className="bg-orange-100 px-8 py-1">Feriado</span><span className="bg-green-100 px-8 py-1">Dia de descanso</span><span className="bg-sky-100 px-8 py-1">Férias</span></div>
   <table className="w-full border-collapse text-[10px]"><thead><tr className="border border-slate-400 text-center">{["DATA","DIA","PRIMEIRA ENTRADA","Almoço 1h Início","Almoço 1h Fim","ÚLTIMA SAÍDA","HRS FOLHA PAG.","HRS NORMAIS","HORAS EXTRAS DIÁRIAS","TOTAL DE HORAS"].map(h=><th key={h} className="border border-slate-400 px-1 py-2">{h}</th>)}</tr></thead><tbody>
   {porSemana.map(([s,dias])=>{const st=dias.reduce((n,d)=>n+minutos(d),0),sn=dias.reduce((n,d)=>n+Math.min(minutos(d),previsto(d)),0),se=dias.reduce((n,d)=>n+Math.max(0,minutos(d)-previsto(d)),0);return <Fragment key={s}><tr className="border border-slate-400 bg-white text-center font-semibold"><td className="border border-slate-400 py-1" colSpan={6}>Semana {s}</td><td className="border border-slate-400 px-1">{hms(st)}</td><td className="border border-slate-400 px-1">{hms(sn)}</td><td className="border border-slate-400 px-1">{hms(se)}</td><td className="border border-slate-400 px-1">{hms(st-sn)}</td></tr>{dias.map(d=>{const t=minutos(d),p=previsto(d),n=Math.min(t,p),e=Math.max(0,t-p),oc=d.emAberto?"Em aberto":ausenciaDoDia(d)?.rotulo||d.ocorrencia||"";return <tr key={d.id||d.data} className={`border border-slate-400 ${classeDia(d)}`}><td className="border border-slate-400 px-1 py-1">{dataBR(d.data)}</td><td className="border border-slate-400 px-1 capitalize">{diaSemana(d.data)}</td><td className="border border-slate-400 px-1 text-center">{oc||hora(d.entrada,d.primeiraEntrada)}</td><td className="border border-slate-400 px-1 text-center">{hora(d.inicioAlmoco,d.inicioIntervalo)}</td><td className="border border-slate-400 px-1 text-center">{hora(d.fimAlmoco,d.fimIntervalo)}</td><td className="border border-slate-400 px-1 text-center">{hora(d.saida,d.ultimaSaida)}</td><td className="border border-slate-400 px-1 text-center">{hms(t)}</td><td className="border border-slate-400 px-1 text-center">{hms(n)}</td><td className="border border-slate-400 px-1 text-center">{hms(e)}</td><td className="border border-slate-400 px-1 text-center">{hms(t-p)}</td></tr>})}</Fragment>})}
   <tr className="border border-slate-400 font-bold"><td className="border border-slate-400 p-1 text-right" colSpan={6}>Total de Horas</td><td className="border border-slate-400 p-1 text-center">{hms(total)}</td><td className="border border-slate-400 p-1 text-center">{hms(normais)}</td><td className="border border-slate-400 p-1 text-center">{hms(extras)}</td><td className="border border-slate-400 p-1 text-center">{hms(saldoMes)}</td></tr></tbody></table>
   <div className="mt-4 grid gap-2 text-sm md:grid-cols-2"><div><strong>Total de Horas:</strong> {duracaoTexto(total)}</div><div><strong>Jornada semanal:</strong> {pessoa.horasSemanais||"—"}</div><div className="md:col-span-2"><strong>Horário previsto:</strong> {pessoa.jornada||"—"}</div></div>
   <div className="mt-2 flex justify-end text-xs font-bold"><span className="mr-3">Total de Horas Acumuladas</span><span className="tnum min-w-24 text-right">{saldoAcumulado==null?"—":hms(saldoAcumulado)}</span></div><div className="mt-5 grid grid-cols-2 gap-8 text-xs"><div><div className="font-semibold text-orange-500">Horário de Trabalho</div><div className="mt-1">Jornada de trabalho</div><div className="mt-2 whitespace-pre-line">{pessoa.jornada||"Jornada não informada"}</div></div><div className="flex items-end justify-center pb-2"><div className="w-64 border-t border-black pt-1 text-center">Assinatura Colaborador</div></div></div>
  </div></div>}
 </Card>{pessoa&&<div className="sem-impressao"><BancoHorasFuncionario pessoa={pessoa} editavel={editavel}/></div>}</div>
}