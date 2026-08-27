// Marketing — as ações de divulgação da MinasLab: post, feira, material,
// anúncio. A tela abre pelo que está NO AR (é o que gasta dinheiro agora),
// depois o planejado, depois as ideias; o encerrado fica recolhido.
//
// Segue o exemplar (Compromissos.jsx): linha e formulário FORA do componente
// da página; datas ymdLocal; aviso de resultado no sucesso E no erro; depois
// de gravar, recarrega do servidor — conferir o efeito, não a ausência de erro.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Pencil, Instagram, Globe, Search, Tent, FileText, CircleDot,
  Megaphone, Lightbulb, CalendarClock, Wallet, ChevronDown, ChevronRight, Download,
} from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { dataCurta, moeda, paraNumero, ymdLocal } from "../lib/format.js";
import { baixarPlanilha } from "../lib/planilha.js";
import {
  PageTitle, StatCard, Empty, CarregandoModulo, ErroModulo, Aviso, Modal, Card,
} from "../components/ui.jsx";

const COLECAO = "mkt";

// Cada canal tem ícone próprio: numa lista comprida, o ícone diz onde a ação
// roda antes de a pessoa ler o título.
const CANAIS = {
  instagram: { rotulo: "Instagram", icone: Instagram, cor: "text-brand-600" },
  site: { rotulo: "Site", icone: Globe, cor: "text-brand-600" },
  google: { rotulo: "Google", icone: Search, cor: "text-warn-700" },
  feira_evento: { rotulo: "Feira/Evento", icone: Tent, cor: "text-ok-700" },
  material: { rotulo: "Material impresso", icone: FileText, cor: "text-slate-600" },
  outro: { rotulo: "Outro", icone: CircleDot, cor: "text-slate-500" },
};

// A ordem dos grupos é a ordem de atenção: o que está gastando agora primeiro.
const STATUS = {
  no_ar: { rotulo: "No ar", grupo: "No ar", chip: "chip-ok" },
  planejada: { rotulo: "Planejada", grupo: "Planejadas", chip: "chip-brand" },
  ideia: { rotulo: "Ideia", grupo: "Ideias", chip: "chip" },
  encerrada: { rotulo: "Encerrada", grupo: "Encerradas", chip: "chip" },
};
const ORDEM_STATUS = ["no_ar", "planejada", "ideia", "encerrada"];

// No formulário o custo é TEXTO do jeito que a pessoa digita;
// só vira número na hora de gravar (paraNumero).
const VAZIO = {
  id: "", titulo: "", canal: "instagram", data: "", custo: "",
  status: "ideia", resultado: "", obs: "",
};

// Escolha persistida: quem abriu as encerradas ontem quer vê-las hoje.
const K_ENCERRADAS = "ml_mkt_encerradas";

// Custo em branco não é custo zero: só conta (e só aparece) quando há número.
const temCusto = (m) => m.custo !== "" && m.custo !== null && m.custo !== undefined;

// Colunas da planilha, na ordem do arquivo. O custo vai como NÚMERO (tipo
// "dinheiro"): coluna de "R$ 1.500,00" em texto não soma, e a primeira coisa
// que se faz com a planilha de marketing é somar o investido.
const COLUNAS_PLANILHA = [
  { chave: "titulo", rotulo: "Título" },
  { chave: "canal", rotulo: "Canal" },
  { chave: "data", rotulo: "Data", tipo: "data" },
  { chave: "custo", rotulo: "Custo", tipo: "dinheiro" },
  { chave: "status", rotulo: "Status" },
  { chave: "resultado", rotulo: "O que rendeu" },
];

// Canal e status vão com o rótulo resolvido — quem abre o arquivo lê
// "Feira/Evento", não "feira_evento". Os campos que a tela monta (cn, st)
// ficam de fora: são conta do render.
const paraPlanilha = (m) => ({
  titulo: m.titulo,
  canal: m.cn.rotulo,
  data: m.data,
  // Sem custo registrado a célula fica VAZIA, nunca R$ 0 — "não anotamos
  // quanto custou" é diferente de "custou zero".
  custo: temCusto(m) ? m.custo : null,
  status: m.st.rotulo,
  resultado: m.resultado,
});

