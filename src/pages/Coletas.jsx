// Coletas — o módulo mais importante do painel: o que tem para coletar, quem
// vai em qual carro, e quem foi. A Agenda abre pelo que atrasou (é assim que o
// problema chega); o Calendário mostra o mês; o Histórico responde "quem foi
// em qual coleta".
//
// Por isso equipe e carro são CARIMBADOS na gravação (equipeNomes, carroNome):
// o histórico é memória, e não pode quebrar se a pessoa sair do RH ou o carro
// for desativado depois. Carro não se apaga — sai de cena desativado.
// Coletas canceladas ficam fora das três vistas de propósito: são registro,
// não trabalho.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Check, Trash2, Pencil, Car, CalendarCheck, CalendarX,
  ClipboardList, CheckCircle2,
} from "lucide-react";
import { listar, salvar, apagar, elenco } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import {
  dataCurta, dataLonga, diaLocalISO, diasEntre, ymdLocal, MESES_LONGOS,
} from "../lib/format.js";
import {
  PageTitle, StatCard, Segmented, Empty, CarregandoModulo, ErroModulo,
  Aviso, Modal, Card,
} from "../components/ui.jsx";
import CalendarioMes from "../components/CalendarioMes.jsx";

const COLECAO = "coletas";
const COLECAO_CARROS = "carros";

const VAZIO = {
  id: "", os: "", cliente: "", endereco: "", data: "", hora: "",
  carroId: "", carroNome: "", equipe: [], equipeNomes: [], obs: "",
  status: "agendada", concluidaEm: "",
};

// A frase que a pessoa lê antes do número. Prazo em palavras vale mais que data.
function prazo(dias) {
  if (dias === null) return { texto: "sem data", chip: "chip", peso: 5000, grupo: "Sem data" };
  if (dias < 0) {
    const d = -dias;
    return { texto: `atrasada ${d} ${d === 1 ? "dia" : "dias"}`, chip: "chip-bad", peso: -1000 + dias, grupo: "Atrasadas" };
  }
  if (dias === 0) return { texto: "HOJE", chip: "chip-bad", peso: 0, grupo: "Hoje" };
  if (dias === 1) return { texto: "amanhã", chip: "chip-warn", peso: 1, grupo: "Amanhã" };
  if (dias <= 7) return { texto: `em ${dias} dias`, chip: "chip-warn", peso: dias, grupo: "Próximos 7 dias" };
  return { texto: `em ${dias} dias`, chip: "chip", peso: dias, grupo: "Mais para frente" };
}

const ORDEM_GRUPOS = ["Atrasadas", "Hoje", "Amanhã", "Próximos 7 dias", "Mais para frente", "Sem data"];

