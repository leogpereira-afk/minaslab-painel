// Propostas → Listar Propostas, com os botões e submenus do GerenciaLab:
// Exportar ▸ Excel/CSV/PDF/Print · Editar Proposta ▸ motivo de alteração,
// motivos, aceite · Criar revisão ▸ motivo, motivos · Documentos ▸ PDF,
// e-mail · Consulta rápida ▸ amostras, parâmetros · Alerta · Limpar Pesquisa.
// "Limpar Pesquisa" zera os filtros recriando a grade (key).

import { useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { navegar } from "../lib/rota.js";
import { estaAtivo } from "../lib/cadastros.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { STATUS_PROPOSTA, numeroProposta, totalProposta, podeEditar, criarRevisao, copiarProposta, aceitarProposta, precoUnitario, chaveNumero, minimoNumero } from "../lib/propostas.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, RotuloProposta, useAviso } from "../components/ui.jsx";

export default function ListaPropostas({ sessao }) {
  const { dados, salvar, proximo } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const [chaveGrade, setChaveGrade] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [alerta, setAlerta] = useState({ data: isoDia(3), desc: "" });
  const [aceite, setAceite] = useState(null);
  const cli = (p) => dados.clientes.find((c) => c.id === p.clienteId) || {};
  const sol = (p) => dados.solicitantes.find((s) => s.id === p.solicitanteId);
  const p = dados.propostas.find((x) => sel.has(x.id));
  const quem = sessao.nome || sessao.usuario;

  const colunas = [
    { t: "ID", v: (r) => Number(r.cod) || 0, filtro: true },
    { t: "Status", v: (r) => r.status, h: (r) => <RotuloProposta status={r.status} />, filtro: "lista" },
    { t: "Responsável", v: (r) => r.resp, filtro: true },
    { t: "Proposta", v: (r) => numeroProposta(r), filtro: true },
    { t: "Versão", v: (r) => r.ver },
    { t: "CNPJ Solicitante", v: (r) => sol(r)?.doc || "", filtro: true },
    { t: "Solicitante", v: (r) => sol(r)?.razao || sol(r)?.nome || "", filtro: true },
    { t: "CNPJ Cliente", v: (r) => cli(r).doc || "", filtro: true },
    { t: "Cliente", v: (r) => `${cli(r).razao || ""} ( ${cli(r).fantasia || ""} )`, h: (r) => <a href={`#/cliente/${cli(r).id}`} onClick={(e) => e.stopPropagation()}>{cli(r).razao} ( {cli(r).fantasia || ""} )</a>, filtro: true },
    { t: "Identificação", v: (r) => r.ident, filtro: true },
    { t: "Total R$", v: (r) => totalProposta(r), fv: (r) => brl(totalProposta(r)), h: (r) => brl(totalProposta(r)), filtro: true },
    { t: "Visualização", v: (r) => r.views },
    { t: "Data de criação", v: (r) => r.criacao, fv: (r) => dataBR(r.criacao), h: (r) => dataBR(r.criacao), filtro: true },
    { t: "Data de validade", v: (r) => r.validade, fv: (r) => dataBR(r.validade), h: (r) => dataBR(r.validade), filtro: true },
    { t: "Status processo", v: (r) => r.statusProc, filtro: true },
  ];

  const exigir = (fn) => () => { if (!p) { avisar("Selecione uma proposta na lista.", "err"); return; } fn(); };

  const menu = (rotulo, itens) => ({ rotulo, menu: itens.map(([r, fn]) => ({ rotulo: r, acao: fn })) });
  const botoes = [
    { rotulo: "Criar Proposta", acao: () => navegar("criar-proposta") },
    menu("Editar Proposta", [
      ["Informar motivo alteração", exigir(() => (podeEditar(p) ? (setMotivo(""), setJanela("alteracao")) : avisar("Proposta aceita não pode ser editada. Use Criar revisão.", "err")))],
      ["Motivo(s) alteração", exigir(() => setJanela("motivosAlt"))],
      ["Aceita proposta", exigir(() => (p.status === "Aceito" ? avisar("Esta proposta já foi aceita.", "err") : (setAceite({ data: isoDia(0), nome: cli(p).resp || "", obs: "" }), setJanela("aceite"))))],
    ]),
    { rotulo: "Visualizar", acao: exigir(() => navegar("proposta", p.id)) },
    menu("Criar revisão", [
      ["Informar o motivo Revisão", exigir(() => { setMotivo(""); setJanela("revisao"); })],
      ["Motivo(s) Revisão", exigir(() => setJanela("motivosRev"))],
    ]),
    { rotulo: "Copiar Proposta", acao: exigir(() => setJanela("copiar")) },
    menu("Documentos", [
      ["Baixar Proposta em PDF", exigir(() => { try { sessionStorage.setItem("lims:imprimir", p.id); } catch { /* sem armazenamento */ } navegar("proposta", p.id); })],
      ["Enviar Proposta por email", exigir(() => setJanela("email"))],
    ]),
    menu("Consulta rápida", [
      ["Amostras da proposta", exigir(() => setJanela("amostras"))],
      ["Consultar todos parâmetros", exigir(() => setJanela("parametros"))],
    ]),
    { rotulo: "Alerta", acao: exigir(() => { setAlerta({ data: isoDia(3), desc: "" }); setJanela("alerta"); }) },
    { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChaveGrade((k) => k + 1); } },
  ];

  const fechar = () => setJanela(null);
  const c = p ? cli(p) : null;
  return (
    <Caixa titulo="Propostas">
      <Grade key={chaveGrade} id="prop" exportar="propostas" exportarMenu linhas={dados.propostas} colunas={colunas} filtrosColuna opcoesFiltro={{ 1: STATUS_PROPOSTA }}
            selecao={sel} aoSelecionar={setSel} aoAbrir={(l) => navegar("proposta", l.id)} botoes={botoes} porPaginaInicial={10} rotuloPorPagina="resultados por página" />

      {janela === "revisao" && p && (
        <Modal titulo="Motivo da Revisão" onFechar={fechar} rotuloOk="Criar revisão" aoConfirmar={async () => {
          try { const r = criarRevisao(p, motivo, quem, isoDia(0)); await salvar("propostas", r, { motivo: `Revisão ${r.ver}: ${motivo.trim()}` }); avisar(`Revisão criada: ${numeroProposta(r)}.`, "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mRev">Motivo da revisão da proposta {numeroProposta(p)}</label><textarea id="mRev" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </Modal>
      )}
      {janela === "copiar" && p && (
        <Modal titulo="Copiar Proposta" onFechar={fechar} rotuloOk="Copiar" aoConfirmar={async () => {
          try {
            const ano = new Date().getFullYear();
            const num = await proximo(chaveNumero(ano), minimoNumero(configSistema(dados)));
            const n = await salvar("propostas", copiarProposta(p, num, quem, isoDia(0), isoDia(30)), { numerar: true, motivo: `Cópia de ${numeroProposta(p)}` });
            setSel(new Set([n.id]));
            avisar(`Proposta copiada: ${numeroProposta(n)}.`, "ok");
          } catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <p style={{ margin: 0 }}>Criar uma nova proposta com os mesmos dados de <b>{numeroProposta(p)}</b>?</p>
        </Modal>
      )}
      {janela === "alteracao" && p && (
        <Modal titulo="Informar motivo alteração" onFechar={fechar} rotuloOk="Continuar para editar" aoConfirmar={async () => {
          if (!motivo.trim()) { avisar("Informe o motivo da alteração.", "err"); return false; }
          try { await salvar("propostas", { ...p, alteracoes: [...(p.alteracoes || []), { em: new Date().toISOString(), por: quem, motivo: motivo.trim() }] }, { motivo: `Alteração: ${motivo.trim()}` }); navegar("criar-proposta", p.id); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mAlt">Motivo da alteração da proposta {numeroProposta(p)}</label><input id="mAlt" list="mot-prop" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <datalist id="mot-prop">{dados.motivos_alteracao.filter(estaAtivo).map((m) => <option key={m.id} value={m.identificacao} />)}</datalist></div>
        </Modal>
      )}
      {(janela === "motivosAlt" || janela === "motivosRev") && p && (
        <Modal titulo={janela === "motivosAlt" ? "Motivo(s) alteração" : "Motivo(s) Revisão"} onFechar={fechar}>
          {(() => { const l = janela === "motivosAlt" ? (p.alteracoes || []) : (p.revs || []).map((r) => ({ em: r.em, por: r.por, motivo: `Versão ${r.ver}: ${r.motivo}` })); return (
            <div className="tw"><table><thead><tr><th>Data</th><th>Por</th><th>Motivo</th></tr></thead>
              <tbody>{l.length ? l.map((m, i) => <tr key={i}><td>{String(m.em).length > 10 ? new Date(m.em).toLocaleString("pt-BR") : dataBR(m.em)}</td><td>{m.por}</td><td className="quebra">{m.motivo}</td></tr>) : <tr><td colSpan={3} className="vazio">Nenhum motivo registrado.</td></tr>}</tbody></table></div>
          ); })()}
        </Modal>
      )}
      {janela === "aceite" && p && aceite && (
        <Modal titulo="Aceita proposta" onFechar={fechar} rotuloOk="Aceitar" aoConfirmar={async () => {
          try { await salvar("propostas", aceitarProposta(p, aceite), { motivo: `Aceite de ${aceite.nome}` }); avisar("Proposta aceita.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="lAcD">Data do aceite</label><input id="lAcD" type="date" value={aceite.data} onChange={(e) => setAceite({ ...aceite, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="lAcN">Aceito por</label><input id="lAcN" value={aceite.nome} onChange={(e) => setAceite({ ...aceite, nome: e.target.value })} /></div>
          <div className="fg"><label htmlFor="lAcO">Observação</label><textarea id="lAcO" rows={2} value={aceite.obs} onChange={(e) => setAceite({ ...aceite, obs: e.target.value })} /></div>
        </Modal>
      )}
      {janela === "email" && p && <EnviarEmail p={p} c={c} sol={sol(p)} onFechar={fechar} aoRegistrar={async (env) => { try { await salvar("propostas", { ...p, envios: [...(p.envios || []), env] }, { motivo: `Envio registrado para ${env.para}` }); avisar("Envio registrado.", "ok"); } catch (e) { avisar(e.message, "err"); return false; } }} />}
      {janela === "amostras" && p && (
        <Modal titulo={`Amostras da proposta ${numeroProposta(p)}`} largo onFechar={fechar}>
          <div className="tw"><table><thead><tr><th>#</th><th>Identificação</th><th>Grupo</th><th>Matriz</th><th>Legislação</th><th>Qtde</th><th>Total da amostra</th><th>Prazo</th></tr></thead>
            <tbody>{(p.itens || []).length ? p.itens.map((i, n) => <tr key={n}><td>{n + 1}</td><td>{i.ident || "—"}</td><td>{i.grupo || "—"}</td><td>{i.matriz || i.descricao}</td><td>{i.legislacao}</td><td>{i.qtd}</td><td>{brl(precoUnitario(i))}</td><td>{i.prazo ? `${i.prazo} dias` : "—"}</td></tr>) : <tr><td colSpan={8} className="vazio">Nenhuma amostra.</td></tr>}</tbody></table></div>
        </Modal>
      )}
      {janela === "parametros" && p && (
        <Modal titulo={`Parâmetros da proposta ${numeroProposta(p)}`} largo onFechar={fechar}>
          <div className="tw"><table><thead><tr><th>Amostra</th><th>Parâmetro</th><th>LQ</th><th>Unidade</th><th>Método</th><th>Preço</th><th>Subcontrato</th></tr></thead>
            <tbody>{(p.itens || []).flatMap((i, n) => i.params.map((x) => <tr key={`${n}-${x.id}`}><td>{i.ident || i.matriz || n + 1}</td><td>{x.nome}{x.acred ? " ¹" : ""}</td><td>{x.lq}</td><td>{x.un}</td><td>{x.metodo}</td><td>{brl(x.preco)}</td><td>{x.subcontratado || "-"}</td></tr>))}</tbody></table></div>
        </Modal>
      )}
      {janela === "alerta" && p && (
        <Modal titulo="Adicionar Alertas" onFechar={fechar} rotuloOk="Adicionar" aoConfirmar={async () => {
          if (!alerta.desc.trim()) { avisar("Descreva o alerta.", "err"); return false; }
          try { await salvar("alertas", { pid: p.id, data: alerta.data, desc: alerta.desc.trim(), feito: false }); avisar("Alerta adicionado.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mAD">Data do alerta</label><input id="mAD" type="date" value={alerta.data} onChange={(e) => setAlerta({ ...alerta, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="mAT">Descrição</label><textarea id="mAT" rows={3} placeholder="Ex.: ligar para o cliente sobre o aceite" value={alerta.desc} onChange={(e) => setAlerta({ ...alerta, desc: e.target.value })} /></div>
        </Modal>
      )}
    </Caixa>
  );
}

function EnviarEmail({ p, c, sol, onFechar, aoRegistrar }) {
  const avisar = useAviso();
  const para0 = p.envio === "Solicitante" ? p.emailSolProp || sol?.email || "" : p.emailCliProp || c?.email || "";
  const [f, setF] = useState({ para: para0, assunto: `Proposta comercial ${numeroProposta(p)} - MinasLab`, msg: `Prezado(a),\n\nSegue a proposta comercial nº ${numeroProposta(p)}.\n\nFicamos à disposição.\nMinasLab` });
  const mailto = `mailto:${encodeURIComponent(f.para)}?subject=${encodeURIComponent(f.assunto)}&body=${encodeURIComponent(f.msg)}`;
  return (
    <Modal titulo="Enviar Proposta por email" onFechar={onFechar} rotuloOk="Registrar envio" aoConfirmar={() => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.para.trim())) { avisar("Informe um e-mail válido.", "err"); return false; }
      return aoRegistrar({ em: new Date().toISOString(), para: f.para.trim(), assunto: f.assunto });
    }}>
      <div className="fg"><label htmlFor="eePara">E-mail</label><input id="eePara" type="email" value={f.para} onChange={(e) => setF({ ...f, para: e.target.value })} /></div>
      <div className="fg"><label htmlFor="eeAss">Assunto</label><input id="eeAss" value={f.assunto} onChange={(e) => setF({ ...f, assunto: e.target.value })} /></div>
      <div className="fg"><label htmlFor="eeMsg">Mensagem</label><textarea id="eeMsg" rows={6} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} /></div>
      <p className="suave" style={{ margin: 0 }}>O envio automático com o PDF anexado entra na próxima etapa. Por enquanto: <a href={mailto}>abrir no seu e-mail</a> (anexe o PDF baixado em Documentos → Baixar Proposta em PDF) e clique em Registrar envio.</p>
    </Modal>
  );
}
