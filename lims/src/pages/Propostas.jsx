// "Limpar Pesquisa" zera os filtros recriando a grade (key).
// Propostas → Listar Propostas, com os 10 botões e os filtros por coluna do
// GerenciaLab. Regras (revisão, cópia) em lib/propostas.js, testadas.

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { navegar } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { STATUS_PROPOSTA, numeroProposta, totalProposta, podeEditar, criarRevisao, copiarProposta } from "../lib/propostas.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, RotuloProposta, useAviso } from "../components/ui.jsx";

export default function ListaPropostas({ sessao }) {
  const { dados, mudar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const [chaveGrade, setChaveGrade] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [alerta, setAlerta] = useState({ data: isoDia(3), desc: "" });
  const cli = (p) => dados.clientes.find((c) => c.id === p.clienteId) || {};
  const sol = (p) => dados.solicitantes.find((s) => s.id === p.solicitanteId);
  const p = dados.propostas.find((x) => sel.has(x.id));
  const quem = sessao.nome || sessao.usuario;

  const colunas = [
    { t: "ID", v: (r) => r.id, filtro: true },
    { t: "Status", v: (r) => r.status, h: (r) => <RotuloProposta status={r.status} />, filtro: "lista" },
    { t: "Responsável", v: (r) => r.resp, filtro: true },
    { t: "Proposta", v: (r) => numeroProposta(r), filtro: true },
    { t: "Versão", v: (r) => r.ver },
    { t: "CNPJ Solicitante", v: () => "", filtro: true },
    { t: "Solicitante", v: (r) => sol(r)?.nome || "", filtro: true },
    { t: "CNPJ Cliente", v: (r) => cli(r).doc || "", filtro: true },
    { t: "Cliente", v: (r) => cli(r).razao || "", filtro: true },
    { t: "Identificação", v: (r) => r.ident, filtro: true },
    { t: "Total R$", v: (r) => totalProposta(r), fv: (r) => brl(totalProposta(r)), h: (r) => brl(totalProposta(r)), filtro: true },
    { t: "Visualização", v: (r) => r.views },
    { t: "Data de criação", v: (r) => r.criacao, fv: (r) => dataBR(r.criacao), h: (r) => dataBR(r.criacao), filtro: true },
    { t: "Data de validade", v: (r) => r.validade, fv: (r) => dataBR(r.validade), h: (r) => dataBR(r.validade), filtro: true },
    { t: "Status processo", v: (r) => r.statusProc, filtro: true },
  ];

  const exigir = (fn) => () => { if (!p) { avisar("Selecione uma proposta na lista.", "err"); return; } fn(); };
  const trocar = (np) => mudar((d) => { d.propostas = d.propostas.map((x) => (x.id === np.id ? np : x)); return d; });

  const botoes = [
    { rotulo: "Exportar", acao: () => avisar("Exportar fica disponível quando o LIMS estiver ligado ao servidor, na próxima etapa.") },
    { rotulo: "Criar Proposta", acao: () => navegar("criar-proposta") },
    { rotulo: "Editar Proposta", acao: exigir(() => (podeEditar(p) ? navegar("criar-proposta", p.id) : avisar("Proposta aceita não pode ser editada. Use Criar revisão.", "err"))) },
    { rotulo: "Visualizar", acao: exigir(() => navegar("proposta", p.id)) },
    { rotulo: "Criar revisão", acao: exigir(() => { setMotivo(""); setJanela("revisao"); }) },
    { rotulo: "Copiar Proposta", acao: exigir(() => setJanela("copiar")) },
    { rotulo: "Documentos", acao: exigir(() => setJanela("docs")) },
    { rotulo: "Consulta rápida", acao: exigir(() => setJanela("cliente")) },
    { rotulo: "Alerta", acao: exigir(() => { setAlerta({ data: isoDia(3), desc: "" }); setJanela("alerta"); }) },
    { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChaveGrade((k) => k + 1); } },
  ];

  const fechar = () => setJanela(null);
  const c = p ? cli(p) : null;
  return (
    <Caixa titulo="Propostas">
      <Grade key={chaveGrade} id="prop" linhas={dados.propostas} colunas={colunas} filtrosColuna opcoesFiltro={{ 1: STATUS_PROPOSTA }}
            selecao={sel} aoSelecionar={setSel} aoAbrir={(l) => navegar("proposta", l.id)} botoes={botoes} porPaginaInicial={10} rotuloPorPagina="resultados por página" />

      {janela === "revisao" && p && (
        <Modal titulo="Motivo da Revisão" onFechar={fechar} rotuloOk="Criar revisão" aoConfirmar={() => {
          try { const r = criarRevisao(p, motivo, quem, isoDia(0)); trocar(r); avisar(`Revisão criada: ${numeroProposta(r)}.`, "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mRev">Motivo da revisão da proposta {numeroProposta(p)}</label><textarea id="mRev" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </Modal>
      )}
      {janela === "copiar" && p && (
        <Modal titulo="Copiar Proposta" onFechar={fechar} rotuloOk="Copiar" aoConfirmar={() => {
          const n = copiarProposta(p, dados.propostas, quem, isoDia(0), isoDia(30));
          mudar((d) => { d.propostas.push(n); return d; });
          setSel(new Set([n.id]));
          avisar(`Proposta copiada: ${numeroProposta(n)}.`, "ok");
        }}>
          <p style={{ margin: 0 }}>Criar uma nova proposta com os mesmos dados de <b>{numeroProposta(p)}</b>?</p>
        </Modal>
      )}
      {janela === "docs" && p && <Documentos p={p} onFechar={fechar} aoAnexar={(doc) => { trocar({ ...p, docs: [...(p.docs || []), doc] }); avisar("Documento anexado.", "ok"); }} />}
      {janela === "cliente" && p && (
        <Modal titulo="Dados do Cliente" onFechar={fechar} rotuloOk="Abrir perfil" aoConfirmar={() => navegar("cliente", c.id)}>
          <dl className="detail uma">{[["Razão Social", c.razao], ["Nome Fantasia", c.fantasia || "—"], ["CNPJ", c.doc], ["Responsável", c.resp], ["E-mail", c.email], ["Telefone", c.tel], ["Celular", c.cel], ["Cidade", `${c.cidade || ""} / ${c.uf || ""}`]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </Modal>
      )}
      {janela === "alerta" && p && (
        <Modal titulo="Adicionar Alertas" onFechar={fechar} rotuloOk="Adicionar" aoConfirmar={() => {
          if (!alerta.desc.trim()) { avisar("Descreva o alerta.", "err"); return false; }
          mudar((d) => { d.alertas = [...(d.alertas || []), { pid: p.id, data: alerta.data, desc: alerta.desc.trim() }]; return d; });
          avisar("Alerta adicionado.", "ok");
        }}>
          <div className="fg"><label htmlFor="mAD">Data do alerta</label><input id="mAD" type="date" value={alerta.data} onChange={(e) => setAlerta({ ...alerta, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="mAT">Descrição</label><textarea id="mAT" rows={3} placeholder="Ex.: ligar para o cliente sobre o aceite" value={alerta.desc} onChange={(e) => setAlerta({ ...alerta, desc: e.target.value })} /></div>
        </Modal>
      )}
    </Caixa>
  );
}

function Documentos({ p, onFechar, aoAnexar }) {
  const [arq, setArq] = useState(null);
  const avisar = useAviso();
  return (
    <Modal titulo="Documentos" onFechar={onFechar} rotuloOk="Anexar" aoConfirmar={() => {
      if (!arq) { avisar("Escolha um arquivo.", "err"); return false; }
      aoAnexar({ nome: arq.name, kb: Math.max(1, Math.round(arq.size / 1024)), em: isoDia(0) });
    }}>
      <div className="tw"><table><thead><tr><th>Documento</th><th>Tamanho</th><th>Anexado em</th></tr></thead><tbody>
        {(p.docs || []).length ? p.docs.map((d, i) => <tr key={i}><td>{d.nome}</td><td>{d.kb} KB</td><td>{dataBR(d.em)}</td></tr>) : <tr><td colSpan={3} className="vazio">Nenhum documento anexado.</td></tr>}
      </tbody></table></div>
      <div className="fg"><label htmlFor="mDoc">Anexar documento</label><input id="mDoc" type="file" onChange={(e) => setArq(e.target.files?.[0] || null)} /></div>
      <p className="suave" style={{ margin: 0 }}>Nesta etapa só o nome do arquivo fica registrado. O arquivo em si passa a ser guardado quando o LIMS estiver ligado ao servidor.</p>
    </Modal>
  );
}

