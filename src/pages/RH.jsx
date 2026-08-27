// RH — o quadro enxuto da MinasLab: quem trabalha aqui, férias e o radar de
// vencimentos (ASO, NR, treinamento, CNH). Só a direção chega nesta rota — e o
// servidor confere de novo em toda chamada; o que a tela esconde é conforto.
//
// Decisões desta tela:
// - Uma linha POR PESSOA na aba Férias: a pergunta da direção é "quem está
//   fora?", não "quantos lançamentos existem". O histórico abre no clique.
// - Desligar não apaga: a ficha vira "desligado" e fica guardada — folha e
//   vencimento antigos continuam apontando para alguém que existe.
// - Salário vazio escreve "sem registro": zero seria afirmar salário zero,
//   e ausência de dado não é zero (lição paga na Impresilk).

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Plus, Pencil, Trash2, Ban, Users, UserMinus, Sun, CalendarClock,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import {
  moedaCheia, ymdLocal, dataCurta, dataLonga, diasEntre, paraNumero,
} from "../lib/format.js";
import {
  PageTitle, SectionTitle, StatCard, Segmented, Empty, CarregandoModulo,
  ErroModulo, Aviso, Modal, Card,
} from "../components/ui.jsx";

const TIPOS_VENC = ["ASO", "NR-35", "NR-06", "NR-10", "Treinamento", "CNH", "Outro"];

const STATUS_FERIAS = {
  marcada: { rotulo: "marcada", chip: "chip" },
  concluida: { rotulo: "concluída", chip: "chip-ok" },
  cancelada: { rotulo: "cancelada", chip: "chip" },
};

const VAZIO_PESSOA = {
  id: "", nome: "", apelido: "", cargo: "", admissao: "", telefone: "",
  salario: "", obs: "", ativo: true, desligadoEm: "",
};
const VAZIO_FERIAS = {
  id: "", pessoaId: "", pessoaNome: "", inicio: "", retorno: "", obs: "", status: "marcada",
};
const VAZIO_VENC = {
  id: "", pessoaId: "", pessoaNome: "", tipo: "ASO", descricao: "", vence: "",
};

// O ano digitado com dígito a mais (20266) passa no input de data e andaria
// 18 mil anos calado. Se o ano não tem 4 dígitos, devolve o ano para a frase.
function anoRuim(data) {
  const ano = String(data || "").split("-")[0];
  return ano && ano.length !== 4 ? ano : null;
}

function tempoDeCasa(admissao, hojeISO) {
  const [a1, m1, d1] = String(admissao).split("-").map(Number);
  const [a2, m2, d2] = String(hojeISO).split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 0) return "";
  if (meses < 1) return "menos de 1 mês de casa";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const pa = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const pm = resto ? `${resto} ${resto === 1 ? "mês" : "meses"}` : "";
  return `${[pa, pm].filter(Boolean).join(" e ")} de casa`;
}

// A frase do radar: vencido grita, 60 dias acende — é o prazo que a casa usa
// para agendar ASO e reciclagem sem correria.
function chipVenc(dias) {
  if (dias === null) return { texto: "sem data", chip: "chip" };
  if (dias < 0) {
    const d = -dias;
    return { texto: `venceu há ${d} ${d === 1 ? "dia" : "dias"}`, chip: "chip-bad" };
  }
  if (dias === 0) return { texto: "vence HOJE", chip: "chip-bad" };
  if (dias <= 60) return { texto: `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`, chip: "chip-warn" };
  return { texto: `em ${dias} dias`, chip: "chip" };
}

