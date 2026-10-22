// Formulário da entrada de amostra. Fica FORA da página (componente dentro de
// componente remonta a cada letra e o campo perde o foco).
//
// O que mudou em relação à planilha: data e hora vêm de um seletor (nada de
// "03/06/2026 10;00"), nomes e tipos são botões de marcar (nada de
// "LUCAS, JOSE ROBERTO" vs "JOSE ROBERTO, LUCAS") e "Agora" carimba o
// instante numa batida só.

import { useState } from "react";
import { Clock, Plus, AlertTriangle, Lock } from "lucide-react";
import { Modal } from "../ui.jsx";
import { lerDataColada } from "../../lib/laboratorioImportacao.js";
import { agoraLocal, contarAmostras, prazoDescarte, dataHora, TIPOS_ANALISE, ORIGENS, validar, corTipo, corOrigem, formatarOS, FINALIZACAO, AREAS_FINAL, situacaoArea, finalizacaoGeral } from "../../lib/laboratorioEntradas.js";

function Marcar({ opcoes, valor = [], onChange, permitirNovo, desabilitado, cor, rotulo = (x) => x, dica }) {
  const [novo, setNovo] = useState("");
  const alternar = (o) => onChange(valor.includes(o) ? valor.filter((v) => v !== o) : [...valor, o]);
  const extras = valor.filter((v) => !opcoes.includes(v));
  const adicionar = () => {
    const n = novo.trim().toUpperCase();
    if (n && !valor.includes(n)) onChange([...valor, n]);
    setNovo("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...opcoes, ...extras].map((o) => (
        <button key={o} type="button" title={dica ? dica(o) : undefined} disabled={desabilitado} aria-pressed={valor.includes(o)} onClick={() => alternar(o)}
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${valor.includes(o) ? (cor ? `border-slate-400 ring-1 ring-slate-400 ${cor(o)}` : "border-brand bg-brand text-white") : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
          {rotulo(o)}
        </button>
      ))}
      {permitirNovo && !desabilitado && (
        <span className="inline-flex items-center gap-1">
          <input className="h-7 w-28 rounded-full border border-slate-200 px-2.5 text-xs" placeholder="Outro nome" value={novo}
            onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }} />
          <button type="button" className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" onClick={adicionar} aria-label="Adicionar nome"><Plus size={13} /></button>
        </span>
      )}
    </div>
  );
}

// Campo de data/hora. Aceita Ctrl+V com a data em texto (do Excel, e-mail,
// outro sistema): "13/10/2026 17:00", "13/10/2026", "2026-10-13 17:00"…
function CampoData({ rotulo, valor, onChange, desabilitado }) {
  const [msg, setMsg] = useState(null);
  const colar = (ev) => {
    if (desabilitado) return;
    const texto = ev.clipboardData?.getData("text") ?? "";
    ev.preventDefault();
    const r = lerDataColada(texto);
    if (r.valor) { onChange(r.valor); setMsg({ ok: true, t: `Colado: ${dataHora(r.valor) || r.valor}` }); }
    else setMsg({ ok: false, t: r.erro });
  };
  return (
    <label className="block" onPaste={colar}>
      <span className="label">{rotulo}</span>
      <span className="flex gap-1.5">
        <input type="datetime-local" className="input h-10 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" value={valor || ""} disabled={desabilitado}
          title={desabilitado ? undefined : "Dá para colar (Ctrl+V) uma data em texto, ex.: 13/10/2026 17:00"} onChange={(e) => { setMsg(null); onChange(e.target.value); }} />
        {!desabilitado && (
          <button type="button" className="btn-outline shrink-0 px-2.5 py-1.5 text-xs" title="Preencher com agora" onClick={() => { setMsg(null); onChange(agoraLocal()); }}>
            <Clock size={13} aria-hidden="true" />Agora
          </button>
        )}
      </span>
      {msg ? <span role="status" className={`mt-1 block text-[11px] ${msg.ok ? "text-ok-700" : "text-bad-700"}`}>{msg.t}</span>
        : !desabilitado && <span className="mt-1 block text-[11px] text-slate-400">Aceita colar (Ctrl+V): 13/10/2026 17:00</span>}
    </label>
  );
}

