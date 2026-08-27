// Calendário — a agenda geral do painel, no desenho da Agenda da Impresilk:
// um mês só juntando o que cada módulo marcou (compromissos, sessões de
// licitação, manutenções e, para a direção, férias e vencimentos do RH).
// A pergunta que esta tela responde é "o que tem para os próximos dias?" sem
// abrir módulo por módulo — por isso cada evento é um link para a origem, e o
// "+ Novo" lança direto no dia escolhido, na coleção da tela DONA.
//
// O módulo "Coletas de campo" saiu do painel em 27/08/2026 (decisão do Léo).
// A coleção "coletas" NÃO foi apagada do banco — só sumiu da interface; o
// filtro salvo com a chave velha é ignorado ao ler (lerFiltros).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  CalendarCheck, CalendarDays, CalendarRange, Gavel, Wrench, Palmtree,
  AlarmClock, AlertTriangle, CircleDot, Plus,
} from "lucide-react";
import { listar, salvar, elenco } from "../services/dados.js";
import { getSessao, ehDirecao, podeEditar } from "../lib/sessao.js";
import { proximasPorAlvo } from "../lib/manutencaoRegra.js";
import { dataLonga, diasEntre, ymdLocal } from "../lib/format.js";
import {
  parseData, validarPeriodo, validarAgendamento, temErro,
  diasEntre as diasEntreDatas,
} from "../lib/rh/feriasAgenda.js";
import { anoRuim } from "../components/rh/uteis.js";
import {
  PageTitle, StatCard, SectionTitle, Card, Empty, CarregandoModulo, ErroModulo,
  Aviso, Modal, Segmented,
} from "../components/ui.jsx";
import CalendarioMes from "../components/CalendarioMes.jsx";

// Cada origem com sua cor, seu ícone e sua porta: a bolinha do filtro, o ponto
// na grade e o ícone do painel "O dia" contam a mesma história.
const ORIGENS = {
  compromissos: { rotulo: "Compromissos", cor: "brand", icone: CalendarCheck, link: "/compromissos" },
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
  { cor: "warn", texto: "Sessão, manutenção ou vencimento por vir" },
  { cor: "bad", texto: "Sessão, manutenção ou vencimento que já passou" },
  { cor: "neutral", texto: "Férias" },
];

const K_FILTROS = "ml_calendario_filtros";
const FILTROS_PADRAO = Object.fromEntries(Object.keys(ORIGENS).map((k) => [k, true]));

// Mescla o salvo COM o padrão CHAVE A CHAVE: origem nova entra LIGADA em vez de
// sumir calada (filtro que descarta o desconhecido esconde dado sem avisar), e
// chave que não existe mais — "coletas", tirada em 27/08/2026 — é IGNORADA, em
// vez de ressuscitar uma origem que a tela nem sabe desenhar.
function lerFiltros() {
  const filtros = { ...FILTROS_PADRAO };
  try {
    const salvo = JSON.parse(localStorage.getItem(K_FILTROS) || "null");
    if (salvo && typeof salvo === "object") {
      for (const chave of Object.keys(FILTROS_PADRAO)) {
        if (chave in salvo) filtros[chave] = !!salvo[chave];
      }
    }
  } catch {
    /* sem localStorage (ou JSON estragado) vale o padrão: tudo ligado */
  }
  return filtros;
}

function gravarFiltros(filtros) {
  try {
    localStorage.setItem(K_FILTROS, JSON.stringify(filtros));
  } catch {
    /* sem localStorage a escolha só não persiste */
  }
}

// Soma dias a um "AAAA-MM-DD" sempre em horário LOCAL — nunca toISOString(),
// que depois das 21h no Brasil já virou amanhã.
function somaDias(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymdLocal(d);
}

