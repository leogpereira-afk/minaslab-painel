// Agenda: reuniões, treinamentos e outros compromissos num calendário do mês.
// Reuniões e compromissos ficam numa agenda única para os dois setores; os
// treinamentos agendados são os do setor (os mesmos do Plano e calendário).
import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal } from "../components/ui.jsx";
import { Registro, useCatalogo } from "./Treinamentos.jsx";
import { trilhaEmQualquerLugar } from "../lib/catalogo.js";
import { hojeBR, dataCurta, mesNome } from "../lib/format.js";

const TIPOS = {
  reuniao: { nome: "Reunião", cor: "reuniao" },
  treinamento: { nome: "Treinamento", cor: "treinamento" },
  outro: { nome: "Outro compromisso", cor: "outro" },
};
const TIPOS_REUNIAO = ["Equipe geral", "Comercial", "Laboratório", "Individual (1:1)", "Análise crítica pela direção", "Com cliente ou fornecedor", "Outra"];
const ST = { agendado: ["neutro", "Agendado"], realizado: ["ok", "Realizado"], cancelado: ["ruim", "Cancelado"] };
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const iso = (d) => d.toISOString().slice(0, 10);
const dataUTC = (s) => new Date(`${s}T12:00:00Z`);
const somarDias = (s, n) => iso(new Date(dataUTC(s).getTime() + n * 864e5));
function somarMesesDia(s, n) {
  const [a, m, d] = s.split("-").map(Number);
  const t = a * 12 + (m - 1) + n; const ano = Math.floor(t / 12), mes = (t % 12) + 1;
  const ult = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ult)).padStart(2, "0")}`;
}
const mesDe = (s) => s.slice(0, 7);
const somarMes = (m, n) => somarMesesDia(`${m}-01`, n).slice(0, 7);

/** Dias da grade do mês (de domingo a sábado, com dias vizinhos). */
function gradeDoMes(mes) {
  const primeiro = `${mes}-01`;
  const ini = somarDias(primeiro, -dataUTC(primeiro).getUTCDay());
  const ultimo = somarMesesDia(primeiro, 1);
  const fimMes = somarDias(ultimo, -1);
  const fim = somarDias(fimMes, 6 - dataUTC(fimMes).getUTCDay());
  const dias = [];
  for (let d = ini; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** Junta reuniões/compromissos (agenda) e treinamentos agendados do setor. */
function eventos(dados, cat) {
  const ag = (dados.agenda || []).map((e) => ({ ...e, origem: "agenda", tipo: e.tipo || "reuniao" }));
  const tr = (dados.treinamentos || []).filter((r) => r.tipo === "agenda").map((r) => ({
    ...r, origem: "treinamentos", tipo: "treinamento",
    titulo: trilhaEmQualquerLugar(cat, r.trilhaId)?.nome || r.titulo || "Treinamento",
  }));
  return [...ag, ...tr].sort((a, b) => `${a.data}${a.hora || ""}`.localeCompare(`${b.data}${b.hora || ""}`));
}

export default function Agenda() {
  const { dados } = useBase();
  const { cat } = useCatalogo();
  const hoje = hojeBR();
  const [mes, setMes] = useState(mesDe(hoje));
  const [form, setForm] = useState(null); // evento (novo ou existente)
  const [ver, setVer] = useState(null);
  const [filtro, setFiltro] = useState({ reuniao: true, treinamento: true, outro: true });
  const todos = eventos(dados, cat).filter((e) => filtro[e.tipo]);
  const doDia = (d) => todos.filter((e) => e.data === d);
  const proximos = todos.filter((e) => e.data >= hoje && (e.status || "agendado") === "agendado").slice(0, 12);
  const semBaixa = todos.filter((e) => e.data < hoje && (e.status || "agendado") === "agendado");
  const dias = gradeDoMes(mes);

  return (
    <>
      <Cabecalho sobre="Agenda" titulo="Agenda de reuniões e treinamentos" sub="Marque reuniões, treinamentos e outros compromissos. Clique num dia para marcar; clique num compromisso para ver, editar ou dar baixa.">
        <button type="button" className="btn" onClick={() => setForm({ data: hoje })}>Marcar compromisso</button>
      </Cabecalho>

      <div className="agenda-topo">
        <div className="pilulas" role="group" aria-label="Mês">
          <button type="button" className="pilula" aria-label="Mês anterior" onClick={() => setMes(somarMes(mes, -1))}>‹</button>
          <span className="pilula ativa" style={{ cursor: "default", minWidth: 150, textAlign: "center" }}>{mesNome(mes).replace(/^./, (c) => c.toUpperCase())} {mes.slice(0, 4)}</span>
          <button type="button" className="pilula" aria-label="Próximo mês" onClick={() => setMes(somarMes(mes, 1))}>›</button>
        </div>
        <button type="button" className="btn claro mini" onClick={() => setMes(mesDe(hoje))}>Hoje</button>
        <div className="agenda-legenda">
          {Object.entries(TIPOS).map(([id, t]) => (
            <label key={id} className={`agenda-filtro ev-${t.cor}`}><input type="checkbox" checked={filtro[id]} onChange={(e) => setFiltro({ ...filtro, [id]: e.target.checked })} /><span className="ev-ponto" aria-hidden="true" />{t.nome}</label>
          ))}
        </div>
      </div>

      {semBaixa.length > 0 && <div className="aviso alerta">{semBaixa.length} compromisso(s) já passaram sem baixa. Abra cada um e marque como realizado ou cancelado; nos treinamentos, a baixa registra quem participou.</div>}

      <div className="agenda-layout">
        <Card semPad className="agenda-cal">
          <div className="agenda-grade" role="grid" aria-label={`Calendário de ${mesNome(mes)}`}>
            {SEMANA.map((d) => <div key={d} className="agenda-semana" role="columnheader">{d}</div>)}
            {dias.map((d) => {
              const evs = doDia(d);
              const fora = mesDe(d) !== mes;
              return (
                <div key={d} role="gridcell" className={`agenda-dia${fora ? " fora" : ""}${d === hoje ? " hoje" : ""}`}>
                  <button type="button" className="agenda-num" onClick={() => setForm({ data: d })} aria-label={`Marcar em ${dataCurta(d)}`}>{Number(d.slice(8))}</button>
                  <div className="agenda-evs">
                    {evs.slice(0, 3).map((e) => (
                      <button key={`${e.origem}-${e.id}`} type="button" className={`agenda-ev ev-${TIPOS[e.tipo].cor}${e.status === "cancelado" ? " cancelado" : ""}${e.status === "realizado" ? " realizado" : ""}`} onClick={() => setVer(e)} title={`${e.titulo}${e.status === "realizado" ? " (realizado)" : e.status === "cancelado" ? " (cancelado)" : ""}`}>
                        {e.status === "realizado" && "✓ "}{e.hora && <span className="tnum">{e.hora} </span>}{e.titulo}
                      </button>
                    ))}
                    {evs.length > 3 && <button type="button" className="agenda-mais" onClick={() => setVer({ lista: evs, data: d })}>+{evs.length - 3}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card semPad className="agenda-lado">
          <div className="card-cab"><h2>Próximos</h2><span className="suave peq">{proximos.length}</span></div>
          {proximos.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nada marcado. Clique num dia do calendário.</div> : (
            <ul className="agenda-proximos">
              {proximos.map((e) => (
                <li key={`${e.origem}-${e.id}`}>
                  <button type="button" onClick={() => setVer(e)}>
                    <span className={`ev-ponto ev-${TIPOS[e.tipo].cor}`} aria-hidden="true" />
                    <span style={{ minWidth: 0 }}><b>{e.titulo}</b><span className="suave peq">{dataCurta(e.data)}{e.hora ? ` · ${e.hora}` : ""}{e.local ? ` · ${e.local}` : ""}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {form && <FormEvento ev={form} aoFechar={() => setForm(null)} />}
      {ver && <VerEvento ev={ver} aoFechar={() => setVer(null)} aoEditar={(e) => { setVer(null); setForm(e); }} aoAbrir={(e) => setVer(e)} />}
    </>
  );
}

function FormEvento({ ev, aoFechar }) {
  const { gravar } = useBase();
  const { cat } = useCatalogo();
  const novo = !ev.id;
  const [f, setF] = useState({
    tipo: ev.tipo || "reuniao", titulo: ev.origem === "treinamentos" ? "" : ev.titulo || "", trilhaId: ev.trilhaId || cat.ativos[0]?.id || "",
    tipoReuniao: ev.tipoReuniao || "Equipe geral", data: ev.data || hojeBR(), hora: ev.hora || "", horaFim: ev.horaFim || "",
    local: ev.local || "", responsavel: ev.responsavel || "", participantes: ev.participantes || "", obs: ev.obs || "",
  });
  const [repetir, setRepetir] = useState("nao");
  const [vezes, setVezes] = useState(4);
  const [msg, setMsg] = useState("");
  const campo = (k, rot, props = {}) => <div className="campo"><label htmlFor={`ag-${k}`}>{rot}</label><input id={`ag-${k}`} className="entrada" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></div>;
  const salvar = async () => {
    if (!f.data) { setMsg("Escolha a data."); return; }
    if (f.tipo !== "treinamento" && !f.titulo.trim()) { setMsg("Dê um título (ex.: Reunião geral de outubro)."); return; }
    const datas = [f.data];
    if (novo && repetir !== "nao") for (let k = 1; k < Math.min(Math.max(Number(vezes) || 1, 1), 12); k++) datas.push(repetir === "semana" ? somarDias(f.data, 7 * k) : somarMesesDia(f.data, k));
    const base = Date.now().toString(36);
    try {
      for (const [k, d] of datas.entries()) {
        const id = novo ? `ag-${base}${datas.length > 1 ? `-${k + 1}` : ""}` : ev.id;
        const comum = { id, data: d, hora: f.hora, horaFim: f.horaFim, local: f.local, responsavel: f.responsavel, obs: f.obs, status: ev.status || "agendado" };
        if (f.tipo === "treinamento") {
          const t = trilhaEmQualquerLugar(cat, f.trilhaId);
          await gravar("treinamentos", { ...(ev.origem === "treinamentos" ? ev : {}), ...comum, tipo: "agenda", trilhaId: f.trilhaId, titulo: t?.nome || "", participantes: undefined, origem: undefined });
        } else {
          await gravar("agenda", { ...(ev.origem === "agenda" ? ev : {}), ...comum, tipo: f.tipo, titulo: f.titulo.trim(), tipoReuniao: f.tipo === "reuniao" ? f.tipoReuniao : "", participantes: f.participantes, origem: undefined });
        }
      }
      aoFechar();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Modal titulo={novo ? "Marcar compromisso" : "Editar compromisso"} aoFechar={aoFechar} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="pilulas" role="group" aria-label="Tipo">
          {Object.entries(TIPOS).map(([id, t]) => <button key={id} type="button" className={`pilula${f.tipo === id ? " ativa" : ""}`} onClick={() => setF({ ...f, tipo: id })} disabled={!novo && (ev.origem === "treinamentos") !== (id === "treinamento")}>{t.nome}</button>)}
        </div>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {f.tipo === "treinamento" ? (
            <div className="campo" style={{ gridColumn: "1 / -1" }}><label htmlFor="ag-trilha">Treinamento</label><select id="ag-trilha" className="entrada" value={f.trilhaId} onChange={(e) => setF({ ...f, trilhaId: e.target.value })}>{cat.ativos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
          ) : (
            <>
              <div style={{ gridColumn: "1 / -1" }}>{campo("titulo", "Título", { placeholder: f.tipo === "reuniao" ? "Ex.: Reunião geral de novembro" : "Ex.: Visita da Vigilância Sanitária" })}</div>
              {f.tipo === "reuniao" && <div className="campo"><label htmlFor="ag-tr">Tipo de reunião</label><select id="ag-tr" className="entrada" value={f.tipoReuniao} onChange={(e) => setF({ ...f, tipoReuniao: e.target.value })}>{TIPOS_REUNIAO.map((x) => <option key={x}>{x}</option>)}</select></div>}
            </>
          )}
          {campo("data", "Data", { type: "date" })}
          {campo("hora", "Início", { type: "time" })}
          {campo("horaFim", "Fim", { type: "time" })}
          {campo("local", "Local")}
          {campo("responsavel", f.tipo === "treinamento" ? "Quem aplica" : "Responsável")}
        </div>
        {f.tipo !== "treinamento" && <div className="campo"><label htmlFor="ag-part">Participantes</label><input id="ag-part" className="entrada" value={f.participantes} onChange={(e) => setF({ ...f, participantes: e.target.value })} placeholder="Ex.: toda a equipe, ou os nomes" /></div>}
        <div className="campo"><label htmlFor="ag-obs">Pauta ou observação</label><textarea id="ag-obs" className="entrada" rows={3} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
        {novo && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="campo"><label htmlFor="ag-rep">Repetir</label><select id="ag-rep" className="entrada" value={repetir} onChange={(e) => setRepetir(e.target.value)}><option value="nao">Não repete</option><option value="semana">Toda semana</option><option value="mes">Todo mês (mesmo dia)</option></select></div>
            {repetir !== "nao" && <div className="campo" style={{ maxWidth: 140 }}><label htmlFor="ag-vezes">Quantas vezes</label><input id="ag-vezes" className="entrada" type="number" min="2" max="12" value={vezes} onChange={(e) => setVezes(e.target.value)} /></div>}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn" onClick={salvar} >{novo ? "Marcar" : "Salvar"}</button>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          {msg && <span className="peq">{msg}</span>}
          {f.tipo === "treinamento" && <span className="suave peq">Aparece também em Treinamentos › Plano e calendário.</span>}
        </div>
      </div>
    </Modal>
  );
}

function VerEvento({ ev, aoFechar, aoEditar, aoAbrir }) {
  const { gravar, remover } = useBase();
  const { cat } = useCatalogo();
  const [baixa, setBaixa] = useState(false);
  const [msg, setMsg] = useState("");
  if (ev.lista) {
    return (
      <Modal titulo={`Compromissos de ${dataCurta(ev.data)}`} aoFechar={aoFechar}>
        <ul className="agenda-proximos">{ev.lista.map((e) => <li key={`${e.origem}-${e.id}`}><button type="button" onClick={() => aoAbrir(e)}><span className={`ev-ponto ev-${TIPOS[e.tipo].cor}`} aria-hidden="true" /><span><b>{e.titulo}</b><span className="suave peq">{e.hora || "sem hora"}</span></span></button></li>)}</ul>
      </Modal>
    );
  }
  const colecao = ev.origem;
  const limpo = (() => { const { origem: _o, ...r } = ev; return ev.origem === "treinamentos" ? { ...r, tipo: "agenda", titulo: ev.titulo } : r; })();
  const st = ev.status || "agendado";
  const [tom, rot] = ST[st] || ST.agendado;
  const marcar = async (status) => { try { await gravar(colecao, { ...limpo, status }); aoFechar(); } catch (e) { setMsg(e.message); } };
  const apagar = async () => { if (!window.confirm("Apagar este compromisso da agenda?")) return; try { await remover(colecao, ev.id); aoFechar(); } catch (e) { setMsg(e.message); } };
  const trilha = ev.tipo === "treinamento" ? trilhaEmQualquerLugar(cat, ev.trilhaId) || { id: ev.trilhaId, nome: ev.titulo, minutos: 30 } : null;
  return (
    <Modal titulo={ev.titulo} aoFechar={aoFechar} largo={baixa}>
      {baixa ? (
        <Registro trilha={trilha} dataInicial={ev.data} instrutorInicial={ev.responsavel} aoSalvar={async (salvo) => { await gravar("treinamentos", { ...limpo, status: "realizado", aplicacaoId: salvo.id }); aoFechar(); }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Chip tom="neutro">{TIPOS[ev.tipo].nome}{ev.tipoReuniao ? ` · ${ev.tipoReuniao}` : ""}</Chip><Chip tom={tom}>{rot}</Chip></div>
          <table><tbody>
            <tr><td className="suave">Quando</td><td>{dataCurta(ev.data)}{ev.hora ? ` · ${ev.hora}` : ""}{ev.horaFim ? ` às ${ev.horaFim}` : ""}</td></tr>
            {ev.local && <tr><td className="suave">Local</td><td>{ev.local}</td></tr>}
            {ev.responsavel && <tr><td className="suave">{ev.tipo === "treinamento" ? "Quem aplica" : "Responsável"}</td><td>{ev.responsavel}</td></tr>}
            {ev.tipo !== "treinamento" && ev.participantes && <tr><td className="suave">Participantes</td><td>{ev.participantes}</td></tr>}
            {ev.obs && <tr><td className="suave">Pauta ou observação</td><td style={{ whiteSpace: "pre-wrap" }}>{ev.obs}</td></tr>}
          </tbody></table>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {st === "agendado" && (ev.tipo === "treinamento"
              ? <button type="button" className="btn" onClick={() => setBaixa(true)}>Dar baixa (registrar presença e nota)</button>
              : <button type="button" className="btn" onClick={() => marcar("realizado")}>Marcar como realizado</button>)}
            {st === "agendado" && <button type="button" className="btn claro" onClick={() => marcar("cancelado")}>Cancelar</button>}
            {st !== "agendado" && ev.tipo !== "treinamento" && <button type="button" className="btn claro" onClick={() => marcar("agendado")}>Voltar para agendado</button>}
            <button type="button" className="btn claro" onClick={() => aoEditar(ev)}>Editar</button>
            <button type="button" className="btn perigo" onClick={apagar}>Apagar</button>
          </div>
          {ev.tipo === "reuniao" && <p className="suave peq" style={{ margin: 0 }}>A apresentação e a ata da reunião ficam em Reuniões e apresentações.</p>}
          {msg && <span className="peq">{msg}</span>}
        </div>
      )}
    </Modal>
  );
}