function LinhaColeta({ c, editavel, acoes }) {
  const concluida = c.status === "concluida";
  // Carro e equipe são AS perguntas desta tela — ausência vira palavra, não
  // espaço em branco (dado ausente não é zero).
  const carroTxt = c.carroRotulo || "sem carro";
  const equipeTxt = (c.equipeNomes || []).length ? c.equipeNomes.join(", ") : "sem equipe";
  const sub = [c.endereco, `${carroTxt} · ${equipeTxt}`].filter(Boolean).join(" · ");
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors ${concluida ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--hairline)" }}
    >
      <button
        type="button"
        onClick={() => editavel && acoes.concluir(c)}
        disabled={!editavel}
        title={concluida ? "Reabrir" : "Marcar como concluída"}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
          concluida ? "border-ok-600 bg-ok-600 text-white" : "text-slate-400 hover:border-ok-600 hover:text-ok-700"
        } disabled:cursor-default`}
        style={concluida ? undefined : { borderColor: "var(--hairline)" }}
      >
        <Check size={15} strokeWidth={concluida ? 3 : 2} />
      </button>

      {c.os && <span className="chip-brand shrink-0 whitespace-nowrap">O.S. {c.os}</span>}

      <span className="min-w-0 flex-1 basis-48">
        <span className={`block truncate font-display text-sm font-medium text-slate-900 ${concluida ? "line-through" : ""}`}>
          {c.cliente || "sem cliente"}
        </span>
        <span className="block truncate text-xs text-slate-500">{sub}</span>
      </span>

      <span className="shrink-0 text-right">
        {concluida ? (
          <span className="chip whitespace-nowrap">concluída</span>
        ) : (
          <span className={`${c.pz.chip} whitespace-nowrap`}>{c.pz.texto}</span>
        )}
        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
          {c.data ? `${dataCurta(c.data)}${c.hora ? ` às ${c.hora}` : ""}` : "sem data"}
        </span>
      </span>

      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
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
        </span>
      )}
    </div>
  );
}

// A linha do Histórico responde "quem foi": data, O.S., cliente, carro, equipe.
// Só leitura — o passado se corrige pelo editar da coleta, não daqui.
function LinhaHistorico({ c }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
      <span className="w-24 shrink-0 font-display text-sm font-medium tabular-nums text-slate-700">
        {c.data ? dataLonga(c.data) : "sem data"}
      </span>
      {c.os && <span className="chip-brand shrink-0 whitespace-nowrap">O.S. {c.os}</span>}
      <span className="min-w-0 flex-1 basis-40 truncate text-sm font-medium text-slate-900">{c.cliente || "sem cliente"}</span>
      <span className="shrink-0 text-xs text-slate-500">{c.carroRotulo || "sem carro"}</span>
      <span className="min-w-0 basis-full truncate text-xs text-slate-500 sm:max-w-[40%] sm:basis-auto">
        {(c.equipeNomes || []).length ? c.equipeNomes.join(", ") : "sem equipe registrada"}
      </span>
    </div>
  );
}

function FormColeta({ form, setForm, carros, pessoas, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const alternarPessoa = (pid) => {
    const tem = form.equipe.includes(pid);
    setForm({ ...form, equipe: tem ? form.equipe.filter((x) => x !== pid) : [...form.equipe, pid] });
  };

  const ativos = carros.filter((x) => x.ativo);
  // Editando uma coleta cujo carro saiu da frota: a opção continua no select
  // para o valor não sumir em silêncio ao regravar.
  const carroFora = form.carroId && !ativos.some((x) => x.id === form.carroId);
  const nomeCarroFora = carros.find((x) => x.id === form.carroId)?.nome || form.carroNome || "carro fora da frota";

  return (
    <Modal titulo={form.id ? "Editar coleta" : "Nova coleta"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="col-os">Nº da O.S.</label>
            <input id="col-os" type="text" className="input" value={form.os} onChange={setCampo("os")} />
          </div>
          <div>
            <label className="label" htmlFor="col-cliente">Cliente</label>
            <input id="col-cliente" type="text" className="input" value={form.cliente} onChange={setCampo("cliente")} autoFocus required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="col-endereco">Endereço</label>
          <input id="col-endereco" type="text" className="input" value={form.endereco} onChange={setCampo("endereco")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="col-data">Data</label>
            <input id="col-data" type="date" className="input" value={form.data} onChange={setCampo("data")} />
          </div>
          <div>
            <label className="label" htmlFor="col-hora">Hora</label>
            <input id="col-hora" type="time" className="input" value={form.hora} onChange={setCampo("hora")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="col-carro">Carro</label>
          <select id="col-carro" className="select" value={form.carroId} onChange={setCampo("carroId")}>
            <option value="">— sem carro —</option>
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}{x.placa ? ` (${x.placa})` : ""}
              </option>
            ))}
            {carroFora && <option value={form.carroId}>{nomeCarroFora} (fora da frota)</option>}
          </select>
        </div>
        <div>
          <span className="label">Equipe</span>
          {pessoas === null ? (
            // Elenco não carregou — mandar "cadastrar no RH" aqui seria afirmação falsa.
            <p className="text-sm text-slate-500">Não consegui carregar a equipe — feche e tente de novo.</p>
          ) : pessoas.length === 0 ? (
            <p className="text-sm text-slate-500">Cadastre as pessoas no módulo RH para montar a equipe.</p>
          ) : (
            <div className="grid max-h-44 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
              {pessoas.map((p) => {
                const idCampo = `col-eq-${p.id}`;
                return (
                  <span key={p.id} className="flex items-center gap-2">
                    <input
                      id={idCampo}
                      type="checkbox"
                      checked={form.equipe.includes(p.id)}
                      onChange={() => alternarPessoa(p.id)}
                    />
                    <label htmlFor={idCampo} className="min-w-0 cursor-pointer truncate text-sm text-slate-700">
                      {p.nome}
                    </label>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="col-obs">Observações</label>
          <textarea id="col-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.cliente.trim()}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCarros({ aberto, aoFechar, carros, aoGravar }) {
  const [nome, setNome] = useState("");
  const [placa, setPlaca] = useState("");
  const [gravando, setGravando] = useState(false);
  if (!aberto) return null;

  const lista = [...carros].sort(
    (a, b) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0) || String(a.nome || "").localeCompare(String(b.nome || ""))
  );

  const adicionar = async (e) => {
    e.preventDefault();
    setGravando(true);
    const ok = await aoGravar(
      { nome: nome.trim(), placa: placa.trim().toUpperCase(), ativo: true },
      "Carro adicionado à frota."
    );
    setGravando(false);
    if (ok) {
      setNome("");
      setPlaca("");
    }
  };

  return (
    <Modal titulo="Frota" aberto={aberto} aoFechar={aoFechar}>
      <div className="space-y-4">
        {lista.length === 0 && <Empty>Nenhum carro cadastrado. Adicione o primeiro aqui embaixo.</Empty>}
        <div className="space-y-2">
          {lista.map((carro) => (
            <div
              key={carro.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${carro.ativo ? "" : "opacity-60"}`}
              style={{ borderColor: "var(--hairline)" }}
            >
              <Car size={17} className={carro.ativo ? "text-brand-600" : "text-slate-400"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-medium text-slate-900">{carro.nome}</span>
                <span className="block text-xs uppercase tabular-nums text-slate-500">{carro.placa || "sem placa"}</span>
              </span>
              <span className={carro.ativo ? "chip-brand" : "chip"}>{carro.ativo ? "ativo" : "inativo"}</span>
              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  aoGravar({ ...carro, ativo: !carro.ativo }, carro.ativo ? "Carro desativado." : "Carro reativado.")
                }
              >
                {carro.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={adicionar} className="flex flex-wrap items-end gap-2 border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
          <div className="min-w-0 flex-1 basis-40">
            <label className="label" htmlFor="fr-nome">Nome do carro</label>
            <input id="fr-nome" type="text" className="input" placeholder="Saveiro branca" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="w-32">
            <label className="label" htmlFor="fr-placa">Placa</label>
            <input id="fr-placa" type="text" className="input uppercase" placeholder="ABC1D23" value={placa} onChange={(e) => setPlaca(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={gravando || !nome.trim()}>
            {gravando ? "Gravando..." : "Adicionar"}
          </button>
        </form>
      </div>
    </Modal>
  );
}

export default function Coletas() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [itens, setItens] = useState(null);
  const [carros, setCarros] = useState([]);
  // null = elenco não carregou (≠ [] = ninguém cadastrado): o form distingue.
  const [pessoas, setPessoas] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [vista, setVista] = useState("agenda"); // "agenda" | "calendario" | "historico"
  // Os cartões viram recorte: clicar filtra a agenda; clicar de novo volta.
  const [recorte, setRecorte] = useState(null); // "atrasadas" | "hoje" | null
  const [modalCarros, setModalCarros] = useState(false);
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroCarro, setFiltroCarro] = useState("");
  const [diaEscolhido, setDiaEscolhido] = useState(() => ymdLocal(new Date()));
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
        // Depois da primeira carga boa o ErroModulo não aparece mais — sem
        // este aviso a tela ficava velha em silêncio.
        setAviso({ tipo: "erro", texto: "Não consegui atualizar agora. O que está na tela pode ser da última carga." });
      });
    // A frota é apoio: se falhar, a agenda continua de pé.
    listar(COLECAO_CARROS).then(setCarros).catch(() => {});
    // O elenco é só para montar equipe e filtrar o histórico. Se falhar, fica
    // null (≠ vazio) e a próxima recarga tenta de novo.
    elenco().then(setPessoas).catch(() => {});
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
    const todos = itens.map((c) => {
      const dias = c.data ? diasEntre(hojeISO, c.data) : null;
      // Nas listas vale o nome VIVO da frota; se o carro já não existe lá,
      // vale o carimbo gravado com a coleta.
      const carroRotulo = c.carroId
        ? carros.find((x) => x.id === c.carroId)?.nome || c.carroNome || ""
        : "";
      return { ...c, dias, pz: prazo(dias), carroRotulo };
    });

    /* O dia sai na ordem do relógio: dentro do grupo, quem tem hora vem
       primeiro, na ordem dela; sem hora vai para o fim do dia ("99:99"). */
    const horaDe = (c) => String(c.hora || "99:99");
    const agendadas = todos
      .filter((c) => c.status === "agendada")
      .sort(
        (a, b) =>
          a.pz.peso - b.pz.peso ||
          horaDe(a).localeCompare(horaDe(b)) ||
          String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
      );
    const concluidas = todos
      .filter((c) => c.status === "concluida")
      .sort(
        (a, b) =>
          String(b.data || "").localeCompare(String(a.data || "")) ||
          horaDe(b).localeCompare(horaDe(a))
      );

    const grupos = [];
    for (const c of agendadas) {
      let g = grupos.find((x) => x.nome === c.pz.grupo);
      if (!g) {
        g = { nome: c.pz.grupo, itens: [] };
        grupos.push(g);
      }
      g.itens.push(c);
    }
    grupos.sort((a, b) => ORDEM_GRUPOS.indexOf(a.nome) - ORDEM_GRUPOS.indexOf(b.nome));

    const eventosPorDia = {};
    for (const c of todos) {
      if (!c.data || c.status === "cancelada") continue;
      (eventosPorDia[c.data] ||= []).push({
        cor: c.status === "concluida" ? "neutral" : "ok",
        rotulo: `${c.hora ? `${c.hora} ` : ""}${c.cliente || "coleta"}`,
      });
    }

    const mes = hojeISO.slice(0, 7);
    const concluidasMes = concluidas.filter(
      (c) => (c.data || (c.concluidaEm ? diaLocalISO(c.concluidaEm) : "")).slice(0, 7) === mes
    ).length;

    return {
      todos,
      grupos,
      concluidas,
      eventosPorDia,
      hoje: agendadas.filter((c) => c.pz.grupo === "Hoje").length,
      atrasadas: agendadas.filter((c) => c.pz.grupo === "Atrasadas").length,
      agendadas: agendadas.length,
      concluidasMes,
    };
  }, [itens, carros, hojeISO]);

  const gravarColeta = async (dados, fraseOk) => {
    setSalvando(true);
    try {
      // Os campos derivados do render (dias, prazo, rótulo do carro) NÃO vão
      // para o banco — são conta da tela, e gravá-los criaria uma segunda
      // verdade que envelhece.
      const { dias: _dias, pz: _pz, carroRotulo: _rot, ...limpo } = dados;

      // CARIMBO: equipe e carro viram nome agora, na gravação. Quem já saiu do
      // elenco mantém o nome que tinha no registro antigo (os pares id↔nome
      // gravados são a única memória dele).
      const antigo = itens.find((x) => x.id === limpo.id);
      const nomeAntigo = {};
      (antigo?.equipe || []).forEach((pid, i) => {
        nomeAntigo[pid] = (antigo.equipeNomes || [])[i] || "";
      });
      limpo.equipeNomes = (limpo.equipe || []).map(
        (pid) => (pessoas || []).find((p) => p.id === pid)?.nome || nomeAntigo[pid] || "(sem cadastro)"
      );
      limpo.carroNome = limpo.carroId
        ? carros.find((x) => x.id === limpo.carroId)?.nome || limpo.carroNome || ""
        : "";

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

  const gravarCarro = async (carro, fraseOk) => {
    try {
      await salvar(COLECAO_CARROS, carro);
      setAviso({ tipo: "ok", texto: fraseOk });
      recarregar();
      return true;
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
      return false;
    }
  };

  const acoes = {
    abrirForm: (c) => setForm(c ? { ...VAZIO, ...c, equipe: [...(c.equipe || [])] } : { ...VAZIO, equipe: [] }),
    concluir: (c) =>
      c.status === "concluida"
        ? gravarColeta({ ...c, status: "agendada", concluidaEm: "" }, "Coleta reaberta.")
        : gravarColeta({ ...c, status: "concluida", concluidaEm: new Date().toISOString() }, "Coleta concluída."),
    remover: async (c) => {
      if (!window.confirm(`Apagar a coleta${c.os ? ` da O.S. ${c.os}` : ""} de "${c.cliente || "sem cliente"}"?`)) return;
      try {
        await apagar(COLECAO, c.id);
        setAviso({ tipo: "ok", texto: "Coleta apagada." });
        recarregar();
      } catch (e) {
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const gruposVisiveis =
    recorte === "atrasadas"
      ? vm.grupos.filter((g) => g.nome === "Atrasadas")
      : recorte === "hoje"
        ? vm.grupos.filter((g) => g.nome === "Hoje")
        : vm.grupos;

  const coletasDoDia = diaEscolhido
    ? vm.todos
        .filter((c) => c.data === diaEscolhido && c.status !== "cancelada")
        .sort((a, b) => String(a.hora || "99:99").localeCompare(String(b.hora || "99:99")))
    : [];

  const historico = vm.concluidas
    .filter((c) => !filtroPessoa || (c.equipe || []).includes(filtroPessoa))
    .filter((c) => !filtroCarro || c.carroId === filtroCarro);

  // Opções dos filtros do Histórico: união dos vivos (elenco/frota) com os
  // pares id↔nome CARIMBADOS nas coletas concluídas — quem saiu do RH continua
  // filtrável, porque a pergunta da aba é "quem foi", não "quem está".
  const opcoesPessoa = (pessoas || []).map((p) => ({ id: p.id, nome: p.nome }));
  for (const c of vm.concluidas) {
    (c.equipe || []).forEach((pid, i) => {
      if (!opcoesPessoa.some((o) => o.id === pid)) {
        opcoesPessoa.push({ id: pid, nome: (c.equipeNomes || [])[i] || "(sem cadastro)" });
      }
    });
  }
  opcoesPessoa.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const opcoesCarro = carros.map((x) => ({ id: x.id, nome: `${x.nome}${x.ativo ? "" : " (inativo)"}` }));
  for (const c of vm.concluidas) {
    if (c.carroId && !opcoesCarro.some((o) => o.id === c.carroId)) {
      opcoesCarro.push({ id: c.carroId, nome: c.carroNome || "(carro sem nome)" });
    }
  }
  opcoesCarro.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Coletas"
        descricao="O que tem para coletar, quem vai em qual carro — e quem foi."
        acao={
          editavel && (
            <div className="flex gap-2">
              <button type="button" className="btn-outline" onClick={() => setModalCarros(true)}>
                <Car size={16} /> Carros
              </button>
              <button type="button" className="btn-primary" onClick={() => acoes.abrirForm(null)}>
                <Plus size={16} strokeWidth={2.5} /> Nova coleta
              </button>
            </div>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Hoje"
          valor={String(vm.hoje)}
          tom={vm.hoje > 0 ? "warn" : "neutral"}
          icone={CalendarCheck}
          onClick={() => {
            setVista("agenda");
            setRecorte(recorte === "hoje" ? null : "hoje");
          }}
          ativo={recorte === "hoje"}
        />
        <StatCard
          rotulo="Atrasadas"
          valor={String(vm.atrasadas)}
          tom={vm.atrasadas > 0 ? "bad" : "ok"}
          icone={CalendarX}
          onClick={() => {
            setVista("agenda");
            setRecorte(recorte === "atrasadas" ? null : "atrasadas");
          }}
          ativo={recorte === "atrasadas"}
        />
        <StatCard
          rotulo="Agendadas"
          valor={String(vm.agendadas)}
          tom="brand"
          icone={ClipboardList}
          onClick={() => {
            setVista("agenda");
            setRecorte(null);
          }}
        />
        <StatCard
          rotulo="Concluídas no mês"
          valor={String(vm.concluidasMes)}
          sub={`em ${MESES_LONGOS[Number(hojeISO.slice(5, 7)) - 1]}`}
          tom="ok"
          icone={CheckCircle2}
          onClick={() => setVista("historico")}
        />
      </div>

      <div className="mb-6">
        <Segmented
          opcoes={[
            { valor: "agenda", rotulo: "Agenda" },
            { valor: "calendario", rotulo: "Calendário" },
            { valor: "historico", rotulo: "Histórico" },
          ]}
          valor={vista}
          onChange={(v) => {
            setVista(v);
            setRecorte(null);
          }}
        />
      </div>

      {vista === "agenda" && (
        <>
          {gruposVisiveis.length === 0 && (
            <Empty>
              {recorte
                ? "Nada neste recorte. Clique de novo no cartão para ver tudo."
                : "Nenhuma coleta agendada. Crie a primeira no botão lá em cima."}
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
                    <LinhaColeta key={c.id} c={c} editavel={editavel} acoes={acoes} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {vista === "calendario" && (
        <div className="space-y-6">
          <Card>
            <CalendarioMes
              eventosPorDia={vm.eventosPorDia}
              diaSelecionado={diaEscolhido}
              aoEscolherDia={setDiaEscolhido}
            />
          </Card>
          <Card>
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              {diaEscolhido ? dataLonga(diaEscolhido) : "Dia escolhido"}
            </h2>
            {!diaEscolhido ? (
              <Empty>Clique num dia do calendário para ver as coletas dele.</Empty>
            ) : coletasDoDia.length === 0 ? (
              <Empty>Nenhuma coleta neste dia.</Empty>
            ) : (
              <div className="space-y-2">
                {coletasDoDia.map((c) => (
                  <LinhaColeta key={c.id} c={c} editavel={editavel} acoes={acoes} />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {vista === "historico" && (
        <Card>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="col-f-pessoa">Quem foi</label>
              <select id="col-f-pessoa" className="select" value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)}>
                <option value="">— todo mundo —</option>
                {opcoesPessoa.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="col-f-carro">Carro</label>
              {/* Inclusive os desativados: o histórico aponta para eles. */}
              <select id="col-f-carro" className="select" value={filtroCarro} onChange={(e) => setFiltroCarro(e.target.value)}>
                <option value="">— todos —</option>
                {opcoesCarro.map((x) => (
                  <option key={x.id} value={x.id}>{x.nome}</option>
                ))}
              </select>
            </div>
          </div>
          {vm.concluidas.length === 0 ? (
            <Empty>Nenhuma coleta concluída ainda.</Empty>
          ) : historico.length === 0 ? (
            <Empty>sem registro para este recorte</Empty>
          ) : (
            <div className="space-y-2">
              {historico.map((c) => (
                <LinhaHistorico key={c.id} c={c} />
              ))}
            </div>
          )}
        </Card>
      )}

      <FormColeta
        form={form}
        setForm={setForm}
        carros={carros}
        pessoas={pessoas}
        salvando={salvando}
        aoSalvar={() => gravarColeta(form, form.id ? "Coleta atualizada." : "Coleta agendada.")}
        aoFechar={() => setForm(null)}
      />

      <ModalCarros
        aberto={modalCarros}
        aoFechar={() => setModalCarros(false)}
        carros={carros}
        aoGravar={gravarCarro}
      />
    </div>
  );
}