// Finalização de uma área (MB ou FQ): Sim / Não / Não se aplica + data.
function AreaFinal({ area, f, onSituacao, onData, desabilitado }) {
  const a = AREAS_FINAL[area];
  const v = situacaoArea(f, area);
  const cores = { SIM: "bg-brand text-white", NAO: "bg-slate-600 text-white", NA: "bg-slate-300 text-slate-800" };
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <span className="label">Finalizado — {a.rotulo}</span>
      <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-0.5">
        {FINALIZACAO.map(([k, t]) => (
          <button key={k} type="button" disabled={desabilitado} aria-pressed={v === k} onClick={() => onSituacao(v === k ? "" : k)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${v === k ? cores[k] : "text-slate-600"}`}>{t}</button>
        ))}
      </div>
      {v !== "NA" && <div className="mt-2"><CampoData rotulo={`Data da finalização ${a.curto}`} valor={f[a.data]} onChange={onData} desabilitado={desabilitado} /></div>}
    </div>
  );
}

function SimNao({ rotulo, valor, onChange, desabilitado }) {
  return (
    <div>
      <span className="label">{rotulo}</span>
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
        {[[true, "Sim"], [false, "Não"]].map(([v, t]) => (
          <button key={t} type="button" disabled={desabilitado} aria-pressed={valor === v} onClick={() => onChange(v)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${valor === v ? (v ? "bg-brand text-white" : "bg-slate-600 text-white") : "text-slate-600"}`}>{t}</button>
        ))}
      </div>
    </div>
  );
}

const Secao = ({ titulo, setor, bloqueado, children }) => (
  <fieldset className={`rounded-xl border p-3 ${setor === "administrativo" ? "border-sky-200" : "border-teal-200"}`}>
    <legend className="flex items-center gap-2 px-1 font-display text-xs font-bold uppercase tracking-wide text-slate-500">
      {titulo}
      <span className={`rounded-full px-2 py-0.5 text-[10px] normal-case ${setor === "administrativo" ? "bg-sky-50 text-sky-800" : "bg-teal-50 text-teal-800"}`}>
        {setor === "administrativo" ? "Administrativo" : "Laboratório"}
      </span>
      {bloqueado && <span className="inline-flex items-center gap-1 text-[10px] normal-case text-slate-400"><Lock size={11} aria-hidden="true" />só leitura para o seu setor</span>}
    </legend>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </fieldset>
);

