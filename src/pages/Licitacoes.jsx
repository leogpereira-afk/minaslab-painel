// Licitações — o funil de editais da MinasLab: do estudo do edital ao
// desfecho. A tela abre pelo que está EM ANDAMENTO, ordenado pela data da
// sessão — é a sessão que manda no dia de quem cuida disso. Sessão que passou
// sem desfecho aparece em vermelho: não é história, é pendência de atualizar.
//
// Estrutura copiada do exemplar (Compromissos.jsx): linha e formulário FORA do
// componente da página, "hoje" como estado, aviso de resultado, recarrega do
// servidor depois de gravar.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Gavel, CalendarClock, Trophy, Percent,
  ChevronDown, ChevronUp, Download,
} from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import {
  dataCurta, diasEntre, ymdLocal, diaLocalISO, moeda, paraNumero,
} from "../lib/format.js";
import { baixarPlanilha } from "../lib/planilha.js";
import {
  PageTitle, StatCard, Empty, CarregandoModulo, ErroModulo, Aviso, Modal, Card,
} from "../components/ui.jsx";

const COLECAO = "licitacoes";
const K_ENCERRADAS = "ml_licitacoes_encerradas";

const MODALIDADES = {
  pregao: "Pregão eletrônico",
  concorrencia: "Concorrência",
  dispensa: "Dispensa",
  credenciamento: "Credenciamento",
  outra: "Outra",
};

const STATUS_ROTULOS = {
  estudando: "Estudando o edital",
  proposta_enviada: "Proposta enviada",
  em_sessao: "Em sessão/disputa",
  ganha: "Ganha",
  perdida: "Perdida",
  nao_participamos: "Não participamos",
};

const EM_ANDAMENTO = ["estudando", "proposta_enviada", "em_sessao"];

// valorEstimado/valorProposta ficam como TEXTO no form e viram
// número só na hora de gravar (paraNumero) — campo de dinheiro editado como
// número perde o que a pessoa está digitando.
const VAZIO = {
  id: "", orgao: "", edital: "", modalidade: "pregao", objeto: "", portal: "",
  dataSessao: "", horaSessao: "", valorEstimado: "", valorProposta: "",
  status: "estudando", resultado: "", obs: "",
};

// A frase do prazo da sessão. "sessão passou" em chip-bad: continuar em
// andamento depois da sessão significa que ninguém registrou o desfecho.
function prazoSessao(dias) {
  if (dias === null) return { texto: "sem data de sessão", chip: "chip", peso: 5000 };
  if (dias < 0) return { texto: "sessão passou", chip: "chip-bad", peso: -1000 + dias };
  if (dias === 0) return { texto: "HOJE", chip: "chip-bad", peso: 0 };
  if (dias === 1) return { texto: "amanhã", chip: "chip-warn", peso: 1 };
  if (dias <= 7) return { texto: `em ${dias} dias`, chip: "chip-warn", peso: dias };
  return { texto: `em ${dias} dias`, chip: "chip", peso: dias };
}

const chipDesfecho = (status) =>
  status === "ganha" ? "chip-ok" : status === "perdida" ? "chip-bad" : "chip";

// Colunas da planilha: a ordem aqui é a ordem no arquivo. Os dois valores vão
// como NÚMERO (tipo "dinheiro") — coluna de "R$ 79.500,00" em texto não soma,
// e somar é a primeira coisa que se faz com o arquivo baixado.
const COLUNAS_PLANILHA = [
  { chave: "orgao", rotulo: "Órgão" },
  { chave: "edital", rotulo: "Edital" },
  { chave: "modalidade", rotulo: "Modalidade" },
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "portal", rotulo: "Portal" },
  { chave: "dataSessao", rotulo: "Data da sessão", tipo: "data" },
  { chave: "valorEstimado", rotulo: "Valor estimado", tipo: "dinheiro" },
  { chave: "valorProposta", rotulo: "Valor da proposta", tipo: "dinheiro" },
  { chave: "situacao", rotulo: "Situação" },
  { chave: "resultado", rotulo: "Resultado" },
];

