// Início — o resumo do dia da MinasLab: quem está na rua, o que está marcado
// para hoje e o que vence na semana. A tela é só leitura de propósito: quem
// quer mexer clica no "Ver tudo" e resolve no módulo, onde moram as regras.
//
// As coleções carregam com Promise.allSettled: se uma porta falhar (equipe não
// abre rh_*, rede caiu no meio), as outras aparecem mesmo assim — um resumo
// que some inteiro porque UM módulo falhou não resume nada.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Truck, Gavel, Wrench, Car, Users } from "lucide-react";
import { listar } from "../services/dados.js";
import { dataCurta, diasEntre, ymdLocal } from "../lib/format.js";
import { proximasPorAlvo } from "../lib/manutencaoRegra.js";
import {
  PageTitle, StatCard, Card, Empty, CarregandoModulo, ErroModulo, Aviso,
} from "../components/ui.jsx";

const COLECOES = [
  { nome: "compromissos", rotulo: "Compromissos" },
  { nome: "coletas", rotulo: "Coletas" },
  { nome: "licitacoes", rotulo: "Licitações" },
  { nome: "manutencoes", rotulo: "Manutenções" },
  { nome: "carros", rotulo: "Carros" },
];

// Sessão de licitação só interessa enquanto a disputa está viva.
const LICITACAO_EM_ANDAMENTO = new Set(["estudando", "proposta_enviada", "em_sessao"]);

// Sem hora vai para o fim do dia, não para o começo.
const horaDe = (x) => String(x.hora || "99:99");

function CardModulo({ titulo, para, children }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
          {titulo}
        </h2>
        <Link to={para} className="shrink-0 font-display text-sm font-medium text-brand-700 hover:underline">
          Ver tudo →
        </Link>
      </div>
      {children}
    </Card>
  );
}

function LinhaColeta({ c }) {
  const equipe = (c.equipeNomes || []).filter(Boolean).join(", ");
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-slate-900">
        {c.hora || <span className="text-xs font-normal text-slate-500">sem hora</span>}
      </span>
      {c.os && <span className="chip-brand shrink-0">O.S. {c.os}</span>}
      <span className="min-w-0 flex-1 basis-40">
        <span className="block truncate text-sm font-medium text-slate-900">
          {c.cliente || "sem cliente informado"}
        </span>
        <span className="flex items-center gap-1 truncate text-xs text-slate-500">
          <Users size={12} className="shrink-0" />
          {equipe || "sem equipe definida"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
        <Car size={14} className="shrink-0" />
        {c.carroNome}
      </span>
    </div>
  );
}

function LinhaCompromisso({ c }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="w-14 shrink-0 font-display text-sm font-semibold tabular-nums text-slate-900">
        {c.hora || <span className="text-xs font-normal text-slate-500">sem hora</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{c.titulo}</span>
        {c.cliente && <span className="block truncate text-xs text-slate-500">{c.cliente}</span>}
      </span>
    </div>
  );
}

function LinhaSessao({ l, hojeISO }) {
  const dias = diasEntre(hojeISO, l.dataSessao);
  const texto = dias === 0 ? "HOJE" : dias === 1 ? "amanhã" : `em ${dias} dias`;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className={`${dias <= 1 ? "chip-warn" : "chip"} shrink-0 whitespace-nowrap`}>{texto}</span>
      <span className="w-12 shrink-0 text-sm tabular-nums text-slate-500">{dataCurta(l.dataSessao)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">
          {l.orgao || "órgão sem registro"}
        </span>
        <span className="block truncate text-xs text-slate-500">{l.objeto || "objeto sem registro"}</span>
      </span>
    </div>
  );
}

