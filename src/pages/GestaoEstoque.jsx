import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, Boxes, ClipboardList, FileText, PackagePlus, PackageMinus,
  Plus, Search, Settings, Tags, Truck,
} from "lucide-react";
import { PageTitle, Card, Modal, Aviso, CarregandoModulo, ErroModulo } from "../components/ui.jsx";
import { carregarColecoes, salvar } from "../services/dados.js";
import { podeEditar } from "../lib/sessao.js";

const SECOES = [
  ["dashboard", "Dashboard", BarChart3],
  ["cadastro-insumo", "Cadastro de Insumos", Boxes],
  ["entrada-lote", "Entrada de Estoque", PackagePlus],
  ["retirada-baixa", "Saída / Baixa", PackageMinus],
  ["fornecedores", "Fornecedores", Truck],
  ["etiquetas", "Etiquetas", Tags],
  ["relatorios", "Relatórios", FileText],
  ["configuracoes", "Configurações", Settings],
  ["pedido-compra", "Pedido de Compra", ClipboardList],
];
const COLECOES = ["estoque_produtos_base", "estoque_lotes", "estoque_fornecedores", "estoque_pedidos"];

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function statusLote(l){
  const atual=n(l.totalAtual ?? l.total_atual);
  const minimo=n(l.qtdMinima ?? l.qtd_minima);
  if(atual<=0) return "ZERADO";
  if(minimo>0 && atual<=minimo) return "CRÍTICO";
  return "OK";
}
function Campo({rotulo,...props}){return <label className="block"><span className="label">{rotulo}</span><input className="input" {...props}/></label>}

function Dashboard({produtos,lotes,fornecedores,pedidos}){
  const vm=useMemo(()=>{
    const ativos=lotes.filter(l=>n(l.totalAtual ?? l.total_atual)>0);
    return {
      produtos:produtos.length,
      lotes:ativos.length,
      criticos:ativos.filter(l=>statusLote(l)==="CRÍTICO").length,
      fornecedores:fornecedores.filter(f=>String(f.status||"ATIVO").toUpperCase()!=="INATIVO").length,
      pedidos:pedidos.filter(p=>!["RECEBIDO","CANCELADO","INTEGRADO"].includes(String(p.status||"").toUpperCase())).length,
    };
  },[produtos,lotes,fornecedores,pedidos]);
  const cards=[
    ["Produtos cadastrados",vm.produtos,Boxes],
    ["Lotes com saldo",vm.lotes,PackagePlus],
    ["Estoque crítico",vm.criticos,AlertTriangle],
    ["Fornecedores ativos",vm.fornecedores,Truck],
    ["Pedidos em aberto",vm.pedidos,ClipboardList],
  ];
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([r,v,I])=><Card key={r}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><I size={18}/></span><span><span className="block text-xs text-slate-500">{r}</span><strong className="font-display text-2xl text-slate-900">{v}</strong></span></div></Card>)}</div>
    <Card><h2 className="font-display text-base font-bold text-slate-900">Visão geral do estoque</h2><p className="mt-1 text-sm text-slate-600">Os indicadores usam as coleções exclusivas da nova Gestão de Estoque. Nenhum dado da página Compras é misturado aqui.</p></Card>
  </div>;
}