export default function FormEntrada({ aberto, entrada, lista, opcoesRecebimento, opcoesRetirada, opcoesRetiradaProvedor, pessoas, podeAdm, podeLab, salvando, aoFechar, aoSalvar, aoExcluir }) {
  const [f, setF] = useState(entrada);
  const [tentou, setTentou] = useState(false);
  const set = (campo) => (v) => setF((x) => ({ ...x, [campo]: v }));
  // MB / FQ: a situação e a data andam juntas, e o "Finalizado pelo laboratório" sai das duas áreas.
  // Enquanto alguma área não foi informada, vale o "Finalizado" que a entrada já tinha.
  const comGeral = (n) => ({ ...n, finalizadoLab: finalizacaoGeral({ ...n, finalizadoLab: !!entrada.finalizadoLab }) });
  const situacao = (k) => (v) => setF((x) => {
    const a = AREAS_FINAL[k];
    return comGeral({ ...x, [a.campo]: v, [a.data]: v === "SIM" ? x[a.data] || agoraLocal() : "" });
  });
  const dataFinal = (k) => (v) => setF((x) => {
    const a = AREAS_FINAL[k];
    const atual = situacaoArea(x, k);
    return comGeral({ ...x, [a.data]: v, [a.campo]: v ? "SIM" : atual === "SIM" ? "" : atual });
  });
  const { erros, avisos } = validar(f, lista);
  const prazo = prazoDescarte(f);
  const dicaPessoa = (n) => `${n}${pessoas.desligado(n) ? " — sem conta ativa no sistema (já desligado)" : ""}`;
  const original = entrada.importacao?.original;
  const enviar = (e) => {
    e.preventDefault();
    setTentou(true);
    if (!erros.length) aoSalvar(f);
  };
  // Cada bloco só abre para o setor dono dele; o servidor confere de novo.
  const dl = !podeAdm; // campos do Administrativo
  const ll = !podeLab; // campos do Laboratório
  // Provedor: a retirada é do Administrativo (o Laboratório também pode lançar).
  const provedor = (f.origem || []).includes("PROVEDOR");
  const rl = !(podeLab || (provedor && podeAdm));
  const leitura = dl && ll;
  return (
    <Modal titulo={entrada.id ? `Entrada · OS ${entrada.os || "—"}` : "Nova entrada de amostra"} aberto={aberto} aoFechar={aoFechar} largura="max-w-3xl">
      <form onSubmit={enviar} className="space-y-3">
        {!!entrada.pendencias?.length && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Veio da planilha com pontos para revisar:</p>
            <ul className="mt-1 list-disc pl-4">{entrada.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="mt-1">Corrija os campos e grave: o aviso sai sozinho.</p>
          </div>
        )}
        <Secao titulo="Recebimento" setor="administrativo" bloqueado={dl}>
          <label className="block"><span className="label">Nº da OS *</span>
            <input className="input h-10 py-1.5 disabled:bg-slate-100 disabled:text-slate-500" value={f.os} disabled={dl} placeholder="Ex.: 1541 → OS001541/2026" onChange={(e) => set("os")(e.target.value)} onBlur={(e) => { const r = formatarOS(e.target.value, f.recebidoEm ? Number(f.recebidoEm.slice(0, 4)) : new Date().getFullYear()); if (r.os) set("os")(r.os); }} autoFocus={!entrada.id} /></label>
          <label className="block"><span className="label">Nº da(s) amostra(s) {f.amostras ? <span className="font-normal text-slate-400">· {contarAmostras(f.amostras)} amostra(s)</span> : null}</span>
            <input className="input h-10 py-1.5 disabled:bg-slate-100 disabled:text-slate-500" value={f.amostras} disabled={dl} placeholder="Ex.: 4426/4427-2026" onChange={(e) => set("amostras")(e.target.value)} /></label>
          <CampoData rotulo="Data e hora do recebimento *" valor={f.recebidoEm} onChange={set("recebidoEm")} desabilitado={dl} />
          <SimNao rotulo="Possui parâmetro imediato?" valor={!!f.parametroImediato} onChange={set("parametroImediato")} desabilitado={dl} />
          <div className="sm:col-span-2"><span className="label">Tipo de análise *</span><Marcar opcoes={TIPOS_ANALISE} valor={f.tipos} onChange={set("tipos")} desabilitado={dl} cor={corTipo} /></div>
          <div><span className="label">Interno ou provedor</span><Marcar opcoes={ORIGENS} valor={f.origem} onChange={set("origem")} desabilitado={dl} cor={corOrigem} /></div>
          <div className="sm:col-span-2"><span className="label">Responsável pelo recebimento</span><Marcar opcoes={opcoesRecebimento} valor={f.recebidoPor} onChange={set("recebidoPor")} desabilitado={dl} cor={pessoas.cor} rotulo={pessoas.curto} dica={dicaPessoa} /></div>
          <div className="sm:col-span-2"><span className="label">Responsável pela retirada</span><Marcar opcoes={provedor ? opcoesRetiradaProvedor : opcoesRetirada} valor={f.retiradoPor} onChange={set("retiradoPor")} desabilitado={dl} cor={pessoas.cor} rotulo={pessoas.curto} dica={dicaPessoa} /></div>
          <SimNao rotulo="OS cancelada?" valor={!!f.cancelada} onChange={set("cancelada")} desabilitado={dl} />
        </Secao>
        <Secao titulo="Análise" setor="laboratorio" bloqueado={ll}>
          {provedor && <p className="sm:col-span-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">Amostra de <b>provedor</b>: a retirada é feita pelo Administrativo, que também lança as datas de retirada.</p>}
          <CampoData rotulo="Retirada pelo laboratório" valor={f.retiradaLabEm} onChange={set("retiradaLabEm")} desabilitado={rl} />
          <CampoData rotulo="Retirado do comercial" valor={f.retiradaComercialEm} onChange={set("retiradaComercialEm")} desabilitado={rl} />
          {["mb", "fq"].map((k) => (
            <AreaFinal key={k} area={k} f={f} desabilitado={ll} onSituacao={situacao(k)} onData={dataFinal(k)} />
          ))}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>Finalizado pelo laboratório:</span>
            <b className={f.finalizadoLab ? "text-ok-700" : "text-slate-700"}>{f.finalizadoLab ? "Sim" : "Não"}</b>
            <span className="text-slate-500">— fecha sozinho quando MB e FQ estão em “Sim” (ou “Não se aplica”).</span>
          </div>
        </Secao>
        <Secao titulo="Liberação e descarte" setor="laboratorio" bloqueado={ll}>
          <SimNao rotulo="Liberado para o cliente?" valor={!!(f.liberadoCliente || f.liberadoEm)} onChange={(v) => setF((x) => ({ ...x, liberadoCliente: v, liberadoEm: v ? x.liberadoEm || agoraLocal() : "" }))} desabilitado={ll} />
          <CampoData rotulo="Data da liberação" valor={f.liberadoEm} onChange={(v) => setF((x) => ({ ...x, liberadoEm: v, liberadoCliente: !!v || x.liberadoCliente }))} desabilitado={ll} />
          <div className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {prazo ? <>Descarte previsto para <b>{dataHora(prazo)}</b> (5 dias após a liberação).</> : "O prazo de descarte (5 dias) começa a contar na liberação."}
          </div>
          <SimNao rotulo="Amostra descartada?" valor={!!f.descartado} onChange={(v) => setF((x) => ({ ...x, descartado: v, descartadoEm: v ? x.descartadoEm || agoraLocal() : "" }))} desabilitado={ll} />
        </Secao>
        <label className="block"><span className="label">Observação</span>
          <textarea className="input min-h-[70px] py-2 disabled:bg-slate-100" value={f.observacao} disabled={leitura} onChange={(e) => set("observacao")(e.target.value)} /></label>
        {(tentou && erros.length > 0) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{erros.join(" ")}</div>}
        {avisos.length > 0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={14} className="shrink-0" aria-hidden="true" /><span>{avisos.join(" ")}</span></div>}
        {original && Object.keys(original).length > 0 && (
          <details className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Como estava na planilha (linha {entrada.importacao.linha})</summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {Object.entries(original).map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[10px] uppercase text-slate-400">{k}</dt><dd className="break-words">{v}</dd></div>)}
            </dl>
          </details>
        )}
        {entrada.historico?.length > 0 ? (
          <details className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Histórico ({entrada.historico.length})</summary>
            <ul className="mt-2 space-y-1">
              {[...entrada.historico].reverse().map((h, i) => (
                <li key={`${h.em}-${i}`}><span className="text-slate-400">{new Date(h.em).toLocaleString("pt-BR")}</span> · <b>{h.por}</b> · {h.acao}</li>
              ))}
            </ul>
          </details>
        ) : entrada.importacao ? (
          <p className="text-[11px] text-slate-400">Importada da planilha (linha {entrada.importacao.linha}).</p>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
          <div>{entrada.id && podeAdm && <button type="button" className="btn-ghost text-red-700 hover:bg-red-50" disabled={salvando} onClick={() => aoExcluir(entrada)}>Excluir entrada</button>}</div>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={aoFechar}>{leitura ? "Fechar" : "Cancelar"}</button>
            {!leitura && <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Gravando…" : "Gravar entrada"}</button>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
