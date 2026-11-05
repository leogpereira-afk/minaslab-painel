// Peças comuns das fichas de Cliente e Solicitante (como no GerenciaLab):
// formulário simples, busca de CEP e a tabela de Endereços por tipo.

import { useState } from "react";
import { UFS } from "../lib/clientes.js";
import { buscarCep } from "../lib/cep.js";
import { erroEndereco, WHATSAPP_ENDERECO } from "../lib/solicitantes.js";
import { Modal, opcoes, useAviso } from "./ui.jsx";

export function useForm(inicial) {
  const [f, setF] = useState(inicial);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const campo = (id, chave, rotulo, cls = "s4", extra = {}) => (
    <div className={`fg ${cls}`}><label htmlFor={id}>{rotulo}</label><input id={id} placeholder={extra.ph ?? rotulo} type={extra.tipo || "text"} value={f[chave] ?? ""} onChange={(e) => set(chave, e.target.value)} onBlur={extra.onBlur} disabled={extra.disabled} autoComplete={extra.ac} /></div>
  );
  const selecao = (id, chave, rotulo, ops, cls = "s4") => (
    <div className={`fg ${cls}`}><label htmlFor={id}>{rotulo}</label><select id={id} value={f[chave] ?? ""} onChange={(e) => set(chave, e.target.value)}>{opcoes(ops)}</select></div>
  );
  return { f, setF, set, campo, selecao };
}

// Preenche endereço pelo CEP sem apagar o que já foi digitado.
export const completarCep = async (f, setF) => {
  const r = await buscarCep(f.cep);
  if (r) setF((x) => ({ ...x, end: x.end || r.end, bairro: x.bairro || r.bairro, cidade: x.cidade || r.cidade, uf: x.uf || r.uf }));
};

export function Pessoa({ f, set }) {
  return (
    <div className="s12 radios" role="radiogroup" aria-label="Tipo de pessoa">
      <label><input type="radio" name="pessoa" checked={f.pessoa !== "PF"} onChange={() => set("pessoa", "PJ")} /> Pessoa Jurídica</label>
      <label><input type="radio" name="pessoa" checked={f.pessoa === "PF"} onChange={() => set("pessoa", "PF")} /> Pessoa Física</label>
    </div>
  );
}

const linhaEndereco = (e) => [e.end && `${e.end}${e.num ? `, ${e.num}` : ""}${e.comp ? ` - ${e.comp}` : ""}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`, e.cep].filter(Boolean).join(" · ");

function JanelaEndereco({ inicial, titulo, tipos, completo, onFechar, aoSalvar }) {
  const avisar = useAviso();
  const { f, setF, set, campo, selecao } = useForm(inicial);
  return (
    <Modal titulo={titulo} largo onFechar={onFechar} rotuloOk="Salvar" aoConfirmar={async () => {
      const erro = erroEndereco(f, tipos);
      if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return false; }
      return aoSalvar(f);
    }}>
      <div className="frm">
        <div className="fg s12"><span className="rot">Tipo de endereço</span><div className="radios" id="eTipo" role="radiogroup">{tipos.map((t) => <label key={t}><input type="radio" name="eTipo" checked={f.tipo === t} onChange={() => set("tipo", t)} /> {t}</label>)}</div></div>
        {campo("eResp", "responsavel", "Responsável")}{campo("eEmail", "email", "E-mail", "s4", { tipo: "email" })}{campo("eTel", "tel", "Telefone", "s2")}{campo("eCel", "cel", "Celular", "s2")}
        {campo("eCep", "cep", "CEP", "s3", { onBlur: () => completarCep(f, setF) })}{campo("eEnd", "end", "Endereço", "s5")}{campo("eNum", "num", "Número", "s2")}{campo("eComp", "comp", "Complemento", "s2")}
        {campo("eBairro", "bairro", "Bairro")}{campo("eCidade", "cidade", "Cidade")}
        <div className="fg s2"><label htmlFor="eUf">Estado</label><select id="eUf" value={f.uf} onChange={(e) => set("uf", e.target.value)}>{opcoes([["", "Selecione"], ...UFS])}</select></div>
        {selecao("eWpp", "whatsapp", "Notificação por Whatsapp", WHATSAPP_ENDERECO, "s2")}
        {completo && <>{campo("eLon", "longitude", "Longitude", "s3")}{campo("eLat", "latitude", "Latitude", "s3")}{selecao("ePadrao", "padrao", "Endereço Padrão", ["Não", "Sim"], "s3")}{selecao("eStatus", "status", "Status", ["Ativo", "Inativo"], "s3")}</>}
      </div>
    </Modal>
  );
}

