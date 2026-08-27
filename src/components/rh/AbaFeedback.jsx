// Aba Feedback do RH: a FILA de quem está esperando conversa — não um arquivo.
// O motor é src/lib/rh/feedbackCadencia.js (portado da Impresilk) e a taxonomia
// dele MANDA: "atrasado" já inclui quem nunca recebeu e estourou o prazo contado
// da admissão; "nunca" dentro do prazo é fato, não cobrança. Preparar e agendar
// NÃO tiram ninguém da fila — só a conversa registrada (ocorridoEm) fecha o
// ciclo; é jaFoiDado() quem garante, e esta tela não burla.
//
// Estado do formulário e da expansão moram AQUI (a casca só passa dados e as
// portas de gravação). A casca também passa `recarregar`, que esta aba não
// destrutura: gravar/apagarReg já recarregam ao final.

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  CalendarPlus, ChevronDown, ChevronRight, MessagesSquare, NotebookPen, Trash2,
} from "lucide-react";
import { dataCurta, dataLonga } from "../../lib/format.js";
import {
  bloqueio, cadenciaDaPessoa, cadenciaDe, compararFila, jaFoiDado, ultimoFeedback,
} from "../../lib/rh/feedbackCadencia.js";
import { situacaoExperiencia } from "../../lib/rh/clt.js";
import { SectionTitle, Empty, Modal, Card } from "../ui.jsx";
import { anoRuim } from "./uteis.js";

// A frase da recusa espelha a razão da lib (bloqueio()): recusar E explicar o
// canal certo. O texto digitado NÃO é gravado em lugar nenhum — nem "para
// depois": avisar, permitir e guardar seria a pior das três opções.
const FRASE_BLOQUEIO = {
  grave:
    "Assédio, agressão e ocorrência de segurança têm canal próprio, com sigilo (Lei 14.457/2022, art. 23) — não entram no histórico de conversa. Nada foi gravado.",
  sensivel:
    "Saúde, religião, sindicato e deficiência são dado pessoal sensível (LGPD, art. 11) e não entram num registro de conversa sobre trabalho. Nada foi gravado.",
};

// O chip da linha traduz a situação que a LIB devolveu — a tela não recalcula
// prazo por conta própria.
function chipFila(c) {
  if (c.situacao === "atrasado") {
    const d = -c.diasParaProximo;
    return { chip: "chip-bad", texto: `atrasado há ${d} ${d === 1 ? "dia" : "dias"}` };
  }
  if (c.situacao === "a-vencer") {
    const d = c.diasParaProximo;
    return { chip: "chip-warn", texto: d === 0 ? "vence hoje" : `vence em ${d} ${d === 1 ? "dia" : "dias"}` };
  }
  if (c.situacao === "nunca") return { chip: "chip", texto: "nunca recebeu" };
  return { chip: "chip-ok", texto: "em dia" };
}

// A frase honesta da linha: só afirma "última conversa individual" quando houve
// UMA; equipe e treinamento não viram "conversa individual" na frase, pelo
// mesmo motivo que não zeram o relógio na lib.
function fraseUltimaConversa(l) {
  const { ultimaIndividual, historico, cadencia } = l;
  if (ultimaIndividual) {
    if (!Number.isFinite(cadencia.diasDesde)) return "última conversa individual com data ilegível";
    const n = cadencia.diasDesde;
    if (n === 0) return "conversa individual hoje";
    return `última conversa individual há ${n} ${n === 1 ? "dia" : "dias"}`;
  }
  if (historico.length > 0) return "sem conversa individual — só equipe ou treinamento";
  return "nunca teve conversa registrada";
}