const LICITACAO_EM_ANDAMENTO = ["estudando", "proposta_enviada", "em_sessao"];
// Cancelada não é agenda; concluída é: o período aconteceu e continua sendo a
// memória de quem esteve fora naqueles dias.
const FERIAS_VALEM = ["marcada", "concluida"];

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

  // Sessão que já passou com a licitação ainda "em andamento" fica vermelha: a
  // data chegou e o status não andou — é disso que a direção precisa saber.
  for (const l of dados.licitacoes) {
    if (LICITACAO_EM_ANDAMENTO.includes(l.status) && l.dataSessao) {
      eventos.push({
        dia: l.dataSessao,
        hora: l.horaSessao || "",
        texto: `Sessão: ${l.orgao || "órgão sem registro"}`,
        cor: corPrazo(l.dataSessao),
        origem: "licitacoes",
      });
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
    if (!FERIAS_VALEM.includes(f.status) || !f.inicio || !f.retorno) continue;
    // Um ponto por dia do período (inicio..retorno-1: o retorno é o dia em que
    // a pessoa VOLTA). Teto de 60 dias: um retorno digitado errado não pode
    // semear anos de calendário.
    const total = Math.min(diasEntre(f.inicio, f.retorno), 60);
    for (let i = 0; i < total; i++) {
      eventos.push({
        dia: somaDias(f.inicio, i),
        hora: "",
        texto: `Férias: ${f.pessoaNome || "pessoa sem registro"}`,
        cor: "neutral",
        origem: "ferias",
      });
    }
  }

  for (const v of dados.vencimentos) {
    if (v.vence) {
      const oQue = `${v.tipo || "documento sem tipo"} — ${v.pessoaNome || "pessoa sem registro"}`;
      eventos.push({ dia: v.vence, hora: "", texto: `Vence: ${oQue}`, cor: corPrazo(v.vence), origem: "vencimentos" });
    }
  }

  return eventos;
}

/* Os vocabulários das telas DONAS, espelhados aqui porque o "+ Novo" grava nas
   coleções delas. O que precisa bater exatamente é o VALOR (a chave gravada);
   o rótulo é só o texto do select. Mexeu lá, mexa aqui:
     tipo de compromisso  → pages/Compromissos.jsx (TIPOS)
     tipo de manutenção   → pages/Manutencoes.jsx (TIPOS) */
const TIPOS_COMPROMISSO = [
  { valor: "reuniao", rotulo: "Reunião" },
  { valor: "visita", rotulo: "Visita" },
  { valor: "retorno", rotulo: "Retorno ao cliente" },
  { valor: "entrega", rotulo: "Entrega de laudo" },
  { valor: "cobranca", rotulo: "Cobrança" },
  { valor: "outro", rotulo: "Outro" },
];
const TIPOS_MANUTENCAO = [
  { valor: "preventiva", rotulo: "Preventiva" },
  { valor: "corretiva", rotulo: "Corretiva" },
  { valor: "calibracao", rotulo: "Calibração" },
];

// O rascunho do "+ Novo". `oQue` diz qual formulário está aberto; os campos de
// cada tipo moram separados para nenhum valor vazar de um lançamento para o
// outro quando a pessoa troca de aba no meio.
const VAZIO_NOVO = {
  oQue: "compromisso",
  titulo: "", compTipo: "reuniao", cliente: "", hora: "", obs: "",
  alvoTipo: "carro", alvoId: "", manTipo: "preventiva", descricao: "",
  pessoaId: "", retorno: "",
};

const COLECAO_DE = { compromisso: "compromissos", manutencao: "manutencoes", ferias: "rh_ferias" };
const ORIGEM_DE = { compromisso: "compromissos", manutencao: "manutencoes", ferias: "ferias" };
const FRASE_OK = {
  compromisso: "Compromisso criado.",
  manutencao: "Manutenção agendada.",
  ferias: "Férias marcadas.",
};

