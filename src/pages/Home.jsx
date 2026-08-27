// Início — o resumo do dia da MinasLab: o que está marcado para hoje, o que
// vence na semana e o que está para chegar. A tela é só leitura de propósito:
// quem quer mexer clica no "Ver tudo" e resolve no módulo, onde moram as regras.
//
// O módulo "Coletas de campo" saiu do painel em 27/08/2026 (decisão do Léo).
// A coleção "coletas" NÃO foi apagada do banco — só sumiu da interface.
//
// As coleções carregam com Promise.allSettled: se uma porta falhar (rede caiu
// no meio, o servidor recusou uma delas), as outras aparecem mesmo assim — um
// resumo que some inteiro porque UM módulo falhou não resume nada.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Gavel, Wrench, ShoppingCart } from "lucide-react";
import { listar } from "../services/dados.js";
import { dataCurta, diasEntre, ymdLocal } from "../lib/format.js";
import { proximasPorAlvo } from "../lib/manutencaoRegra.js";
import {
  PageTitle, StatCard, Card, Empty, CarregandoModulo, ErroModulo, Aviso,
} from "../components/ui.jsx";

const COLECOES = [
  { nome: "compromissos", rotulo: "Compromissos" },
  { nome: "licitacoes", rotulo: "Licitações" },
  { nome: "manutencoes", rotulo: "Manutenções" },
  { nome: "compras", rotulo: "Compras" },
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

// A compra que já foi comprada e ainda não chegou: o que é, de quem, e desde
// quando espera. Ausência vira palavra — "sem registro", nunca espaço em branco.
function LinhaCompra({ c }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <ShoppingCart size={16} strokeWidth={2.2} className="shrink-0 text-brand-600" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">
          {c.item || "item sem registro"}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {c.fornecedor || "fornecedor sem registro"}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500">
        {c.data ? `pedida ${dataCurta(c.data)}` : "sem data"}
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
    const { compromissos, licitacoes, manutencoes, compras } = dados;

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

    // Comprada = paga/pedida e ainda não recebida. A mais antiga primeiro: é a
    // que espera há mais tempo, e é dela que o fornecedor precisa ser cobrado.
    let cprs = null;
    if (compras) {
      cprs = {
        aReceber: compras
          .filter((c) => c.status === "comprada")
          .sort(
            (a, b) =>
              String(a.data || "9999").localeCompare(String(b.data || "9999")) ||
              String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
          ),
        cotando: compras.filter((c) => c.status === "cotando").length,
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

    return { comps, cprs, lics, mans };
  }, [dados, hojeISO]);

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const { comps, cprs, lics, mans } = vm;
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
        <StatCard
          rotulo="Compras para receber"
          valor={cprs ? String(cprs.aReceber.length) : "—"}
          sub={!cprs ? "sem dados agora" : `${cprs.cotando} em cotação`}
          tom={cprs && cprs.aReceber.length > 0 ? "warn" : "neutral"}
          icone={ShoppingCart}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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

        <div className="lg:col-span-2">
          <CardModulo titulo="Compras a receber" para="/compras">
            {!cprs ? (
              <Empty>O módulo de compras não respondeu agora.</Empty>
            ) : cprs.aReceber.length === 0 ? (
              <Empty>Nenhuma compra esperando chegar.</Empty>
            ) : (
              <div className="space-y-2">
                {cprs.aReceber.map((c) => (
                  <LinhaCompra key={c.id} c={c} />
                ))}
              </div>
            )}
          </CardModulo>
        </div>
      </div>
    </div>
  );
}