export default function Home() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  // "Hoje" é ESTADO, não conta do render: esta tela fica aberta na recepção de
  // um dia para o outro e o dia congelado mentiria o resumo inteiro.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.allSettled(COLECOES.map((c) => listar(c.nome))).then((resultados) => {
      const porNome = {};
      const falhas = [];
      resultados.forEach((r, i) => {
        if (r.status === "fulfilled") porNome[COLECOES[i].nome] = r.value;
        else {
          porNome[COLECOES[i].nome] = null; // null = não carregou; não é lista vazia
          falhas.push(COLECOES[i].rotulo);
        }
      });
      if (falhas.length === COLECOES.length) {
        setErro(resultados[0].reason?.message || "Nenhum módulo respondeu.");
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm já
        // existe): a falha TOTAL também precisa avisar, senão a tela fica com
        // números velhos sob a data de hoje, em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
        return;
      }
      setErro(null);
      setDados(porNome);
      if (falhas.length > 0) {
        setAviso({
          tipo: "erro",
          texto: `Sem resposta de: ${falhas.join(", ")}. O restante está na tela.`,
        });
      }
    });
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Voltou para a aba: refaz a conta do dia e busca o que chegou.
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

  const vm = useMemo(() => {
    if (!dados) return null;
    const { compromissos, coletas, licitacoes, manutencoes, carros } = dados;
    const carroPorId = new Map((carros || []).map((c) => [c.id, c]));

    let comps = null;
    if (compromissos) {
      const abertos = compromissos.filter((c) => !c.feito);
      comps = {
        hoje: abertos
          .filter((c) => c.data && diasEntre(hojeISO, c.data) === 0)
          .sort((a, b) => horaDe(a).localeCompare(horaDe(b))),
        atrasados: abertos.filter((c) => c.data && diasEntre(hojeISO, c.data) < 0).length,
      };
    }

    let cols = null;
    if (coletas) {
      const agendadas = coletas.filter((c) => c.status === "agendada");
      cols = {
        deHoje: agendadas
          .filter((c) => c.data && diasEntre(hojeISO, c.data) === 0)
          .sort((a, b) => horaDe(a).localeCompare(horaDe(b)))
          .map((c) => ({
            ...c,
            carroNome: !c.carroId
              ? "sem carro definido"
              : carros === null
                ? "carro não carregado"
                : carroPorId.get(c.carroId)?.nome || "carro não encontrado",
          })),
        totalAgendadas: agendadas.length,
      };
    }

    let lics = null;
    if (licitacoes) {
      lics = {
        sessoes: licitacoes
          .filter((l) => {
            if (!l.dataSessao || !LICITACAO_EM_ANDAMENTO.has(l.status)) return false;
            const d = diasEntre(hojeISO, l.dataSessao);
            return d >= 0 && d <= 7;
          })
          .sort((a, b) => String(a.dataSessao).localeCompare(String(b.dataSessao))),
      };
    }

    let mans = null;
    if (manutencoes) {
      const noPrazo = (iso) => {
        if (!iso) return false;
        const d = diasEntre(hojeISO, iso);
        return d >= 0 && d <= 30;
      };
      // Agendadas contam pela própria data; das FEITAS conta só a "proxima"
      // da última de cada alvo (lib/manutencaoRegra.js) — próxima superada
      // por manutenção mais nova inflava este número em relação ao módulo.
      const proximas = [...proximasPorAlvo(manutencoes).values()];
      mans = {
        qtd:
          manutencoes.filter((m) => m.status === "agendada" && noPrazo(m.data)).length +
          proximas.filter((m) => noPrazo(m.proxima)).length,
      };
    }

    return { comps, cols, lics, mans };
  }, [dados, hojeISO]);

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const { comps, cols, lics, mans } = vm;
  const dataExtensa = new Date(hojeISO + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle titulo="Início" descricao={dataExtensa} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Compromissos hoje"
          valor={comps ? String(comps.hoje.length) : "—"}
          sub={
            !comps
              ? "sem dados agora"
              : comps.atrasados > 0
                ? `${comps.atrasados} ${comps.atrasados === 1 ? "atrasado" : "atrasados"}`
                : "nenhum atrasado"
          }
          tom={comps && comps.atrasados > 0 ? "bad" : "neutral"}
          icone={CalendarCheck}
        />
        <StatCard
          rotulo="Coletas hoje"
          valor={cols ? String(cols.deHoje.length) : "—"}
          sub={
            !cols
              ? "sem dados agora"
              : `${cols.totalAgendadas} ${cols.totalAgendadas === 1 ? "agendada" : "agendadas"} no total`
          }
          tom={cols && cols.deHoje.length > 0 ? "brand" : "neutral"}
          icone={Truck}
        />
        <StatCard
          rotulo="Sessões em 7 dias"
          valor={lics ? String(lics.sessoes.length) : "—"}
          sub={
            !lics
              ? "sem dados agora"
              : lics.sessoes.length > 0
                ? `próxima em ${dataCurta(lics.sessoes[0].dataSessao)}`
                : "nenhuma sessão marcada"
          }
          tom={lics && lics.sessoes.length > 0 ? "warn" : "neutral"}
          icone={Gavel}
        />
        <StatCard
          rotulo="Manutenções em 30 dias"
          valor={mans ? String(mans.qtd) : "—"}
          sub={mans ? "agendadas ou com próxima no prazo" : "sem dados agora"}
          tom={mans && mans.qtd > 0 ? "warn" : "neutral"}
          icone={Wrench}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <CardModulo titulo="Hoje na rua" para="/coletas">
            {!cols ? (
              <Empty>O módulo de coletas não respondeu agora.</Empty>
            ) : cols.deHoje.length === 0 ? (
              <Empty>Nenhuma coleta marcada para hoje.</Empty>
            ) : (
              <div className="space-y-2">
                {cols.deHoje.map((c) => (
                  <LinhaColeta key={c.id} c={c} />
                ))}
              </div>
            )}
          </CardModulo>
        </div>

        <CardModulo titulo="Compromissos de hoje" para="/compromissos">
          {!comps ? (
            <Empty>O módulo de compromissos não respondeu agora.</Empty>
          ) : comps.hoje.length === 0 ? (
            <Empty>Nenhum compromisso marcado para hoje.</Empty>
          ) : (
            <div className="space-y-2">
              {comps.hoje.map((c) => (
                <LinhaCompromisso key={c.id} c={c} />
              ))}
            </div>
          )}
        </CardModulo>

        <CardModulo titulo="Próximas sessões de licitação" para="/licitacoes">
          {!lics ? (
            <Empty>O módulo de licitações não respondeu agora.</Empty>
          ) : lics.sessoes.length === 0 ? (
            <Empty>Nenhuma sessão nos próximos 7 dias.</Empty>
          ) : (
            <div className="space-y-2">
              {lics.sessoes.map((l) => (
                <LinhaSessao key={l.id} l={l} hojeISO={hojeISO} />
              ))}
            </div>
          )}
        </CardModulo>
      </div>
    </div>
  );
}
