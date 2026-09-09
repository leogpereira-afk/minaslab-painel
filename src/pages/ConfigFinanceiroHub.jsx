import {useNavigate} from "react-router-dom";
import {Tags,Landmark,Building2,CreditCard,Network,CloudDownload,ArrowRight} from "lucide-react";
import {PageTitle} from "../components/ui.jsx";

const itens=[
 {id:"categorias",titulo:"Categorias",descricao:"Receitas, despesas e categorias globais ou por empresa.",icone:Tags,rota:"/financas/configuracoes/categorias"},
 {id:"contas",titulo:"Contas bancárias",descricao:"Bancos, agência, conta, saldo inicial e vínculo com MinasLab ou M Lab.",icone:Landmark,rota:"/financas/configuracoes/contas"},
 {id:"centros",titulo:"Centros de custo",descricao:"Cadastros utilizados na classificação e análise das despesas.",icone:Building2,rota:"/financas/configuracoes/centros"},
 {id:"formas",titulo:"Formas de pagamento",descricao:"PIX, boleto, transferência e demais formas usadas nos lançamentos.",icone:CreditCard,rota:"/financas/configuracoes/formas"},
 {id:"plano",titulo:"Plano de contas",descricao:"Estrutura gerencial e contábil usada nos relatórios financeiros.",icone:Network,rota:"/financas/plano-contas"},
 {id:"omie",titulo:"Integração Omie",descricao:"Pré-validação e sincronização seletiva da MinasLab com a Omie.",icone:CloudDownload,rota:"/financas/configuracoes/omie"},
];

export default function ConfigFinanceiroHub(){const navigate=useNavigate();return <div className="space-y-5"><PageTitle titulo="Configurações Financeiras" descricao="Escolha o cadastro ou integração que deseja alterar. Cada item abre em uma tela própria."/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{itens.map(({id,titulo,descricao,icone:Icone,rota})=><button key={id} type="button" onClick={()=>navigate(rota)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icone size={20}/></span><ArrowRight size={18} className="mt-2 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600"/></div><h2 className="mt-4 font-semibold text-slate-900">{titulo}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{descricao}</p></button>)}</div></div>}
