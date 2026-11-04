import { useEffect, useState } from "react";
import { aoMudarSessao, getSessao, podeUsarLims, sair } from "./lib/sessao.js";
import { useRota, link } from "./lib/rota.js";
import { ITEM_DA_TELA } from "./lib/menu.js";
import { DadosProvider } from "./lib/dados.jsx";
import { AvisoProvider, Caixa } from "./components/ui.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { ListaClientes, FormCliente, VerCliente } from "./pages/Clientes.jsx";
import Solicitantes from "./pages/Solicitantes.jsx";
import ListaPropostas from "./pages/Propostas.jsx";
import PropostaForm from "./pages/PropostaForm.jsx";
import PropostaServicos from "./pages/PropostaServicos.jsx";
import PropostaVer from "./pages/PropostaVer.jsx";

// Tela → [componente, migalhas]. Telas do menu ainda não construídas abrem
// "Tela em construção". Tela nova entra aqui e em lib/menu.js.
const TELAS = {
  dashboard: [Dashboard, () => [["Dashboard"]]],
  customers: [ListaClientes, () => [["Clientes"]]],
  "customer-register": [FormCliente, () => [["Clientes", link("customers")], ["Adiciona Cliente"]]],
  cliente: [VerCliente, () => [["Clientes", link("customers")], ["Visualizar Cliente"]]],
  "cliente-editar": [FormCliente, () => [["Clientes", link("customers")], ["Editar Cliente"]]],
  solicitantes: [Solicitantes, () => [["Solicitantes"]]],
  proposedlist: [ListaPropostas, () => [["Propostas"], ["Listar Propostas"]]],
  "criar-proposta": [PropostaForm, (param) => [["Propostas", link("proposedlist")], [param ? "Editar Proposta" : "Criar Proposta"]]],
  "proposta-servicos": [PropostaServicos, () => [["Propostas", link("proposedlist")], ["Serviços e amostras"]]],
  proposta: [PropostaVer, () => [["Propostas", link("proposedlist")], ["Visualizar Proposta"]]],
};

function EmConstrucao({ tela }) {
  const it = ITEM_DA_TELA[tela];
  return (
    <Caixa titulo={it.rotulo}>
      <div className="soonbox"><b>Tela em construção</b>Este item do menu {it.menu} entra numa próxima etapa. Já estão prontos: Dashboard, Cadastro e Propostas.</div>
    </Caixa>
  );
}
function NaoEncontrada() {
  return <Caixa titulo="Página não encontrada"><p style={{ margin: 0 }}>Este endereço não existe no LIMS. <a href={link("dashboard")}>Voltar ao Dashboard</a></p></Caixa>;
}

function Telas({ sessao }) {
  const { tela, param } = useRota();
  const def = TELAS[tela];
  const Tela = def ? def[0] : ITEM_DA_TELA[tela] ? EmConstrucao : NaoEncontrada;
  const migalhas = def ? def[1](param) : ITEM_DA_TELA[tela] ? [[ITEM_DA_TELA[tela].menu], [ITEM_DA_TELA[tela].rotulo]] : [["Não encontrada"]];
  // key: trocar de registro (#/proposta/941 → /942) recria a tela do zero.
  return <Layout sessao={sessao} tela={tela} migalhas={migalhas}><Tela key={`${tela}/${param}`} tela={tela} param={param} sessao={sessao} /></Layout>;
}

export default function App() {
  const [sessao, setSessao] = useState(getSessao);
  useEffect(() => aoMudarSessao(() => setSessao(getSessao())), []);
  if (!sessao) return <Login />;
  if (!podeUsarLims(sessao)) {
    return (
      <div className="login"><div className="cartao" style={{ textAlign: "center" }}>
        <h1>MinasLab LIMS</h1>
        <p style={{ margin: 0 }}>O LIMS está em fase piloto e, por enquanto, está liberado só para a direção. A liberação para a equipe chega junto com a gravação no servidor.</p>
        <button type="button" className="btn btn-default" onClick={() => sair()}>Entrar com outro usuário</button>
      </div></div>
    );
  }
  return <AvisoProvider><DadosProvider><Telas sessao={sessao} /></DadosProvider></AvisoProvider>;
}