// Tabela de endereços com Adicionar, Copiar, Editar e Remover. aoGravar(lista, motivo).
export function TabelaEnderecos({ enderecos, tipos, completo = false, base = {}, aoGravar }) {
  const avisar = useAviso();
  const [janela, setJanela] = useState(null);
  const [marcado, setMarcado] = useState(null);
  const [filtro, setFiltro] = useState("Todos");
  const vazio = { tipo: tipos[tipos.length - 1], responsavel: "", email: "", tel: "", cel: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "", whatsapp: "Não enviar", ...(completo ? { longitude: "", latitude: "", padrao: "Não", status: "Ativo" } : {}), ...base };
  const salvar = (e) => {
    let lista = e.id ? enderecos.map((x) => (x.id === e.id ? e : x)) : [...enderecos, { ...e, id: `e${Date.now().toString(36)}` }];
    // Um só endereço padrão por tipo.
    if (completo && e.padrao === "Sim") { const id = e.id || lista[lista.length - 1].id; lista = lista.map((x) => (x.id !== id && x.tipo === e.tipo && x.padrao === "Sim" ? { ...x, padrao: "Não" } : x)); }
    return aoGravar(lista, e.id ? `Endereço alterado (${e.tipo})` : `Endereço adicionado (${e.tipo})`);
  };
  const visiveis = filtro === "Todos" ? enderecos : enderecos.filter((e) => e.tipo === filtro);
  const cols = completo ? 12 : 9;
  return (
    <>
      <div className="acoes" style={{ marginBottom: 10 }}>
        <button type="button" className="btn btn-info" onClick={() => setJanela({ titulo: "Adiciona endereço", inicial: { ...vazio } })}>Adicionar endereço</button>
        <button type="button" className="btn btn-default" onClick={() => { const e = enderecos.find((x) => x.id === marcado); if (!e) { avisar("Marque o endereço a copiar.", "err"); return; } setJanela({ titulo: "Copiar endereço", inicial: { ...e, id: undefined, padrao: "Não", tipo: tipos.find((t) => !enderecos.some((x) => x.tipo === t)) || e.tipo } }); }}>Copiar endereço</button>
      </div>
      <div className="tw"><table>
        <thead>
          <tr><th className="chk">#</th>{completo && <><th>Status</th><th>Padrão</th></>}<th>Tipo de Cadastro</th><th>Endereço</th><th>Responsável</th><th>Telefone</th><th>Celular</th><th>E-mail</th><th>Whatsapp</th>{completo && <th>Lat./Long.</th>}<th>ação</th></tr>
          {completo && <tr className="filtros"><th /><th /><th /><th><select aria-label="Filtrar por tipo" value={filtro} onChange={(e) => setFiltro(e.target.value)}>{opcoes(["Todos", ...tipos])}</select></th><th colSpan={8} /></tr>}
        </thead>
        <tbody>{visiveis.length ? visiveis.map((e) => (
          <tr key={e.id}>
            <td className="chk"><input type="radio" name="endSel" aria-label={`Marcar ${e.tipo}`} checked={marcado === e.id} onChange={() => setMarcado(e.id)} /></td>
            {completo && <><td><span className={`lbl ${e.status === "Inativo" ? "off" : "ok"}`}>{e.status || "Ativo"}</span></td><td>{e.padrao === "Sim" ? "Sim" : "Não"}</td></>}
            <td>{e.tipo}</td><td className="quebra">{linhaEndereco(e)}</td><td>{e.responsavel}</td><td>{e.tel}</td><td>{e.cel}</td><td>{e.email}</td>
            <td>{e.whatsapp === "Sim enviar" ? "Sim" : "Não"}</td>{completo && <td>{e.latitude || e.longitude ? `${e.latitude || "—"} / ${e.longitude || "—"}` : ""}</td>}
            <td><div className="acoes">
              <button type="button" className="btn btn-default btn-sm" onClick={() => setJanela({ titulo: "Editar endereço", inicial: { ...vazio, ...e } })}>Editar</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setJanela({ remover: e })}>Remover</button>
            </div></td>
          </tr>
        )) : <tr><td colSpan={cols} className="vazio">Nenhum endereço. Use “Adicionar endereço”.</td></tr>}</tbody>
      </table></div>
      {janela?.inicial && <JanelaEndereco titulo={janela.titulo} inicial={janela.inicial} tipos={tipos} completo={completo} onFechar={() => setJanela(null)} aoSalvar={salvar} />}
      {janela?.remover && (
        <Modal titulo="Remover endereço" onFechar={() => setJanela(null)} rotuloOk="Remover" aoConfirmar={() => aoGravar(enderecos.filter((x) => x.id !== janela.remover.id), `Endereço removido (${janela.remover.tipo})`)}>
          <p style={{ margin: 0 }}>Remover o endereço <b>{janela.remover.tipo}</b> de {janela.remover.responsavel || "—"}? Fica registrado na Auditoria LOG.</p>
        </Modal>
      )}
    </>
  );
}
