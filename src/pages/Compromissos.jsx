// Compromissos — a agenda de trabalho da MinasLab: reunião, visita, retorno,
// entrega de laudo, cobrança. O desenho é o do Painel da Impresilk, que a
// equipe de lá usa todo dia: a tela abre pelo que está ATRASADO e depois por
// hoje — é assim que o problema chega.
//
// ESTA PÁGINA É O EXEMPLAR das demais: linha e formulário declarados FORA do
// componente da página (dentro, o React remonta a subárvore a cada render e o
// campo perde o foco a cada letra); datas sempre ymdLocal; aviso de resultado
// onde a pessoa está olhando; depois de gravar, recarrega do servidor —
// conferir o efeito, não a ausência de erro.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Check, Trash2, Pencil, Users, MapPin, Phone, FileText,
  HandCoins, CircleDot, MessageCircle, CalendarCheck,
} from "lucide-react";
import { listar, salvar, apagar, elenco } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { dataCurta, diasEntre, ymdLocal } from "../lib/format.js";
import {
  PageTitle, StatCard, Empty, CarregandoModulo, ErroModulo, Aviso, Modal, Card,
} from "../components/ui.jsx";

const COLECAO = "compromissos";

// Cada tipo tem ícone próprio: numa lista de 20 linhas, o ícone diz o que é
// antes de a pessoa ler o título.
const TIPOS = {
  reuniao: { rotulo: "Reunião", icone: Users, cor: "text-brand-600" },
  visita: { rotulo: "Visita", icone: MapPin, cor: "text-brand-600" },
  retorno: { rotulo: "Retorno ao cliente", icone: Phone, cor: "text-warn-700" },
  entrega: { rotulo: "Entrega de laudo", icone: FileText, cor: "text-ok-700" },
  cobranca: { rotulo: "Cobrança", icone: HandCoins, cor: "text-bad-700" },
  outro: { rotulo: "Outro", icone: CircleDot, cor: "text-slate-500" },
};

const VAZIO = {
  id: "", titulo: "", tipo: "reuniao", cliente: "", data: "", hora: "",
  telefone: "", responsavelId: "", obs: "", feito: false,
};

// A frase que a pessoa lê antes do número. Prazo em palavras vale mais que data.
function prazo(dias) {
  if (dias === null) return { texto: "sem data", chip: "chip", peso: 5000, grupo: "Sem data marcada" };
  if (dias < 0) {
    const d = -dias;
    return { texto: `atrasado ${d} ${d === 1 ? "dia" : "dias"}`, chip: "chip-bad", peso: -1000 + dias, grupo: "Atrasados" };
  }
  if (dias === 0) return { texto: "HOJE", chip: "chip-bad", peso: 0, grupo: "Hoje" };
  if (dias === 1) return { texto: "amanhã", chip: "chip-warn", peso: 1, grupo: "Amanhã" };
  if (dias <= 7) return { texto: `em ${dias} dias`, chip: "chip-warn", peso: dias, grupo: "Próximos 7 dias" };
  return { texto: `em ${dias} dias`, chip: "chip", peso: dias, grupo: "Mais para frente" };
}

const ORDEM_GRUPOS = ["Atrasados", "Hoje", "Amanhã", "Próximos 7 dias", "Mais para frente", "Sem data marcada"];

// As datas do remarcar rápido. Local, nunca UTC: toISOString() devolve o dia
// de AMANHÃ depois das 21h no Brasil.
function maisDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymdLocal(d);
}
function proximaSegunda() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return ymdLocal(d);
}