function Linha({ m, editavel, mudandoStatus, setMudandoStatus, acoes }) {
  const Icone = m.cn.icone;
  const encerrada = m.status === "encerrada";
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors ${encerrada ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--hairline)" }}
    >
      <Icone size={17} strokeWidth={2.2} className={`shrink-0 ${m.cn.cor}`} title={m.cn.rotulo} />

      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {m.titulo}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[
            m.cn.rotulo,
            m.data ? dataCurta(m.data) : null,
            temCusto(m) ? moeda(m.custo) : null,
            m.resultado,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      <span className="shrink-0">
        {mudandoStatus === m.id ? (
          /* Seletor no LUGAR da etiqueta: escolher já muda o status, sem
             formulário e sem perder o lugar na lista (padrão do remarcar). */
          <select
            autoFocus
            className="input h-8 w-32 py-0 text-xs"
            value={m.status}
            onChange={(e) => {
              setMudandoStatus(null);
              if (e.target.value !== m.status) acoes.mudarStatus(m, e.target.value);
            }}
            onBlur={() => setMudandoStatus(null)}
          >
            {ORDEM_STATUS.map((s) => (
              <option key={s} value={s}>{STATUS[s].rotulo}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => editavel && setMudandoStatus(m.id)}
            disabled={!editavel}
            title={editavel ? "Mudar status" : undefined}
            className={`${m.st.chip} whitespace-nowrap transition-opacity hover:opacity-75 disabled:cursor-default`}
          >
            {m.st.rotulo}
          </button>
        )}
      </span>

      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => acoes.abrirForm(m)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => acoes.remover(m)}
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

function FormAcao({ form, setForm, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <Modal titulo={form.id ? "Editar ação" : "Nova ação"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="m-titulo">O que é</label>
          <input id="m-titulo" type="text" className="input" value={form.titulo} onChange={setCampo("titulo")} autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-canal">Canal</label>
            <select id="m-canal" className="select" value={form.canal} onChange={setCampo("canal")}>
              {Object.entries(CANAIS).map(([valor, c]) => (
                <option key={valor} value={valor}>{c.rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-status">Status</label>
            <select id="m-status" className="select" value={form.status} onChange={setCampo("status")}>
              {ORDEM_STATUS.map((s) => (
                <option key={s} value={s}>{STATUS[s].rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-data">Data</label>
            <input id="m-data" type="date" className="input" value={form.data} onChange={setCampo("data")} />
          </div>
          <div>
            <label className="label" htmlFor="m-custo">Custo (R$)</label>
            <input
              id="m-custo"
              type="text"
              inputMode="decimal"
              className="input"
              placeholder="1.500,00"
              value={form.custo}
              onChange={setCampo("custo")}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="m-resultado">O que rendeu</label>
          <textarea id="m-resultado" className="input" rows={2} value={form.resultado} onChange={setCampo("resultado")} />
        </div>
        <div>
          <label className="label" htmlFor="m-obs">Observações</label>
          <textarea id="m-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.titulo.trim()}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Marketing() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(null);
  // Os cartões viram recorte: clicar filtra a lista; clicar de novo volta.
  const [recorte, setRecorte] = useState(null); // "no_ar" | "planejada" | "ideia" | null
  const [verEncerradas, setVerEncerradas] = useState(() => {
    try {
      return localStorage.getItem(K_ENCERRADAS) === "1";
    } catch {
      return false;
    }
  });
  // "Hoje" é ESTADO, não conta do render: a tela fica aberta de um dia para o
  // outro e o ano do "Investido no ano" tem que virar junto com o calendário.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

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

  const alternarEncerradas = () =>
    setVerEncerradas((v) => {
      const novo = !v;
      try {
        localStorage.setItem(K_ENCERRADAS, novo ? "1" : "0");
      } catch {
        /* sem localStorage a escolha só não persiste */
      }
      return novo;
    });

  const vm = useMemo(() => {
    if (!itens) return null;
    const todos = itens.map((m) => ({
      ...m,
      cn: CANAIS[m.canal] || CANAIS.outro,
      st: STATUS[m.status] || STATUS.ideia,
    }));

    // Dentro do grupo, a data manda (a mais próxima primeiro); sem data vai
    // para o fim, e o desempate é a ordem de criação.
    const ordenar = (a, b) =>
      String(a.data || "9999-99-99").localeCompare(String(b.data || "9999-99-99")) ||
      String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""));

    const grupos = ORDEM_STATUS.map((s) => ({
      status: s,
      nome: STATUS[s].grupo,
      itens: todos.filter((m) => (STATUS[m.status] ? m.status : "ideia") === s).sort(ordenar),
    })).filter((g) => g.itens.length > 0);

    // Investido no ano: só o que saiu da ideia e tem data no ano corrente.
    // Sem nenhum custo registrado, a resposta é "sem registro" — não R$ 0.
    const anoAtual = hojeISO.slice(0, 4);
    const comCusto = todos.filter(
      (m) => m.status !== "ideia" && temCusto(m) && String(m.data || "").slice(0, 4) === anoAtual
    );
    const investidoAno = comCusto.reduce((soma, m) => soma + (Number(m.custo) || 0), 0);

    return {
      grupos,
      noAr: todos.filter((m) => m.status === "no_ar").length,
      planejadas: todos.filter((m) => m.status === "planejada").length,
      ideias: todos.filter((m) => m.status === "ideia").length,
      investidoAno: comCusto.length > 0 ? moeda(investidoAno) : "sem registro",
      anoAtual,
    };
  }, [itens, hojeISO]);

  const gravar = async (dados, fraseOk) => {
    setSalvando(true);
    try {
      // Os campos resolvidos pela tela (canal e status expandidos) NÃO vão
      // para o banco — só dado cru; e o custo volta a ser número.
      const { cn: _cn, st: _st, ...limpo } = dados;
      limpo.custo = String(limpo.custo ?? "").trim() ? paraNumero(limpo.custo) : "";
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
    abrirForm: (m) =>
      setForm(
        m
          ? {
              ...VAZIO,
              ...m,
              // Custo volta para o campo do jeito que se digita. Não usar
              // paraCampo aqui: ele devolve "" para 0, e custo zero REGISTRADO
              // não é a mesma coisa que custo sem registro.
              custo: m.custo == null || m.custo === "" ? "" : String(m.custo).replace(".", ","),
            }
          : { ...VAZIO }
      ),
    mudarStatus: (m, novoStatus) =>
      gravar({ ...m, status: novoStatus }, `Agora está em "${STATUS[novoStatus].rotulo}".`),
    remover: async (m) => {
      if (!window.confirm(`Apagar "${m.titulo}"?`)) return;
      try {
        await apagar(COLECAO, m.id);
        setAviso({ tipo: "ok", texto: "Ação apagada." });
        recarregar();
      } catch (e) {
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const gruposVisiveis = recorte
    ? vm.grupos.filter((g) => g.status === recorte)
    : vm.grupos.filter((g) => g.status !== "encerrada");
  const encerradas = recorte ? null : vm.grupos.find((g) => g.status === "encerrada");

  // A planilha leva EXATAMENTE o que está na tela: o recorte do cartão vale, e
  // as encerradas só entram se estiverem abertas. Se exportasse tudo, o total
  // do arquivo divergiria do total dos cartões e a conversa passaria a ser
  // sobre qual dos dois números está certo.
  const baixar = () => {
    const visiveis = [
      ...gruposVisiveis.flatMap((g) => g.itens),
      ...(encerradas && verEncerradas ? encerradas.itens : []),
    ];
    if (visiveis.length === 0) {
      setAviso({ tipo: "erro", texto: "Não há nada neste recorte para baixar." });
      return;
    }
    try {
      const arquivo = baixarPlanilha({
        nome: "marketing",
        titulo: `Marketing — ${recorte ? STATUS[recorte].grupo : "em aberto"}${
          !recorte && verEncerradas ? " e encerradas" : ""
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
        titulo="Marketing"
        descricao="O que a MinasLab está fazendo para aparecer — do que está no ar até a ideia na gaveta."
        acao={
          /* Baixar não é escrita: quem só consulta também precisa da planilha. */
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline" onClick={baixar}>
              <Download size={16} strokeWidth={2.5} /> Baixar planilha
            </button>
            {editavel && (
              <button type="button" className="btn-primary" onClick={() => acoes.abrirForm(null)}>
                <Plus size={16} strokeWidth={2.5} /> Nova ação
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="No ar"
          valor={String(vm.noAr)}
          tom={vm.noAr > 0 ? "ok" : "neutral"}
          icone={Megaphone}
          onClick={() => setRecorte(recorte === "no_ar" ? null : "no_ar")}
          ativo={recorte === "no_ar"}
        />
        <StatCard
          rotulo="Planejadas"
          valor={String(vm.planejadas)}
          tom={vm.planejadas > 0 ? "brand" : "neutral"}
          icone={CalendarClock}
          onClick={() => setRecorte(recorte === "planejada" ? null : "planejada")}
          ativo={recorte === "planejada"}
        />
        <StatCard
          rotulo="Ideias"
          valor={String(vm.ideias)}
          tom="neutral"
          icone={Lightbulb}
          onClick={() => setRecorte(recorte === "ideia" ? null : "ideia")}
          ativo={recorte === "ideia"}
        />
        <StatCard
          rotulo="Investido no ano"
          valor={vm.investidoAno}
          sub={`ações fora da ideia em ${vm.anoAtual}`}
          tom="brand"
          icone={Wallet}
        />
      </div>

      {gruposVisiveis.length === 0 && (
        <Empty>
          {recorte
            ? "Nada neste recorte. Clique de novo no cartão para ver tudo."
            : "Nenhuma ação de marketing por aqui. Registre a primeira no botão lá em cima."}
        </Empty>
      )}

      <div className="space-y-6">
        {gruposVisiveis.map((g) => (
          <Card key={g.status}>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.nome} <span className="text-slate-400">({g.itens.length})</span>
            </h2>
            <div className="space-y-2">
              {g.itens.map((m) => (
                <Linha
                  key={m.id}
                  m={m}
                  editavel={editavel}
                  mudandoStatus={mudandoStatus}
                  setMudandoStatus={setMudandoStatus}
                  acoes={acoes}
                />
              ))}
            </div>
          </Card>
        ))}

        {/* Encerradas recolhidas por padrão: são memória, não trabalho. A
            escolha fica guardada para a próxima visita. */}
        {encerradas && (
          <Card>
            <button
              type="button"
              onClick={alternarEncerradas}
              aria-expanded={verEncerradas}
              className="flex w-full items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
            >
              {verEncerradas ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Encerradas <span className="text-slate-400">({encerradas.itens.length})</span>
            </button>
            {verEncerradas && (
              <div className="mt-3 space-y-2">
                {encerradas.itens.map((m) => (
                  <Linha
                    key={m.id}
                    m={m}
                    editavel={editavel}
                    mudandoStatus={mudandoStatus}
                    setMudandoStatus={setMudandoStatus}
                    acoes={acoes}
                  />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <FormAcao
        form={form}
        setForm={setForm}
        salvando={salvando}
        aoSalvar={() => gravar(form, form.id ? "Ação atualizada." : "Ação registrada.")}
        aoFechar={() => setForm(null)}
      />
    </div>
  );
}
