// Calendário — a agenda geral do painel, no desenho da Agenda da Impresilk:
// um mês só juntando o que cada módulo marcou (compromissos, coletas, sessões
// de licitação, manutenções e, para a direção, férias e vencimentos do RH).
// A pergunta que esta tela responde é "o que tem para os próximos dias?" sem
// abrir módulo por módulo — por isso cada evento é um link para a origem.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  CalendarCheck, CalendarDays, CalendarRange, FlaskConical, Gavel, Wrench,
  Palmtree, AlarmClock, AlertTriangle, CircleDot,
} from "lucide-react";
import { listar } from "../services/dados.js";
import { getSessao, ehDirecao } from "../lib/sessao.js";
import { proximasPorAlvo } from "../lib/manutencaoRegra.js";
import { dataLonga, diasEntre, ymdLocal } from "../lib/format.js";
import {
  PageTitle, StatCard, SectionTitle, Card, Empty, CarregandoModulo, ErroModulo,
  Aviso,
} from "../components/ui.jsx";
import CalendarioMes from "../components/CalendarioMes.jsx";

// Cada origem com sua cor, seu ícone e sua porta: a bolinha do filtro, o ponto
// na grade e o ícone do painel "O dia" contam a mesma história.
const ORIGENS = {
  compromissos: { rotulo: "Compromissos", cor: "brand", icone: CalendarCheck, link: "/compromissos" },
  coletas: { rotulo: "Coletas", cor: "ok", icone: FlaskConical, link: "/coletas" },
  licitacoes: { rotulo: "Licitações", cor: "warn", icone: Gavel, link: "/licitacoes" },
  manutencoes: { rotulo: "Manutenções", cor: "warn", icone: Wrench, link: "/manutencoes" },
  ferias: { rotulo: "Férias", cor: "neutral", icone: Palmtree, link: "/rh", soDirecao: true },
  vencimentos: { rotulo: "Vencimentos", cor: "warn", icone: AlarmClock, link: "/rh", soDirecao: true },
};

// As mesmas cores dos pontos do CalendarioMes — filtro e legenda apontam
// exatamente para o que a grade mostra.
const PONTO = { brand: "bg-brand", ok: "bg-ok-600", warn: "bg-warn-500", bad: "bg-bad-600", neutral: "bg-slate-400" };
const COR_TEXTO = { brand: "text-brand-600", ok: "text-ok-700", warn: "text-warn-700", bad: "text-bad-700", neutral: "text-slate-500" };

const LEGENDA = [
  { cor: "brand", texto: "Compromisso" },
  { cor: "ok", texto: "Coleta" },
  { cor: "warn", texto: "Sessão, manutenção ou vencimento por vir" },
  { cor: "bad", texto: "Manutenção ou vencimento que já passou" },
  { cor: "neutral", texto: "Férias" },
];

const K_FILTROS = "ml_calendario_filtros";
const FILTROS_PADRAO = Object.fromEntries(Object.keys(ORIGENS).map((k) => [k, true]));

// Mescla o salvo COM o padrão: origem nova entra LIGADA em vez de sumir calada
// (filtro que descarta o desconhecido esconde dado sem avisar).
function lerFiltros() {
  try {
    const raw = localStorage.getItem(K_FILTROS);
    return raw ? { ...FILTROS_PADRAO, ...JSON.parse(raw) } : { ...FILTROS_PADRAO };
  } catch {
    return { ...FILTROS_PADRAO };
  }
}

// Soma dias a um "AAAA-MM-DD" sempre em horário LOCAL — nunca toISOString(),
// que depois das 21h no Brasil já virou amanhã.
function somaDias(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymdLocal(d);
}

