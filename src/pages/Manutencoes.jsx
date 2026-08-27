// Manutenções — carros e equipamentos do laboratório, incluindo CALIBRAÇÃO,
// que em laboratório de análises não é capricho: sem calibração em dia o
// resultado perde a rastreabilidade. A tela abre pelo que VENCEU e pelo que
// vence em 30 dias — é assim que o problema chega.
//
// A FROTA mora aqui. Antes o cadastro de carros ficava em Coletas; com aquele
// módulo fora do painel, quem cuida do carro é quem cuida da manutenção dele.
//
// Segue o exemplar (Compromissos.jsx): linhas e formulários declarados FORA
// do componente da página; "hoje" é estado e refaz a conta no
// visibilitychange; depois de gravar, recarrega do servidor — conferir o
// efeito, não a ausência de erro.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Check, Pencil, Trash2, Car, Wrench, AlertTriangle, CalendarClock,
  CheckCircle2, HandCoins, Download,
} from "lucide-react";
import { listar, salvar, apagar } from "../services/dados.js";
import { getSessao, podeEditar } from "../lib/sessao.js";
import { chaveAlvo, proximasPorAlvo } from "../lib/manutencaoRegra.js";
import { baixarPlanilha } from "../lib/planilha.js";
import {
  dataCurta, dataLonga, diasEntre, ymdLocal, moeda, moedaCheia, numero, paraNumero,
} from "../lib/format.js";
import {
  PageTitle, StatCard, Empty, CarregandoModulo, ErroModulo, Aviso, Modal, Card,
  Segmented,
} from "../components/ui.jsx";

const COLECAO = "manutencoes";

const TIPOS = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  calibracao: "Calibração",
};

const VAZIO = {
  id: "", alvoTipo: "carro", alvoId: "", alvoNome: "", tipo: "preventiva",
  descricao: "", data: "", custo: "", proxima: "", status: "agendada", obs: "",
};

// A ficha do carro vive como TEXTO enquanto está no formulário; ano e km viram
// número (ou null) só na gravação — campo em branco não é zero.
const FICHA_VAZIA = {
  nome: "", placa: "", modelo: "", ano: "", kmAtual: "", renavam: "", obs: "",
};

// Renavam fica como TEXTO de propósito: começa com zero em muito carro, e
// número apagaria o zero da frente sem ninguém ver.
const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

const temKm = (c) => c && c.kmAtual != null && c.kmAtual !== "";

const ndias = (n) => `${n} ${n === 1 ? "dia" : "dias"}`;

// A frase da PRÓXIMA manutenção de um alvo. Prazo em palavras vale mais que
// data: "venceu há 12 dias" cobra; "15/08" só informa.
function prazoProxima(dias) {
  if (dias < 0) return { texto: `venceu há ${ndias(-dias)}`, chip: "chip-bad", peso: dias };
  if (dias === 0) return { texto: "vence hoje", chip: "chip-warn", peso: 0 };
  if (dias <= 30) return { texto: `em ${ndias(dias)}`, chip: "chip-warn", peso: dias };
  return { texto: `em ${ndias(dias)}`, chip: "chip", peso: dias };
}

// A frase de uma manutenção AGENDADA.
function prazoAgendada(dias) {
  if (dias === null) return { texto: "sem data", chip: "chip" };
  if (dias < 0) return { texto: `atrasada há ${ndias(-dias)}`, chip: "chip-bad" };
  if (dias === 0) return { texto: "HOJE", chip: "chip-warn" };
  if (dias <= 7) return { texto: `em ${ndias(dias)}`, chip: "chip-warn" };
  return { texto: `em ${ndias(dias)}`, chip: "chip" };
}

