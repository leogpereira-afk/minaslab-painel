import { useEffect, useState } from "react";
import { aoMudarSessao, getSessao } from "./lib/sessao.js";
import { useRota } from "./lib/rota.js";
import { BaseProvider, useBase } from "./hooks/base.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import VisaoMes from "./pages/VisaoMes.jsx";
import QualidadeDado from "./pages/QualidadeDado.jsx";
import Pessoas from "./pages/Pessoas.jsx";
import Avaliacao from "./pages/Avaliacao.jsx";
import Ocorrencias from "./pages/Ocorrencias.jsx";
import Estrategias from "./pages/Estrategias.jsx";
import Equipe from "./pages/Equipe.jsx";
import Cockpit from "./pages/Cockpit.jsx";
import Funil from "./pages/Funil.jsx";
import Carteira from "./pages/Carteira.jsx";
import Satisfacao from "./pages/Satisfacao.jsx";
import Licitacoes from "./pages/Licitacoes.jsx";
import Reunioes from "./pages/Reunioes.jsx";
import Treinamentos from "./pages/Treinamentos.jsx";
import Decisoes from "./pages/Decisoes.jsx";
import Funcoes from "./pages/Funcoes.jsx";
import Votar from "./pages/Votar.jsx";
import Liderar from "./pages/Liderar.jsx";
import Destaque from "./pages/Destaque.jsx";
import Laboratorio from "./pages/Laboratorio.jsx";
import NaoConformidades from "./pages/NaoConformidades.jsx";
import Produtividade from "./pages/Produtividade.jsx";
import Acessos from "./pages/Acessos.jsx";
import Agenda from "./pages/Agenda.jsx";

const TELAS = {
  cockpit: Cockpit, visao: VisaoMes, funil: Funil, dado: QualidadeDado,
  pessoas: Pessoas, avaliacao: Avaliacao, ocorrencias: Ocorrencias,
  carteira: Carteira, satisfacao: Satisfacao, licitacoes: Licitacoes,
  estrategias: Estrategias, decisoes: Decisoes, funcoes: Funcoes, equipe: Equipe,
  agenda: Agenda, reunioes: Reunioes, treinamentos: Treinamentos, destaque: Destaque,
  lab: Laboratorio, ncs: NaoConformidades, produtividade: Produtividade, acessos: Acessos,
};

function Telas() {
  const { tela, param } = useRota();
  const { carregando, erro, recarregar, pode, paginas, acesso, nomeSetor } = useBase();
  // Só abre o que está liberado no setor; senão, a primeira página liberada.
  const liberada = (tela === "acessos" && acesso?.admin) || (TELAS[tela] && pode(tela));
  const id = liberada ? tela : paginas[0]?.id || (acesso?.admin ? "acessos" : "");
  const Tela = TELAS[id] || null;
  return (
    <Layout tela={id}>
      {erro ? (
        <div className="aviso ruim">
          {erro} <button type="button" className="btn mini claro" style={{ marginLeft: 8 }} onClick={recarregar}>Tentar de novo</button>
        </div>
      ) : carregando ? (
        <div className="carregando">Carregando os dados{nomeSetor ? ` do ${nomeSetor}` : ""}…</div>
      ) : Tela ? (
        <Tela param={param} />
      ) : (
        <div className="aviso alerta">Nenhuma página liberada para você neste setor. Peça a liberação à administração.</div>
      )}
    </Layout>
  );
}

export default function App() {
  const [sessao, setSessao] = useState(() => getSessao());
  const { tela, param } = useRota();
  useEffect(() => aoMudarSessao(() => setSessao(getSessao())), []);
  // Votação do Destaque do Mês: pública, sem login e sem ler sessão alguma.
  if (tela === "votar") return <Votar key={param} param={param} />;
  // Avaliação da liderança por link: pública, só com o segredo do convite.
  if (tela === "liderar") return <Liderar key={param} param={param} />;
  if (!sessao) return <Login />;
  return (
    <BaseProvider key={sessao.usuario}>
      <Telas />
    </BaseProvider>
  );
}