// Traduz cada coleção em eventos { dia, hora, texto, cor, origem }. Só entram
// itens ABERTOS — feito, concluído e cancelado não são agenda.
function montarEventos(dados, hojeISO) {
  const eventos = [];
  const corPrazo = (dia) => (diasEntre(hojeISO, dia) < 0 ? "bad" : "warn");

  for (const c of dados.compromissos) {
    if (!c.feito && c.data) {
      eventos.push({ dia: c.data, hora: c.hora || "", texto: c.titulo, cor: "brand", origem: "compromissos" });
    }
  }

  for (const c of dados.coletas) {
    if (c.status === "agendada" && c.data) {
      const quem = [c.os, c.cliente].filter(Boolean).join(" · ");
      eventos.push({ dia: c.data, hora: c.hora || "", texto: quem ? `Coleta: ${quem}` : "Coleta", cor: "ok", origem: "coletas" });
    }
  }

  const EM_ANDAMENTO = ["estudando", "proposta_enviada", "em_sessao"];
  for (const l of dados.licitacoes) {
    if (EM_ANDAMENTO.includes(l.status) && l.dataSessao) {
      eventos.push({ dia: l.dataSessao, hora: "", texto: `Sessão: ${l.orgao}`, cor: "warn", origem: "licitacoes" });
    }
  }

  // A agendada tem a própria data; das FEITAS, só a última de cada alvo
  // agenda a PRÓXIMA (lib/manutencaoRegra.js) — próxima superada por
  // manutenção mais nova não é agenda, senão fica vermelha para sempre e
  // infla o cartão "Atrasados". Passou da data, fica vermelha — manutenção
  // vencida é o que esta tela existe para gritar.
  for (const m of dados.manutencoes) {
    if (m.status === "agendada" && m.data) {
      eventos.push({ dia: m.data, hora: "", texto: `Manutenção: ${m.alvoNome}`, cor: corPrazo(m.data), origem: "manutencoes" });
    }
  }
  for (const m of proximasPorAlvo(dados.manutencoes).values()) {
    eventos.push({ dia: m.proxima, hora: "", texto: `Manutenção: ${m.alvoNome}`, cor: corPrazo(m.proxima), origem: "manutencoes" });
  }

  for (const f of dados.ferias) {
    if (f.status !== "marcada" || !f.inicio || !f.retorno) continue;
    // Um ponto por dia do período (inicio..retorno-1). Teto de 60 dias: um
    // retorno digitado errado não pode semear anos de calendário.
    const total = Math.min(diasEntre(f.inicio, f.retorno), 60);
    for (let i = 0; i < total; i++) {
      eventos.push({ dia: somaDias(f.inicio, i), hora: "", texto: `Férias: ${f.pessoaNome}`, cor: "neutral", origem: "ferias" });
    }
  }

  for (const v of dados.vencimentos) {
    if (v.vence) {
      const oQue = [v.tipo, v.pessoaNome].filter(Boolean).join(" ");
      eventos.push({ dia: v.vence, hora: "", texto: `Vence: ${oQue}`, cor: corPrazo(v.vence), origem: "vencimentos" });
    }
  }

  return eventos;
}

// A linha de filtros por origem. A escolha PERSISTE em localStorage — pedido
// do Léo: escolha de quadro não se perde ao sair da tela.
function FiltroOrigens({ filtros, aoAlternar, direcao }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      {Object.entries(ORIGENS).map(([chave, o]) => {
        if (o.soDirecao && !direcao) return null;
        return (
          <label key={chave} htmlFor={`flt-${chave}`} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input
              id={`flt-${chave}`}
              type="checkbox"
              checked={!!filtros[chave]}
              onChange={() => aoAlternar(chave)}
            />
            <span className={clsx("h-2 w-2 rounded-full", PONTO[o.cor])} />
            {o.rotulo}
          </label>
        );
      })}
    </div>
  );
}

