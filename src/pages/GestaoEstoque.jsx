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
const COLECOES = ["estoque_produtos_base", "estoque_lotes", "estoque_movimentos", "estoque_fornecedores", "estoque_pedidos"];

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

function EntradaEstoque({produtos,lotes,fornecedores,aoRecarregar}){
  const vazio={dataChegada:new Date().toISOString().slice(0,10),notaFiscal:"",valorNF:"",fornecedor:"",cnpj:"",grupo:"",produto:"",referencia:"",lote:"",unidade:"UN",validade:"",conteudoKit:"1",qtdKit:"1",qtdMinima:"",observacao:""};
  const [form,setForm]=useState(vazio); const [salvando,setSalvando]=useState(false); const [aviso,setAviso]=useState(null);
  const total=n(form.conteudoKit)*n(form.qtdKit);
  const escolherProduto=(nome)=>{const p=produtos.find(x=>x.produto===nome)||{};setForm({...form,produto:nome,grupo:p.grupo||form.grupo,unidade:p.unidade||form.unidade,qtdMinima:p.qtdMinima??form.qtdMinima,referencia:p.especificacao||form.referencia});};
  const salvarEntrada=async()=>{if(!form.produto.trim()||!form.lote.trim()||total<=0){setAviso({tipo:"erro",texto:"Informe produto, lote e quantidades válidas."});return;}setSalvando(true);try{const ids=lotes.map(l=>String(l.codigoID||l.codigoAuto||l.id||"")).filter(x=>/^ML-\d+$/.test(x)).map(x=>Number(x.split("-")[1]));const codigo="ML-"+String((Math.max(0,...ids)+1)).padStart(2,"0");const id="lote-"+codigo.toLowerCase();const reg={id,codigoID:codigo,codigoAuto:codigo,...form,produto:form.produto.toUpperCase(),lote:form.lote.toUpperCase(),notaFiscal:form.notaFiscal.toUpperCase(),fornecedor:form.fornecedor.toUpperCase(),qtdTotal:total,qtdRetirada:0,totalAtual:total,qtdAtual:total,dataAbertura:"",ultimaRetirada:"",statusValidade:"OK",statusCompra:"OK",origem:"GESTAO_ESTOQUE"};await salvar("estoque_lotes",reg);await salvar("estoque_movimentos",{tipo:"CADASTRO NOVO",codigoID:codigo,produto:reg.produto,lote:reg.lote,quantidade:0,unidade:reg.unidade,data:new Date().toISOString()});setForm(vazio);setAviso({tipo:"ok",texto:`Entrada ${codigo} cadastrada com sucesso.`});await aoRecarregar();}catch(e){setAviso({tipo:"erro",texto:e.message});}finally{setSalvando(false);}};
  return <div className="space-y-4"><Aviso aviso={aviso} aoFechar={()=>setAviso(null)}/><Card><div className="grid gap-4 md:grid-cols-3"><Campo rotulo="Data de chegada" type="date" value={form.dataChegada} onChange={e=>setForm({...form,dataChegada:e.target.value})}/><Campo rotulo="Nota fiscal" value={form.notaFiscal} onChange={e=>setForm({...form,notaFiscal:e.target.value})}/><Campo rotulo="Valor da NF" type="number" step="0.01" value={form.valorNF} onChange={e=>setForm({...form,valorNF:e.target.value})}/><label className="block"><span className="label">Fornecedor</span><select className="input" value={form.fornecedor} onChange={e=>{const x=fornecedores.find(f=>f.nome===e.target.value);setForm({...form,fornecedor:e.target.value,cnpj:x?.cnpj||""});}}><option value="">Selecione</option>{fornecedores.map(f=><option key={f.id||f.cnpj||f.nome} value={f.nome}>{f.nome}</option>)}</select></label><Campo rotulo="CNPJ" value={form.cnpj} onChange={e=>setForm({...form,cnpj:e.target.value})}/><Campo rotulo="Grupo" value={form.grupo} onChange={e=>setForm({...form,grupo:e.target.value})}/><label className="block"><span className="label">Produto</span><select className="input" value={form.produto} onChange={e=>escolherProduto(e.target.value)}><option value="">Selecione</option>{produtos.map(p=><option key={p.id} value={p.produto}>{p.produto}</option>)}</select></label><Campo rotulo="Referência / especificação" value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})}/><Campo rotulo="Lote" value={form.lote} onChange={e=>setForm({...form,lote:e.target.value})}/><Campo rotulo="Unidade" value={form.unidade} onChange={e=>setForm({...form,unidade:e.target.value})}/><Campo rotulo="Validade" type="date" value={form.validade} onChange={e=>setForm({...form,validade:e.target.value})}/><Campo rotulo="Conteúdo do kit" type="number" value={form.conteudoKit} onChange={e=>setForm({...form,conteudoKit:e.target.value})}/><Campo rotulo="Qtd. kits" type="number" value={form.qtdKit} onChange={e=>setForm({...form,qtdKit:e.target.value})}/><Campo rotulo="Qtd. mínima" type="number" value={form.qtdMinima} onChange={e=>setForm({...form,qtdMinima:e.target.value})}/><div><span className="label">Quantidade total</span><div className="input bg-slate-50 font-semibold">{total}</div></div><label className="block md:col-span-3"><span className="label">Observação</span><input className="input" value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/></label></div><div className="mt-5 flex justify-end"><button className="btn-primary" disabled={salvando||!podeEditar()} onClick={salvarEntrada}>{salvando?"Salvando...":"Registrar entrada"}</button></div></Card></div>;
}

