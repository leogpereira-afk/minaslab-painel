// Cadastro → Solicitantes, fiel ao GerenciaLab:
//  - Lista: ID, Status, Nome responsável, Razão social, CNPJ, E-mail, Criado,
//    Modificado; botões Selecionar/Deselecionar todos, Visualizar, Novo
//    Solicitante e Status.
//  - Adicionar Solicitante: Pessoa Jurídica/Física, responsável, telefones,
//    razão social, CNPJ/CPF, inscrições, endereço (busca pelo CEP) e e-mail.
//  - Ficha do solicitante: resumo (contratos, OS, faturas), dados editáveis
//    (com senha de acesso, inadimplência e ativo) e Endereços por tipo
//    (Nota Fiscal, Resultados, Principal).

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl } from "../lib/formato.js";
import { UFS } from "../lib/clientes.js";
import { buscarCep } from "../lib/cep.js";
import { erroSolicitante, normalizarSolicitante, enderecoDoCadastro, erroEndereco, TIPOS_ENDERECO, WHATSAPP_ENDERECO } from "../lib/solicitantes.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, RotuloStatus, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";

const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

const COLUNAS = [
  { t: "ID", v: (r) => Number(r.cod) || 0 },
  { t: "Status", v: (r) => r.status, h: (r) => <RotuloStatus status={r.status} /> },
  { t: "Nome responsável", v: (r) => r.nome || "" },
  { t: "Razão social", v: (r) => r.razao || r.cliente || "" },
  { t: "CNPJ", v: (r) => r.doc || "" },
  { t: "E-mail", v: (r) => r.email || "" },
  { t: "Criado", v: (r) => r.criadoEm || "", h: (r) => quando(r.criadoEm), fv: (r) => quando(r.criadoEm) },
  { t: "Modificado", v: (r) => r.atualizadoEm || "", h: (r) => quando(r.atualizadoEm), fv: (r) => quando(r.atualizadoEm) },
];

export default function ListaSolicitantes() {
  const { dados, salvarLote } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const selecionados = dados.solicitantes.filter((s) => sel.has(s.id));
  return (
    <Caixa titulo="Solicitantes">
      <Grade id="sol" exportar="solicitantes" linhas={dados.solicitantes} colunas={COLUNAS} selecao={sel} aoSelecionar={setSel} multipla ordemInicial={[0, "asc"]}
        aoAbrir={(r) => navegar("solicitante", r.id)}
        botoes={[
          { rotulo: "Selecionar todos", acao: () => setSel(new Set(dados.solicitantes.map((s) => s.id))) },
          { rotulo: "Deselecionar todos", acao: () => setSel(new Set()), desativado: !sel.size },
          { rotulo: "Visualizar", acao: () => (selecionados.length === 1 ? navegar("solicitante", selecionados[0].id) : avisar("Selecione um solicitante.", "err")) },
          { rotulo: "Novo Solicitante", acao: () => navegar("adicionar-solicitante") },
          { rotulo: "Status", desativado: !sel.size, acao: async () => {
            try { await salvarLote("solicitantes", selecionados.map((s) => ({ ...s, status: s.status === "Ativo" ? "Inativo" : "Ativo" })), { motivo: "Status alterado" }); avisar(`Status alterado em ${selecionados.length} registro(s).`, "ok"); setSel(new Set()); }
            catch (e) { avisar(e.message, "err"); }
          } },
        ]} />
    </Caixa>
  );
}

/* ---------- campos comuns ---------- */

function useForm(inicial) {
  const [f, setF] = useState(inicial);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const campo = (id, chave, rotulo, cls = "s4", extra = {}) => (
    <div className={`fg ${cls}`}><label htmlFor={id}>{rotulo}</label><input id={id} placeholder={extra.ph ?? rotulo} type={extra.tipo || "text"} value={f[chave] ?? ""} onChange={(e) => set(chave, e.target.value)} onBlur={extra.onBlur} disabled={extra.disabled} autoComplete={extra.ac} /></div>
  );
  return { f, setF, set, campo };
}

// Preenche endereço pelo CEP sem apagar o que já foi digitado.
const completarCep = async (f, setF) => {
  const r = await buscarCep(f.cep);
  if (r) setF((x) => ({ ...x, end: x.end || r.end, bairro: x.bairro || r.bairro, cidade: x.cidade || r.cidade, uf: x.uf || r.uf }));
};