function ODia({ diaISO, hojeISO, eventos }) {
  const doDia = eventos.filter((e) => e.dia === diaISO);
  return (
    <Card>
      <SectionTitle titulo="O dia" sub={`${dataLonga(diaISO)}${diaISO === hojeISO ? " — hoje" : ""}`} />
      {doDia.length === 0 ? (
        <Empty>Nada marcado para este dia.</Empty>
      ) : (
        <div className="space-y-2">
          {doDia.map((e, i) => {
            const o = ORIGENS[e.origem];
            const Icone = o.icone;
            return (
              <Link
                key={`${e.origem}-${i}`}
                to={o.link}
                title={`Abrir ${o.rotulo}`}
                className="flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors hover:bg-slate-50"
                style={{ borderColor: "var(--hairline)" }}
              >
                <Icone size={16} strokeWidth={2.2} className={clsx("mt-0.5 shrink-0", COR_TEXTO[e.cor] || COR_TEXTO.neutral)} />
                {e.hora && (
                  <span className="mt-0.5 shrink-0 font-display text-xs font-semibold tnum text-slate-500">{e.hora}</span>
                )}
                <span className="min-w-0 flex-1 text-sm text-slate-800">{e.texto}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function Calendario() {
  const direcao = ehDirecao(getSessao());

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [dia, setDia] = useState(null); // dia escolhido na grade; null = hoje
  const [filtros, setFiltros] = useState(lerFiltros);
  // "Hoje" é ESTADO, não conta do render: esta tela fica aberta de um dia para
  // o outro e o dia congelado mentiria os prazos (padrão do exemplar).
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    const querRH = ehDirecao(getSessao());
    Promise.allSettled([
      listar("compromissos"),
      listar("coletas"),
      listar("licitacoes"),
      listar("manutencoes"),
      // Férias e vencimentos são assunto da direção — para os demais nem se
      // pede. E se o servidor recusar ou falhar, o calendário segue sem eles.
      querRH ? listar("rh_ferias") : Promise.resolve([]),
      querRH ? listar("rh_vencimentos") : Promise.resolve([]),
    ]).then((r) => {
      const nomes = ["compromissos", "coletas", "licitações", "manutenções"];
      const falhas = nomes.filter((_, i) => r[i].status === "rejected");
      if (falhas.length) {
        // Melhor parar do que mostrar um mês pela metade como se fosse inteiro.
        const motivo = r.slice(0, 4).find((x) => x.status === "rejected")?.reason?.message || "";
        setErro(`Não consegui carregar: ${falhas.join(", ")}. ${motivo}`.trim());
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm já
        // existe): sem este aviso a agenda ficava velha sob a data de hoje,
        // em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
        return;
      }
      setDados({
        compromissos: r[0].value,
        coletas: r[1].value,
        licitacoes: r[2].value,
        manutencoes: r[3].value,
        ferias: r[4].status === "fulfilled" ? r[4].value : [],
        vencimentos: r[5].status === "fulfilled" ? r[5].value : [],
      });
      setErro(null);
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

  const alternarFiltro = (chave) => {
    setFiltros((f) => {
      const novo = { ...f, [chave]: !f[chave] };
      try {
        localStorage.setItem(K_FILTROS, JSON.stringify(novo));
      } catch {
        /* sem localStorage a escolha só não persiste */
      }
      return novo;
    });
  };

  const vm = useMemo(() => {
    if (!dados) return null;
    // Sem hora vai para o fim do dia ("99:99"), como na lista de compromissos.
    const horaDe = (e) => e.hora || "99:99";
    const eventos = montarEventos(dados, hojeISO)
      .filter((e) => filtros[e.origem])
      .sort((a, b) => a.dia.localeCompare(b.dia) || horaDe(a).localeCompare(horaDe(b)));

    const porDia = {};
    for (const e of eventos) {
      if (!porDia[e.dia]) porDia[e.dia] = [];
      porDia[e.dia].push({ cor: e.cor, rotulo: e.hora ? `${e.hora} ${e.texto}` : e.texto });
    }

    // Os cartões contam o que o calendário mostra: origem desligada no filtro
    // sai da conta junto — número e grade nunca discordam.
    const atrasaveis = ["compromissos", "coletas", "manutencoes"];
    const semData =
      (filtros.compromissos ? dados.compromissos.filter((c) => !c.feito && !c.data).length : 0) +
      (filtros.coletas ? dados.coletas.filter((c) => c.status === "agendada" && !c.data).length : 0);

    return {
      eventos,
      porDia,
      hoje: eventos.filter((e) => diasEntre(hojeISO, e.dia) === 0).length,
      semana: eventos.filter((e) => {
        const d = diasEntre(hojeISO, e.dia);
        return d >= 0 && d <= 6;
      }).length,
      atrasados: eventos.filter((e) => atrasaveis.includes(e.origem) && diasEntre(hojeISO, e.dia) < 0).length,
      semData,
    };
  }, [dados, hojeISO, filtros]);

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const diaVisto = dia || hojeISO;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Calendário"
        descricao="A agenda de tudo num lugar só — clique num dia para ver o detalhe e no evento para abrir o módulo."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard rotulo="Hoje" valor={String(vm.hoje)} tom={vm.hoje > 0 ? "brand" : "neutral"} icone={CalendarDays} />
        <StatCard rotulo="Esta semana" valor={String(vm.semana)} tom="neutral" icone={CalendarRange} />
        <StatCard
          rotulo="Atrasados"
          valor={String(vm.atrasados)}
          tom={vm.atrasados > 0 ? "bad" : "ok"}
          icone={AlertTriangle}
          sub={vm.atrasados > 0 ? "compromissos, coletas e manutenções" : undefined}
        />
        <StatCard rotulo="Sem data" valor={String(vm.semData)} tom="neutral" icone={CircleDot} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card>
          <FiltroOrigens filtros={filtros} aoAlternar={alternarFiltro} direcao={direcao} />
          <CalendarioMes eventosPorDia={vm.porDia} diaSelecionado={dia} aoEscolherDia={setDia} />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
            {LEGENDA.map((l) => (
              <span key={l.cor} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={clsx("h-1.5 w-1.5 rounded-full", PONTO[l.cor])} />
                {l.texto}
              </span>
            ))}
          </div>
        </Card>

        <ODia diaISO={diaVisto} hojeISO={hojeISO} eventos={vm.eventos} />
      </div>
    </div>
  );
}