function Linha({ c, editavel, remarcando, setRemarcando, acoes }) {
  const Icone = c.t.icone;
  const telDigitos = String(c.telefone || "").replace(/\D/g, "");
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors ${c.feito ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--hairline)" }}
    >
      <button
        type="button"
        onClick={() => editavel && acoes.alternarFeito(c)}
        disabled={!editavel}
        title={c.feito ? "Reabrir" : "Marcar como feito"}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
          c.feito ? "border-ok-600 bg-ok-600 text-white" : "text-slate-400 hover:border-ok-600 hover:text-ok-700"
        } disabled:cursor-default`}
        style={c.feito ? undefined : { borderColor: "var(--hairline)" }}
      >
        <Check size={15} strokeWidth={c.feito ? 3 : 2} />
      </button>

      <Icone size={17} strokeWidth={2.2} className={`shrink-0 ${c.t.cor}`} title={c.t.rotulo} />

      <span className="min-w-0 flex-1 basis-48">
        <span className={`block truncate font-display text-sm font-medium text-slate-900 ${c.feito ? "line-through" : ""}`}>
          {c.titulo}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[c.t.rotulo, c.cliente, c.responsavelNome, c.obs].filter(Boolean).join(" · ")}
        </span>
      </span>

      <span className="shrink-0 text-right">
        {remarcando === c.id ? (
          /* Seletor no LUGAR da etiqueta: escolher já remarca, sem formulário
             e sem perder o lugar na lista. */
          <select
            autoFocus
            className="input h-8 w-36 py-0 text-xs"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setRemarcando(null);
              if (v === "escolher") return acoes.abrirForm(c);
              acoes.remarcar(c, v);
            }}
            onBlur={() => setRemarcando(null)}
          >
            <option value="" disabled>Remarcar para...</option>
            <option value={maisDias(0)}>Hoje</option>
            <option value={maisDias(1)}>Amanhã</option>
            <option value={proximaSegunda()}>Segunda</option>
            <option value={maisDias(7)}>Daqui a 7 dias</option>
            <option value="escolher">Escolher data...</option>
          </select>
        ) : (
          <>
            {!c.feito && (
              <button
                type="button"
                onClick={() => editavel && setRemarcando(c.id)}
                title={editavel ? "Remarcar" : undefined}
                className={`${c.pz.chip} whitespace-nowrap transition-opacity hover:opacity-75`}
              >
                {c.pz.texto}
              </button>
            )}
            <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
              {c.data ? `${dataCurta(c.data)}${c.hora ? ` às ${c.hora}` : ""}` : "sem data"}
            </span>
          </>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-0.5">
        {/* Ligar e WhatsApp direto da linha. Só aparecem quando há telefone —
            botão que não liga para lugar nenhum é pior que a falta dele. */}
        {telDigitos && (
          <>
            <a
              href={`tel:${telDigitos}`}
              title={`Ligar para ${c.cliente || "o cliente"}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
            >
              <Phone size={15} strokeWidth={2.2} />
            </a>
            <a
              href={`https://wa.me/55${telDigitos}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no WhatsApp"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-ok-50 hover:text-ok-700"
            >
              <MessageCircle size={15} strokeWidth={2.2} />
            </a>
          </>
        )}
        {editavel && (
          <>
            <button
              type="button"
              onClick={() => acoes.abrirForm(c)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => acoes.remover(c)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
              title="Apagar"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function FormCompromisso({ form, setForm, equipe, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <Modal titulo={form.id ? "Editar compromisso" : "Novo compromisso"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="c-titulo">O que é</label>
          <input id="c-titulo" type="text" className="input" value={form.titulo} onChange={setCampo("titulo")} autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-tipo">Tipo</label>
            <select id="c-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
              {Object.entries(TIPOS).map(([valor, t]) => (
                <option key={valor} value={valor}>{t.rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-cliente">Cliente</label>
            <input id="c-cliente" type="text" className="input" value={form.cliente} onChange={setCampo("cliente")} />
          </div>
          <div>
            <label className="label" htmlFor="c-data">Data</label>
            <input id="c-data" type="date" className="input" value={form.data} onChange={setCampo("data")} />
          </div>
          <div>
            <label className="label" htmlFor="c-hora">Hora</label>
            <input id="c-hora" type="time" className="input" value={form.hora} onChange={setCampo("hora")} />
          </div>
          <div>
            <label className="label" htmlFor="c-tel">Telefone</label>
            <input id="c-tel" type="tel" className="input" placeholder="(31) 99999-0000" value={form.telefone} onChange={setCampo("telefone")} />
          </div>
          <div>
            <label className="label" htmlFor="c-resp">Responsável</label>
            <select id="c-resp" className="select" value={form.responsavelId} onChange={setCampo("responsavelId")}>
              <option value="">— sem responsável —</option>
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="c-obs">Observações</label>
          <textarea id="c-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
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

export default function Compromissos() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [equipe, setEquipe] = useState([]);
  const [remarcando, setRemarcando] = useState(null);
  const [verFeitos, setVerFeitos] = useState(false);
  // Os cartões viram recorte: clicar filtra a lista; clicar de novo volta.
  const [recorte, setRecorte] = useState(null); // "atrasados" | "hoje" | "semData" | null
  // "Hoje" precisa ser ESTADO, não um cálculo do render: esta tela fica aberta
  // de um dia para o outro e o dia congelado mentia o prazo.
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
        // A tela pode já estar cheia de dados de uma carga antiga: recarga que
        // falha em silêncio deixaria números de ontem sob a data de hoje.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
      });
  }, []);

  useEffect(() => {
    recarregar();
    // O elenco é só para o "responsável". Se falhar, a tela continua.
    elenco().then(setEquipe).catch(() => {});
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
    const todos = itens.map((c) => {
      const dias = c.data ? diasEntre(hojeISO, c.data) : null;
      return { ...c, dias, pz: prazo(dias), t: TIPOS[c.tipo] || TIPOS.outro };
    });

    /* O dia sai na ordem do relógio: dentro de "Hoje" quem tem hora vem
       primeiro, na ordem dela; sem hora vai para o fim do dia ("99:99"). */
    const horaDe = (c) => String(c.hora || "99:99");
    const abertos = todos
      .filter((c) => !c.feito)
      .sort(
        (a, b) =>
          a.pz.peso - b.pz.peso ||
          horaDe(a).localeCompare(horaDe(b)) ||
          String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
      );
    const feitos = todos
      .filter((c) => c.feito)
      .sort((a, b) => String(b.feitoEm || "").localeCompare(String(a.feitoEm || "")));

    const grupos = [];
    for (const c of abertos) {
      let g = grupos.find((x) => x.nome === c.pz.grupo);
      if (!g) {
        g = { nome: c.pz.grupo, itens: [] };
        grupos.push(g);
      }
      g.itens.push(c);
    }
    grupos.sort((a, b) => ORDEM_GRUPOS.indexOf(a.nome) - ORDEM_GRUPOS.indexOf(b.nome));

    return {
      grupos,
      feitos,
      atrasados: abertos.filter((c) => c.pz.grupo === "Atrasados").length,
      hoje: abertos.filter((c) => c.pz.grupo === "Hoje").length,
      semData: abertos.filter((c) => c.pz.grupo === "Sem data marcada").length,
    };
  }, [itens, hojeISO]);

  const gravar = async (dados, fraseOk) => {
    setSalvando(true);
    try {
      // Os campos derivados do render (prazo, tipo resolvido, dias) NÃO vão
      // para o banco — são conta da tela, e gravá-los criaria uma segunda
      // verdade que envelhece.
      const { dias: _dias, pz: _pz, t: _t, ...limpo } = dados;
      // O nome do responsável é CARIMBO: se o id não resolve no elenco vivo
      // (pessoa desligada, ou o elenco falhou ao carregar), o nome já gravado
      // fica. Zerar aqui apagava "Maria" num simples clique de "feito".
      const resp = equipe.find((p) => p.id === limpo.responsavelId);
      const responsavelNome = limpo.responsavelId
        ? resp?.nome || limpo.responsavelNome || ""
        : "";
      await salvar(COLECAO, { ...limpo, responsavelNome });
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
    abrirForm: (c) => setForm(c ? { ...VAZIO, ...c } : { ...VAZIO }),
    alternarFeito: (c) =>
      gravar(
        { ...c, feito: !c.feito, feitoEm: !c.feito ? new Date().toISOString() : "" },
        c.feito ? "Compromisso reaberto." : "Feito! Compromisso concluído."
      ),
    remarcar: (c, novaData) => gravar({ ...c, data: novaData }, `Remarcado para ${dataCurta(novaData)}.`),
    remover: async (c) => {
      if (!window.confirm(`Apagar "${c.titulo}"?`)) return;
      try {
        await apagar(COLECAO, c.id);
        setAviso({ tipo: "ok", texto: "Compromisso apagado." });
        recarregar();
      } catch (e) {
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const gruposVisiveis =
    recorte === "atrasados"
      ? vm.grupos.filter((g) => g.nome === "Atrasados")
      : recorte === "hoje"
        ? vm.grupos.filter((g) => g.nome === "Hoje")
        : recorte === "semData"
          ? vm.grupos.filter((g) => g.nome === "Sem data marcada")
          : vm.grupos;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Compromissos"
        descricao="O que está marcado e o que está esperando — a tela abre pelo que atrasou."
        acao={
          editavel && (
            <button type="button" className="btn-primary" onClick={() => acoes.abrirForm(null)}>
              <Plus size={16} strokeWidth={2.5} /> Novo compromisso
            </button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Atrasados"
          valor={String(vm.atrasados)}
          tom={vm.atrasados > 0 ? "bad" : "ok"}
          icone={CalendarCheck}
          onClick={() => setRecorte(recorte === "atrasados" ? null : "atrasados")}
          ativo={recorte === "atrasados"}
        />
        <StatCard
          rotulo="Hoje"
          valor={String(vm.hoje)}
          tom={vm.hoje > 0 ? "warn" : "neutral"}
          icone={CalendarCheck}
          onClick={() => setRecorte(recorte === "hoje" ? null : "hoje")}
          ativo={recorte === "hoje"}
        />
        <StatCard
          rotulo="Sem data"
          valor={String(vm.semData)}
          tom="neutral"
          icone={CircleDot}
          onClick={() => setRecorte(recorte === "semData" ? null : "semData")}
          ativo={recorte === "semData"}
        />
        <StatCard
          rotulo="Feitos"
          valor={String(vm.feitos.length)}
          tom="ok"
          icone={Check}
          onClick={() => setVerFeitos(!verFeitos)}
          ativo={verFeitos}
        />
      </div>

      {gruposVisiveis.length === 0 && (
        <Empty>
          {recorte
            ? "Nada neste recorte. Clique de novo no cartão para ver tudo."
            : "Nenhum compromisso em aberto. Crie o primeiro no botão lá em cima."}
        </Empty>
      )}

      <div className="space-y-6">
        {gruposVisiveis.map((g) => (
          <Card key={g.nome}>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.nome} <span className="text-slate-400">({g.itens.length})</span>
            </h2>
            <div className="space-y-2">
              {g.itens.map((c) => (
                <Linha
                  key={c.id}
                  c={c}
                  editavel={editavel}
                  remarcando={remarcando}
                  setRemarcando={setRemarcando}
                  acoes={acoes}
                />
              ))}
            </div>
          </Card>
        ))}

        {verFeitos && vm.feitos.length > 0 && (
          <Card>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              Feitos <span className="text-slate-400">({vm.feitos.length})</span>
            </h2>
            <div className="space-y-2">
              {vm.feitos.map((c) => (
                <Linha
                  key={c.id}
                  c={c}
                  editavel={editavel}
                  remarcando={remarcando}
                  setRemarcando={setRemarcando}
                  acoes={acoes}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      <FormCompromisso
        form={form}
        setForm={setForm}
        equipe={equipe}
        salvando={salvando}
        aoSalvar={() => gravar(form, form.id ? "Compromisso atualizado." : "Compromisso criado.")}
        aoFechar={() => setForm(null)}
      />
    </div>
  );
}