function LinhaPessoa({ p, hojeISO, editavel, aoAbrir }) {
  const desligada = p.ativo === false;
  const Comp = editavel ? "button" : "div";
  return (
    <Comp
      type={editavel ? "button" : undefined}
      onClick={editavel ? aoAbrir : undefined}
      className={clsx(
        "flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-3 text-left transition-colors",
        editavel && "hover:bg-slate-50",
        desligada && "opacity-60"
      )}
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {p.nome}
          {p.apelido && <span className="font-normal text-slate-400"> · {p.apelido}</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">{p.cargo || "cargo sem registro"}</span>
      </span>

      {desligada ? (
        <span className="shrink-0 text-right text-xs text-slate-500">
          desligado(a) em {p.desligadoEm ? dataLonga(p.desligadoEm) : "data sem registro"}
        </span>
      ) : (
        <>
          <span className="shrink-0 text-right text-xs text-slate-500">
            {p.admissao ? (
              <>
                <span className="block text-slate-700">{dataLonga(p.admissao)}</span>
                <span className="block">{tempoDeCasa(p.admissao, hojeISO)}</span>
              </>
            ) : (
              <span className="block">admissão sem registro</span>
            )}
          </span>
          <span className="shrink-0 basis-36 text-right text-xs text-slate-500">
            <span className="block text-slate-700">{p.telefone || "sem telefone"}</span>
            <span className="block tabular-nums">
              {p.salario ? moedaCheia(p.salario) : "salário sem registro"}
            </span>
          </span>
        </>
      )}
    </Comp>
  );
}

function FormPessoa({ form, setForm, salvando, aoSalvar, aoFechar, aoDesligar, aoReativar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const desligada = form.ativo === false;
  return (
    <Modal titulo={form.id ? "Ficha da pessoa" : "Nova pessoa"} aberto={!!form} aoFechar={aoFechar}>
      {desligada && (
        <p className="mb-3 text-sm text-slate-500">
          Desligado(a) em {form.desligadoEm ? dataLonga(form.desligadoEm) : "data sem registro"}.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="p-nome">Nome</label>
          <input id="p-nome" type="text" className="input" value={form.nome} onChange={setCampo("nome")} autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="p-apelido">Apelido</label>
            <input id="p-apelido" type="text" className="input" value={form.apelido} onChange={setCampo("apelido")} />
          </div>
          <div>
            <label className="label" htmlFor="p-cargo">Cargo</label>
            <input id="p-cargo" type="text" className="input" value={form.cargo} onChange={setCampo("cargo")} />
          </div>
          <div>
            <label className="label" htmlFor="p-admissao">Admissão</label>
            <input id="p-admissao" type="date" className="input" value={form.admissao} onChange={setCampo("admissao")} />
          </div>
          <div>
            <label className="label" htmlFor="p-telefone">Telefone</label>
            <input id="p-telefone" type="tel" className="input" placeholder="(31) 99999-0000" value={form.telefone} onChange={setCampo("telefone")} />
          </div>
          <div>
            <label className="label" htmlFor="p-salario">Salário (R$)</label>
            <input id="p-salario" type="text" inputMode="decimal" className="input" placeholder="vazio = sem registro" value={form.salario} onChange={setCampo("salario")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="p-obs">Observações</label>
          <textarea id="p-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {form.id && (desligada ? (
              <button type="button" className="btn-outline" onClick={aoReativar}>Reativar</button>
            ) : (
              <button type="button" className="btn-outline text-bad-700" onClick={aoDesligar}>Desligar</button>
            ))}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando || !form.nome.trim()}>
              {salvando ? "Gravando..." : "Gravar"}
            </button>
          </span>
        </div>
      </form>
    </Modal>
  );
}

function LinhaFerias({ lf, aberta, aoAlternar, editavel, acoes }) {
  const { p, periodos, situacao } = lf;
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
        {situacao.chip ? (
          <span className={clsx(situacao.chip, "whitespace-nowrap")}>{situacao.texto}</span>
        ) : (
          <span className="text-xs text-slate-400">{situacao.texto}</span>
        )}
      </button>

      {aberta && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: "var(--hairline)" }}>
          {periodos.length === 0 && (
            <p className="text-xs text-slate-400">Nenhum período lançado para {p.apelido || p.nome}.</p>
          )}
          {periodos.map((f) => {
            const st = STATUS_FERIAS[f.status] || STATUS_FERIAS.marcada;
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
                <span className={clsx("min-w-0 flex-1 basis-44 text-sm text-slate-700", f.status === "cancelada" && "line-through opacity-60")}>
                  {dataLonga(f.inicio)} → volta {dataCurta(f.retorno)}
                  <span className="text-slate-400"> · {f.dias} dias</span>
                  {f.obs && <span className="block truncate text-xs text-slate-400">{f.obs}</span>}
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

function FormFerias({ form, setForm, ativos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  // A leitura em tempo real: quem marca vê a conta antes de gravar.
  const anoI = anoRuim(form.inicio);
  const anoR = anoRuim(form.retorno);
  const dias = form.inicio && form.retorno && !anoI && !anoR ? diasEntre(form.inicio, form.retorno) : null;
  const diaSem = form.inicio && !anoI ? new Date(form.inicio + "T00:00:00").getDay() : null;
  const foraDoQuadro = form.pessoaId && !ativos.some((x) => x.id === form.pessoaId);

  return (
    <Modal titulo={form.id ? "Editar férias" : "Marcar férias"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
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

        {anoI && <p className="text-sm font-medium text-bad-700">Confira o ano da data de início: {anoI}</p>}
        {anoR && <p className="text-sm font-medium text-bad-700">Confira o ano da data de retorno: {anoR}</p>}
        {dias !== null && dias <= 0 && (
          <p className="text-sm font-medium text-bad-700">O retorno precisa ser depois do início — é o dia em que a pessoa volta.</p>
        )}
        {dias !== null && dias > 0 && (
          <p className="text-sm text-ok-700">
            {dias} {dias === 1 ? "dia" : "dias"} de férias, volta em {dataCurta(form.retorno)}.
          </p>
        )}
        {dias !== null && dias > 30 && <p className="text-sm text-warn-700">Mais de 30 dias — confira.</p>}
        {diaSem !== null && (diaSem === 0 || diaSem >= 4) && (
          <p className="text-sm text-warn-700">
            A CLT não permite começar férias nos 2 dias antes do descanso semanal (art. 134 §3).
          </p>
        )}

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
          <button type="submit" className="btn-primary" disabled={salvando || !form.pessoaId || !form.inicio || !form.retorno}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LinhaVenc({ v, editavel, aoEditar, aoApagar }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {v.tipo}
          {v.descricao && <span className="font-normal text-slate-500"> — {v.descricao}</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">{v.pessoaNome || "pessoa sem registro"}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={clsx(v.cv.chip, "whitespace-nowrap")}>{v.cv.texto}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
          {v.vence ? dataLonga(v.vence) : "sem data"}
        </span>
      </span>
      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={aoEditar}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={aoApagar}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
            title="Apagar"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

function FormVenc({ form, setForm, ativos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const foraDoQuadro = form.pessoaId && !ativos.some((x) => x.id === form.pessoaId);
  return (
    <Modal titulo={form.id ? "Editar vencimento" : "Novo vencimento"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="v-pessoa">Pessoa</label>
          <select id="v-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
            <option value="" disabled>— escolha —</option>
            {foraDoQuadro && <option value={form.pessoaId}>{form.pessoaNome || "—"} (fora do quadro)</option>}
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="v-tipo">Tipo</label>
            <select id="v-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
              {TIPOS_VENC.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="v-vence">Vence em</label>
            <input id="v-vence" type="date" className="input" value={form.vence} onChange={setCampo("vence")} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="v-desc">Descrição</label>
          <input id="v-desc" type="text" className="input" placeholder="ex.: reciclagem NR-35" value={form.descricao} onChange={setCampo("descricao")} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.pessoaId || !form.vence}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function RH() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [dados, setDados] = useState(null); // { pessoas, ferias, vencimentos }
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aba, setAba] = useState("pessoas");
  const [busca, setBusca] = useState("");
  const [verDesligados, setVerDesligados] = useState(false);
  const [expandida, setExpandida] = useState(null);
  const [filtroVenc, setFiltroVenc] = useState("");
  const [formPessoa, setFormPessoa] = useState(null);
  const [formFerias, setFormFerias] = useState(null);
  const [formVenc, setFormVenc] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // "Hoje" é ESTADO: a tela fica aberta de um dia para o outro e o dia
  // congelado mentia "de férias" para quem já tinha voltado.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.all([listar("rh_pessoas"), listar("rh_ferias"), listar("rh_vencimentos")])
      .then(([pessoas, ferias, vencimentos]) => {
        setDados({ pessoas, ferias, vencimentos });
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm
        // existe) — sem este aviso, a recarga que falha deixava a tela velha
        // em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
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
    const norm = (s) => String(s || "").toLowerCase();

    const ativos = dados.pessoas
      .filter((p) => p.ativo !== false)
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
    const desligados = dados.pessoas
      .filter((p) => p.ativo === false)
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    const q = norm(busca).trim();
    const visiveis = q
      ? ativos.filter((p) => norm(p.nome).includes(q) || norm(p.apelido).includes(q))
      : ativos;

    // Férias: uma linha por pessoa. Concluída/cancelada mandam — decisão
    // explícita não é atropelada pela data.
    const porPessoa = new Map();
    for (const f of dados.ferias) {
      if (!porPessoa.has(f.pessoaId)) porPessoa.set(f.pessoaId, []);
      porPessoa.get(f.pessoaId).push(f);
    }
    const linhasFerias = ativos.map((p) => {
      const periodos = (porPessoa.get(p.id) || [])
        .map((f) => ({ ...f, dias: f.inicio && f.retorno ? diasEntre(f.inicio, f.retorno) : null }))
        .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
      const emCurso = periodos.find(
        (f) => f.status === "marcada" && f.inicio && f.retorno && f.inicio <= hojeISO && hojeISO < f.retorno
      );
      const futuras = periodos.filter((f) => f.status === "marcada" && f.inicio > hojeISO);
      const proxima = futuras.length ? futuras[futuras.length - 1] : null;
      let situacao;
      if (emCurso) {
        situacao = { ordem: 0, quando: emCurso.retorno, chip: "chip-ok", texto: `de férias, volta ${dataCurta(emCurso.retorno)}` };
      } else if (proxima) {
        const n = diasEntre(hojeISO, proxima.inicio);
        situacao = { ordem: 1, quando: proxima.inicio, chip: "chip", texto: `começa em ${n} ${n === 1 ? "dia" : "dias"}` };
      } else {
        // Este sistema começou agora: ausência de registro não é dívida.
        situacao = { ordem: 2, quando: "", chip: "", texto: "sem férias marcadas" };
      }
      return { p, periodos, situacao };
    });
    linhasFerias.sort(
      (a, b) =>
        a.situacao.ordem - b.situacao.ordem ||
        String(a.situacao.quando).localeCompare(String(b.situacao.quando)) ||
        norm(a.p.nome).localeCompare(norm(b.p.nome))
    );

    const vencimentos = dados.vencimentos
      .map((v) => {
        const dias = v.vence ? diasEntre(hojeISO, v.vence) : null;
        return { ...v, dias, cv: chipVenc(dias) };
      })
      .sort((a, b) => String(a.vence).localeCompare(String(b.vence)));

    const pessoasComVenc = [];
    for (const v of vencimentos) {
      if (v.pessoaId && !pessoasComVenc.some((x) => x.id === v.pessoaId)) {
        pessoasComVenc.push({ id: v.pessoaId, nome: v.pessoaNome || "(sem nome)" });
      }
    }
    pessoasComVenc.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));

    return {
      ativos,
      desligados,
      visiveis,
      linhasFerias,
      vencimentos,
      pessoasComVenc,
      feriasAgora: linhasFerias.filter((l) => l.situacao.ordem === 0).length,
      venc60: vencimentos.filter((v) => v.dias !== null && v.dias <= 60).length,
      vencidos: vencimentos.filter((v) => v.dias !== null && v.dias < 0).length,
    };
  }, [dados, hojeISO, busca]);

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

  const abrirPessoa = (p) =>
    setFormPessoa(
      p
        ? {
            ...VAZIO_PESSOA,
            ...p,
            // Salário volta para o campo do jeito que se digita. Não usar
            // paraCampo aqui: ele devolve "" para 0, e salário zero REGISTRADO
            // não é a mesma coisa que salário sem registro.
            salario: p.salario == null || p.salario === "" ? "" : String(p.salario).replace(".", ","),
          }
        : { ...VAZIO_PESSOA }
    );
  const abrirFerias = (f, pessoaId) =>
    setFormFerias(f ? { ...VAZIO_FERIAS, ...f } : { ...VAZIO_FERIAS, pessoaId: pessoaId || "" });
  const abrirVenc = (v) => setFormVenc(v ? { ...VAZIO_VENC, ...v } : { ...VAZIO_VENC });

  const gravarPessoa = () => {
    const f = formPessoa;
    const ano = anoRuim(f.admissao);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da admissão: ${ano}` });
    const limpo = {
      ...f,
      nome: f.nome.trim(),
      apelido: f.apelido.trim(),
      cargo: f.cargo.trim(),
      telefone: f.telefone.trim(),
      obs: f.obs.trim(),
      // Vazio fica vazio: gravar 0 afirmaria "salário zero", e não é isso.
      salario: String(f.salario).trim() ? paraNumero(f.salario) : "",
    };
    gravarRegistro(
      "rh_pessoas", limpo,
      f.id ? "Ficha atualizada." : `${limpo.nome} entrou no quadro.`,
      () => setFormPessoa(null)
    );
  };

  // Desligar mexe no registro do servidor, não no rascunho do formulário —
  // edição não gravada não pega carona no desligamento.
  const desligarPessoa = () => {
    const p = dados.pessoas.find((x) => x.id === formPessoa?.id);
    if (!p) return;
    if (!window.confirm(`Desligar ${p.nome}? A ficha não é apagada — fica guardada em "Desligados".`)) return;
    gravarRegistro(
      "rh_pessoas", { ...p, ativo: false, desligadoEm: hojeISO },
      `${p.nome} saiu do quadro. A ficha está em "Desligados".`,
      () => setFormPessoa(null)
    );
  };

  const reativarPessoa = () => {
    const p = dados.pessoas.find((x) => x.id === formPessoa?.id);
    if (!p) return;
    if (!window.confirm(`Reativar ${p.nome} no quadro?`)) return;
    gravarRegistro(
      "rh_pessoas", { ...p, ativo: true, desligadoEm: "" },
      `${p.nome} voltou ao quadro.`,
      () => setFormPessoa(null)
    );
  };

  const gravarFerias = () => {
    const f = formFerias;
    const anoI = anoRuim(f.inicio);
    if (anoI) return setAviso({ tipo: "erro", texto: `Confira o ano da data de início: ${anoI}` });
    const anoR = anoRuim(f.retorno);
    if (anoR) return setAviso({ tipo: "erro", texto: `Confira o ano da data de retorno: ${anoR}` });
    if (diasEntre(f.inicio, f.retorno) <= 0) {
      return setAviso({ tipo: "erro", texto: "O retorno precisa ser depois do início — é o dia em que a pessoa volta." });
    }
    // Só dado cru vai ao banco; datas puras "AAAA-MM-DD" (meio-dia local
    // virava 15:00Z e a data andava a cada salvar).
    const { dias: _dias, ...cru } = f;
    const pessoa = vm.ativos.find((x) => x.id === cru.pessoaId);
    gravarRegistro(
      "rh_ferias",
      { ...cru, obs: (cru.obs || "").trim(), pessoaNome: pessoa?.nome || cru.pessoaNome || "" },
      f.id ? "Férias atualizadas." : "Férias marcadas.",
      () => setFormFerias(null)
    );
  };

  const cancelarFerias = (f) => {
    if (!window.confirm(`Cancelar as férias de ${f.pessoaNome || "esta pessoa"} com início em ${dataLonga(f.inicio)}?`)) return;
    const { dias: _dias, ...cru } = f;
    gravarRegistro("rh_ferias", { ...cru, status: "cancelada" }, "Período cancelado.");
  };

  const gravarVenc = () => {
    const f = formVenc;
    const ano = anoRuim(f.vence);
    if (ano) return setAviso({ tipo: "erro", texto: `Confira o ano da data de vencimento: ${ano}` });
    const { dias: _dias, cv: _cv, ...cru } = f;
    const pessoa = vm.ativos.find((x) => x.id === cru.pessoaId);
    gravarRegistro(
      "rh_vencimentos",
      { ...cru, descricao: (cru.descricao || "").trim(), pessoaNome: pessoa?.nome || cru.pessoaNome || "" },
      f.id ? "Vencimento atualizado." : "Vencimento anotado.",
      () => setFormVenc(null)
    );
  };

  const apagarVenc = async (v) => {
    if (!window.confirm(`Apagar ${v.tipo} de ${v.pessoaNome || "pessoa sem registro"}?`)) return;
    try {
      await apagar("rh_vencimentos", v.id);
      setAviso({ tipo: "ok", texto: "Vencimento apagado." });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    }
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const vencVisiveis = filtroVenc
    ? vm.vencimentos.filter((v) => v.pessoaId === filtroVenc)
    : vm.vencimentos;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="RH"
        descricao="O quadro da MinasLab: quem trabalha aqui, férias e o radar de ASO, NR e treinamento."
        acao={
          editavel &&
          (aba === "pessoas" ? (
            <button type="button" className="btn-primary" onClick={() => abrirPessoa(null)}>
              <Plus size={16} strokeWidth={2.5} /> Nova pessoa
            </button>
          ) : aba === "ferias" ? (
            <button type="button" className="btn-primary" onClick={() => abrirFerias(null)}>
              <Plus size={16} strokeWidth={2.5} /> Marcar férias
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => abrirVenc(null)}>
              <Plus size={16} strokeWidth={2.5} /> Novo vencimento
            </button>
          ))
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="No quadro"
          valor={String(vm.ativos.length)}
          tom="brand"
          icone={Users}
          onClick={() => {
            setAba("pessoas");
            setVerDesligados(false);
          }}
          ativo={aba === "pessoas" && !verDesligados}
        />
        <StatCard
          rotulo="Desligados"
          valor={String(vm.desligados.length)}
          tom="neutral"
          icone={UserMinus}
          onClick={() => {
            setAba("pessoas");
            setVerDesligados(true);
          }}
          ativo={aba === "pessoas" && verDesligados}
        />
        <StatCard
          rotulo="Férias agora"
          valor={String(vm.feriasAgora)}
          tom={vm.feriasAgora > 0 ? "ok" : "neutral"}
          icone={Sun}
          onClick={() => setAba("ferias")}
          ativo={aba === "ferias"}
        />
        <StatCard
          rotulo="Vencimentos em 60 dias"
          valor={String(vm.venc60)}
          tom={vm.vencidos > 0 ? "bad" : vm.venc60 > 0 ? "warn" : "ok"}
          sub={vm.vencidos > 0 ? `${vm.vencidos} já ${vm.vencidos === 1 ? "venceu" : "venceram"}` : undefined}
          icone={CalendarClock}
          onClick={() => setAba("vencimentos")}
          ativo={aba === "vencimentos"}
        />
      </div>

      <div className="mb-4">
        <Segmented
          opcoes={[
            { valor: "pessoas", rotulo: "Pessoas" },
            { valor: "ferias", rotulo: "Férias" },
            { valor: "vencimentos", rotulo: "Vencimentos" },
          ]}
          valor={aba}
          onChange={setAba}
        />
      </div>

      {aba === "pessoas" && (
        <Card>
          <SectionTitle
            titulo="Quadro"
            sub={`${vm.ativos.length} ${vm.ativos.length === 1 ? "pessoa ativa" : "pessoas ativas"}`}
            acao={
              <>
                <label className="sr-only" htmlFor="rh-busca">Buscar por nome</label>
                <input
                  id="rh-busca"
                  type="search"
                  className="input h-9 w-56"
                  placeholder="Buscar por nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </>
            }
          />
          {vm.visiveis.length === 0 && (
            <Empty>
              {vm.ativos.length === 0
                ? "Ninguém no quadro ainda. Cadastre a primeira pessoa no botão lá em cima."
                : "Ninguém no quadro com esse nome."}
            </Empty>
          )}
          <div className="space-y-2">
            {vm.visiveis.map((p) => (
              <LinhaPessoa key={p.id} p={p} hojeISO={hojeISO} editavel={editavel} aoAbrir={() => abrirPessoa(p)} />
            ))}
          </div>

          {vm.desligados.length > 0 && (
            <button
              type="button"
              className="mt-4 text-sm font-medium text-slate-500 underline hover:text-slate-700"
              onClick={() => setVerDesligados(!verDesligados)}
            >
              {verDesligados ? "Ocultar desligados" : `Ver desligados (${vm.desligados.length})`}
            </button>
          )}
          {verDesligados && vm.desligados.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">Nenhum desligamento registrado.</p>
          )}
          {verDesligados && vm.desligados.length > 0 && (
            <div className="mt-3 space-y-2">
              {vm.desligados.map((p) => (
                <LinhaPessoa key={p.id} p={p} hojeISO={hojeISO} editavel={editavel} aoAbrir={() => abrirPessoa(p)} />
              ))}
            </div>
          )}
        </Card>
      )}

      {aba === "ferias" && (
        <Card>
          <SectionTitle
            titulo="Férias por pessoa"
            sub="Quem está fora agora vem primeiro. Clique na linha para ver o histórico."
          />
          {vm.linhasFerias.length === 0 && (
            <Empty>Ninguém no quadro ainda — as férias moram na ficha de cada pessoa.</Empty>
          )}
          <div className="space-y-2">
            {vm.linhasFerias.map((lf) => (
              <LinhaFerias
                key={lf.p.id}
                lf={lf}
                aberta={expandida === lf.p.id}
                aoAlternar={() => setExpandida(expandida === lf.p.id ? null : lf.p.id)}
                editavel={editavel}
                acoes={{
                  editar: (f) => abrirFerias(f),
                  cancelar: cancelarFerias,
                  marcar: (pessoaId) => abrirFerias(null, pessoaId),
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {aba === "vencimentos" && (
        <Card>
          <SectionTitle
            titulo="Radar de vencimentos"
            sub="ASO, NRs, treinamentos e CNH — o alerta acende a 60 dias."
            acao={
              <>
                <label className="sr-only" htmlFor="rh-filtro-venc">Filtrar por pessoa</label>
                <select
                  id="rh-filtro-venc"
                  className="select h-9 w-56"
                  value={filtroVenc}
                  onChange={(e) => setFiltroVenc(e.target.value)}
                >
                  <option value="">Todas as pessoas</option>
                  {vm.pessoasComVenc.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </>
            }
          />
          {vencVisiveis.length === 0 && (
            <Empty>
              {filtroVenc
                ? "Nada anotado para esta pessoa."
                : "Nenhum vencimento anotado. Anote o primeiro no botão lá em cima."}
            </Empty>
          )}
          <div className="space-y-2">
            {vencVisiveis.map((v) => (
              <LinhaVenc key={v.id} v={v} editavel={editavel} aoEditar={() => abrirVenc(v)} aoApagar={() => apagarVenc(v)} />
            ))}
          </div>
        </Card>
      )}

      <FormPessoa
        form={formPessoa}
        setForm={setFormPessoa}
        salvando={salvando}
        aoSalvar={gravarPessoa}
        aoFechar={() => setFormPessoa(null)}
        aoDesligar={desligarPessoa}
        aoReativar={reativarPessoa}
      />
      <FormFerias
        form={formFerias}
        setForm={setFormFerias}
        ativos={vm.ativos}
        salvando={salvando}
        aoSalvar={gravarFerias}
        aoFechar={() => setFormFerias(null)}
      />
      <FormVenc
        form={formVenc}
        setForm={setFormVenc}
        ativos={vm.ativos}
        salvando={salvando}
        aoSalvar={gravarVenc}
        aoFechar={() => setFormVenc(null)}
      />
    </div>
  );
}