function Pessoa({ f, set }) {
  return (
    <div className="s12 radios" role="radiogroup" aria-label="Tipo de pessoa">
      <label><input type="radio" name="pessoa" checked={f.pessoa !== "PF"} onChange={() => set("pessoa", "PJ")} /> Pessoa Jurídica</label>
      <label><input type="radio" name="pessoa" checked={f.pessoa === "PF"} onChange={() => set("pessoa", "PF")} /> Pessoa Física</label>
    </div>
  );
}

/* ---------- Adicionar Solicitante ---------- */

const VAZIO = { pessoa: "PJ", nome: "", tel: "", cel: "", razao: "", doc: "", im: "", ie: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "", email: "" };

export function FormSolicitante() {
  const { salvar } = useDados();
  const avisar = useAviso();
  const { f, setF, set, campo } = useForm(VAZIO);
  const [ocupado, setOcupado] = useState(false);
  const pf = f.pessoa === "PF";
  const gravar = async (e) => {
    e.preventDefault();
    const erro = erroSolicitante(f);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return; }
    setOcupado(true);
    try {
      const n = normalizarSolicitante(f);
      const r = await salvar("solicitantes", { ...n, status: "Ativo", inadimplente: "Não", enderecos: [enderecoDoCadastro(n)] }, { numerar: true });
      avisar("Solicitante cadastrado.", "ok");
      navegar("solicitante", r.id);
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };
  return (
    <Caixa titulo="Solicitantes">
      <form className="frm" onSubmit={gravar} noValidate>
        <Pessoa f={f} set={set} />
        {campo("sNome", "nome", "Nome do Responsável")}{campo("sTel", "tel", "Telefone", "s4", { ph: "(xx)xxxx-xxxxx" })}{campo("sCel", "cel", "Celular", "s4", { ph: "(xx)xxxx-xxxxx" })}
        {!pf && campo("sRazao", "razao", "Razão Social")}
        {campo("sDoc", "doc", pf ? "CPF" : "CNPJ", "s4", { ph: pf ? "000.000.000-00" : "00.000.000/0000-00" })}
        {!pf && <>{campo("sIm", "im", "Inscrição Municipal")}{campo("sIe", "ie", "Inscrição Estadual")}</>}
        {campo("sCep", "cep", "CEP", "s4", { onBlur: () => completarCep(f, setF) })}{campo("sEnd", "end", "Endereço", "s4", { ph: "Endereço completo" })}
        {campo("sNum", "num", "Número")}{campo("sComp", "comp", "Complemento")}{campo("sBairro", "bairro", "Bairro")}{campo("sCidade", "cidade", "Cidade")}
        <div className="fg s4"><label htmlFor="sUf">Estado</label><select id="sUf" value={f.uf} onChange={(e) => set("uf", e.target.value)}>{opcoes([["", "Estado"], ...UFS])}</select></div>
        {campo("sEmail", "email", "E-mail", "s4", { tipo: "email" })}
        <div className="s12 acoes" style={{ marginTop: 8 }}><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Adicionar"}</button><a className="btn btn-default" href={link("solicitantes")}>Voltar</a></div>
      </form>
    </Caixa>
  );
}

/* ---------- Ficha do solicitante ---------- */

const ENDERECO_VAZIO = { tipo: "Principal", responsavel: "", email: "", tel: "", cel: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "", whatsapp: "Não enviar" };

function JanelaEndereco({ inicial, titulo, onFechar, aoSalvar }) {
  const avisar = useAviso();
  const { f, setF, set, campo } = useForm(inicial);
  return (
    <Modal titulo={titulo} largo onFechar={onFechar} rotuloOk="Salvar" aoConfirmar={async () => {
      const erro = erroEndereco(f);
      if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return false; }
      return aoSalvar(f);
    }}>
      <div className="frm">
        <div className="fg s12"><span className="rot">Tipo de endereço</span><div className="radios" id="eTipo" role="radiogroup">{TIPOS_ENDERECO.map((t) => <label key={t}><input type="radio" name="eTipo" checked={f.tipo === t} onChange={() => set("tipo", t)} /> {t}</label>)}</div></div>
        {campo("eResp", "responsavel", "Responsável")}{campo("eEmail", "email", "E-mail", "s4", { tipo: "email" })}{campo("eTel", "tel", "Telefone", "s2")}{campo("eCel", "cel", "Celular", "s2")}
        {campo("eCep", "cep", "CEP", "s3", { onBlur: () => completarCep(f, setF) })}{campo("eEnd", "end", "Endereço", "s5")}{campo("eNum", "num", "Número", "s2")}{campo("eComp", "comp", "Complemento", "s2")}
        {campo("eBairro", "bairro", "Bairro")}{campo("eCidade", "cidade", "Cidade")}
        <div className="fg s2"><label htmlFor="eUf">Estado</label><select id="eUf" value={f.uf} onChange={(e) => set("uf", e.target.value)}>{opcoes([["", "Selecione"], ...UFS])}</select></div>
        <div className="fg s2"><label htmlFor="eWpp">Notificação por Whatsapp</label><select id="eWpp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)}>{opcoes(WHATSAPP_ENDERECO)}</select></div>
      </div>
    </Modal>
  );
}

