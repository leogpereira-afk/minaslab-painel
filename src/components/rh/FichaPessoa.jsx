// ============================================================================
// A FICHA DA PESSOA — o retrato de quem trabalha aqui, no padrão da casa.
//
// Nasceu do print da ficha do RH da Impresilk, que o Léo mandou em 29/08/2026
// pedindo "o RH nesse padrão". A ideia central de lá, e que vale mais que o
// visual: a ficha ABRE NO LUGAR DA LISTA (é navegação, não janela flutuante),
// tem "‹ Anterior · Próximo ›" para passar de pessoa em pessoa sem voltar, e
// começa por um bloco que diz O QUE PRECISA DE ATENÇÃO — com o botão da ação
// ao lado de cada aviso. Aviso que não leva à ação é aviso que se aprende a
// ignorar.
//
// O QUE ESTA TELA NÃO FAZ: conta nenhuma. Férias vêm de lib/rh/clt.js,
// completude de lib/rh/completudeCadastro.js, exames de components/rh/uteis.js.
// Refazer a conta aqui criaria um segundo resultado — e duas verdades sobre a
// mesma pessoa é o defeito que este sistema mais evitou até agora.
//
// ----------------------------------------------------------------------------
// CONTRATO — props
//   pessoa        a ficha (rh_pessoas)
//   ferias        os períodos DESTA pessoa
//   todasFerias   TODOS os períodos da casa — é o corte de inicioDoHistorico:
//                 sem ele, situacaoFerias afirma "VENCIDA" sobre período que o
//                 sistema nunca enxergou (na Impresilk foram 12 alertas falsos
//                 em 32 pessoas, todos ruído)
//   exames, vencimentos, feedbacks, historico   os DESTA pessoa
//   hojeISO       "AAAA-MM-DD" local
//   editavel      podeEditar da sessão
//   aoVoltar, aoAnterior, aoProximo   navegação (null desabilita o botão,
//                 nunca o esconde — botão escondido não ensina que existe)
//   aoEditar, aoDesligar, aoEfetivar  reusam o que a aba já faz
//   aoIrParaAba   troca a aba do RH ("ferias" | "exames" | "feedback")
//   aoRegistrarAcontecimento   abre o lançamento no histórico
// ============================================================================

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Pencil, UserMinus, AlertTriangle,
  CheckCircle2, CalendarDays, Stethoscope, History, IdCard, LayoutGrid, Plus,
} from "lucide-react";
import { dataLonga, moedaCheia } from "../../lib/format.js";
import { situacaoFerias, situacaoExperiencia, inicioDoHistorico } from "../../lib/rh/clt.js";
import { completudeDaFicha, tomDaCompletude } from "../../lib/rh/completudeCadastro.js";
import { radarExames, tempoDeCasa, chipVenc } from "./uteis.js";
import { Card, Empty } from "../ui.jsx";

const txt = (v) => String(v ?? "").trim();
const ehData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(txt(v));

/* Avatar de INICIAIS. A MinasLab não guarda foto, e um círculo cinza vazio
   fingiria um recurso que não existe — duas letras dizem de quem é a ficha. */
function Iniciais({ nome }) {
  const letras = txt(nome).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-ink font-display text-xl font-semibold text-white">
      {letras || "?"}
    </span>
  );
}