function SaidaEstoque({lotes,aoRecarregar}){
 const disponiveis=useMemo(()=>lotes.filter(l=>n(l.totalAtual??l.qtdAtual)>0&&(!l.validade||l.validade>=new Date().toISOString().slice(0,10))).sort((a,b)=>(a.validade||"9999").localeCompare(b.validade||"9999")),[lotes]);
 const [id,setId]=useState("");const [qtd,setQtd]=useState("");const [dataAbertura,setDataAbertura]=useState("");const [salvando,setSalvando]=useState(false);const [aviso,setAviso]=useState(null);const lote=disponiveis.find(l=>l.id===id);
 const baixar=async()=>{const q=n(qtd),saldo=n(lote?.totalAtual??lote?.qtdAtual);if(!lote||q<=0||q>saldo){setAviso({tipo:"erro",texto:q>saldo?`Quantidade superior ao saldo disponível (${saldo} ${lote?.unidade||""}).`:"Selecione um lote e informe quantidade maior que zero."});return;}setSalvando(true);try{const retirada=n(lote.qtdRetirada)+q;await salvar("estoque_lotes",{...lote,qtdRetirada:retirada,totalAtual:saldo-q,qtdAtual:saldo-q,ultimaRetirada:new Date().toISOString(),dataAbertura:dataAbertura||lote.dataAbertura||""});await salvar("estoque_movimentos",{tipo:"RETIRADA (BAIXA)",codigoID:lote.codigoID||lote.codigoAuto,produto:lote.produto,lote:lote.lote,quantidade:q,unidade:lote.unidade,data:new Date().toISOString(),dataAbertura:dataAbertura||""});setId("");setQtd("");setDataAbertura("");setAviso({tipo:"ok",texto:`Saída de ${q} ${lote.unidade||""} processada.`});await aoRecarregar();}catch(e){setAviso({tipo:"erro",texto:e.message});}finally{setSalvando(false);}};
 return <div className="space-y-4"><Aviso aviso={aviso} aoFechar={()=>setAviso(null)}/><Card><div className="grid gap-4 md:grid-cols-3"><label className="block md:col-span-2"><span className="label">Produto / lote disponível</span><select className="input" value={id} onChange={e=>setId(e.target.value)}><option value="">Selecione</option>{disponiveis.map(l=><option key={l.id} value={l.id}>{l.produto} — lote {l.lote} — saldo {n(l.totalAtual??l.qtdAtual)} {l.unidade||""}{l.validade?` — val. ${l.validade}`:""}</option>)}</select></label><Campo rotulo="Quantidade da saída" type="number" min="0" step="any" value={qtd} onChange={e=>setQtd(e.target.value)}/><Campo rotulo="Data de abertura (opcional)" type="date" value={dataAbertura} onChange={e=>setDataAbertura(e.target.value)}/>{lote&&<div className="md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{lote.codigoID||lote.codigoAuto}</b> · {lote.produto} · lote {lote.lote}<br/><span className="text-slate-600">Saldo atual: {n(lote.totalAtual??lote.qtdAtual)} {lote.unidade||""}</span></div>}</div><div className="mt-5 flex justify-end"><button className="btn-primary" disabled={salvando||!podeEditar()} onClick={baixar}>{salvando?"Processando...":"Confirmar saída / baixa"}</button></div></Card></div>;
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
  return <div><PageTitle titulo="Gestão de Estoque" descricao="Controle de insumos, lotes, entradas, saídas, fornecedores, compras, inspeções, etiquetas e relatórios."/><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{SECOES.map(([id,nome,Icone])=><button key={id} type="button" onClick={()=>setSecao(id)} className={secao===id?"btn-primary shrink-0":"btn-outline shrink-0"}><Icone size={15}/>{nome}</button>)}</div>{secao==="dashboard"?<Dashboard produtos={dados.estoque_produtos_base} lotes={dados.estoque_lotes} fornecedores={dados.estoque_fornecedores} pedidos={dados.estoque_pedidos}/>:secao==="cadastro-insumo"?<CadastroInsumos produtos={dados.estoque_produtos_base} aoRecarregar={carregar}/>:secao==="entrada-lote"?<EntradaEstoque produtos={dados.estoque_produtos_base} lotes={dados.estoque_lotes} fornecedores={dados.estoque_fornecedores} aoRecarregar={carregar}/>:secao==="retirada-baixa"?<SaidaEstoque lotes={dados.estoque_lotes} aoRecarregar={carregar}/>:<Card><h2 className="font-display text-lg font-bold text-slate-900">{atual[1]}</h2><p className="mt-1 text-sm text-slate-600">Estrutura criada. Esta etapa será conectada às regras do sistema legado na sequência da migração.</p></Card>}</div>;
}
