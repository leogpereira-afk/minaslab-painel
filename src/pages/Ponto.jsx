// PONTO — a CASCA do módulo próprio. Saiu de dentro do RH em 28/08/2026, a
// pedido do Leonardo ("criar um botão na barra lateral escrito Ponto").
//
// Por que virou módulo, e não mais uma aba do RH: o ponto tem cinco telas
// (fechamento, batidas, faltas, relatórios e as pessoas do relógio) e duas
// coleções só dele. Espremido numa aba, ele empurrava o RH para sete abas que
// não cabem na largura do celular — e o RH carregava "rh_ponto" e
// "rh_ponto_dia" em toda visita, mesmo de quem só ia ver férias.
//
// DUAS PORTAS PARA A MESMA TELA ENVELHECEM DESENCONTRADAS: a aba "Ponto" foi
// TIRADA do RH no mesmo commit. Lá ficou uma linha apontando para cá, e mais
// nada — quem procura o ponto no lugar velho é levado ao novo, em vez de achar
// uma cópia parada no tempo.
//
// Só a direção chega nesta rota (SO_DIRECAO em lib/sessao.js): ponto é dado de
// pessoa, mesma régua das coleções rh_*. O que a tela esconde é conforto — quem
// barra de verdade é o servidor, que confere o crachá em toda chamada.
//
// ============================================================================
// AS ABAS
//
//   "Fechamento e Batidas"  → AbaPonto (components/rh/AbaPonto.jsx), inteira,
//                             com as mesmas props que a casca do RH passava.
//   "Faltas"                → components/ponto/Faltas.jsx
//   "Relatórios"            → components/ponto/Relatorios.jsx
//   "Pessoas do relógio"    → components/ponto/TrazerDoRelogio.jsx
//
// POR QUE QUATRO ABAS E NÃO CINCO. O pedido original era um Segmented de cinco,
// separando "Fechamento" de "Batidas". Não dá HOJE sem mexer no AbaPonto: ele
// guarda a escolha entre as duas num estado interno (`visao`) e não aceita essa
// escolha por prop. Duas abas aqui em cima que não trocassem a visão de lá
// embaixo seriam dois botões que não fazem nada — e botão que não faz nada é
// pior que a falta dele. Então a entrada diz, na palavra, o que ela contém:
// "Fechamento e Batidas". O alternador de verdade é o do próprio AbaPonto.
//
// Para virar cinco, basta AbaPonto aceitar a visão de fora (3 linhas lá):
//     export default function AbaPonto({ ..., visao: visaoProp, setVisao: setVisaoProp }) {
//       const [visaoInterna, setVisaoInterna] = useState("fechamento");
//       const visao = visaoProp ?? visaoInterna;
//       const setVisao = setVisaoProp ?? setVisaoInterna;
// Feito isso, esta casca troca a entrada única pelas duas e passa
// visao={aba} setVisao={setAba}.
//
// ----------------------------------------------------------------------------
// A COMPETÊNCIA (o mês) É DE CADA ABA, NÃO DA CASCA. Pelo mesmo motivo: o
// AbaPonto guarda o mês dele por dentro, e um seletor aqui em cima que não
// mexesse no dele mostraria agosto no alto e julho na tabela. Quando o AbaPonto
// aceitar o mês por prop, o seletor sobe para cá e passa a valer para as quatro.
//
// ----------------------------------------------------------------------------
// IMPRESSÃO: o botão "Imprimir / PDF" chama a impressão do navegador — é por
// ela que sai o PDF ("Salvar como PDF" no destino). O que é controle sai
// marcado com `sem-impressao` e some no papel; o cabeçalho de papel
// (`apenas-impressao`) só existe impresso, para a folha dizer de onde veio, de
// quem e de quando. As regras estão em src/index.css.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, Users } from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { ymdLocal, dataLonga } from "../lib/format.js";
import { PageTitle, Segmented, CarregandoModulo, ErroModulo, Aviso } from "../components/ui.jsx";
import AbaPonto from "../components/rh/AbaPonto.jsx";
import Faltas from "../components/ponto/Faltas.jsx";
import Relatorios from "../components/ponto/Relatorios.jsx";
import TrazerDoRelogio from "../components/ponto/TrazerDoRelogio.jsx";

const ABAS = [
  { valor: "fechamento", rotulo: "Fechamento e Batidas" },
  { valor: "faltas", rotulo: "Faltas" },
  { valor: "relatorios", rotulo: "Relatórios" },
  { valor: "relogio", rotulo: "Pessoas do relógio" },
];

/* O cabeçalho que SÓ existe no papel. Folha impressa circula solta: sem dizer
   de que sistema saiu, de qual mês e de quando, ela vira um número sem dono na
   mesa de alguém. Fica fora do componente da página de propósito — componente
   declarado dentro remonta a cada render (e o lint reprova). */