// Uma linha da Seção 1: o alvo e a próxima manutenção dele. O chip "sem
// registro" existe de propósito: alvo sem manutenção registrada NÃO está em
// dia — só não sabemos, e não saber também precisa aparecer.
function LinhaAlvo({ a }) {
  const Icone = a.alvoTipo === "carro" ? Car : Wrench;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icone size={16} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {a.nome}
          {a.placa ? <span className="font-normal text-slate-500"> — {a.placa}</span> : null}
          {/* Quilometragem manda na preventiva do carro tanto quanto a data.
              A DATA da leitura vai no title: km sem data envelhece calado. */}
          {a.km != null ? (
            <span
              className="font-normal text-slate-500"
              title={a.kmEm ? `Quilometragem lida em ${dataLonga(a.kmEm)}` : "Quilometragem sem data de leitura"}
            >
              {" · "}{numero(a.km)} km
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-slate-500">{a.sub}</span>
      </span>
      <span className={`${a.chip} shrink-0 whitespace-nowrap`}>{a.texto}</span>
    </div>
  );
}

function LinhaAgendada({ m, editavel, acoes }) {
  const Icone = m.alvoTipo === "carro" ? Car : Wrench;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      {editavel && (
        <button
          type="button"
          onClick={() => acoes.marcarFeita(m)}
          title="Marcar como feita"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-slate-400 transition-colors hover:border-ok-600 hover:text-ok-700"
          style={{ borderColor: "var(--hairline)" }}
        >
          <Check size={15} />
        </button>
      )}
      <Icone size={17} strokeWidth={2.2} className="shrink-0 text-brand-600" />
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">{m.descricao}</span>
        <span className="block truncate text-xs text-slate-500">
          {[m.alvoNome, TIPOS[m.tipo] || m.tipo, m.obs].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`${m.pz.chip} whitespace-nowrap`}>{m.pz.texto}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
          {m.data ? dataCurta(m.data) : "sem data"}
        </span>
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

function LinhaHistorico({ m, editavel, acoes }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="w-16 shrink-0 text-xs tabular-nums text-slate-500">
        {m.data ? dataCurta(m.data) : "sem data"}
      </span>
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {m.alvoNome || "(alvo sem nome)"}
          <span className="font-normal text-slate-500"> · {TIPOS[m.tipo] || m.tipo}</span>
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[m.descricao, m.obs].filter(Boolean).join(" · ")}
        </span>
      </span>
      {/* Custo ausente escreve "sem registro" — R$ 0 seria afirmar que foi de graça. */}
      <span className="shrink-0 text-sm tabular-nums text-slate-700">
        {m.custo == null || m.custo === "" ? (
          <span className="text-xs text-slate-400">sem registro</span>
        ) : (
          moedaCheia(m.custo)
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

function FormManutencao({ form, setForm, carros, equipamentos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const lista = form.alvoTipo === "carro" ? carros : equipamentos;
  const opcoes = lista.filter((a) => a.ativo !== false);
  // Registro antigo pode apontar para alvo desativado (ou fora do cadastro):
  // o select precisa continuar mostrando, senão editar qualquer outro campo
  // trocaria o alvo sem ninguém pedir.
  if (form.alvoId && !opcoes.some((a) => a.id === form.alvoId)) {
    const antigo = lista.find((a) => a.id === form.alvoId);
    opcoes.push(
      antigo
        ? { ...antigo, nome: `${antigo.nome} (desativado)` }
        : { id: form.alvoId, nome: `${form.alvoNome || "?"} (fora do cadastro)` }
    );
  }

  const valido = form.descricao.trim() && form.alvoId && form.data;

  return (
    <Modal titulo={form.id ? "Editar manutenção" : "Nova manutenção"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-alvo">{form.alvoTipo === "carro" ? "Carro" : "Equipamento"}</label>
            <select id="m-alvo" className="select" value={form.alvoId} onChange={setCampo("alvoId")} required>
              <option value="">— escolha —</option>
              {opcoes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}{a.placa ? ` — ${a.placa}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-tipo">Tipo</label>
            <select id="m-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
              {Object.entries(TIPOS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="m-desc">O que foi (ou será) feito</label>
          <input id="m-desc" type="text" className="input" value={form.descricao} onChange={setCampo("descricao")} autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-status">Situação</label>
            <select id="m-status" className="select" value={form.status} onChange={setCampo("status")}>
              <option value="agendada">Agendada</option>
              <option value="feita">Feita</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-data">{form.status === "feita" ? "Feita em" : "Agendada para"}</label>
            <input id="m-data" type="date" className="input" value={form.data} onChange={setCampo("data")} required />
          </div>
          <div>
            <label className="label" htmlFor="m-custo">Custo (R$)</label>
            <input
              id="m-custo" type="text" inputMode="decimal" className="input"
              placeholder="em branco = sem registro"
              value={form.custo} onChange={setCampo("custo")}
            />
          </div>
          <div>
            <label className="label" htmlFor="m-proxima">Próxima (opcional)</label>
            <input id="m-proxima" type="date" className="input" value={form.proxima} onChange={setCampo("proxima")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="m-obs">Observações</label>
          <textarea id="m-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
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

// Cadastro da FROTA — gêmea da gaveta de equipamentos, com a ficha a mais que
// a manutenção do carro pede (modelo, ano, km, renavam). Carro NÃO se apaga:
// o histórico de manutenção aponta para ele; desativar tira das opções de alvo
// novo e mantém o que já foi feito legível.
function ModalCarros({ aberto, aoFechar, carros, salvando, aoAdicionar, aoAlternar, aoGravarFicha }) {
  const [novoNome, setNovoNome] = useState("");
  const [novaPlaca, setNovaPlaca] = useState("");
  const [fichaId, setFichaId] = useState("");
  const [ficha, setFicha] = useState(FICHA_VAZIA);
  if (!aberto) return null;

  const ordenados = [...carros].sort(
    (a, b) =>
      Number(b.ativo !== false) - Number(a.ativo !== false) ||
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
  );

  const setCampoFicha = (campo) => (e) => setFicha({ ...ficha, [campo]: e.target.value });

  // A ficha é semeada AQUI, no clique, e não num efeito: efeito que copia prop
  // para estado reescreve o que a pessoa está digitando quando a lista
  // recarrega do servidor.
  const abrirFicha = (c) => {
    setFichaId(c.id);
    setFicha({
      nome: c.nome || "",
      placa: c.placa || "",
      modelo: c.modelo || "",
      ano: c.ano == null ? "" : String(c.ano),
      kmAtual: temKm(c) ? String(c.kmAtual) : "",
      renavam: c.renavam || "",
      obs: c.obs || "",
    });
  };

  const adicionar = async (e) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return;
    // Só limpa os campos se o servidor confirmou: limpar antes some com o que
    // foi digitado justamente quando a gravação falhou e precisa de repetição.
    const ok = await aoAdicionar(nome, novaPlaca.trim().toUpperCase());
    if (ok) {
      setNovoNome("");
      setNovaPlaca("");
    }
  };

  const gravarFicha = async (e) => {
    e.preventDefault();
    const km = String(ficha.kmAtual).trim();
    const ok = await aoGravarFicha(fichaId, {
      nome: ficha.nome.trim(),
      placa: ficha.placa.trim().toUpperCase(),
      modelo: ficha.modelo.trim(),
      ano: ficha.ano === "" ? null : Number(ficha.ano),
      // Km em branco grava null, não 0: carro sem leitura não é carro zerado.
      kmAtual: km === "" ? null : Math.round(paraNumero(km)),
      renavam: soDigitos(ficha.renavam),
      obs: ficha.obs.trim(),
    });
    if (ok) setFichaId("");
  };

  return (
    <Modal titulo="Frota" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={adicionar} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-40">
          <label className="label" htmlFor="ca-nome">Novo carro</label>
          <input
            id="ca-nome" type="text" className="input" placeholder="Ex.: Fiorino branca"
            value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
          />
        </div>
        <div className="w-32">
          <label className="label" htmlFor="ca-placa">Placa</label>
          <input
            id="ca-placa" type="text" className="input uppercase" placeholder="ABC1D23"
            value={novaPlaca} onChange={(e) => setNovaPlaca(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={salvando || !novoNome.trim()}>
          <Plus size={16} strokeWidth={2.5} /> Adicionar
        </button>
      </form>

      {ordenados.length === 0 ? (
        <Empty>Nenhum carro cadastrado ainda.</Empty>
      ) : (
        <div className="space-y-2">
          {ordenados.map((c) => {
            const ativo = c.ativo !== false;
            const aberta = fichaId === c.id;
            const resumo = [
              c.placa ? String(c.placa).toUpperCase() : "sem placa",
              c.modelo || null,
              c.ano || null,
              temKm(c) ? `${numero(c.kmAtual)} km` : null,
            ].filter(Boolean).join(" · ");
            return (
              <div key={c.id} className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
                <div className="flex flex-wrap items-center gap-3">
                  <Car size={16} strokeWidth={2.2} className={ativo ? "text-brand-600" : "text-slate-300"} />
                  <span className="min-w-0 flex-1 basis-40">
                    <span className={`block truncate text-sm ${ativo ? "text-slate-900" : "text-slate-400 line-through"}`}>
                      {c.nome}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{resumo}</span>
                  </span>
                  {!ativo && <span className="chip">desativado</span>}
                  <button
                    type="button"
                    className="btn-outline px-2.5 py-1 text-xs"
                    aria-expanded={aberta}
                    onClick={() => (aberta ? setFichaId("") : abrirFicha(c))}
                  >
                    {aberta ? "Fechar" : "Ficha"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline px-2.5 py-1 text-xs"
                    disabled={salvando}
                    onClick={() => aoAlternar(c)}
                  >
                    {ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>

                {aberta && (
                  <form onSubmit={gravarFicha} className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label" htmlFor="ficha-nome">Nome</label>
                        <input id="ficha-nome" type="text" className="input" value={ficha.nome} onChange={setCampoFicha("nome")} required />
                      </div>
                      <div>
                        <label className="label" htmlFor="ficha-placa">Placa</label>
                        <input id="ficha-placa" type="text" className="input uppercase" value={ficha.placa} onChange={setCampoFicha("placa")} />
                      </div>
                      <div>
                        <label className="label" htmlFor="ficha-modelo">Modelo</label>
                        <input id="ficha-modelo" type="text" className="input" placeholder="opcional" value={ficha.modelo} onChange={setCampoFicha("modelo")} />
                      </div>
                      <div>
                        <label className="label" htmlFor="ficha-ano">Ano</label>
                        <input
                          id="ficha-ano" type="number" className="input" min="1950" max="2100" step="1"
                          placeholder="opcional" value={ficha.ano} onChange={setCampoFicha("ano")}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="ficha-km">Quilometragem</label>
                        <input
                          id="ficha-km" type="text" inputMode="numeric" className="input"
                          placeholder="em branco = sem registro"
                          value={ficha.kmAtual} onChange={setCampoFicha("kmAtual")}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          {!temKm(c)
                            ? "Nenhuma leitura registrada."
                            : c.kmAtualEm
                              ? `Última leitura em ${dataLonga(c.kmAtualEm)}.`
                              : "Leitura antiga, sem data."}
                        </p>
                      </div>
                      <div>
                        <label className="label" htmlFor="ficha-renavam">Renavam</label>
                        <input
                          id="ficha-renavam" type="text" inputMode="numeric" className="input"
                          placeholder="opcional" value={ficha.renavam} onChange={setCampoFicha("renavam")}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="ficha-obs">Observações</label>
                      <textarea id="ficha-obs" className="input" rows={2} value={ficha.obs} onChange={setCampoFicha("obs")} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-outline" onClick={() => setFichaId("")}>Cancelar</button>
                      <button type="submit" className="btn-primary" disabled={salvando || !ficha.nome.trim()}>
                        {salvando ? "Gravando..." : "Gravar ficha"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// Cadastro de equipamentos. Desativar em vez de apagar: o histórico de
// manutenções aponta para o equipamento, e apagar deixaria linhas órfãs.
function ModalEquipamentos({ aberto, aoFechar, equipamentos, salvando, aoAdicionar, aoAlternar }) {
  const [novoNome, setNovoNome] = useState("");
  if (!aberto) return null;

  const ordenados = [...equipamentos].sort(
    (a, b) =>
      Number(b.ativo !== false) - Number(a.ativo !== false) ||
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
  );

  return (
    <Modal titulo="Equipamentos do laboratório" aberto={aberto} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const nome = novoNome.trim();
          if (!nome) return;
          setNovoNome("");
          aoAdicionar(nome);
        }}
        className="mb-4 flex gap-2"
      >
        <div className="flex-1">
          <label className="label" htmlFor="eq-nome">Novo equipamento</label>
          <input
            id="eq-nome" type="text" className="input" placeholder="Ex.: Espectrofotômetro UV-Vis"
            value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary self-end" disabled={salvando || !novoNome.trim()}>
          <Plus size={16} strokeWidth={2.5} /> Adicionar
        </button>
      </form>

      {ordenados.length === 0 ? (
        <Empty>Nenhum equipamento cadastrado ainda.</Empty>
      ) : (
        <div className="space-y-2">
          {ordenados.map((eq) => {
            const ativo = eq.ativo !== false;
            return (
              <div
                key={eq.id}
                className="flex items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: "var(--hairline)" }}
              >
                <Wrench size={16} strokeWidth={2.2} className={ativo ? "text-brand-600" : "text-slate-300"} />
                <span className={`min-w-0 flex-1 truncate text-sm ${ativo ? "text-slate-900" : "text-slate-400 line-through"}`}>
                  {eq.nome}
                </span>
                {!ativo && <span className="chip">desativado</span>}
                <button
                  type="button"
                  className="btn-outline px-2.5 py-1 text-xs"
                  disabled={salvando}
                  onClick={() => aoAlternar(eq)}
                >
                  {ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default function Manutencoes() {
  const sessao = getSessao();
  const editavel = podeEditar(sessao);

  const [itens, setItens] = useState(null);
  const [equipamentos, setEquipamentos] = useState(null);
  const [carros, setCarros] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [modalEq, setModalEq] = useState(false);
  const [modalCarros, setModalCarros] = useState(false);
  const [filtroAlvo, setFiltroAlvo] = useState("");
  // Os cartões viram recorte: clicar filtra as seções; clicar de novo volta.
  const [recorte, setRecorte] = useState(null); // "vencidas" | "proximas" | null
  // "Hoje" é ESTADO, não conta do render: a tela fica aberta de um dia para o
  // outro e o dia congelado mentiria o prazo da calibração.
  const [hojeISO, setHojeISO] = useState(() => ymdLocal(new Date()));

  const recarregar = useCallback(() => {
    setHojeISO(ymdLocal(new Date()));
    Promise.all([listar(COLECAO), listar("equipamentos"), listar("carros")])
      .then(([ms, eqs, cs]) => {
        setItens(ms);
        setEquipamentos(eqs);
        setCarros(cs);
        setErro(null);
      })
      .catch((e) => {
        setErro(e.message);
        // Depois da primeira carga boa o ErroModulo não aparece mais (vm já
        // existe): sem este aviso a tela ficava com números velhos sob a data
        // de hoje, em silêncio.
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
    if (!itens || !equipamentos || !carros) return null;
    const anoAtual = hojeISO.slice(0, 4);

    const agendadas = itens
      .filter((m) => m.status === "agendada")
      .map((m) => {
        const dias = m.data ? diasEntre(hojeISO, m.data) : null;
        return { ...m, dias, pz: prazoAgendada(dias) };
      })
      .sort((a, b) => String(a.data || "9999").localeCompare(String(b.data || "9999")));

    const feitas = itens
      .filter((m) => m.status === "feita")
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));

    // Seção 1: para cada alvo ATIVO, a manutenção feita mais recente que tem
    // "próxima" marcada — a regra mora em lib/manutencaoRegra.js porque Home
    // e Calendário contam pela MESMA. Quem nunca teve manutenção aparece como
    // "sem registro" — dado ausente não é "em dia".
    const proximas = proximasPorAlvo(itens);
    const alvosAtivos = [
      ...carros.filter((c) => c.ativo !== false).map((c) => ({ ...c, alvoTipo: "carro" })),
      ...equipamentos.filter((e) => e.ativo !== false).map((e) => ({ ...e, alvoTipo: "equipamento" })),
    ];
    const alvos = alvosAtivos
      .map((a) => {
        const doAlvo = itens.filter((m) => m.alvoTipo === a.alvoTipo && m.alvoId === a.id);
        const base = {
          alvoTipo: a.alvoTipo, id: a.id, nome: a.nome, placa: a.placa,
          // Km só existe para carro; equipamento não roda estrada.
          km: a.alvoTipo === "carro" && temKm(a) ? Number(a.kmAtual) : null,
          kmEm: a.kmAtualEm || null,
        };
        const ult = proximas.get(chaveAlvo(a.alvoTipo, a.id));
        if (ult) {
          const dias = diasEntre(hojeISO, ult.proxima);
          const pz = prazoProxima(dias);
          return {
            ...base, situacao: "prazo", dias, ...pz,
            sub: `${TIPOS[ult.tipo] || ult.tipo} em ${dataLonga(ult.data)} · próxima ${dataLonga(ult.proxima)}`,
          };
        }
        if (doAlvo.length > 0) {
          const ultima = [...doAlvo].sort((x, y) => String(y.data || "").localeCompare(String(x.data || "")))[0];
          return {
            ...base, situacao: "semProxima", dias: null,
            texto: "sem próxima marcada", chip: "chip", peso: 9999,
            sub: `última movimentação em ${ultima.data ? dataLonga(ultima.data) : "data não informada"}`,
          };
        }
        // "sem registro" fica logo depois das vencidas: não saber também cobra.
        return {
          ...base, situacao: "semRegistro", dias: null,
          texto: "sem registro", chip: "chip-warn", peso: -0.5,
          sub: "nenhuma manutenção registrada",
        };
      })
      .sort((a, b) => a.peso - b.peso || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

    const alvosVencidos = alvos.filter((x) => x.situacao === "prazo" && x.dias < 0);
    const alvosProximos = alvos.filter((x) => x.situacao === "prazo" && x.dias >= 0 && x.dias <= 30);
    const agAtrasadas = agendadas.filter((m) => m.dias !== null && m.dias < 0);
    const agProximas = agendadas.filter((m) => m.dias !== null && m.dias >= 0 && m.dias <= 30);

    const feitasAno = feitas.filter((m) => String(m.data || "").slice(0, 4) === anoAtual);
    const comCusto = feitasAno.filter((m) => m.custo != null && m.custo !== "");
    const custoAno = comCusto.reduce((s, m) => s + (Number(m.custo) || 0), 0);

    // Opções do filtro do histórico saem do próprio histórico (nome carimbado
    // na gravação): alvo apagado do cadastro continua filtrável.
    const opcoesFiltro = [];
    for (const m of feitas) {
      const chave = `${m.alvoTipo}|${m.alvoId}`;
      if (!opcoesFiltro.some((o) => o.chave === chave)) {
        opcoesFiltro.push({ chave, nome: m.alvoNome || "(alvo sem nome)" });
      }
    }
    opcoesFiltro.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return {
      agendadas, feitas, alvos, opcoesFiltro, anoAtual,
      vencidas: agAtrasadas.length + alvosVencidos.length,
      proximas: agProximas.length + alvosProximos.length,
      feitasAno: feitasAno.length,
      comCusto: comCusto.length,
      semCusto: feitasAno.length - comCusto.length,
      custoAno,
    };
  }, [itens, equipamentos, carros, hojeISO]);

  const gravar = async (dados, fraseOk) => {
    setSalvando(true);
    try {
      // Derivados do render (dias, prazo) não vão ao banco — são conta da tela.
      const { dias: _dias, pz: _pz, ...limpo } = dados;
      // CARIMBO: o nome do alvo é resolvido AGORA e gravado junto. Se o carro
      // ou o equipamento for renomeado depois, o histórico não quebra.
      const alvo = (limpo.alvoTipo === "carro" ? carros : equipamentos)?.find((a) => a.id === limpo.alvoId);
      if (alvo) limpo.alvoNome = alvo.nome;
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
          : { ...VAZIO, data: hojeISO }
      ),
    marcarFeita: (m) => gravar({ ...m, status: "feita" }, "Manutenção marcada como feita."),
    remover: async (m) => {
      if (!window.confirm(`Apagar "${m.descricao}" (${m.alvoNome})?`)) return;
      try {
        await apagar(COLECAO, m.id);
        setAviso({ tipo: "ok", texto: "Manutenção apagada." });
        recarregar();
      } catch (e) {
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
  };

  const salvarForm = () => {
    const custoTexto = String(form.custo ?? "").trim();
    gravar(
      // Campo de custo em branco grava null, não 0: ausente não é de graça.
      { ...form, custo: custoTexto === "" ? null : paraNumero(custoTexto) },
      form.id ? "Manutenção atualizada." : "Manutenção registrada."
    );
  };

  const adicionarEquipamento = async (nome) => {
    setSalvando(true);
    try {
      await salvar("equipamentos", { nome, ativo: true });
      setAviso({ tipo: "ok", texto: `Equipamento "${nome}" adicionado.` });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const alternarEquipamento = async (eq) => {
    const ativo = eq.ativo !== false;
    setSalvando(true);
    try {
      await salvar("equipamentos", { ...eq, ativo: !ativo });
      setAviso({
        tipo: "ok",
        texto: ativo
          ? `"${eq.nome}" desativado. O histórico dele continua aqui.`
          : `"${eq.nome}" reativado.`,
      });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const adicionarCarro = async (nome, placa) => {
    setSalvando(true);
    try {
      await salvar("carros", { nome, placa, ativo: true });
      setAviso({ tipo: "ok", texto: `Carro "${nome}" adicionado à frota.` });
      recarregar();
      return true;
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const alternarCarro = async (c) => {
    const ativo = c.ativo !== false;
    setSalvando(true);
    try {
      await salvar("carros", { ...c, ativo: !ativo });
      setAviso({
        tipo: "ok",
        texto: ativo
          ? `"${c.nome}" desativado. O histórico de manutenção dele continua aqui.`
          : `"${c.nome}" reativado.`,
      });
      recarregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const gravarFichaCarro = async (id, campos) => {
    // Relê o carro da lista PELO ID na hora de gravar: o objeto capturado
    // quando a ficha abriu pode ter envelhecido num recarregar, e gravar por
    // cima apagaria o que mudou no servidor enquanto a ficha estava aberta.
    const atual = carros.find((c) => c.id === id);
    if (!atual) {
      setAviso({ tipo: "erro", texto: "Este carro não está mais na lista. Recarregue e tente de novo." });
      return false;
    }
    setSalvando(true);
    try {
      // A data da leitura é carimbada quando o NÚMERO muda. Regravar a ficha
      // sem mexer no km não rejuvenesce a leitura — e o carimbo usa o relógio,
      // não o "hoje" da tela, que pode estar aberta desde ontem.
      const mudouKm = campos.kmAtual !== (atual.kmAtual ?? null);
      const kmAtualEm =
        campos.kmAtual == null ? null : mudouKm ? ymdLocal(new Date()) : atual.kmAtualEm || null;
      await salvar("carros", { ...atual, ...campos, kmAtualEm });
      setAviso({ tipo: "ok", texto: `Ficha de "${campos.nome || atual.nome}" gravada.` });
      recarregar();
      return true;
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
      return false;
    } finally {
      setSalvando(false);
    }
  };

  if (erro && !vm) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!vm) return <CarregandoModulo />;

  const alvosVisiveis =
    recorte === "vencidas"
      ? vm.alvos.filter((x) => x.situacao === "prazo" && x.dias < 0)
      : recorte === "proximas"
        ? vm.alvos.filter((x) => x.situacao === "prazo" && x.dias >= 0 && x.dias <= 30)
        : vm.alvos;
  const agendadasVisiveis =
    recorte === "vencidas"
      ? vm.agendadas.filter((m) => m.dias !== null && m.dias < 0)
      : recorte === "proximas"
        ? vm.agendadas.filter((m) => m.dias !== null && m.dias >= 0 && m.dias <= 30)
        : vm.agendadas;
  const historicoVisivel = filtroAlvo
    ? vm.feitas.filter((m) => `${m.alvoTipo}|${m.alvoId}` === filtroAlvo)
    : vm.feitas;

  // Sai o que está na tela — o mesmo recorte do filtro. Planilha que exporta
  // "tudo" enquanto a tela mostra um alvo entrega uma conta que ninguém pediu.
  // Por isso o alvo filtrado vai ESCRITO no título: fora da tela, a planilha
  // perde o filtro de vista e um recorte anônimo passa por total.
  const alvoFiltrado = filtroAlvo
    ? vm.opcoesFiltro.find((o) => o.chave === filtroAlvo)?.nome
    : null;

  const exportarHistorico = () => {
    try {
      // baixarPlanilha já carimba o dia local no nome do arquivo — repetir a
      // data aqui sairia "…-2026-08-27-2026-08-27.xlsx".
      const arquivo = baixarPlanilha({
        nome: "manutencoes-historico",
        titulo: `Histórico de manutenções${alvoFiltrado ? ` — ${alvoFiltrado}` : ""}`,
        colunas: [
          { chave: "data", rotulo: "Data", tipo: "data" },
          { chave: "alvo", rotulo: "Alvo", tipo: "texto" },
          { chave: "tipo", rotulo: "Tipo", tipo: "texto" },
          { chave: "descricao", rotulo: "Descrição", tipo: "texto" },
          { chave: "custo", rotulo: "Custo", tipo: "dinheiro" },
          { chave: "proxima", rotulo: "Próxima", tipo: "data" },
          { chave: "status", rotulo: "Situação", tipo: "texto" },
        ],
        linhas: historicoVisivel.map((m) => ({
          data: m.data || null,
          alvo: m.alvoNome || "(alvo sem nome)",
          tipo: TIPOS[m.tipo] || m.tipo,
          descricao: m.descricao || "",
          // Custo ausente vai VAZIO, não 0: a planilha vai ser somada, e um
          // zero inventado viraria "manutenção de graça" na conta do ano.
          custo: m.custo == null || m.custo === "" ? null : Number(m.custo),
          proxima: m.proxima || null,
          status: m.status === "feita" ? "Feita" : "Agendada",
        })),
      });
      setAviso({
        tipo: "ok",
        texto: `${arquivo} baixado (${historicoVisivel.length} ${historicoVisivel.length === 1 ? "linha" : "linhas"}).`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Não consegui gerar a planilha: ${e.message}` });
    }
  };

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Manutenções"
        descricao="Carros e equipamentos do laboratório — calibração vencida compromete o laudo."
        acao={
          <div className="flex flex-wrap gap-2">
            {/* Baixar é LEITURA: quem enxerga a tela pode levar o recorte
                embora, mesmo sem permissão de escrita. */}
            <button
              type="button"
              className="btn-outline disabled:cursor-not-allowed disabled:opacity-50"
              onClick={exportarHistorico}
              disabled={historicoVisivel.length === 0}
              title={historicoVisivel.length === 0 ? "Nada no histórico para baixar" : undefined}
            >
              <Download size={16} strokeWidth={2.2} /> Baixar planilha
            </button>
            {editavel && (
              <>
                <button type="button" className="btn-outline" onClick={() => setModalCarros(true)}>
                  <Car size={16} strokeWidth={2.2} /> Carros
                </button>
                <button type="button" className="btn-outline" onClick={() => setModalEq(true)}>
                  <Wrench size={16} strokeWidth={2.2} /> Equipamentos
                </button>
                <button type="button" className="btn-primary" onClick={() => acoes.abrirForm(null)}>
                  <Plus size={16} strokeWidth={2.5} /> Nova manutenção
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Vencidas"
          valor={String(vm.vencidas)}
          tom={vm.vencidas > 0 ? "bad" : "ok"}
          icone={AlertTriangle}
          onClick={() => setRecorte(recorte === "vencidas" ? null : "vencidas")}
          ativo={recorte === "vencidas"}
        />
        <StatCard
          rotulo="Próximas (30 dias)"
          valor={String(vm.proximas)}
          tom={vm.proximas > 0 ? "warn" : "neutral"}
          icone={CalendarClock}
          onClick={() => setRecorte(recorte === "proximas" ? null : "proximas")}
          ativo={recorte === "proximas"}
        />
        <StatCard rotulo="Feitas no ano" valor={String(vm.feitasAno)} tom="ok" icone={CheckCircle2} />
        <StatCard
          rotulo="Custo no ano"
          valor={vm.comCusto > 0 ? moeda(vm.custoAno) : "sem registro"}
          sub={vm.comCusto > 0 && vm.semCusto > 0 ? `${vm.semCusto} sem custo lançado` : undefined}
          tom="neutral"
          icone={HandCoins}
        />
      </div>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Próxima manutenção por alvo <span className="text-slate-400">({alvosVisiveis.length})</span>
          </h2>
          {alvosVisiveis.length === 0 ? (
            <Empty>
              {recorte
                ? "Nada neste recorte. Clique de novo no cartão para ver tudo."
                : editavel
                  ? "Nenhum carro ou equipamento ativo. Cadastre pelos botões Carros e Equipamentos, lá em cima."
                  : "Nenhum carro ou equipamento ativo cadastrado."}
            </Empty>
          ) : (
            <div className="space-y-2">
              {alvosVisiveis.map((a) => (
                <LinhaAlvo key={`${a.alvoTipo}|${a.id}`} a={a} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
            Agendadas <span className="text-slate-400">({agendadasVisiveis.length})</span>
          </h2>
          {agendadasVisiveis.length === 0 ? (
            <Empty>
              {recorte ? "Nada neste recorte." : "Nenhuma manutenção agendada."}
            </Empty>
          ) : (
            <div className="space-y-2">
              {agendadasVisiveis.map((m) => (
                <LinhaAgendada key={m.id} m={m} editavel={editavel} acoes={acoes} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
              Histórico <span className="text-slate-400">({historicoVisivel.length})</span>
            </h2>
            {vm.opcoesFiltro.length > 0 && (
              <div>
                <label className="sr-only" htmlFor="h-filtro">Filtrar por alvo</label>
                <select
                  id="h-filtro"
                  className="select h-9 w-56 py-0 text-sm"
                  value={filtroAlvo}
                  onChange={(e) => setFiltroAlvo(e.target.value)}
                >
                  <option value="">Todos os alvos</option>
                  {vm.opcoesFiltro.map((o) => (
                    <option key={o.chave} value={o.chave}>{o.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {historicoVisivel.length === 0 ? (
            <Empty>
              {filtroAlvo ? "Nenhuma manutenção feita para este alvo." : "Nenhuma manutenção feita ainda."}
            </Empty>
          ) : (
            <div className="space-y-2">
              {historicoVisivel.map((m) => (
                <LinhaHistorico key={m.id} m={m} editavel={editavel} acoes={acoes} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <FormManutencao
        form={form}
        setForm={setForm}
        carros={carros}
        equipamentos={equipamentos}
        salvando={salvando}
        aoSalvar={salvarForm}
        aoFechar={() => setForm(null)}
      />

      {editavel && (
        <ModalCarros
          aberto={modalCarros}
          aoFechar={() => setModalCarros(false)}
          carros={carros}
          salvando={salvando}
          aoAdicionar={adicionarCarro}
          aoAlternar={alternarCarro}
          aoGravarFicha={gravarFichaCarro}
        />
      )}

      {editavel && (
        <ModalEquipamentos
          aberto={modalEq}
          aoFechar={() => setModalEq(false)}
          equipamentos={equipamentos}
          salvando={salvando}
          aoAdicionar={adicionarEquipamento}
          aoAlternar={alternarEquipamento}
        />
      )}
    </div>
  );
}