function CadastroInsumos({produtos,aoRecarregar}){
  const [busca,setBusca]=useState("");
  const [form,setForm]=useState(null);
  const [gravando,setGravando]=useState(false);
  const [aviso,setAviso]=useState(null);
  const lista=useMemo(()=>produtos.filter(p=>[p.id,p.produto,p.especificacao,p.grupo,p.fornecedorAtual].join(" ").toLowerCase().includes(busca.toLowerCase())),[produtos,busca]);
  const novo=()=>setForm({id:"",fornecedorAtual:"",grupo:"",produto:"",especificacao:"",requerCertificado:"NAO",unidade:"UN",conteudoKit:"",qtdMinima:"",setor:"",statusQuantidade:"ATIVO",statusCompra:""});
  const gravar=async()=>{
    setGravando(true);
    try{await salvar("estoque_produtos_base",{...form,id:form.id||undefined,qtdMinima:n(form.qtdMinima),conteudoKit:n(form.conteudoKit),origem:"GESTAO_ESTOQUE"});setForm(null);setAviso({tipo:"ok",texto:"Insumo salvo."});await aoRecarregar();}
    catch(e){setAviso({tipo:"erro",texto:e.message});}finally{setGravando(false);}
  };
  return <div>
    <Aviso aviso={aviso} aoFechar={()=>setAviso(null)}/>
    <div className="mb-4 flex flex-wrap items-center gap-2"><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input className="input pl-9" placeholder="Buscar ID, produto, grupo, fornecedor..." value={busca} onChange={e=>setBusca(e.target.value)}/></div>{podeEditar()&&<button className="btn-primary" onClick={novo}><Plus size={15}/> Novo insumo</button>}</div>
    <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{["ID","Grupo","Produto","Especificação","Fornecedor atual","Unidade","Qtd. mínima","Setor","Status"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{lista.map(p=><tr key={p.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium">{p.id}</td><td className="px-4 py-3">{p.grupo||"—"}</td><td className="px-4 py-3 font-medium text-slate-900">{p.produto||"—"}</td><td className="px-4 py-3">{p.especificacao||"—"}</td><td className="px-4 py-3">{p.fornecedorAtual||"—"}</td><td className="px-4 py-3">{p.unidade||"—"}</td><td className="px-4 py-3">{p.qtdMinima??"—"}</td><td className="px-4 py-3">{p.setor||"—"}</td><td className="px-4 py-3">{p.statusQuantidade||"—"}</td></tr>)}</tbody></table>{!lista.length&&<p className="p-6 text-center text-sm text-slate-500">Nenhum insumo encontrado.</p>}</div></Card>
    {form&&<Modal titulo="Novo insumo" aberto aoFechar={()=>setForm(null)} largura="max-w-3xl"><div className="grid gap-4 sm:grid-cols-2"><Campo rotulo="ID" value={form.id} onChange={e=>setForm({...form,id:e.target.value})} placeholder="Gerado automaticamente se vazio"/><Campo rotulo="Fornecedor atual" value={form.fornecedorAtual} onChange={e=>setForm({...form,fornecedorAtual:e.target.value})}/><Campo rotulo="Grupo" value={form.grupo} onChange={e=>setForm({...form,grupo:e.target.value})}/><Campo rotulo="Produto" value={form.produto} onChange={e=>setForm({...form,produto:e.target.value})}/><label className="block sm:col-span-2"><span className="label">Especificação</span><input className="input" value={form.especificacao} onChange={e=>setForm({...form,especificacao:e.target.value})}/></label><Campo rotulo="Unidade" value={form.unidade} onChange={e=>setForm({...form,unidade:e.target.value})}/><Campo rotulo="Conteúdo do kit" type="number" value={form.conteudoKit} onChange={e=>setForm({...form,conteudoKit:e.target.value})}/><Campo rotulo="Quantidade mínima" type="number" value={form.qtdMinima} onChange={e=>setForm({...form,qtdMinima:e.target.value})}/><Campo rotulo="Setor" value={form.setor} onChange={e=>setForm({...form,setor:e.target.value})}/></div><div className="mt-5 flex justify-end gap-2"><button className="btn-outline" onClick={()=>setForm(null)}>Cancelar</button><button className="btn-primary" disabled={gravando||!form.produto.trim()} onClick={gravar}>{gravando?"Salvando...":"Salvar insumo"}</button></div></Modal>}
  </div>;
}

export default function GestaoEstoque(){
  const [secao,setSecao]=useState("dashboard");
  const [dados,setDados]=useState(null);
  const [erro,setErro]=useState("");
  const carregar=async()=>{try{const r=await carregarColecoes(COLECOES);setDados(r);setErro("");}catch(e){setErro(e.message);}};
  useEffect(()=>{carregar();},[]);
  if(erro&&!dados)return <ErroModulo mensagem={erro} aoTentar={carregar}/>;
  if(!dados)return <CarregandoModulo/>;
  const atual=SECOES.find(([id])=>id===secao)||SECOES[0];
  return <div><PageTitle titulo="Gestão de Estoque" descricao="Controle de insumos, lotes, entradas, saídas, fornecedores, compras, inspeções, etiquetas e relatórios."/><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{SECOES.map(([id,nome,Icone])=><button key={id} type="button" onClick={()=>setSecao(id)} className={secao===id?"btn-primary shrink-0":"btn-outline shrink-0"}><Icone size={15}/>{nome}</button>)}</div>{secao==="dashboard"?<Dashboard produtos={dados.estoque_produtos_base} lotes={dados.estoque_lotes} fornecedores={dados.estoque_fornecedores} pedidos={dados.estoque_pedidos}/>:secao==="cadastro-insumo"?<CadastroInsumos produtos={dados.estoque_produtos_base} aoRecarregar={carregar}/>:<Card><h2 className="font-display text-lg font-bold text-slate-900">{atual[1]}</h2><p className="mt-1 text-sm text-slate-600">Estrutura criada. Esta etapa será conectada às regras do sistema legado na sequência da migração.</p></Card>}</div>;
}