function CabecalhoDoPapel({ hojeISO, aba, sessao }) {
  const nomeDaAba = ABAS.find((a) => a.valor === aba)?.rotulo || "";
  return (
    <div className="apenas-impressao mb-4 border-b pb-2" style={{ borderColor: "var(--hairline)" }}>
      <p className="font-display text-base font-bold">MinasLab — Ponto · {nomeDaAba}</p>
      <p className="text-xs">
        Impresso em {dataLonga(hojeISO)} por {sessao?.nome || sessao?.usuario || "usuário sem nome"} ·
        Painel de Gestão MinasLab
      </p>
    </div>
  );
}

export default function Ponto() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { pessoas, ponto, pontoDia }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aba, setAba] = useState("fechamento");
  const [salvando, setSalvando] = useState(false);
  // "Hoje" é ESTADO, nunca uma constante do módulo: esta tela fica aberta de um
  // dia para o outro na sala da direção, e um dia congelado faz a folha do mês
  // errado parecer a do mês corrente.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.all([listar("rh_pessoas"), listar("rh_ponto"), listar("rh_ponto_dia")])
      .then(([pessoas, ponto, pontoDia]) => {
        setDados({ pessoas, ponto, pontoDia });
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (dados
        // existe). Sem este aviso, a recarga que falha deixaria a tela velha em
        // silêncio — e o mês fechado a partir dela seria fechado às cegas.
        setAviso({
          tipo: "erro",
          texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga.",
        });
      });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Voltou para a aba: refaz a conta do dia e busca o que chegou (uma
  // importação do relógio pode ter rodado noutra janela).
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [recarregar]);

  // Quem está no quadro, já ordenado por nome — é o contrato que as abas
  // esperam receber pronto, para nenhuma delas ordenar de um jeito diferente.
  const ativos = useMemo(() => {
    if (!dados) return [];
    const norm = (s) => String(s || "").toLowerCase();
    return dados.pessoas
      .filter((p) => p.ativo !== false)
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
  }, [dados]);

  /* A ÚNICA PORTA DE ESCRITA do módulo: nenhuma aba fala com services/dados.js
     por conta própria. Aviso no SUCESSO e no ERRO, e recarga depois — gravação
     que só avisa quando dá certo ensina a confiar no silêncio. */
  const gravarRegistro = async (colecao, registro, fraseOk, fechar) => {
    setSalvando(true);
    try {
      await salvar(colecao, registro);
      fechar?.();
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // O window.confirm fica em quem chama, junto do texto que faz sentido para
  // aquele registro.
  const apagarRegistro = async (colecao, id, fraseOk) => {
    try {
      await apagar(colecao, id);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    }
  };

  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!dados) return <CarregandoModulo />;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <CabecalhoDoPapel hojeISO={hojeISO} aba={aba} sessao={sessao} />

      <PageTitle
        titulo="Ponto"
        descricao="O relógio da MinasLab é o Jibble. Aqui ficam as batidas do dia, o fechamento do mês, as faltas lançadas e os relatórios."
        acao={
          <div className="sem-impressao flex flex-wrap items-center gap-2">
            {/* Imprimir não é escrita: quem só consulta também leva a folha.
                O PDF sai daqui — no destino da impressão, "Salvar como PDF". */}
            <button
              type="button"
              className="btn-outline"
              onClick={() => window.print()}
              title="Imprimir esta tela (ou salvar como PDF no destino da impressão)"
            >
              <Printer size={16} strokeWidth={2.5} /> Imprimir / PDF
            </button>
            <Link to="/rh" className="btn-ghost">
              <Users size={16} strokeWidth={2.5} /> Ir para o RH
            </Link>
          </div>
        }
      />

      {/* Quatro abas não cabem na largura do celular. Sem o overflow aqui, a
          PÁGINA INTEIRA passava a rolar de lado. */}
      <div className="sem-impressao mb-4 max-w-full overflow-x-auto pb-1">
        <Segmented opcoes={ABAS} valor={aba} onChange={setAba} />
      </div>

      {aba === "fechamento" && (
        <AbaPonto
          pessoas={dados.pessoas}
          ativos={ativos}
          ponto={dados.ponto}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          editavel={editavel}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
        />
      )}

      {aba === "faltas" && (
        <Faltas
          pessoas={dados.pessoas}
          ativos={ativos}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          gravar={gravarRegistro}
          apagarReg={apagarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
        />
      )}

      {aba === "relatorios" && (
        <Relatorios
          pessoas={dados.pessoas}
          ativos={ativos}
          ponto={dados.ponto}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          setAviso={setAviso}
        />
      )}

      {aba === "relogio" && (
        <TrazerDoRelogio
          pessoas={dados.pessoas}
          ativos={ativos}
          pontoDia={dados.pontoDia}
          hojeISO={hojeISO}
          editavel={editavel}
          salvando={salvando}
          gravar={gravarRegistro}
          setAviso={setAviso}
          recarregar={recarregar}
        />
      )}
    </div>
  );
}
