// Propostas → Criar Proposta (etapa 1): os quatro blocos do GerenciaLab
// (Criar proposta, Solicitante, Cliente, Prazos) e o botão verde Avançar.

import { useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { emailsDoSolicitante, rotuloSolicitante } from "../lib/solicitantes.js";
import { emailDoTipo, erroCliente, normalizarCliente, enderecoPrincipal } from "../lib/clientes.js";
import { link, navegar } from "../lib/rota.js";
import { isoDia } from "../lib/formato.js";
import { STATUS_PROPOSTA, EXIBICAO_PRECOS, numeroProposta, erroEtapa1, chaveNumero, minimoNumero } from "../lib/propostas.js";
import { estaAtivo } from "../lib/cadastros.js";
import { Caixa, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";

function nova(dados) {
  const ano = new Date().getFullYear();
  const centro = dados.centros_servico.find(estaAtivo)?.nome || "MinasLab";
  const modelo = dados.modelos.find((m) => m.tipo === "Proposta" && estaAtivo(m))?.titulo || "Proposta Modelo Padrão";
  return {
    num: null, ano, ver: 0, ident: "", modelo, centro, status: "Aguardando",
    exib: EXIBICAO_PRECOS[0], indicacao: "Sem indicação", equip: "", solicitanteId: null, envio: "Cliente", cobranca: "Cliente", resultado: "Cliente",
    emailSolProp: "", emailSolCob: "", emailSolRes: "", clienteId: null, unidade: "Não tem unidade", emailCliProp: "", emailCliNF: "", emailCliRes: "",
    criacao: isoDia(0), validade: isoDia(30), ciclo: "Faturado", parcelas: 1, tipoPeriodo: "Por dia Fixo", cobrarDia: "10", primeiroPag: "",
    tipoContrato: "", condicoes: "", cobrancaNa: "Entrada da amostra", obs: "", obsFin: "",
  };
}

export default function PropostaForm({ param, sessao }) {
  const { dados, salvar, proximo } = useDados();
  const avisar = useAviso();
  const existente = param ? dados.propostas.find((p) => p.id === param) : null;
  const [f, setF] = useState(() => (existente ? { ...existente } : nova(dados)));
  const [ocupado, setOcupado] = useState(false);
  const [novoCli, setNovoCli] = useState(null); // { pessoa, razao, fantasia, resp, doc, email, tel } quando "Novo cliente"
  if (param && !existente) return <NaoAchou />;
  if (existente && existente.status === "Aceito") {
    return <Caixa titulo="Proposta aceita"><p style={{ margin: 0 }}>A proposta {numeroProposta(existente)} já foi aceita e não pode ser editada. Use <b>Criar revisão</b> em <a href={link("proposedlist")}>Listar Propostas</a>.</p></Caixa>;
  }

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const muda = (k) => (e) => set(k, e.target.value);
  const cliente = dados.clientes.find((c) => c.id === f.clienteId);
  const sol = dados.solicitantes.find((s) => s.id === f.solicitanteId);
  const emailsSol = [["", "Selecione o solicitante"], ...emailsDoSolicitante(sol).map((e) => [e, e])];

  const escolherCliente = (id) => {
    const c = dados.clientes.find((x) => x.id === id);
    setF((x) => ({ ...x, clienteId: c ? c.id : null, unidade: "Não tem unidade", emailCliProp: c?.email || "", emailCliNF: c ? emailDoTipo(c, "Nota Fiscal") : "", emailCliRes: c ? emailDoTipo(c, "Resultados") : "" }));
  };
  const escolherSolicitante = (id) => {
    const s = dados.solicitantes.find((x) => x.id === id);
    setF((x) => ({ ...x, solicitanteId: s ? s.id : null, emailSolProp: s?.email || "", emailSolCob: emailsDoSolicitante(s, "Nota Fiscal")[1] || s?.email || "", emailSolRes: emailsDoSolicitante(s, "Resultados")[1] || s?.email || "" }));
  };

  const avancar = async (e) => {
    e.preventDefault();
    if (cliente?.inadimplencia === "Bloqueio total") { avisar("Cliente com inadimplência (bloqueio total): regularize no Financeiro antes de criar a proposta.", "err"); return; }
    let dadosF = f;
    if (novoCli) {
      const erroC = erroCliente({ ...novoCli, razao: novoCli.pessoa === "PF" ? novoCli.resp : novoCli.razao });
      if (erroC) { avisar(erroC[1], "err"); document.getElementById(`nc-${erroC[0]}`)?.focus(); return; }
    } else {
      const erro = erroEtapa1(f);
      if (erro) { avisar(erro, "err"); return; }
    }
    setOcupado(true);
    try {
      if (novoCli) {
        const n = normalizarCliente({ ...novoCli, tipo: "Cliente", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "" });
        const c = await salvar("clientes", { ...n, status: "Ativo", obs: "", enderecos: [enderecoPrincipal(n)] }, { numerar: true, motivo: "Cadastrado na proposta" });
        dadosF = { ...f, clienteId: c.id, emailCliProp: c.email || "", emailCliNF: c.email || "", emailCliRes: c.email || "" };
        const erro = erroEtapa1(dadosF);
        if (erro) { avisar(erro, "err"); setF(dadosF); setNovoCli(null); return; }
      }
      const fx = dadosF;
      let reg;
      if (existente) reg = await salvar("propostas", { ...fx, parcelas: Number(fx.parcelas) || 1 });
      else {
        // Número dado pelo servidor (atômico): duas pessoas nunca recebem o mesmo.
        const num = await proximo(chaveNumero(fx.ano), minimoNumero(configSistema(dados)));
        reg = await salvar("propostas", { ...fx, num, ident: fx.ident || `${String(num).padStart(5, "0")}/${fx.ano}`, parcelas: Number(fx.parcelas) || 1, itens: [], outros: 0, resp: sessao.nome || sessao.usuario, statusProc: "Aguardando aceite", views: 0, revs: [], docs: [], aceite: null, novo: true }, { numerar: true });
      }
      navegar("proposta-servicos", reg.id);
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };

  const ro = (id, rot, v) => <div className="fg s4"><label htmlFor={id}>{rot}</label><input id={id} value={v || ""} readOnly /></div>;

  return (
    <form onSubmit={avancar} noValidate>
      <Caixa cabecalho={existente ? "Editar proposta" : "Criar proposta"}>
        <div className="pnum">Proposta nº<br />{f.num ? numeroProposta(f) : <span className="suave" style={{ fontWeight: 400 }}>gerado ao avançar</span>}</div>
        <div className="frm" style={{ marginTop: 14 }}>
          <div className="fg s4"><label htmlFor="pIdent">Identificação</label><input id="pIdent" value={f.ident} placeholder="Gerada ao avançar, se ficar em branco" onChange={muda("ident")} /></div>
          <div className="fg s3"><label htmlFor="pModelo">Modelo da proposta</label><select id="pModelo" value={f.modelo} onChange={muda("modelo")}>{opcoes([...new Set([f.modelo, ...dados.modelos.filter((m) => m.tipo === "Proposta" && estaAtivo(m)).map((m) => m.titulo), "Proposta Modelo Padrão"])])}</select></div>
          <div className="quebra-linha" />
          <div className="fg s2"><label htmlFor="pCentro">Centro de Serviços</label><select id="pCentro" value={f.centro} onChange={muda("centro")}>{opcoes([...new Set([f.centro, ...dados.centros_servico.filter(estaAtivo).map((c) => c.nome)])])}</select></div>
          <div className="fg s2"><label htmlFor="pStatus">Status proposta</label><select id="pStatus" value={f.status} onChange={muda("status")}>{opcoes(STATUS_PROPOSTA.filter((s) => s !== "Salvo" || f.status === "Salvo"))}</select></div>
          <div className="fg s2"><label htmlFor="pExib">Exibição de preços</label><select id="pExib" value={f.exib} onChange={muda("exib")}>{opcoes(EXIBICAO_PRECOS)}</select></div>
          <div className="fg s2"><label htmlFor="pInd">Indicação</label><select id="pInd" className="gray" value={f.indicacao} onChange={muda("indicacao")}>{opcoes(["Sem indicação", "Cliente", "Parceiro", "Site", "Redes sociais"])}</select></div>
          <div className="fg s2"><label htmlFor="pEquip">Equipamentos</label><input id="pEquip" list="equip-prop" placeholder="Equipamentos" value={f.equip} onChange={muda("equip")} /><datalist id="equip-prop">{dados.equipamentos.filter((x) => x.emUso !== "Não").map((x) => <option key={x.id} value={`${x.codigo ? `${x.codigo} · ` : ""}${x.equipamento}`} />)}</datalist></div>
        </div>
      </Caixa>

      <Caixa cabecalho="Solicitante">
        <div className="frm">
          <div className="fg s3"><label htmlFor="pSol">Solicitante</label><select id="pSol" className="gray" value={f.solicitanteId || ""} onChange={(e) => escolherSolicitante(e.target.value)}>{opcoes([["", "Sem solicitante"], ...dados.solicitantes.filter((s) => s.status === "Ativo").map((s) => [s.id, rotuloSolicitante(s)])])}</select></div>
          <div className="fg s3"><label htmlFor="pEnvio">Envio da proposta</label><select id="pEnvio" value={f.envio} onChange={muda("envio")}>{opcoes(["Cliente", "Solicitante"])}</select></div>
          <div className="fg s3"><label htmlFor="pCob">Cobrança</label><select id="pCob" value={f.cobranca} onChange={muda("cobranca")}>{opcoes(["Cliente", "Solicitante"])}</select></div>
          <div className="fg s3"><label htmlFor="pRes">Resultado Final</label><select id="pRes" value={f.resultado} onChange={muda("resultado")}>{opcoes(["Cliente", "Solicitante", "Ambos"])}</select></div>
          <div className="fg s4"><label htmlFor="pESP">Email proposta Solicitante</label><select id="pESP" value={f.emailSolProp} onChange={muda("emailSolProp")}>{opcoes(emailsSol)}</select></div>
          <div className="fg s4"><label htmlFor="pESC">Email cobrança Solicitante</label><select id="pESC" value={f.emailSolCob} onChange={muda("emailSolCob")}>{opcoes(emailsSol)}</select></div>
          <div className="fg s4"><label htmlFor="pESR">Email Resultado Solicitante</label><select id="pESR" value={f.emailSolRes} onChange={muda("emailSolRes")}>{opcoes(emailsSol)}</select></div>
        </div>
      </Caixa>

      <Caixa cabecalho="Cliente">
        {!existente && <div className="radios" style={{ marginBottom: 10 }} role="radiogroup" aria-label="Cliente novo ou existente">
          <label><input type="radio" name="tipoCli" checked={!!novoCli} onChange={() => setNovoCli({ pessoa: "PJ", razao: "", fantasia: "", resp: "", doc: "", email: "", tel: "" })} /> Novo cliente</label>
          <label><input type="radio" name="tipoCli" checked={!novoCli} onChange={() => setNovoCli(null)} /> Cliente existente</label>
        </div>}
        {novoCli ? (
          <div className="frm">
            <div className="s12 radios" role="radiogroup" aria-label="Tipo de pessoa"><label><input type="radio" name="ncPessoa" checked={novoCli.pessoa !== "PF"} onChange={() => setNovoCli({ ...novoCli, pessoa: "PJ" })} /> Pessoa Jurídica</label><label><input type="radio" name="ncPessoa" checked={novoCli.pessoa === "PF"} onChange={() => setNovoCli({ ...novoCli, pessoa: "PF" })} /> Pessoa Física</label></div>
            {[["razao", "Razão Social"], ["fantasia", "Nome Fantasia"], ["resp", "Nome Responsável"], ["doc", novoCli.pessoa === "PF" ? "CPF" : "CNPJ"], ["email", "E-mail"], ["tel", "Telefone"]].filter(([k]) => novoCli.pessoa !== "PF" || !["razao", "fantasia"].includes(k)).map(([k, r]) => (
              <div className="fg s4" key={k}><label htmlFor={`nc-${k}`}>{r}</label><input id={`nc-${k}`} type={k === "email" ? "email" : "text"} value={novoCli[k]} onChange={(e) => setNovoCli({ ...novoCli, [k]: e.target.value })} /></div>
            ))}
            <p className="s12 suave" style={{ margin: 0 }}>O cliente é cadastrado ao avançar. Endereços e demais dados ficam na ficha do cliente.</p>
          </div>
        ) : (
        <div className="frm">
          <div className="fg s6"><label htmlFor="pCli">Selecione o cliente</label><select id="pCli" value={f.clienteId || ""} onChange={(e) => escolherCliente(e.target.value)}>{opcoes([["", "Selecione o cliente"], ...dados.clientes.filter((c) => c.status === "Ativo" || c.id === f.clienteId).map((c) => [c.id, `${c.razao} — ${c.doc}`])])}</select></div>
          <div className="fg s6"><label htmlFor="pUni">Selecione a unidade</label><select id="pUni" value={f.unidade} onChange={muda("unidade")}>{opcoes(["Não tem unidade", ...((cliente?.unidades || []).filter((u) => u.status !== "Inativo").map((u) => u.nome))])}</select></div>
          {ro("cRaz", "Razão Social", cliente?.razao)}{ro("cFan", "Nome Fantasia", cliente?.fantasia)}{ro("cResp", "Nome Responsável", cliente?.resp)}
          {ro("cDoc", "CNPJ", cliente?.doc)}{ro("cMail", "E-mail", cliente?.email)}{ro("cTel", "Telefone", cliente?.tel)}
          {cliente?.inadimplencia && cliente.inadimplencia !== "Não" && <p className="s12 aviso ruim" style={{ margin: 0 }}><b>Atenção Cliente com inadimplência</b> ({cliente.inadimplencia}).{cliente.inadimplencia === "Bloqueio total" ? " Não é possível avançar." : ""}</p>}
        </div>
        )}
      </Caixa>

      {cliente && !novoCli && (
        <Caixa cabecalho="Email Cliente">
          <div className="frm">
            <div className="fg s4"><label htmlFor="pECP">Email proposta Cliente</label><input id="pECP" type="email" value={f.emailCliProp} onChange={muda("emailCliProp")} /></div>
            <div className="fg s4"><label htmlFor="pECN">Email Nota Fiscal Cliente</label><input id="pECN" type="email" value={f.emailCliNF} onChange={muda("emailCliNF")} /></div>
            <div className="fg s4"><label htmlFor="pECR">Email Resultado Cliente</label><input id="pECR" type="email" value={f.emailCliRes} onChange={muda("emailCliRes")} /></div>
          </div>
        </Caixa>
      )}

      <Caixa cabecalho="Prazos">
        <div className="frm">
          <div className="fg s3"><label htmlFor="pCria">Data criação da proposta</label><input id="pCria" type="date" value={f.criacao} onChange={muda("criacao")} /></div>
          <div className="fg s3"><label htmlFor="pVal">Data Validade da proposta</label><input id="pVal" type="date" value={f.validade} onChange={muda("validade")} /></div>
          <div className="fg s3"><label htmlFor="pCiclo">Ciclo pagamento</label><select id="pCiclo" value={f.ciclo} onChange={muda("ciclo")}>{opcoes(["Faturado", "Parcelado"])}</select></div>
          {f.ciclo === "Parcelado" && <>
          <div className="fg s3"><label htmlFor="pParc">Numero de parcelas</label><input id="pParc" type="number" min="1" max="36" value={f.parcelas} onChange={muda("parcelas")} /></div>
          <div className="fg s3"><label htmlFor="pTP">Tipo período</label><select id="pTP" value={f.tipoPeriodo} onChange={muda("tipoPeriodo")}>{opcoes(["Por dia Fixo", "Por dia útil"])}</select></div>
          <div className="fg s3"><label htmlFor="pDia">Cobrar sempre no</label><select id="pDia" value={f.cobrarDia} onChange={muda("cobrarDia")}>{opcoes(Array.from({ length: 31 }, (_, i) => String(i + 1)))}</select></div>
          <div className="fg s3"><label htmlFor="pPrim">Data primeiro pagamento</label><input id="pPrim" type="date" value={f.primeiroPag} onChange={muda("primeiroPag")} /></div>
          </>}
          <div className="fg s3"><label htmlFor="pTC">Tipo de contrato</label><select id="pTC" value={f.tipoContrato} onChange={muda("tipoContrato")}>{opcoes([["", "Selecione tipo de contrato"], ...new Set(["Contrato Padrão", "Contrato Parcelado", ...dados.formas_pagamento.filter(estaAtivo).map((x) => x.tipoContrato)])])}</select></div>
          <div className="fg s6"><label htmlFor="pCond">Condições de pagamento</label><select id="pCond" value={f.condicoes} onChange={muda("condicoes")}>{opcoes([["", "Selecione"], ...new Set([...(f.condicoes ? [f.condicoes] : []), ...dados.formas_pagamento.filter((x) => estaAtivo(x) && (!f.tipoContrato || x.tipoContrato === f.tipoContrato)).map((x) => x.descricao), ...dados.condicoes_pagamento.map((c) => c.descricao)])])}</select></div>
          <div className="fg s6"><label htmlFor="pCobNa">Cobrança Na</label><select id="pCobNa" value={f.cobrancaNa} onChange={muda("cobrancaNa")}>{opcoes(["Entrada da amostra", "Assinatura do certificado", "Nota Fiscal"])}</select></div>
          <div className="fg s6"><label htmlFor="pObs">Observações internas ou Externa</label><textarea id="pObs" rows={4} value={f.obs} onChange={muda("obs")} /></div>
          <div className="fg s6"><label htmlFor="pObsF">Observações Financeiras</label><textarea id="pObsF" rows={4} value={f.obsFin} onChange={muda("obsFin")} /></div>
          <div className="s12" style={{ marginTop: 6 }}><button type="submit" className="btn btn-success btn-block" disabled={ocupado}>{ocupado ? "Gravando…" : "Avançar"}</button>
          {!dados.condicoes_pagamento.length && <p className="suave" style={{ margin: "8px 0 0" }}>As condições de pagamento vêm de Configurações → Proposta.</p>}</div>
        </div>
      </Caixa>
    </form>
  );
}