export function VerSolicitante({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const s = dados.solicitantes.find((x) => x.id === param);
  const { f, set, campo } = useForm(() => ({ pessoa: "PJ", fantasia: "", inadimplente: "Não", ...(s || {}), razao: s?.razao || s?.cliente || "", senhaPortal: "" }));
  const [ocupado, setOcupado] = useState(false);
  const [janela, setJanela] = useState(null);
  const [marcado, setMarcado] = useState(null);
  if (!s) return <NaoAchou />;
  const pf = f.pessoa === "PF";
  const contratos = dados.contratos.filter((c) => c.solicitanteId === s.id);
  const ordens = dados.ordens.filter((o) => o.solicitanteId === s.id);
  const idsContrato = new Set(contratos.map((c) => c.id));
  const faturas = dados.contas_receber.filter((r) => idsContrato.has(r.contratoId) && r.status !== "Cancelado");
  const enderecos = s.enderecos || [];
  const atualizar = async (e) => {
    e.preventDefault();
    const erro = erroSolicitante(f);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return; }
    setOcupado(true);
    try {
      const { senhaPortal, ...resto } = normalizarSolicitante(f);
      await salvar("solicitantes", { ...s, ...resto, status: f.status, enderecos: s.enderecos || [], ...(senhaPortal ? { senhaPortal } : {}) }, { motivo: "Cadastro atualizado" });
      set("senhaPortal", "");
      avisar("Solicitante atualizado.", "ok");
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };
  const gravarEnderecos = async (lista, motivo) => {
    try { await salvar("solicitantes", { ...s, enderecos: lista }, { motivo }); avisar("Endereços atualizados.", "ok"); }
    catch (ex) { avisar(ex.message, "err"); return false; }
  };
  const salvarEndereco = (e) => {
    const lista = e.id ? enderecos.map((x) => (x.id === e.id ? e : x)) : [...enderecos, { ...e, id: `e${Date.now().toString(36)}` }];
    return gravarEnderecos(lista, e.id ? "Endereço alterado" : "Endereço adicionado");
  };
  return (
    <div className="ficha">
      <aside className="box ficha-resumo">
        <div className="ficha-topo"><span>SOLICITANTE</span><b>{s.razao || s.nome}</b><small>{s.doc}</small></div>
        <ul className="ficha-lista">
          <li><span>Contratos</span><b>{contratos.length}</b></li>
          <li><span>Ordem de serviços</span><b>{ordens.length}</b></li>
          <li><span>Faturas</span><b>{brl(faturas.reduce((t, r) => t + (Number(r.valor) || 0), 0))}</b></li>
        </ul>
        <button type="button" className="btn btn-primary btn-block" onClick={() => document.getElementById("sNome")?.focus()}>Editar Solicitante</button>
      </aside>
      <div className="ficha-corpo">
        <Caixa titulo="Solicitantes">
          <form className="frm" onSubmit={atualizar} noValidate>
            <Pessoa f={f} set={set} />
            {campo("sNome", "nome", "Responsável")}{campo("sTel", "tel", "Telefone")}{campo("sCel", "cel", "Celular")}
            {!pf && <>{campo("sRazao", "razao", "Razão Social")}{campo("sFant", "fantasia", "Nome Fantasia")}</>}
            {campo("sDoc", "doc", pf ? "CPF" : "CNPJ")}
            {!pf && <>{campo("sIm", "im", "Inscrição Municipal")}{campo("sIe", "ie", "Inscrição Estadual")}</>}
            {campo("sEmail", "email", "E-mail", "s4", { tipo: "email" })}
            <div className="fg s4"><label htmlFor="sSenha">Senha</label><input id="sSenha" type="password" autoComplete="new-password" placeholder={s.senhaPortalDefinida ? "•••••• (definida — deixe em branco para manter)" : "Senha"} value={f.senhaPortal} onChange={(e) => set("senhaPortal", e.target.value)} /></div>
            <div className="fg s4"><label htmlFor="sInad">Inadimplência financeira</label><select id="sInad" value={f.inadimplente || "Não"} onChange={(e) => set("inadimplente", e.target.value)}>{opcoes(["Não", "Sim"])}</select></div>
            <div className="fg s4"><label htmlFor="sAtivo">Ativo</label><select id="sAtivo" value={f.status === "Inativo" ? "Não" : "Sim"} onChange={(e) => set("status", e.target.value === "Sim" ? "Ativo" : "Inativo")}>{opcoes(["Sim", "Não"])}</select></div>
            <p className="s12 suave" style={{ margin: 0 }}>A senha é para o acesso do solicitante ao portal do cliente (etapa futura). Fica guardada só no servidor.</p>
            <div className="s12 acoes"><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Atualizar"}</button><a className="btn btn-default" href={link("solicitantes")}>Voltar</a></div>
          </form>
        </Caixa>
        <Caixa titulo="Endereços">
          <div className="acoes" style={{ marginBottom: 10 }}>
            <button type="button" className="btn btn-info" onClick={() => setJanela({ titulo: "Adiciona endereço", inicial: { ...ENDERECO_VAZIO, responsavel: s.nome || "", email: s.email || "", tel: s.tel || "", cel: s.cel || "" } })}>Adicionar endereço</button>
            <button type="button" className="btn btn-default" onClick={() => { const e = enderecos.find((x) => x.id === marcado); if (!e) { avisar("Marque o endereço a copiar.", "err"); return; } setJanela({ titulo: "Copiar endereço", inicial: { ...e, id: undefined, tipo: TIPOS_ENDERECO.find((t) => !enderecos.some((x) => x.tipo === t)) || e.tipo } }); }}>Copiar endereço</button>
          </div>
          <div className="tw"><table>
            <thead><tr><th className="chk">#</th><th>Tipo de Cadastro</th><th>Responsável</th><th>Telefone</th><th>Celular</th><th>E-mail</th><th>Endereço</th><th>Whatsapp</th><th>ação</th></tr></thead>
            <tbody>{enderecos.length ? enderecos.map((e) => (
              <tr key={e.id}>
                <td className="chk"><input type="radio" name="endSel" aria-label={`Marcar ${e.tipo}`} checked={marcado === e.id} onChange={() => setMarcado(e.id)} /></td>
                <td>{e.tipo}</td><td>{e.responsavel}</td><td>{e.tel}</td><td>{e.cel}</td><td>{e.email}</td>
                <td className="quebra">{[e.end && `${e.end}${e.num ? `, ${e.num}` : ""}${e.comp ? ` - ${e.comp}` : ""}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`, e.cep].filter(Boolean).join(" · ")}</td>
                <td>{e.whatsapp === "Sim enviar" ? "Sim" : "Não"}</td>
                <td><div className="acoes">
                  <button type="button" className="btn btn-default btn-sm" onClick={() => setJanela({ titulo: "Alterar endereço", inicial: { ...e } })}>Editar</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setJanela({ remover: e })}>Remover</button>
                </div></td>
              </tr>
            )) : <tr><td colSpan={9} className="vazio">Nenhum endereço. Use “Adicionar endereço”.</td></tr>}</tbody>
          </table></div>
        </Caixa>
      </div>
      {janela?.inicial && <JanelaEndereco titulo={janela.titulo} inicial={janela.inicial} onFechar={() => setJanela(null)} aoSalvar={salvarEndereco} />}
      {janela?.remover && (
        <Modal titulo="Remover endereço" onFechar={() => setJanela(null)} rotuloOk="Remover" aoConfirmar={() => gravarEnderecos(enderecos.filter((x) => x.id !== janela.remover.id), `Endereço removido (${janela.remover.tipo})`)}>
          <p style={{ margin: 0 }}>Remover o endereço <b>{janela.remover.tipo}</b> de {janela.remover.responsavel}? Fica registrado na Auditoria LOG.</p>
        </Modal>
      )}
    </div>
  );
}