/* A conferência do agendamento de férias pelo motor da CLT
   (lib/rh/feriasAgenda.js): ERRO trava a gravação, AVISO informa e deixa
   passar — quem classifica é a lib, esta tela só mostra.
   O que NÃO entra aqui: saldo do período aquisitivo e contagem de frações.
   Essa conta depende do contexto do FIFO que mora na aba Férias do RH
   (components/rh/AbaFerias.jsx + lib/rh/clt.js), e refazê-la por conta própria
   daria veredito diferente do dela — pior que não afirmar. Por isso o
   formulário diz, em uma linha, o que ele não confere. */
function conferirFerias(inicioISO, retornoISO, outros) {
  const ano = anoRuim(retornoISO);
  if (ano) return [{ nivel: "erro", texto: `Confira o ano da data de retorno: ${ano}` }];
  const ini = parseData(inicioISO);
  const ret = parseData(retornoISO);
  // Campo ainda vazio: nada a conferir — o botão já fica travado sem o retorno,
  // e mensagem no meio da digitação só atrapalha.
  if (!ini || !ret) return [];
  const pares = validarPeriodo(ini, ret);
  if (temErro(pares)) return pares;
  return [
    ...pares,
    ...validarAgendamento({ inicio: ini, dias: diasEntreDatas(ini, ret), outros, abono: 0 }),
  ];
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

function ODia({ diaISO, hojeISO, eventos, podeCriar, aoNovo }) {
  const doDia = eventos.filter((e) => e.dia === diaISO);
  return (
    <Card>
      <SectionTitle
        titulo="O dia"
        sub={`${dataLonga(diaISO)}${diaISO === hojeISO ? " — hoje" : ""}`}
        acao={
          podeCriar && (
            <button type="button" className="btn-primary" onClick={aoNovo}>
              <Plus size={16} strokeWidth={2.5} /> Novo
            </button>
          )
        }
      />
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

/* O lançamento direto do calendário. Cada tipo grava na coleção da tela DONA,
   com os MESMOS nomes de campo e status dela — campo divergente aqui viraria
   registro que a tela dona não enxerga. A data é sempre o dia escolhido na
   grade: é para isso que este formulário existe.
   Alvos e elenco chegam como null quando NÃO carregaram (≠ [] = nada
   cadastrado): o formulário diz qual dos dois é, em vez de mandar cadastrar
   algo que talvez já exista. */
function FormNovo({
  form, setForm, diaISO, direcao, carros, equipamentos, pessoas, ferias,
  salvando, aoSalvar, aoFechar,
}) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const alvos = form.alvoTipo === "carro" ? carros : equipamentos;
  const alvosAtivos = (alvos || []).filter((a) => a.ativo !== false);

  const achados = form.oQue === "ferias"
    ? conferirFerias(diaISO, form.retorno, (ferias || []).filter((r) => r.pessoaId === form.pessoaId))
    : [];
  const travado = temErro(achados);

  const valido =
    form.oQue === "compromisso"
      ? !!form.titulo.trim()
      : form.oQue === "manutencao"
        ? !!(form.descricao.trim() && form.alvoId)
        : !!(form.pessoaId && form.retorno) && !travado;

  return (
    <Modal titulo={`Novo lançamento — ${dataLonga(diaISO)}`} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (travado) return; // erro trava; aviso não
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <span className="label">O que lançar</span>
          <Segmented
            opcoes={[
              { valor: "compromisso", rotulo: "Compromisso" },
              { valor: "manutencao", rotulo: "Manutenção" },
              // Férias mexem em rh_ferias, coleção da direção — o servidor
              // recusa os demais papéis, e oferecer o que vai dar 403 é pior
              // que não oferecer.
              ...(direcao ? [{ valor: "ferias", rotulo: "Férias" }] : []),
            ]}
            valor={form.oQue}
            onChange={(v) => setForm({ ...form, oQue: v })}
          />
        </div>

        {form.oQue === "compromisso" && (
          <>
            <div>
              <label className="label" htmlFor="nv-titulo">O que é</label>
              <input id="nv-titulo" type="text" className="input" value={form.titulo} onChange={setCampo("titulo")} autoFocus required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="nv-comp-tipo">Tipo</label>
                <select id="nv-comp-tipo" className="select" value={form.compTipo} onChange={setCampo("compTipo")}>
                  {TIPOS_COMPROMISSO.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="nv-cliente">Cliente</label>
                <input id="nv-cliente" type="text" className="input" value={form.cliente} onChange={setCampo("cliente")} />
              </div>
              <div>
                <label className="label" htmlFor="nv-hora">Hora</label>
                <input id="nv-hora" type="time" className="input" value={form.hora} onChange={setCampo("hora")} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="nv-obs">Observações</label>
              <textarea id="nv-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
            </div>
          </>
        )}

        {form.oQue === "manutencao" && (
          <>
            <div>
              <span className="label">Manutenção de quê</span>
              <Segmented
                opcoes={[
                  { valor: "carro", rotulo: "Carro" },
                  { valor: "equipamento", rotulo: "Equipamento" },
                ]}
                valor={form.alvoTipo}
                onChange={(v) => setForm({ ...form, alvoTipo: v, alvoId: "" })}
              />
            </div>
            <div>
              {alvosAtivos.length === 0 ? (
                <>
                  {/* Sem select para apontar, o rótulo é <span>: htmlFor para
                      um id que não existe na tela não é rótulo de nada. */}
                  <span className="label">{form.alvoTipo === "carro" ? "Carro" : "Equipamento"}</span>
                  <p className="text-sm text-slate-500">
                    {alvos === null
                      ? `Não consegui carregar ${form.alvoTipo === "carro" ? "a frota" : "os equipamentos"} agora — feche e tente de novo.`
                      : form.alvoTipo === "carro"
                        ? "Nenhum carro ativo — a frota se cadastra em Manutenções."
                        : "Nenhum equipamento ativo — cadastre em Manutenções."}
                  </p>
                </>
              ) : (
                <>
                  <label className="label" htmlFor="nv-alvo">{form.alvoTipo === "carro" ? "Carro" : "Equipamento"}</label>
                  <select id="nv-alvo" className="select" value={form.alvoId} onChange={setCampo("alvoId")} required>
                    <option value="">— escolha —</option>
                    {alvosAtivos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}{a.placa ? ` — ${a.placa}` : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="nv-man-tipo">Tipo</label>
                <select id="nv-man-tipo" className="select" value={form.manTipo} onChange={setCampo("manTipo")}>
                  {TIPOS_MANUTENCAO.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="nv-desc">O que será feito</label>
                <input id="nv-desc" type="text" className="input" value={form.descricao} onChange={setCampo("descricao")} required />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Entra como <strong>agendada</strong> para {dataLonga(diaISO)}. Custo e próxima manutenção se lançam em Manutenções, na hora de dar por feita.
            </p>
          </>
        )}

        {form.oQue === "ferias" && (
          <>
            <div>
              {!pessoas || pessoas.length === 0 ? (
                <>
                  <span className="label">Pessoa</span>
                  <p className="text-sm text-slate-500">
                    {pessoas === null
                      ? "Não consegui carregar o quadro agora — feche e tente de novo."
                      : "Ninguém no quadro ainda — as pessoas moram no módulo RH."}
                  </p>
                </>
              ) : (
                <>
                  <label className="label" htmlFor="nv-pessoa">Pessoa</label>
                  <select id="nv-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
                    <option value="">— escolha —</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">Início</span>
                <p className="text-sm text-slate-700">{dataLonga(diaISO)}</p>
              </div>
              <div>
                <label className="label" htmlFor="nv-retorno">Retorno (dia em que volta)</label>
                <input id="nv-retorno" type="date" className="input" value={form.retorno} onChange={setCampo("retorno")} required />
              </div>
            </div>
            {achados.map((a, i) => (
              <p key={i} className={a.nivel === "erro" ? "text-sm font-medium text-bad-700" : "text-sm text-warn-700"}>
                {a.texto}
              </p>
            ))}
            <p className="text-xs text-slate-500">
              Daqui saem as datas e a sobreposição. O saldo do período aquisitivo e o fracionamento (art. 134) quem confere é a aba Férias do RH — confira lá depois de marcar.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !valido}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Calendario() {
  const sessao = getSessao();
  const direcao = ehDirecao(sessao);
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [dia, setDia] = useState(null); // dia escolhido na grade; null = hoje
  const [filtros, setFiltros] = useState(lerFiltros);
  // Apoio do "+ Novo". null = não carregou (≠ [] = nada cadastrado).
  const [carros, setCarros] = useState(null);
  const [equipamentos, setEquipamentos] = useState(null);
  const [pessoas, setPessoas] = useState(null);
  const [formNovo, setFormNovo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // "Hoje" é ESTADO, não conta do render: esta tela fica aberta de um dia para
  // o outro e o dia congelado mentiria os prazos (padrão do exemplar).
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    const s = getSessao();
    const querRH = ehDirecao(s);

    Promise.allSettled([
      listar("compromissos"),
      listar("licitacoes"),
      listar("manutencoes"),
      // Férias e vencimentos são assunto da direção — para os demais nem se
      // pede (a porta devolve 403). Cada uma com o seu próprio tratamento de
      // falha: RH que recusa ou cai não pode apagar as outras origens da tela.
      querRH ? listar("rh_ferias") : Promise.resolve([]),
      querRH ? listar("rh_vencimentos") : Promise.resolve([]),
    ]).then((r) => {
      const nomes = ["compromissos", "licitações", "manutenções"];
      const falhas = nomes.filter((_, i) => r[i].status === "rejected");
      if (falhas.length) {
        // Melhor parar do que mostrar um mês pela metade como se fosse inteiro.
        const motivo = r.slice(0, 3).find((x) => x.status === "rejected")?.reason?.message || "";
        setErro(`Não consegui carregar: ${falhas.join(", ")}. ${motivo}`.trim());
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm já
        // existe): sem este aviso a agenda ficava velha sob a data de hoje,
        // em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
        return;
      }
      // RH que falhou vira LACUNA DECLARADA, não lista vazia: calendário sem a
      // linha de férias não é calendário sem férias marcadas.
      const rhFalhas = querRH
        ? ["férias", "vencimentos"].filter((_, i) => r[3 + i].status === "rejected")
        : [];
      setDados({
        compromissos: r[0].value,
        licitacoes: r[1].value,
        manutencoes: r[2].value,
        ferias: r[3].status === "fulfilled" ? r[3].value : [],
        vencimentos: r[4].status === "fulfilled" ? r[4].value : [],
        rhFalhas,
      });
      setErro(null);
    });

    // Apoio do "+ Novo", fora da agenda: alvos da manutenção e, para a direção,
    // o elenco das férias. Se falharem, o mês continua de pé e o formulário diz
    // que não carregou.
    if (podeEditar(s)) {
      listar("carros").then(setCarros).catch(() => setCarros(null));
      listar("equipamentos").then(setEquipamentos).catch(() => setEquipamentos(null));
    }
    if (querRH) elenco().then(setPessoas).catch(() => setPessoas(null));
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
      gravarFiltros(novo);
      return novo;
    });
  };

  // Gravou numa origem que estava desligada no filtro? Liga: "gravei e não
  // apareceu" é indistinguível de "não gravou".
  const ligarFiltro = (chave) => {
    setFiltros((f) => {
      if (f[chave]) return f;
      const novo = { ...f, [chave]: true };
      gravarFiltros(novo);
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
    const atrasaveis = ["compromissos", "manutencoes"];

    return {
      eventos,
      porDia,
      rhFalhas: dados.rhFalhas || [],
      hoje: eventos.filter((e) => diasEntre(hojeISO, e.dia) === 0).length,
      semana: eventos.filter((e) => {
        const d = diasEntre(hojeISO, e.dia);
        return d >= 0 && d <= 6;
      }).length,
      atrasados: eventos.filter((e) => atrasaveis.includes(e.origem) && diasEntre(hojeISO, e.dia) < 0).length,
      semData: filtros.compromissos ? dados.compromissos.filter((c) => !c.feito && !c.data).length : 0,
    };
  }, [dados, hojeISO, filtros]);

  const diaVisto = dia || hojeISO;

  const gravarNovo = async () => {
    const f = formNovo;
    let registro;

    if (f.oQue === "compromisso") {
      registro = {
        titulo: f.titulo.trim(),
        tipo: f.compTipo,
        cliente: f.cliente.trim(),
        data: diaVisto,
        hora: f.hora,
        obs: f.obs.trim(),
        feito: false,
      };
    } else if (f.oQue === "manutencao") {
      const alvo = ((f.alvoTipo === "carro" ? carros : equipamentos) || []).find((a) => a.id === f.alvoId);
      // O nome do alvo é CARIMBO — a tela de Manutenções conta com ele para o
      // histórico não quebrar quando o carro é renomeado. Sem conseguir
      // resolvê-lo, melhor não gravar do que gravar "(alvo sem nome)".
      if (!alvo) {
        return setAviso({ tipo: "erro", texto: "Não consegui identificar o carro/equipamento escolhido. Recarregue a página e tente de novo." });
      }
      registro = {
        alvoTipo: f.alvoTipo,
        alvoId: f.alvoId,
        alvoNome: alvo.nome,
        tipo: f.manTipo,
        descricao: f.descricao.trim(),
        data: diaVisto,
        status: "agendada",
      };
    } else {
      const pessoa = (pessoas || []).find((p) => p.id === f.pessoaId);
      if (!pessoa) {
        return setAviso({ tipo: "erro", texto: "Não consegui identificar a pessoa escolhida. Recarregue a página e tente de novo." });
      }
      registro = {
        pessoaId: f.pessoaId,
        pessoaNome: pessoa.nome, // CARIMBO: a ficha pode sair do quadro depois
        inicio: diaVisto,
        retorno: f.retorno,
        status: "marcada",
        abonoDias: 0, // nada vendido: aqui o zero é fato, não dado ausente
      };
    }

    setSalvando(true);
    try {
      await salvar(COLECAO_DE[f.oQue], registro);
      setFormNovo(null);
      setAviso({ tipo: "ok", texto: FRASE_OK[f.oQue] });
      ligarFiltro(ORIGEM_DE[f.oQue]);
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

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
          sub={vm.atrasados > 0 ? "compromissos e manutenções" : undefined}
        />
        <StatCard rotulo="Sem data" valor={String(vm.semData)} tom="neutral" icone={CircleDot} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card>
          <FiltroOrigens filtros={filtros} aoAlternar={alternarFiltro} direcao={direcao} />
          {vm.rhFalhas.length > 0 && (
            <p className="mb-3 text-xs text-warn-700">
              Não consegui carregar {vm.rhFalhas.join(" e ")} do RH agora — o que falta na grade não é ausência de registro.
            </p>
          )}
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

        <ODia
          diaISO={diaVisto}
          hojeISO={hojeISO}
          eventos={vm.eventos}
          podeCriar={editavel}
          aoNovo={() => setFormNovo({ ...VAZIO_NOVO })}
        />
      </div>

      {editavel && (
        <FormNovo
          form={formNovo}
          setForm={setFormNovo}
          diaISO={diaVisto}
          direcao={direcao}
          carros={carros}
          equipamentos={equipamentos}
          pessoas={pessoas}
          ferias={dados.ferias}
          salvando={salvando}
          aoSalvar={gravarNovo}
          aoFechar={() => setFormNovo(null)}
        />
      )}
    </div>
  );
}