function LinhaFeedback({ l, aberta, aoAlternar, editavel, acoes }) {
  const { p, emPreparo, historico } = l;
  const Seta = aberta ? ChevronDown : ChevronRight;
  const cf = chipFila(l.cadencia);
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          className="flex min-w-0 flex-1 basis-52 items-center gap-3 text-left"
        >
          <Seta size={16} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-sm font-medium text-slate-900">{p.nome}</span>
            <span className="block truncate text-xs text-slate-500">{p.cargo || "cargo sem registro"}</span>
            <span className="block truncate text-xs text-slate-400">{fraseUltimaConversa(l)}</span>
          </span>
        </button>

        {/* O ciclo em preparo aparece, mas NÃO muda o chip da fila: preparado
            não é conversado, e a tela não pode sugerir o contrário. */}
        {emPreparo && (
          <span className="chip-brand whitespace-nowrap" title="Só o registro da conversa fecha o ciclo.">
            {emPreparo.agendadaPara ? `agendada ${dataCurta(emPreparo.agendadaPara)}` : "em preparo"}
          </span>
        )}
        <span className={clsx(cf.chip, "whitespace-nowrap")}>{cf.texto}</span>

        {editavel && (
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {!emPreparo && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.preparar(l)}>
                <NotebookPen size={13} /> Preparar
              </button>
            )}
            {emPreparo && !emPreparo.agendadaPara && (
              <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.agendar(l)}>
                <CalendarPlus size={13} /> Agendar
              </button>
            )}
            <button type="button" className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => acoes.registrar(l)}>
              <MessagesSquare size={13} /> Registrar conversa
            </button>
          </span>
        )}
      </div>

      {aberta && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: "var(--hairline)" }}>
          {emPreparo && (
            <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-700">
              <p className="text-xs font-medium text-brand-700">
                Ciclo em preparo
                {emPreparo.preparadoEm && ` — roteiro de ${dataCurta(emPreparo.preparadoEm)}`}
                {emPreparo.agendadaPara && `, conversa agendada para ${dataCurta(emPreparo.agendadaPara)}`}
                . Só o registro da conversa fecha o ciclo.
              </p>
              {emPreparo.roteiro && <p className="mt-1 whitespace-pre-wrap">{emPreparo.roteiro}</p>}
              {editavel && (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-medium text-bad-700 hover:underline"
                  onClick={() => acoes.descartarPreparo(l)}
                >
                  Descartar este preparo
                </button>
              )}
            </div>
          )}

          {historico.length === 0 && (
            <p className="text-xs text-slate-400">Nenhuma conversa registrada para {p.apelido || p.nome}.</p>
          )}
          {historico.map((c) => (
            <div key={c.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 basis-52 text-sm text-slate-700">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">{dataLonga(c.ocorridoEm || c.criadoEm)}</span>
                  {c.tipo === "equipe" && (
                    <span className="chip" title="Conversa com a equipe não zera o relógio individual.">com a equipe</span>
                  )}
                  {c.origem === "treinamento" && (
                    <span className="chip" title="Fala de treinamento não zera o relógio da conversa de trabalho.">treinamento</span>
                  )}
                </span>
                <span className="block whitespace-pre-wrap">
                  {c.oQueAconteceu || c.roteiro || <span className="text-slate-400">sem texto registrado</span>}
                </span>
                {c.combinado && (
                  <span className="block text-xs text-slate-500">Combinado: {c.combinado}</span>
                )}
              </span>
              {editavel && (
                <button
                  type="button"
                  onClick={() => acoes.apagarConversa(c)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
                  title="Apagar este registro"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Um modal para as três etapas (form.etapa: "preparar" | "agendar" |
// "registrar"). Declarado FORA da aba: componente dentro de componente remonta
// a subárvore a cada render e o campo perde o foco a cada letra.
function FormFeedback({ form, setForm, hojeISO, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const p = form.pessoa;
  const ano = form.etapa === "agendar" ? anoRuim(form.agendadaPara) : null;

  const titulo =
    form.etapa === "preparar" ? `Preparar conversa — ${p.nome}`
      : form.etapa === "agendar" ? `Agendar conversa — ${p.nome}`
        : `Registrar conversa — ${p.nome}`;

  const prontoParaGravar =
    form.etapa === "preparar" ? !!form.roteiro.trim()
      : form.etapa === "agendar" ? !!form.agendadaPara && !ano
        : !!form.oQueAconteceu.trim();

  return (
    <Modal titulo={titulo} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {form.etapa === "preparar" && (
          <div>
            <label className="label" htmlFor="fb-roteiro">Roteiro</label>
            <textarea
              id="fb-roteiro"
              className="input"
              rows={4}
              autoFocus
              placeholder="O que precisa ser conversado — fatos, não julgamentos da pessoa."
              value={form.roteiro}
              onChange={setCampo("roteiro")}
            />
          </div>
        )}

        {form.etapa === "agendar" && (
          <>
            {form.base?.roteiro && (
              <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
                <span className="label mb-0.5">Roteiro preparado</span>
                <p className="whitespace-pre-wrap">{form.base.roteiro}</p>
              </div>
            )}
            <div>
              <label className="label" htmlFor="fb-agendada">Data da conversa</label>
              <input
                id="fb-agendada"
                type="date"
                className="input"
                value={form.agendadaPara}
                onChange={setCampo("agendadaPara")}
                required
              />
            </div>
            {ano && <p className="text-sm font-medium text-bad-700">Confira o ano da data da conversa: {ano}</p>}
          </>
        )}

        {form.etapa === "registrar" && (
          <>
            {form.base?.roteiro && (
              <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
                <span className="label mb-0.5">Roteiro preparado</span>
                <p className="whitespace-pre-wrap">{form.base.roteiro}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="fb-tipo">Tipo</label>
                <select id="fb-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
                  <option value="individual">Individual</option>
                  <option value="equipe">Com a equipe</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fb-origem">Origem</label>
                <select id="fb-origem" className="select" value={form.origem} onChange={setCampo("origem")}>
                  <option value="trabalho">Trabalho</option>
                  <option value="treinamento">Treinamento</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Conversa de equipe e fala de treinamento entram na ficha, mas não zeram o relógio da conversa individual.
            </p>
            <div className="flex items-center gap-2">
              <input
                id="fb-elogio"
                type="checkbox"
                className="h-4 w-4"
                checked={form.elogio}
                onChange={(e) => setForm({ ...form, elogio: e.target.checked })}
              />
              <label className="label mb-0" htmlFor="fb-elogio">Elogio simples — elogio não leva combinado</label>
            </div>
            <div>
              {/* "O que aconteceu", não "como a pessoa é": a proteção contra
                  julgar a pessoa é o RÓTULO do campo — decisão da lib. */}
              <label className="label" htmlFor="fb-aconteceu">O que aconteceu</label>
              <textarea
                id="fb-aconteceu"
                className="input"
                rows={4}
                autoFocus
                placeholder="O fato: o que a pessoa fez ou deixou de fazer — não um julgamento dela."
                value={form.oQueAconteceu}
                onChange={setCampo("oQueAconteceu")}
              />
            </div>
            {!form.elogio && (
              <div>
                <label className="label" htmlFor="fb-combinado">Combinado</label>
                <textarea
                  id="fb-combinado"
                  className="input"
                  rows={2}
                  placeholder="O que ficou combinado (se ficou)."
                  value={form.combinado}
                  onChange={setCampo("combinado")}
                />
              </div>
            )}
            <p className="text-sm text-slate-500">A conversa fica registrada como ocorrida hoje ({dataLonga(hojeISO)}).</p>
          </>
        )}

        {form.etapa !== "registrar" && (
          <p className="text-xs text-slate-500">
            Preparar e agendar não tiram {p.apelido || p.nome} da fila — só o registro da conversa fecha o ciclo.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !prontoParaGravar}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaFeedback({
  pessoas, feedbacks, hojeISO, editavel, gravar, apagarReg, setAviso,
}) {
  const [expandida, setExpandida] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const linhas = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const ativos = pessoas.filter((p) => p.ativo !== false);

    const porPessoa = new Map();
    for (const f of feedbacks) {
      if (!porPessoa.has(f.pessoaId)) porPessoa.set(f.pessoaId, []);
      porPessoa.get(f.pessoaId).push(f);
    }

    // A mesma âncora da casca: meia-noite LOCAL do hojeISO — new Date("AAAA-MM-DD")
    // seria meia-noite UTC e o dia voltaria um no Brasil.
    const [hA, hM, hD] = hojeISO.split("-").map(Number);
    const hojeData = new Date(hA, hM - 1, hD);

    const lista = ativos.map((p) => {
      const fbs = porPessoa.get(p.id) || [];
      // Os MESMOS opts do KPI da casca (pages/RH.jsx): se a fila usasse outra
      // régua, o card "Feedback esperando" e a lista contariam gente diferente.
      const cadencia = cadenciaDe(
        fbs,
        p.admissao || null,
        hojeData,
        // Em experiência é FATO DERIVADO (situacaoExperiencia), não campo da
        // ficha — mesma derivação do KPI da casca, senão o cartão e a fila
        // contariam gente diferente.
        cadenciaDaPessoa({ emExperiencia: !!situacaoExperiencia(p, hojeData), comPlanoAberto: p.planoAberto === true })
      );
      // Só conversa que ACONTECEU entra no histórico — jaFoiDado é da lib.
      const dados = fbs.filter(jaFoiDado);
      // O mesmo recorte que a lib usa para o relógio: individual e de trabalho.
      const ultimaIndividual = ultimoFeedback(
        dados.filter((f) => f.tipo !== "equipe" && f.origem !== "treinamento")
      );
      // Ciclo em preparo (preparado/agendado sem ocorridoEm) — aparece, mas
      // NÃO tira a pessoa da fila.
      const emPreparo = ultimoFeedback(fbs.filter((f) => !jaFoiDado(f)));
      const historico = [...dados].sort((a, b) =>
        String(b.ocorridoEm || b.criadoEm).localeCompare(String(a.ocorridoEm || a.criadoEm))
      );
      return { p, cadencia, ultimaIndividual, emPreparo, historico };
    });

    // A ordem é da lib: atrasado > nunca > a-vencer > em-dia; dentro do grupo,
    // quem espera há mais tempo primeiro. Empate final por nome.
    lista.sort((a, b) => compararFila(a.cadencia, b.cadencia) || norm(a.p.nome).localeCompare(norm(b.p.nome)));
    return lista;
  }, [pessoas, feedbacks, hojeISO]);

  const disparar = async (registro, fraseOk) => {
    setSalvando(true);
    try {
      await gravar("rh_feedbacks", registro, fraseOk, () => setForm(null));
    } finally {
      setSalvando(false);
    }
  };

  const abrirPreparar = (l) =>
    setForm({ etapa: "preparar", pessoa: l.p, base: null, roteiro: "" });
  const abrirAgendar = (l) =>
    setForm({ etapa: "agendar", pessoa: l.p, base: l.emPreparo, agendadaPara: l.emPreparo?.agendadaPara || "" });
  const abrirRegistrar = (l) =>
    setForm({
      etapa: "registrar",
      pessoa: l.p,
      base: l.emPreparo || null,
      tipo: l.emPreparo?.tipo || "individual",
      origem: l.emPreparo?.origem || "trabalho",
      elogio: false, // só da tela: decide se o campo Combinado aparece; não vai ao banco
      oQueAconteceu: "",
      combinado: "",
    });

  const gravarForm = () => {
    const f = form;
    if (!f) return;
    const p = f.pessoa;

    if (f.etapa === "preparar") {
      const roteiro = f.roteiro.trim();
      // A conferência da lib ANTES de gravar: se bloquear, recusa e o texto
      // não é guardado em lugar nenhum.
      const motivo = bloqueio(roteiro);
      if (motivo) return setAviso({ tipo: "erro", texto: FRASE_BLOQUEIO[motivo] });
      return disparar(
        {
          pessoaId: p.id, pessoaNome: p.nome, tipo: "individual", origem: "trabalho",
          preparadoEm: hojeISO, agendadaPara: "", ocorridoEm: "",
          roteiro, oQueAconteceu: "", combinado: "",
        },
        `Roteiro preparado — ${p.apelido || p.nome} segue na fila até a conversa acontecer.`
      );
    }

    if (f.etapa === "agendar") {
      // Sem ciclo aberto não há o que agendar (tela desatualizada): melhor
      // recusar do que gravar um registro sem pessoa.
      if (!f.base?.id) {
        setForm(null);
        return setAviso({ tipo: "erro", texto: "O preparo desta conversa não existe mais. Recarregue e prepare de novo." });
      }
      const ano = anoRuim(f.agendadaPara);
      if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da data da conversa: ${ano}` });
      // Agendar só escreve a data no ciclo aberto — NÃO escreve ocorridoEm:
      // agendado continua na fila (jaFoiDado da lib garante).
      return disparar(
        { ...f.base, agendadaPara: f.agendadaPara },
        `Conversa agendada para ${dataLonga(f.agendadaPara)} — só o registro da conversa fecha o ciclo.`
      );
    }

    // registrar: é o ÚNICO caminho que grava ocorridoEm e fecha o ciclo.
    const oQueAconteceu = f.oQueAconteceu.trim();
    const combinado = f.elogio ? "" : f.combinado.trim();
    for (const texto of [oQueAconteceu, combinado]) {
      // Combinado também é texto que fica na ficha — passa pela mesma porta.
      const motivo = bloqueio(texto);
      if (motivo) return setAviso({ tipo: "erro", texto: FRASE_BLOQUEIO[motivo] });
    }
    const base = f.base || {
      pessoaId: p.id, pessoaNome: p.nome, preparadoEm: "", agendadaPara: "", roteiro: "",
    };
    const naoZera = f.tipo === "equipe" || f.origem === "treinamento";
    return disparar(
      {
        ...base,
        pessoaNome: p.nome,
        tipo: f.tipo,
        origem: f.origem,
        ocorridoEm: hojeISO,
        oQueAconteceu,
        combinado,
      },
      naoZera
        ? "Conversa registrada na ficha — equipe/treinamento não zera o relógio individual."
        : `Conversa registrada — o relógio de ${p.apelido || p.nome} recomeça hoje.`
    );
  };

  const descartarPreparo = (l) => {
    if (!l.emPreparo) return;
    if (!window.confirm(`Descartar o preparo da conversa com ${l.p.nome}? O roteiro é apagado e nada fica na ficha.`)) return;
    apagarReg("rh_feedbacks", l.emPreparo.id, "Preparo descartado.");
  };

  const apagarConversa = (c) => {
    if (!window.confirm(`Apagar este registro de conversa de ${c.pessoaNome || "esta pessoa"}? O histórico não terá mais este registro.`)) return;
    apagarReg("rh_feedbacks", c.id, "Registro apagado.");
  };

  return (
    <>
      <Card>
        <SectionTitle
          titulo="Fila de feedback"
          sub="Quem espera há mais tempo vem primeiro. Preparar e agendar não tiram ninguém da fila — só a conversa registrada."
        />
        {linhas.length === 0 && (
          <Empty>Ninguém no quadro ainda — a fila de feedback nasce das pessoas ativas.</Empty>
        )}
        <div className="space-y-2">
          {linhas.map((l) => (
            <LinhaFeedback
              key={l.p.id}
              l={l}
              aberta={expandida === l.p.id}
              aoAlternar={() => setExpandida(expandida === l.p.id ? null : l.p.id)}
              editavel={editavel}
              acoes={{
                preparar: abrirPreparar,
                agendar: abrirAgendar,
                registrar: abrirRegistrar,
                descartarPreparo,
                apagarConversa,
              }}
            />
          ))}
        </div>
      </Card>

      <FormFeedback
        form={form}
        setForm={setForm}
        hojeISO={hojeISO}
        salvando={salvando}
        aoSalvar={gravarForm}
        aoFechar={() => setForm(null)}
      />
    </>
  );
}
