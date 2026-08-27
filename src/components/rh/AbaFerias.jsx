// Aba Férias do RH: uma linha POR PESSOA (a pergunta da direção é "quem está
// fora?", não "quantos lançamentos existem"); o histórico abre no clique.
// Estado e gravação moram na casca (pages/RH.jsx); as CONTAS moram no motor
// portado da Impresilk (src/lib/rh):
//   - clt.js       → o relógio da CLT (art. 134/137): período aquisitivo em
//                    aberto, dias em aberto, vencida/a vencer/sem registro.
//   - ferias.js    → quem está de férias AGORA (as datas mandam, não o texto
//                    do status — mas "concluida"/"cancelada" são decisão
//                    explícita e continuam mandando).
//   - feriasContagem.js → o relógio em dias de calendário ("volta em N dias")
//                    e a conferência status × datas (pendência, nunca conserto
//                    automático).
//   - feriasAgenda.js → as regras do agendamento. ERRO trava a gravação,
//                    AVISO informa e deixa passar — a classificação é DA LIB
//                    (é lá que mora a base legal), a tela só mostra.
// A tela não repete nenhuma dessas contas por conta própria.

import { useMemo } from "react";
import { clsx } from "clsx";
import { Pencil, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { dataCurta, dataLonga, ymdLocal } from "../../lib/format.js";
import { situacaoFerias, inicioDoHistorico } from "../../lib/rh/clt.js";
import { feriasEmCurso } from "../../lib/rh/ferias.js";
import { contagem, statusIncoerente } from "../../lib/rh/feriasContagem.js";
import {
  parseData, diasEntre as diasEntreDatas, validarPeriodo, validarAgendamento,
  temErro, MAX_ABONO_DIAS,
} from "../../lib/rh/feriasAgenda.js";
import { SectionTitle, Empty, Modal, Card } from "../ui.jsx";
import { anoRuim } from "./uteis.js";

const STATUS_FERIAS = {
  marcada: { rotulo: "marcada", chip: "chip" },
  concluida: { rotulo: "concluída", chip: "chip-ok" },
  cancelada: { rotulo: "cancelada", chip: "chip" },
};

const plural = (n, um, muitos) => (n === 1 ? um : muitos);

// Date → "dd/mm/aaaa" pelo dia LOCAL (as datas do motor são Date de meia-noite
// local; toISOString aqui devolveria o dia anterior no Brasil).
const dataDe = (d) => dataLonga(ymdLocal(d));

// Dias que um registro representa: calendário entre início e retorno + abono
// vendido — a MESMA conta do clt.js. Sem uma das datas não dá para derivar: 0.
function diasDoRegistro(r) {
  const i = parseData(r.inicio);
  const v = parseData(r.retorno);
  if (!i || !v) return 0;
  return diasEntreDatas(i, v) + (Number(r.abonoDias) || 0);
}

/* A presença da pessoa: fora AGORA, marcada para o futuro, ou nada.
   feriasEmCurso (ferias.js) decide quem está fora — nele "concluida"/
   "cancelada" mandam (decisão explícita de quem lançou), coisa que olhar só o
   relógio não respeitaria: um período "concluida" com as datas cobrindo hoje é
   alguém que VOLTOU antes, não alguém de férias. O relógio e as frases vêm de
   contagem (feriasContagem.js). É a mesma régua do KPI "Férias agora" da casca. */
function presencaDaPessoa(periodos, hoje) {
  const agora = periodos
    .filter((f) => feriasEmCurso(f, hoje))
    .map((f) => ({ f, c: contagem(f, hoje) }))
    .sort((a, b) => a.c.dias - b.c.dias)[0];
  if (agora) return { fase: "em-curso", dias: agora.c.dias, texto: agora.c.texto };

  // Só "marcada" vale como próxima: "concluida" no futuro é dado incoerente
  // (a pendência de statusIncoerente aponta), não uma férias por vir.
  const futuras = periodos
    .filter((f) => f.status === "marcada")
    .map((f) => ({ f, c: contagem(f, hoje) }))
    .filter((x) => x.c.fase === "futuro")
    .sort((a, b) => a.c.dias - b.c.dias);
  if (futuras.length) return { fase: "futuro", dias: futuras[0].c.dias, texto: futuras[0].c.texto };

  return { fase: "sem-marcacao", dias: 0, texto: "Sem férias marcadas" };
}

/* A leitura da CLT para a linha: o período aquisitivo em aberto mais antigo,
   com as frases honestas — o sistema só afirma o que os dados sustentam.
   `gravidade` ordena o "resto" da lista (vencida sobe). */
function leituraCLT(p, periodos, hoje, desde) {
  if (!p.admissao) {
    // Sem admissão não há relógio. Dizer "em dia" seria afirmar sem dado.
    return { chip: "chip", texto: "admissão sem registro — sem como contar as férias", detalhes: [], gravidade: 3 };
  }
  const s = situacaoFerias(p, periodos, hoje, desde);
  if (!s) {
    return { chip: "", texto: "no 1º ano de casa — o direito ainda não nasceu", detalhes: [], gravidade: 3 };
  }

  const detalhes = [];
  if (!s.jaGozou && s.situacao !== "sem-registro") {
    detalhes.push(
      `${s.diasEmAberto} ${plural(s.diasEmAberto, "dia", "dias")} em aberto · conceder até ${dataDe(s.limiteConcessao)}`
    );
  }
  // Agendar não é gozar: os dias marcados aparecem (quem lançou precisa ver
  // que o sistema registrou), mas não quitam nada.
  if (s.diasAgendados > 0 && s.agendadoPara) {
    detalhes.push(
      `${s.diasAgendados} ${plural(s.diasAgendados, "dia marcado", "dias marcados")} para ${dataDe(s.agendadoPara)} — agendar não quita`
    );
  }

  if (s.situacao === "vencida") {
    const n = -s.diasParaLimite;
    return {
      chip: "chip-bad",
      texto: `VENCIDA há ${n} ${plural(n, "dia", "dias")} — por lei o pagamento é em dobro (art. 137)`,
      detalhes, gravidade: 0,
    };
  }
  if (s.situacao === "a-vencer") {
    const prazo = s.diasParaLimite === 0
      ? "vence HOJE"
      : `${s.diasParaLimite} ${plural(s.diasParaLimite, "dia", "dias")}`;
    return {
      chip: "chip-warn",
      texto: `a vencer: conceda até ${dataDe(s.limiteConcessao)} (${prazo})`,
      detalhes, gravidade: 1,
    };
  }
  if (s.situacao === "sem-registro") {
    // Sem alarme DE PROPÓSITO: período anterior ao histórico é desconhecido,
    // não dívida — alerta falso ensina a ignorar o verdadeiro.
    return {
      chip: "chip",
      texto: "sem registro: período anterior ao histórico deste sistema — sem como afirmar",
      detalhes, gravidade: 2,
    };
  }
  return { chip: "chip-ok", texto: "férias em dia", detalhes, gravidade: 3 };
}

/* A conferência do formulário, em tempo real. Devolve { achados, dias }.
   Erro trava a gravação; aviso não — quem classifica é feriasAgenda.js.

   A MinasLab não carimba o período aquisitivo no registro, então o form
   reconstrói o contexto do jeito que o FIFO do clt.js vai atribuir:
   - período em aberto (situacaoFerias): os dias já gozados nele + TODO
     agendamento futuro contam como lançados (quando os agendados começarem,
     é nele que o FIFO os abate);
   - tudo quitado: o novo lançamento abre o próximo aquisitivo — só os
     agendamentos futuros contam;
   - ainda no 1º ano (antecipação é possível): tudo conta contra o 1º;
   - sem pessoa/admissão não há como atribuir aquisitivo — confere só o par
     de datas, a sobreposição e o abono, sem inventar saldo. */
function conferirAgendamento(form, pessoa, registros, hoje, desde) {
  const achados = [];
  const anoI = anoRuim(form.inicio);
  const anoR = anoRuim(form.retorno);
  if (anoI) achados.push({ nivel: "erro", texto: `Confira o ano da data de início: ${anoI}` });
  if (anoR) achados.push({ nivel: "erro", texto: `Confira o ano da data de retorno: ${anoR}` });
  if (achados.length) return { achados, dias: null };

  const ini = parseData(form.inicio);
  const ret = parseData(form.retorno);
  // Um dos campos ainda vazio: nada a conferir — o botão já fica desabilitado
  // sem as duas datas, e mensagem no meio da digitação só atrapalha.
  if (!ini || !ret) return { achados, dias: null };

  const pares = validarPeriodo(ini, ret);
  achados.push(...pares);
  const dias = diasEntreDatas(ini, ret);
  if (temErro(pares)) return { achados, dias };

  const outros = registros.filter((r) => r.id !== form.id);
  const abono = Math.max(0, Number(form.abonoDias) || 0);
  let jaLancados = 0;
  let fracoes = 0;
  if (pessoa && pessoa.admissao) {
    const s = situacaoFerias(pessoa, outros, hoje, desde);
    const comDatas = outros.filter((r) => r.status !== "cancelada" && diasDoRegistro(r) > 0);
    const futuros = comDatas.filter((r) => {
      const i = parseData(r.inicio);
      return i && i.getTime() > hoje.getTime();
    });
    const somaFuturos = futuros.reduce((t, r) => t + diasDoRegistro(r), 0);
    if (s && !s.jaGozou) {
      jaLancados = s.diasGozados + somaFuturos;
      /* Frações no aberto: quem manda é a ATRIBUIÇÃO do FIFO, não a data crua.
         O filtro antigo (início >= direitoDesde) contava também o gozo ATRASADO
         do período ANTERIOR — regularizar as vencidas de julho entrava na conta
         e o form barrava a 3ª fração LEGÍTIMA com "a CLT não permite um quarto"
         (10+10+10 é legal). Gozo que já começou só conta se o clt.js o creditou
         A ESTE período (gozosCreditados); agendado futuro conta porque é neste
         aberto que o FIFO vai abatê-lo quando começar. */
      fracoes = comDatas.filter((r) => {
        const i = parseData(r.inicio);
        if (!i) return false;
        if (i.getTime() > hoje.getTime()) return true; // futuro: cairá no aberto
        return s.gozosCreditados.includes(ymdLocal(i));
      }).length;
    } else if (s) {
      jaLancados = somaFuturos;
      fracoes = futuros.length;
    } else {
      jaLancados = comDatas.reduce((t, r) => t + diasDoRegistro(r), 0);
      fracoes = comDatas.length;
    }
  }

  achados.push(...validarAgendamento({
    inicio: ini, dias, diasJaLancados: jaLancados, fracoesExistentes: fracoes,
    outros, ignorarId: form.id || undefined, abono,
  }));
  return { achados, dias };
}

function LinhaFerias({ linha, hoje, aberta, aoAlternar, editavel, acoes }) {
  const { p, periodos, presenca, clt } = linha;
  const Seta = aberta ? ChevronDown : ChevronRight;
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left transition-colors hover:bg-slate-50"
      >
        <Seta size={16} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 basis-40">
          <span className="block truncate font-display text-sm font-medium text-slate-900">{p.nome}</span>
          <span className="block truncate text-xs text-slate-500">{p.cargo || "cargo sem registro"}</span>
        </span>
        {presenca.fase === "sem-marcacao" ? (
          <span className="text-xs text-slate-400">{presenca.texto}</span>
        ) : (
          <span className={clsx(presenca.fase === "em-curso" ? "chip-ok" : "chip", "whitespace-nowrap")}>
            {presenca.texto}
          </span>
        )}
        {/* A frase da CLT pode ser longa (a de vencida cita o art. 137): sem
            nowrap e com max-w-full para nunca empurrar a página de lado. */}
        {clt.chip ? (
          <span className={clsx(clt.chip, "max-w-full")}>{clt.texto}</span>
        ) : (
          <span className="text-xs text-slate-400">{clt.texto}</span>
        )}
        {clt.detalhes.length > 0 && (
          <span className="w-full pl-7 text-xs text-slate-500">{clt.detalhes.join(" · ")}</span>
        )}
      </button>

      {aberta && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: "var(--hairline)" }}>
          {periodos.length === 0 && (
            <p className="text-xs text-slate-400">Nenhum período lançado para {p.apelido || p.nome}.</p>
          )}
          {periodos.map((f) => {
            const st = STATUS_FERIAS[f.status] || STATUS_FERIAS.marcada;
            // Status × datas: quando a conferência devolve a frase da
            // incoerência, ela vira pendência na linha — nunca conserto
            // automático (mudar status é decisão de quem cuida da folha).
            const pend = statusIncoerente(f, hoje);
            const abono = Number(f.abonoDias) || 0;
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
                <span className={clsx("min-w-0 flex-1 basis-44 text-sm text-slate-700", f.status === "cancelada" && "line-through opacity-60")}>
                  {f.inicio ? dataLonga(f.inicio) : "início sem registro"} → {f.retorno ? `volta ${dataCurta(f.retorno)}` : "retorno sem registro"}
                  {f.dias != null && <span className="text-slate-400"> · {f.dias} {plural(f.dias, "dia", "dias")}</span>}
                  {abono > 0 && <span className="text-slate-400"> · {abono} de abono</span>}
                  {f.obs && <span className="block truncate text-xs text-slate-400">{f.obs}</span>}
                  {pend && <span className="block text-xs font-medium text-warn-700">{pend}</span>}
                </span>
                <span className={st.chip}>{st.rotulo}</span>
                {editavel && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => acoes.editar(f)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    {f.status === "marcada" && (
                      <button
                        type="button"
                        onClick={() => acoes.cancelar(f)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
                        title="Cancelar este período"
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
          {editavel && (
            <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => acoes.marcar(p.id)}>
              + Marcar férias para {p.apelido || p.nome}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormFerias({ form, setForm, ativos, ferias, hoje, desde, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const pessoa = ativos.find((x) => x.id === form.pessoaId) || null;
  const registros = (ferias || []).filter((r) => r.pessoaId === form.pessoaId);
  const foraDoQuadro = form.pessoaId && !pessoa;

  // A conferência em tempo real: quem marca vê a conta e os achados ANTES de
  // gravar. Erro trava o botão e o submit; aviso informa e deixa passar.
  const { achados, dias } = conferirAgendamento(form, pessoa, registros, hoje, desde);
  const travado = temErro(achados);
  const abono = Math.max(0, Number(form.abonoDias) || 0);

  return (
    <Modal titulo={form.id ? "Editar férias" : "Marcar férias"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (travado) return; // erro trava; aviso não
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="f-pessoa">Pessoa</label>
          <select id="f-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
            <option value="" disabled>— escolha —</option>
            {foraDoQuadro && <option value={form.pessoaId}>{form.pessoaNome || "—"} (fora do quadro)</option>}
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="f-inicio">Início</label>
            <input id="f-inicio" type="date" className="input" value={form.inicio} onChange={setCampo("inicio")} required />
          </div>
          <div>
            <label className="label" htmlFor="f-retorno">Retorno (dia em que volta)</label>
            <input id="f-retorno" type="date" className="input" value={form.retorno} onChange={setCampo("retorno")} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-abono">Abono pecuniário (dias vendidos — art. 143)</label>
          <input
            id="f-abono" type="number" inputMode="numeric" min="0" max={MAX_ABONO_DIAS} step="1"
            className="input" value={form.abonoDias || ""} onChange={setCampo("abonoDias")}
          />
        </div>

        {/* A leitura em tempo real: quem marca vê a conta antes de gravar. */}
        {dias !== null && dias > 0 && !travado && (
          <p className="text-sm text-ok-700">
            {dias} {plural(dias, "dia", "dias")} de férias
            {abono > 0 && <> + {abono} {plural(abono, "dia vendido", "dias vendidos")} de abono</>}
            , volta em {dataCurta(form.retorno)}.
          </p>
        )}
        {achados.map((a, i) => (
          <p key={i} className={a.nivel === "erro" ? "text-sm font-medium text-bad-700" : "text-sm text-warn-700"}>
            {a.texto}
          </p>
        ))}

        <div>
          <label className="label" htmlFor="f-obs">Observações</label>
          <textarea id="f-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        {form.id && (
          <div>
            <label className="label" htmlFor="f-status">Situação</label>
            <select id="f-status" className="select" value={form.status} onChange={setCampo("status")}>
              <option value="marcada">marcada</option>
              <option value="concluida">concluída</option>
              <option value="cancelada">cancelada</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button
            type="submit" className="btn-primary"
            disabled={salvando || !form.pessoaId || !form.inicio || !form.retorno || travado}
          >
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaFerias({
  linhasFerias, ativos, ferias, hojeISO, editavel, expandida, setExpandida,
  form, setForm, salvando, aoAbrir, aoGravar, aoFechar, aoCancelar,
}) {
  // Meia-noite LOCAL do hojeISO — new Date("AAAA-MM-DD") seria meia-noite UTC
  // e o dia voltaria um no Brasil. "Hoje" vem da casca (estado com recarga).
  const hoje = useMemo(() => {
    const [a, m, d] = String(hojeISO).split("-").map(Number);
    return new Date(a, m - 1, d);
  }, [hojeISO]);

  // O corte "desde": antes do registro de férias mais antigo da base (TODAS as
  // férias, inclusive de desligados) o sistema não afirma dívida.
  const desde = useMemo(() => inicioDoHistorico(ferias || []), [ferias]);

  const linhas = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const FASE = { "em-curso": 0, futuro: 1, "sem-marcacao": 2 };
    const ls = linhasFerias.map((lf) => ({
      ...lf,
      presenca: presencaDaPessoa(lf.periodos, hoje),
      clt: leituraCLT(lf.p, lf.periodos, hoje, desde),
    }));
    // Quem está fora AGORA primeiro (volta mais próxima antes), depois quem
    // tem marcada (mais próxima antes), depois o resto — e no resto a CLT
    // mais grave sobe (vencida > a vencer > sem registro).
    ls.sort((a, b) =>
      FASE[a.presenca.fase] - FASE[b.presenca.fase] ||
      (a.presenca.fase === "sem-marcacao"
        ? a.clt.gravidade - b.clt.gravidade
        : a.presenca.dias - b.presenca.dias) ||
      norm(a.p.nome).localeCompare(norm(b.p.nome))
    );
    return ls;
  }, [linhasFerias, hoje, desde]);

  return (
    <>
      <Card>
        <SectionTitle
          titulo="Férias por pessoa"
          sub="Quem está fora agora vem primeiro; ao lado, o prazo da CLT do período em aberto. Clique na linha para ver o histórico."
        />
        {linhas.length === 0 && (
          <Empty>Ninguém no quadro ainda — as férias moram na ficha de cada pessoa.</Empty>
        )}
        <div className="space-y-2">
          {linhas.map((linha) => (
            <LinhaFerias
              key={linha.p.id}
              linha={linha}
              hoje={hoje}
              aberta={expandida === linha.p.id}
              aoAlternar={() => setExpandida(expandida === linha.p.id ? null : linha.p.id)}
              editavel={editavel}
              acoes={{
                editar: (f) => aoAbrir(f),
                cancelar: aoCancelar,
                marcar: (pessoaId) => aoAbrir(null, pessoaId),
              }}
            />
          ))}
        </div>
      </Card>

      <FormFerias
        form={form}
        setForm={setForm}
        ativos={ativos}
        ferias={ferias}
        hoje={hoje}
        desde={desde}
        salvando={salvando}
        aoSalvar={aoGravar}
        aoFechar={aoFechar}
      />
    </>
  );
}