// A linha vai para a planilha com os rótulos já resolvidos: quem abre o
// arquivo lê "Pregão eletrônico", não "pregao". Os campos que a tela calcula
// (dias, pz) ficam de fora — são conta do render, não dado.
const paraPlanilha = (l) => ({
  orgao: l.orgao,
  edital: l.edital,
  modalidade: MODALIDADES[l.modalidade] || MODALIDADES.outra,
  objeto: l.objeto,
  portal: l.portal,
  dataSessao: l.dataSessao,
  valorEstimado: l.valorEstimado,
  valorProposta: l.valorProposta,
  situacao: STATUS_ROTULOS[l.status] || l.status,
  resultado: l.resultado,
});

function LinhaAndamento({ l, editavel, mudando, setMudando, acoes }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors"
      style={{ borderColor: "var(--hairline)" }}
    >
      <Gavel size={17} strokeWidth={2.2} className="shrink-0 text-brand-600" />

      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {l.orgao}
          {l.edital ? <span className="text-slate-500"> · {l.edital}</span> : null}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[MODALIDADES[l.modalidade] || MODALIDADES.outra, l.portal, l.objeto]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className={`${l.pz.chip} whitespace-nowrap`}>{l.pz.texto}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
          {l.dataSessao
            ? `${dataCurta(l.dataSessao)}${l.horaSessao ? ` às ${l.horaSessao}` : ""}`
            : "sem data"}
        </span>
      </span>

      <span className="w-24 shrink-0 text-right">
        {l.valorEstimado ? (
          <span className="text-sm font-medium tabular-nums text-slate-700">{moeda(l.valorEstimado)}</span>
        ) : (
          <span className="text-xs text-slate-400">sem estimado</span>
        )}
      </span>

      <span className="shrink-0 text-right">
        {mudando === l.id ? (
          /* Seletor no LUGAR do chip: escolher já grava, sem abrir formulário
             e sem perder o lugar na lista (mesmo desenho do remarcar do
             exemplar). */
          <select
            autoFocus
            className="select h-8 w-44 py-0 text-xs"
            value={l.status}
            onChange={(e) => {
              const v = e.target.value;
              setMudando(null);
              if (v !== l.status) acoes.mudarStatus(l, v);
            }}
            onBlur={() => setMudando(null)}
          >
            {Object.entries(STATUS_ROTULOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => editavel && setMudando(l.id)}
            disabled={!editavel}
            title={editavel ? "Mudar status" : undefined}
            className="chip whitespace-nowrap transition-opacity hover:opacity-75 disabled:cursor-default"
          >
            {STATUS_ROTULOS[l.status] || l.status}
          </button>
        )}
      </span>

      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => acoes.abrirForm(l)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => acoes.remover(l)}
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

function LinhaEncerrada({ l, editavel, acoes }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 opacity-80"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className={`${chipDesfecho(l.status)} shrink-0 whitespace-nowrap`}>
        {STATUS_ROTULOS[l.status] || l.status}
      </span>

      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {l.orgao}
          {l.edital ? <span className="text-slate-500"> · {l.edital}</span> : null}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[MODALIDADES[l.modalidade] || MODALIDADES.outra, l.objeto, l.resultado]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      <span className="shrink-0 text-right">
        {l.valorProposta ? (
          <span className="block text-sm font-medium tabular-nums text-slate-700">{moeda(l.valorProposta)}</span>
        ) : null}
        <span className="block text-xs tabular-nums text-slate-500">
          {l.dataSessao ? dataCurta(l.dataSessao) : "sem data"}
        </span>
      </span>

      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => acoes.abrirForm(l)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => acoes.remover(l)}
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

function FormLicitacao({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <Modal titulo={form.id ? "Editar licitação" : "Nova licitação"} aberto={!!form} aoFechar={aoFechar} largura="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="l-orgao">Órgão</label>
            <input id="l-orgao" type="text" className="input" value={form.orgao} onChange={setCampo("orgao")} autoFocus required />
          </div>
          <div>
            <label className="label" htmlFor="l-edital">Edital</label>
            <input id="l-edital" type="text" className="input" placeholder="PE 012/2026" value={form.edital} onChange={setCampo("edital")} />
          </div>
          <div>
            <label className="label" htmlFor="l-modalidade">Modalidade</label>
            <select id="l-modalidade" className="select" value={form.modalidade} onChange={setCampo("modalidade")}>
              {Object.entries(MODALIDADES).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="l-portal">Portal</label>
            <input id="l-portal" type="text" className="input" placeholder="Compras.gov, Licitar Digital..." value={form.portal} onChange={setCampo("portal")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="l-objeto">Objeto</label>
          <textarea id="l-objeto" className="input" rows={2} value={form.objeto} onChange={setCampo("objeto")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="l-data">Data da sessão</label>
            <input id="l-data" type="date" className="input" value={form.dataSessao} onChange={setCampo("dataSessao")} />
          </div>
          <div>
            <label className="label" htmlFor="l-hora">Hora da sessão</label>
            <input id="l-hora" type="time" className="input" value={form.horaSessao} onChange={setCampo("horaSessao")} />
          </div>
          <div>
            <label className="label" htmlFor="l-estimado">Valor estimado (R$)</label>
            <input id="l-estimado" type="text" inputMode="decimal" className="input" placeholder="85.000,00" value={form.valorEstimado} onChange={setCampo("valorEstimado")} />
          </div>
          <div>
            <label className="label" htmlFor="l-proposta">Valor da proposta (R$)</label>
            <input id="l-proposta" type="text" inputMode="decimal" className="input" placeholder="79.500,00" value={form.valorProposta} onChange={setCampo("valorProposta")} />
          </div>
          <div>
            <label className="label" htmlFor="l-status">Status</label>
            <select id="l-status" className="select" value={form.status} onChange={setCampo("status")}>
              {Object.entries(STATUS_ROTULOS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="l-resultado">Resultado (obs do desfecho)</label>
            <input id="l-resultado" type="text" className="input" placeholder="Ganhamos por R$ 79.500 / perdemos no lance final..." value={form.resultado} onChange={setCampo("resultado")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="l-obs">Observações</label>
          <textarea id="l-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.orgao.trim()}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Licitacoes() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mudando, setMudando] = useState(null);
  // O cartão "Sessão em 7 dias" vira recorte: clicar filtra, clicar de novo volta.
  const [recorte, setRecorte] = useState(null); // "sessao7" | null
  // Encerradas recolhidas por padrão; a escolha da pessoa fica no navegador.
  const [verEncerradas, setVerEncerradas] = useState(() => {
    try {
      return localStorage.getItem(K_ENCERRADAS) === "1";
    } catch {
      return false;
    }
  });
  // "Hoje" é ESTADO, não conta do render: a tela fica aberta de um dia para o
  // outro e o dia congelado mentia o prazo da sessão.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const alternarEncerradas = (v) => {
    setVerEncerradas(v);
    try {
      localStorage.setItem(K_ENCERRADAS, v ? "1" : "0");
    } catch {
        /* sem localStorage a escolha só não persiste */
      }
  };

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    listar(COLECAO)
      .then((lista) => {
        setItens(lista);
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
    if (!itens) return null;
    const todos = itens.map((l) => {
      const dias = l.dataSessao ? diasEntre(hojeISO, l.dataSessao) : null;
      return { ...l, dias, pz: prazoSessao(dias) };
    });

    // A sessão mais próxima primeiro (passadas antes: são pendência); sem data
    // vai para o fim. Empate de dia decide pela hora da sessão.
    const horaDe = (l) => String(l.horaSessao || "99:99");
    const andamento = todos
      .filter((l) => EM_ANDAMENTO.includes(l.status))
      .sort(
        (a, b) =>
          a.pz.peso - b.pz.peso ||
          horaDe(a).localeCompare(horaDe(b)) ||
          String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
      );

    const quando = (l) => l.dataSessao || diaLocalISO(l.criadoEm || "") || "";
    const encerradas = todos
      .filter((l) => !EM_ANDAMENTO.includes(l.status))
      .sort((a, b) => quando(b).localeCompare(quando(a)));

    const anoAtual = hojeISO.slice(0, 4);
    const ganhas = todos.filter((l) => l.status === "ganha").length;
    const perdidas = todos.filter((l) => l.status === "perdida").length;

    return {
      andamento,
      encerradas,
      sessao7: andamento.filter((l) => l.dias !== null && l.dias >= 0 && l.dias <= 7).length,
      ganhasNoAno: todos.filter((l) => l.status === "ganha" && quando(l).slice(0, 4) === anoAtual).length,
      disputadas: ganhas + perdidas,
      // Taxa só existe quando houve disputa decidida — sem denominador, o
      // certo é "sem registro", não 0% (dado ausente não é zero).
      taxa: ganhas + perdidas > 0 ? `${Math.round((100 * ganhas) / (ganhas + perdidas))}%` : null,
    };
  }, [itens, hojeISO]);

  const gravar = async (dados, fraseOk) => {
    setSalvando(true);
    try {
      // Os campos derivados do render (dias, prazo) NÃO vão para o banco —
      // são conta da tela, e gravá-los criaria uma segunda verdade que envelhece.
      const { dias: _dias, pz: _pz, ...limpo } = dados;
      await salvar(COLECAO, limpo);
      setForm(null);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const acoes = {
    // Editar traz os valores de dinheiro como TEXTO pt-BR, do jeito que a
    // pessoa digita; gravar converte de volta (paraNumero). Não usar paraCampo
    // aqui: ele devolve "" para 0, e valor zero REGISTRADO não é a mesma
    // coisa que valor sem registro.
    abrirForm: (l) =>
      setForm(
        l
          ? {
              ...VAZIO,
              ...l,
              valorEstimado:
                l.valorEstimado == null || l.valorEstimado === "" ? "" : String(l.valorEstimado).replace(".", ","),
              valorProposta:
                l.valorProposta == null || l.valorProposta === "" ? "" : String(l.valorProposta).replace(".", ","),
            }
          : { ...VAZIO }
      ),
    mudarStatus: (l, novo) =>
      gravar({ ...l, status: novo }, `Status atualizado: ${STATUS_ROTULOS[novo]}.`),
    remover: async (l) => {
      if (!window.confirm(`Apagar a licitação "${l.orgao}${l.edital ? ` · ${l.edital}` : ""}"?`)) return;
      try {
        await apagar(COLECAO, l.id);
        setAviso({ tipo: "ok", texto: "Licitação apagada." });
        recarregar();
      } catch (e) {
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
  };

  const salvarDoForm = () =>
    gravar(
      {
        ...form,
        // Campo vazio grava null, não 0: "não informamos o valor" é diferente
        // de "o valor é zero".
        valorEstimado: String(form.valorEstimado ?? "").trim() ? paraNumero(form.valorEstimado) : null,
        valorProposta: String(form.valorProposta ?? "").trim() ? paraNumero(form.valorProposta) : null,
      },
      form.id ? "Licitação atualizada." : "Licitação criada."
    );

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const andamentoVisiveis =
    recorte === "sessao7"
      ? vm.andamento.filter((l) => l.dias !== null && l.dias >= 0 && l.dias <= 7)
      : vm.andamento;

  // A planilha leva EXATAMENTE o que está na tela: o recorte de sessão em 7
  // dias vale, e as encerradas só entram se estiverem abertas. Se exportasse
  // tudo, o total do arquivo divergiria do total dos cartões e a conversa
  // passaria a ser sobre qual dos dois números está certo.
  const baixar = () => {
    const visiveis = [...andamentoVisiveis, ...(verEncerradas ? vm.encerradas : [])];
    if (visiveis.length === 0) {
      setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
      return;
    }
    try {
      const arquivo = baixarPlanilha({
        nome: "licitacoes",
        titulo: `Licitações — ${recorte === "sessao7" ? "sessão em 7 dias" : "em andamento"}${
          verEncerradas ? " e encerradas" : ""
        }`,
        colunas: COLUNAS_PLANILHA,
        linhas: visiveis.map(paraPlanilha),
      });
      setAviso({
        tipo: "ok",
        texto: `Planilha baixada: ${arquivo} (${visiveis.length} ${visiveis.length === 1 ? "linha" : "linhas"}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Licitações"
        descricao="Do estudo do edital ao desfecho — a tela abre pela sessão mais próxima."
        acao={
          /* Baixar não é escrita: quem só consulta também precisa da planilha. */
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline" onClick={baixar}>
              <Download size={16} strokeWidth={2.5} /> Baixar planilha
            </button>
            {editavel && (
              <button type="button" className="btn-primary" onClick={() => acoes.abrirForm(null)}>
                <Plus size={16} strokeWidth={2.5} /> Nova licitação
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Em andamento"
          valor={String(vm.andamento.length)}
          tom="brand"
          icone={Gavel}
        />
        <StatCard
          rotulo="Sessão em 7 dias"
          valor={String(vm.sessao7)}
          tom={vm.sessao7 > 0 ? "warn" : "neutral"}
          icone={CalendarClock}
          onClick={() => setRecorte(recorte === "sessao7" ? null : "sessao7")}
          ativo={recorte === "sessao7"}
        />
        <StatCard
          rotulo="Ganhas no ano"
          valor={String(vm.ganhasNoAno)}
          tom="ok"
          icone={Trophy}
          onClick={() => alternarEncerradas(!verEncerradas)}
          ativo={verEncerradas}
        />
        <StatCard
          rotulo="Taxa de êxito"
          valor={vm.taxa ?? "sem registro"}
          sub={vm.taxa ? `${vm.disputadas} ${vm.disputadas === 1 ? "disputa decidida" : "disputas decididas"}` : "nenhuma disputa decidida ainda"}
          tom={vm.taxa ? "ok" : "neutral"}
          icone={Percent}
        />
      </div>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Em andamento <span className="text-slate-400">({andamentoVisiveis.length})</span>
          </h2>
          {andamentoVisiveis.length === 0 ? (
            <Empty>
              {recorte === "sessao7"
                ? "Nenhuma sessão nos próximos 7 dias. Clique de novo no cartão para ver tudo."
                : "Nenhuma licitação em andamento. Crie a primeira no botão lá em cima."}
            </Empty>
          ) : (
            <div className="space-y-2">
              {andamentoVisiveis.map((l) => (
                <LinhaAndamento
                  key={l.id}
                  l={l}
                  editavel={editavel}
                  mudando={mudando}
                  setMudando={setMudando}
                  acoes={acoes}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              Encerradas <span className="text-slate-400">({vm.encerradas.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => alternarEncerradas(!verEncerradas)}
              className="flex items-center gap-1 font-display text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              {verEncerradas ? (
                <>esconder <ChevronUp size={14} /></>
              ) : (
                <>mostrar <ChevronDown size={14} /></>
              )}
            </button>
          </div>
          {verEncerradas &&
            (vm.encerradas.length === 0 ? (
              <Empty>Nenhuma licitação encerrada ainda.</Empty>
            ) : (
              <div className="space-y-2">
                {vm.encerradas.map((l) => (
                  <LinhaEncerrada key={l.id} l={l} editavel={editavel} acoes={acoes} />
                ))}
              </div>
            ))}
        </Card>
      </div>

      <FormLicitacao
        form={form}
        setForm={setForm}
        salvando={salvando}
        aoSalvar={salvarDoForm}
        aoFechar={() => setForm(null)}
      />
    </div>
  );
}