/* Um aviso do "Precisa de atenção": frase + o botão que resolve. */
function Aviso({ tom = "warn", texto, acao, aoAgir }) {
  const cor = tom === "bad"
    ? "border-bad-200 bg-bad-50 text-bad-800"
    : "border-warn-200 bg-warn-50 text-warn-800";
  return (
    <div className={clsx("flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5", cor)}>
      <AlertTriangle size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 text-sm">{texto}</span>
      {acao && aoAgir && (
        <button type="button" className="btn-outline shrink-0 py-1 text-xs" onClick={aoAgir}>
          {acao} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

/* Rótulo em cima, valor embaixo. Vazio é travessão — nunca "N/A", nunca 0. */
function Dado({ rotulo, valor }) {
  return (
    <div className="min-w-0">
      <p className="label mb-0.5">{rotulo}</p>
      <p className="truncate text-sm text-slate-800">{txt(valor) || "—"}</p>
    </div>
  );
}

function Contagem({ n, rotulo, aoAbrir }) {
  const Comp = aoAbrir ? "button" : "div";
  return (
    <Comp
      onClick={aoAbrir}
      className={clsx(
        "flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left",
        aoAbrir && "hover:bg-slate-50"
      )}
    >
      <span className="text-sm text-slate-600">{rotulo}</span>
      <span className="font-display text-base font-semibold tnum text-slate-900">{n}</span>
    </Comp>
  );
}

const ABAS = [
  { id: "resumo", rotulo: "Resumo 360°", icone: LayoutGrid },
  { id: "dados", rotulo: "Dados", icone: IdCard },
  { id: "ferias", rotulo: "Férias", icone: CalendarDays },
  { id: "exames", rotulo: "Exames", icone: Stethoscope },
  { id: "historico", rotulo: "Histórico", icone: History },
];

const ICONE_HIST = {
  admissao: CheckCircle2, cargo: Pencil, salario: Pencil, setor: Pencil,
  desligamento: UserMinus, advertencia: AlertTriangle, elogio: CheckCircle2,
};

export default function FichaPessoa({
  pessoa, ferias = [], todasFerias = [], exames = [], vencimentos = [], feedbacks = [], historico = [],
  hojeISO, editavel,
  aoVoltar, aoAnterior, aoProximo,
  aoEditar, aoDesligar, aoEfetivar, aoIrParaAba, aoRegistrarAcontecimento,
}) {
  const [aba, setAba] = useState("resumo");

  const vm = useMemo(() => {
    if (!pessoa) return null;
    // Meia-noite LOCAL do dia de hoje: new Date("AAAA-MM-DD") seria UTC e o dia
    // voltaria um no Brasil.
    const [a, m, d] = String(hojeISO).split("-").map(Number);
    const hoje = new Date(a, m - 1, d);

    const comp = completudeDaFicha(pessoa);
    // O CORTE do histórico: sem ele a ficha afirma "vencida" sobre período que
    // o sistema nunca teve como conferir.
    const desde = inicioDoHistorico(todasFerias);
    const sf = situacaoFerias(pessoa, ferias, hoje, desde);
    const exp = situacaoExperiencia(pessoa, hoje);
    const radar = radarExames(exames, [pessoa], hojeISO).filter((r) => r.pessoaId === pessoa.id);

    const avisos = [];
    if (sf?.situacao === "vencida") {
      avisos.push({
        tom: "bad",
        texto: `Férias VENCIDAS há ${Math.abs(sf.diasParaLimite)} dias — por lei o pagamento é em dobro (CLT art. 137). Limite era ${dataLonga(sf.limiteConcessao?.toISOString?.().slice(0, 10) ?? "")}.`,
        acao: "Agendar férias", aoAgir: () => aoIrParaAba?.("ferias"),
      });
    } else if (sf?.situacao === "a-vencer") {
      avisos.push({
        texto: `Férias a conceder em ${sf.diasParaLimite} dias (${sf.diasEmAberto} dias em aberto).`,
        acao: "Agendar férias", aoAgir: () => aoIrParaAba?.("ferias"),
      });
    }
    if (exp && exp.situacao !== "primeiro-periodo") {
      const frase = exp.situacao === "expirou"
        ? "O contrato de experiência passou dos 90 dias: virou prazo indeterminado."
        : exp.situacao === "decidir-prorrogacao"
          ? `Dia ${exp.diasDeCasa} de experiência — é a hora de decidir prorrogar.`
          : `Faltam ${exp.diasParaFim} dias para os 90 da experiência: decida a efetivação.`;
      avisos.push({ texto: frase, acao: editavel ? "Efetivar" : null, aoAgir: aoEfetivar });
    }
    for (const r of radar) {
      if (r.dias != null && r.dias < 0) {
        avisos.push({ tom: "bad", texto: `Exame ${r.tipo || ""} venceu há ${Math.abs(r.dias)} dias.`.replace(/\s+/g, " "), acao: "Ver exames", aoAgir: () => aoIrParaAba?.("exames") });
      } else if (r.dias != null && r.dias <= 60) {
        avisos.push({ texto: `Exame ${r.tipo || ""} vence em ${r.dias} dias.`.replace(/\s+/g, " "), acao: "Ver exames", aoAgir: () => aoIrParaAba?.("exames") });
      }
    }
    if (pessoa.admissaoConferida === false && ehData(pessoa.admissao)) {
      avisos.push({
        texto: "A admissão veio do relógio de ponto (é a entrada NELE, não na empresa) e ainda não foi conferida — ela governa férias, experiência e 13º.",
        acao: editavel ? "Conferir" : null, aoAgir: aoEditar,
      });
    }
    const vencAbertos = vencimentos.filter((v) => ehData(v.vence));
    for (const v of vencAbertos) {
      const cv = chipVenc(v.dias);
      if (cv?.tom === "bad" || cv?.tom === "warn") {
        avisos.push({ tom: cv.tom, texto: `${v.tipo || "Vencimento"}: ${cv.texto}.`, acao: null });
      }
    }

    return { comp, sf, exp, radar, avisos };
  }, [pessoa, ferias, todasFerias, exames, vencimentos, hojeISO, editavel, aoIrParaAba, aoEditar, aoEfetivar]);

  if (!pessoa || !vm) return null;
  const { comp, sf, avisos } = vm;
  const tomComp = tomDaCompletude(comp);
  const desligado = pessoa.ativo === false;

  return (
    <div className="space-y-4">
      {/* ---- NAVEGAÇÃO ---- */}
      <div className="sem-impressao flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={aoVoltar}>
          <ArrowLeft size={16} /> Voltar para as pessoas
        </button>
        {/* Desabilitado, nunca escondido: botão que some não ensina que existe. */}
        <span className="flex items-center gap-1">
          <button type="button" className="btn-outline py-1 text-xs disabled:opacity-40" onClick={aoAnterior} disabled={!aoAnterior}>
            <ChevronLeft size={14} /> Anterior
          </button>
          <button type="button" className="btn-outline py-1 text-xs disabled:opacity-40" onClick={aoProximo} disabled={!aoProximo}>
            Próximo <ChevronRight size={14} />
          </button>
        </span>
      </div>

      {/* ---- QUEM É ---- */}
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Iniciais nome={pessoa.nome} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-slate-900">{txt(pessoa.nome) || "sem nome"}</h1>
              <span className={desligado ? "chip" : "chip-ok"}>{desligado ? "Desligado" : "Ativo"}</span>
              {pessoa.batePonto === false && <span className="chip">não bate ponto</span>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {txt(pessoa.cargo) || "cargo não informado"}
              {txt(pessoa.setor) && ` · ${txt(pessoa.setor)}`}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
              {ehData(pessoa.admissao) && <span>{tempoDeCasa(pessoa.admissao, hojeISO)} de casa</span>}
              {ehData(pessoa.admissao) && <span className="tnum">· admissão em {dataLonga(pessoa.admissao)}</span>}
              {/* O selo fica COLADO na data, não no rodapé da tela: quem lê a
                  data precisa saber, ali, que ela é sugestão do relógio. */}
              {pessoa.admissaoConferida === false && ehData(pessoa.admissao) && (
                <span className="chip-warn">a conferir</span>
              )}
              {desligado && ehData(pessoa.desligadoEm) && <span>· desligado em {dataLonga(pessoa.desligadoEm)}</span>}
            </p>
          </div>
          {editavel && (
            <div className="sem-impressao flex shrink-0 flex-wrap gap-2">
              <button type="button" className="btn-outline" onClick={aoEditar}>
                <Pencil size={15} /> Editar
              </button>
              {!desligado && (
                <button type="button" className="btn-ghost text-bad-700" onClick={aoDesligar}>
                  <UserMinus size={15} /> Desligar
                </button>
              )}
            </div>
          )}
        </div>

        {/* ---- COMPLETUDE: a lacuna aparece ANTES de ser necessária ---- */}
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="label mb-0">Cadastro preenchido</span>
            <span className={clsx(
              "font-display text-lg font-bold tnum",
              tomComp === "ruim" ? "text-bad-600" : tomComp === "atencao" ? "text-warn-600" : "text-ok-600"
            )}>
              {comp.pct}%
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={clsx("h-full rounded-full transition-all",
                tomComp === "ruim" ? "bg-bad-500" : tomComp === "atencao" ? "bg-warn-500" : "bg-ok-500")}
              style={{ width: `${Math.max(2, comp.pct)}%` }}
            />
          </div>
          {comp.faltam.length > 0 && (
            <p className="mt-1.5 text-xs text-slate-500">
              Falta ainda: {comp.faltam.map((f) => f.rotulo).join(", ")}
            </p>
          )}
        </div>
      </Card>

      {/* ---- ABAS DA FICHA ---- */}
      <div className="sem-impressao flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--hairline)" }}>
        {ABAS.map((ab) => {
          const Icone = ab.icone;
          return (
            <button
              key={ab.id}
              type="button"
              onClick={() => setAba(ab.id)}
              aria-current={aba === ab.id ? "page" : undefined}
              className={clsx(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 font-display text-sm font-medium transition-colors",
                aba === ab.id
                  ? "border-brand text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <Icone size={15} /> {ab.rotulo}
            </button>
          );
        })}
      </div>

      {aba === "resumo" && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 font-display text-base font-semibold text-slate-900">Precisa de atenção</h2>
            <p className="mb-3 text-sm text-slate-500">Prazos legais e vencimentos desta pessoa.</p>
            {avisos.length === 0 ? (
              /* SUCESSO TAMBÉM FALA: silêncio é indistinguível de "não conferi". */
              <div className="flex items-center gap-2.5 rounded-xl border border-ok-200 bg-ok-50 px-3 py-2.5 text-sm text-ok-800">
                <CheckCircle2 size={16} className="shrink-0 text-ok-600" />
                Nada pendente para esta pessoa.
              </div>
            ) : (
              <div className="space-y-2">
                {avisos.map((av, i) => (
                  <Aviso key={i} tom={av.tom} texto={av.texto} acao={av.acao} aoAgir={av.aoAgir} />
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-display text-base font-semibold text-slate-900">Situação de férias (CLT)</h2>
              {!sf ? (
                <p className="text-sm text-slate-500">
                  {ehData(pessoa.admissao)
                    ? "Ainda não completou 12 meses de casa — o primeiro período aquisitivo está correndo."
                    : "Sem data de admissão na ficha: não dá para contar período aquisitivo."}
                </p>
              ) : sf.situacao === "sem-registro" ? (
                /* "Não sei" dito com todas as letras. Afirmar vencida sobre
                   período anterior ao histórico foi o alarme falso que a
                   Impresilk mediu em 12 de 32 pessoas. */
                <p className="text-sm text-slate-500">
                  Período anterior ao histórico deste sistema — não dá para afirmar se foi gozado.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Dado rotulo="Direito adquirido em" valor={sf.direitoDesde?.toLocaleDateString?.("pt-BR")} />
                  <Dado rotulo="Conceder até" valor={sf.limiteConcessao?.toLocaleDateString?.("pt-BR")} />
                  <Dado rotulo="Dias em aberto" valor={sf.diasEmAberto} />
                  <Dado
                    rotulo="Situação"
                    valor={sf.situacao === "vencida" ? `vencida há ${Math.abs(sf.diasParaLimite)} dias` : sf.situacao === "a-vencer" ? `a vencer em ${sf.diasParaLimite} dias` : "em dia"}
                  />
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-base font-semibold text-slate-900">O que existe na ficha</h2>
              <div className="divide-y" style={{ borderColor: "var(--fio-lista)" }}>
                <Contagem n={ferias.length} rotulo="Períodos de férias" aoAbrir={() => setAba("ferias")} />
                <Contagem n={exames.length} rotulo="Exames" aoAbrir={() => setAba("exames")} />
                <Contagem n={vencimentos.length} rotulo="Vencimentos" />
                <Contagem n={feedbacks.length} rotulo="Conversas registradas" />
                <Contagem n={historico.length} rotulo="Acontecimentos" aoAbrir={() => setAba("historico")} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {aba === "dados" && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-slate-900">Identificação</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Dado rotulo="Nome" valor={pessoa.nome} />
              <Dado rotulo="Apelido" valor={pessoa.apelido} />
              <Dado rotulo="CPF" valor={pessoa.cpf} />
              <Dado rotulo="Nascimento" valor={ehData(pessoa.dataNascimento) ? dataLonga(pessoa.dataNascimento) : ""} />
              <Dado rotulo="Telefone" valor={pessoa.telefone} />
              <Dado rotulo="E-mail" valor={pessoa.email} />
              <Dado rotulo="Contato de emergência" valor={pessoa.contatoEmergencia} />
              <Dado rotulo="Cidade" valor={pessoa.cidade} />
              <Dado rotulo="CNH" valor={pessoa.cnh} />
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-slate-900">Contrato</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Dado rotulo="Matrícula" valor={pessoa.matricula} />
              <Dado rotulo="Tipo de contrato" valor={pessoa.tipoContrato} />
              <Dado rotulo="Cargo" valor={pessoa.cargo} />
              <Dado rotulo="Setor" valor={pessoa.setor} />
              <Dado rotulo="Gestor" valor={pessoa.gestorNome} />
              <Dado rotulo="Jornada" valor={pessoa.jornada} />
              {/* Salário 0 é ficha incompleta, não salário zero — a completude
                  cobra, e aqui sai travessão em vez de R$ 0,00. */}
              <Dado rotulo="Salário" valor={pessoa.salario ? moedaCheia(pessoa.salario) : ""} />
              <Dado rotulo="Bate ponto" valor={pessoa.batePonto === false ? `não — ${txt(pessoa.motivoSemPonto) || "sem motivo registrado"}` : "sim"} />
              <Dado rotulo="Registro no conselho" valor={pessoa.registroConselho} />
            </div>
          </Card>
        </div>
      )}

      {aba === "ferias" && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900">Períodos de férias</h2>
            <button type="button" className="btn-outline py-1 text-xs" onClick={() => aoIrParaAba?.("ferias")}>
              Ver no módulo <ChevronRight size={13} />
            </button>
          </div>
          {ferias.length === 0 ? (
            <Empty>Nenhum período lançado para esta pessoa.</Empty>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--fio-lista)" }}>
              {[...ferias].sort((x, y) => String(y.inicio).localeCompare(String(x.inicio))).map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="tnum w-44 shrink-0 text-slate-700">
                    {ehData(f.inicio) ? dataLonga(f.inicio) : "—"} → {ehData(f.retorno) ? dataLonga(f.retorno) : "—"}
                  </span>
                  <span className="chip">{f.status || "—"}</span>
                  {f.abonoDias > 0 && <span className="text-xs text-slate-500">{f.abonoDias} dias de abono</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {aba === "exames" && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900">Exames</h2>
            <button type="button" className="btn-outline py-1 text-xs" onClick={() => aoIrParaAba?.("exames")}>
              Ver no módulo <ChevronRight size={13} />
            </button>
          </div>
          {exames.length === 0 ? (
            <Empty>Nenhum exame registrado para esta pessoa.</Empty>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--fio-lista)" }}>
              {[...exames].sort((x, y) => String(y.data).localeCompare(String(x.data))).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="tnum w-24 shrink-0 text-slate-500">{ehData(e.data) ? dataLonga(e.data) : "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{txt(e.exame) || txt(e.tipo) || "—"}</span>
                  <span className="chip">{e.resultado || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {aba === "historico" && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900">Histórico</h2>
            {editavel && (
              <button type="button" className="btn-outline py-1 text-xs" onClick={aoRegistrarAcontecimento}>
                <Plus size={13} /> Registrar acontecimento
              </button>
            )}
          </div>
          {historico.length === 0 ? (
            <Empty>Nada registrado ainda para esta pessoa.</Empty>
          ) : (
            <ul className="space-y-2">
              {[...historico].sort((x, y) => String(y.data).localeCompare(String(x.data))).map((h) => {
                const Icone = ICONE_HIST[h.tipo] || History;
                return (
                  <li key={h.id} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
                    <Icone size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{txt(h.titulo) || txt(h.tipo) || "—"}</p>
                      <p className="text-xs text-slate-500">
                        {ehData(h.data) ? dataLonga(h.data) : "—"}
                        {txt(h.valorDe) && txt(h.valorPara) && ` · de ${h.valorDe} para ${h.valorPara}`}
                      </p>
                      {txt(h.detalhe) && <p className="mt-1 text-sm text-slate-600">{h.detalhe}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
