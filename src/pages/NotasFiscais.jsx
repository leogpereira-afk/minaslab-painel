import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileCode2, FileText, Mail, Plus, Search, Send, Trash2, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import {
  financeiroOpcoes,
  finArquivoUpload,
  finArquivoUrl,
  finEmailEnviar,
  finEmailEstado,
  finNotaExcluir,
  finNotaSalvar,
  finNotaSalvarXml,
  finNotasListar,
} from "../services/financeiro.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => { const p = String(v || "").slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "—"; };
const vazio = { empresa_id:"", tipo:"SAIDA", numero_nf:"", chave_acesso:"", cnpj_emitente:"", cnpj_destinatario:"", nome_emitente:"", nome_destinatario:"", data_emissao:"", data_vencimento:"", valor_total:"", email_destino:"", xml_url:"", pdf_url:"", observacao:"", origem:"MANUAL" };

function tag(root, nome) { return root?.getElementsByTagName(nome)?.[0]?.textContent?.trim() || ""; }
function lerXML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido.");
  const emit = doc.getElementsByTagName("emit")?.[0];
  const dest = doc.getElementsByTagName("dest")?.[0];
  const inf = doc.getElementsByTagName("infNFe")?.[0];
  const emis = tag(doc, "dhEmi") || tag(doc, "dEmi");
  const chaveTag = tag(doc, "chNFe");
  const chaveId = String(inf?.getAttribute("Id") || "").replace(/^NFe/i, "");
  return {
    numero_nf: tag(doc, "nNF"),
    chave_acesso: chaveTag || chaveId,
    cnpj_emitente: tag(emit, "CNPJ") || tag(emit, "CPF"),
    cnpj_destinatario: tag(dest, "CNPJ") || tag(dest, "CPF"),
    nome_emitente: tag(emit, "xNome"),
    nome_destinatario: tag(dest, "xNome"),
    data_emissao: emis ? emis.slice(0, 10) : "",
    valor_total: Number(tag(doc, "vNF") || 0),
    email_destino: tag(dest, "email"),
    origem: "XML",
  };
}
async function arquivoBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}
function Modal({ titulo, onClose, children, largura = "max-w-3xl" }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><div className={`max-h-[92vh] w-full ${largura} overflow-hidden rounded-2xl bg-white shadow-2xl`}><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold">{titulo}</h2><button className="btn-ghost h-9 w-9 p-0" onClick={onClose}><X size={18}/></button></div><div className="max-h-[calc(92vh-68px)] overflow-y-auto p-5">{children}</div></div></div>;
}

export default function NotasFiscais() {
  const navigate = useNavigate();
  const xmlRef = useRef(null);
  const pdfRef = useRef(null);
  const [op, setOp] = useState({ empresas: [] });
  const [itens, setItens] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(vazio);
  const [modal, setModal] = useState(false);
  const [xmlFile, setXmlFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [emailConfigurado, setEmailConfigurado] = useState(false);
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ email:"", assunto:"", mensagem:"" });
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    setErro("");
    try {
      const [o, d, em] = await Promise.all([financeiroOpcoes(), finNotasListar(empresa), finEmailEstado().catch(() => ({ configurado:false }))]);
      setOp(o); setItens(d); setEmailConfigurado(!!em.configurado);
    } catch (e) { setErro(e.message); }
  }
  useEffect(() => { carregar(); }, [empresa]);

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase().trim();
    return itens.filter(x => !t || `${x.numero_nf || ""} ${x.nome_emitente || ""} ${x.nome_destinatario || ""} ${x.cnpj_emitente || ""} ${x.cnpj_destinatario || ""}`.toLowerCase().includes(t));
  }, [itens, busca]);

  function limparArquivos() { setXmlFile(null); setPdfFile(null); }
  function novo() {
    limparArquivos();
    setForm({ ...vazio, empresa_id: empresa || op.empresas?.[0]?.id || "" });
    setModal(true);
  }
  async function importar(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro("");
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error("O XML deve ter no máximo 8 MB.");
      const x = lerXML(await f.text());
      setXmlFile(f); setPdfFile(null);
      setForm({ ...vazio, ...x, empresa_id: empresa || op.empresas?.[0]?.id || "" });
      setModal(true);
    } catch (ex) { setErro(ex.message); }
    finally { e.target.value = ""; }
  }
  async function escolherPdf(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setErro("O PDF deve ter no máximo 8 MB."); return; }
    setPdfFile(f);
  }
  async function subir(arquivo, categoria, empresaId) {
    if (!arquivo) return "";
    const base64 = await arquivoBase64(arquivo);
    const r = await finArquivoUpload(empresaId, categoria, { nome: arquivo.name, mime: arquivo.type || "application/octet-stream", base64 });
    return r.path;
  }
  async function salvar(e) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      if (!form.empresa_id) throw new Error("Selecione a empresa.");
      const registro = { ...form, valor_total: Number(form.valor_total || 0) };
      if (form.origem === "XML") {
        if (!form.data_vencimento) throw new Error("Informe o vencimento antes de importar a nota.");
        if (!xmlFile && !form.xml_url) throw new Error("O arquivo XML é obrigatório.");
        if (xmlFile) registro.xml_url = await subir(xmlFile, "xml", form.empresa_id);
        if (pdfFile) registro.pdf_url = await subir(pdfFile, "pdf", form.empresa_id);
        await finNotaSalvarXml(registro);
      } else {
        if (xmlFile) registro.xml_url = await subir(xmlFile, "xml", form.empresa_id);
        if (pdfFile) registro.pdf_url = await subir(pdfFile, "pdf", form.empresa_id);
        await finNotaSalvar(registro);
      }
      setModal(false); limparArquivos(); await carregar();
    } catch (ex) { setErro(ex.message); }
    finally { setSalvando(false); }
  }
  async function abrirArquivo(path, nome) {
    try {
      if (/^https?:\/\//i.test(String(path || ""))) { window.open(path, "_blank", "noopener,noreferrer"); return; }
      const url = await finArquivoUrl(path, nome);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { setErro(e.message); }
  }
  async function excluir(x) {
    if (!confirm(`Excluir a nota ${x.numero_nf || "sem número"}?`)) return;
    try { await finNotaExcluir(x.id); await carregar(); } catch (ex) { setErro(ex.message); }
  }
  function abrirEmail(x) {
    setEmailModal(x);
    setEmailForm({ email:x.email_destino || "", assunto:`Nota Fiscal ${x.numero_nf || ""} - ${x.empresa?.nome || "MinasLab"}`, mensagem:`Olá,\n\nSegue em anexo a Nota Fiscal ${x.numero_nf || ""}.\n\nAtenciosamente,\n${x.empresa?.nome || "MinasLab"}` });
  }
  async function enviarEmail(e) {
    e.preventDefault(); setErro(""); setEnviando(true);
    try { await finEmailEnviar(emailModal.id, emailForm.email, emailForm.assunto, emailForm.mensagem); setEmailModal(null); await carregar(); }
    catch (ex) { setErro(ex.message); }
    finally { setEnviando(false); }
  }

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={() => navigate("/financas")}><ArrowLeft size={18}/></button><PageTitle titulo="Notas Fiscais" descricao="XML e PDF privados, vínculo automático ao Financeiro e envio de nota com anexos."/></div>

    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 md:flex-row md:items-end">
      <label className="md:w-56"><span className="label">Empresa</span><select className="input" value={empresa} onChange={e => setEmpresa(e.target.value)}><option value="">Todas</option>{op.empresas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label className="flex-1"><span className="label">Pesquisar</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={e => setBusca(e.target.value)} placeholder="NF, razão social ou CNPJ"/></div></label>
      <button className="btn-outline" onClick={() => xmlRef.current?.click()}><Upload size={16}/>Importar XML</button>
      <input ref={xmlRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={importar}/>
      <button className="btn-primary" onClick={novo}><Plus size={16}/>Nova nota</button>
    </div>

    {!emailConfigurado && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><b>Envio por e-mail:</b> funcionalidade pronta, aguardando configuração do remetente no Supabase (`RESEND_API_KEY` e `FIN_EMAIL_FROM`). XML/PDF e demais funções continuam disponíveis normalmente.</div>}
    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">NF</th><th className="px-4 py-3">Emissão / Venc.</th><th className="px-4 py-3">Emitente / Destinatário</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Arquivos</th><th className="px-4 py-3">Envio</th><th className="px-4 py-3"></th></tr></thead><tbody>
      {filtrados.length === 0 ? <tr><td colSpan="9" className="p-8 text-center text-slate-500">Nenhuma nota cadastrada.</td></tr> : filtrados.map(x => <tr key={x.id} className="border-t"><td className="px-4 py-3">{x.empresa?.nome || "—"}</td><td className="px-4 py-3 font-medium">{x.numero_nf || "—"}</td><td className="px-4 py-3"><div>{dataBR(x.data_emissao)}</div><div className="text-xs text-slate-500">Venc. {dataBR(x.data_vencimento)}</div></td><td className="px-4 py-3"><div>{x.nome_emitente || "—"}</div><div className="text-xs text-slate-500">→ {x.nome_destinatario || "—"}</div></td><td className="px-4 py-3 text-right font-semibold">{moeda(x.valor_total)}</td><td className="px-4 py-3"><span className="text-xs font-semibold">{x.origem}</span>{x.recebimento_id && <div className="text-[10px] text-emerald-700">A RECEBER VINCULADO</div>}{x.despesa_id && <div className="text-[10px] text-amber-700">DESPESA VINCULADA</div>}</td><td className="px-4 py-3"><div className="flex gap-1">{x.xml_url && <button className="btn-ghost h-8 px-2 text-xs" title="Abrir XML" onClick={() => abrirArquivo(x.xml_url, `NF-${x.numero_nf || x.id}.xml`)}><FileCode2 size={14}/>XML</button>}{x.pdf_url && <button className="btn-ghost h-8 px-2 text-xs" title="Abrir PDF" onClick={() => abrirArquivo(x.pdf_url, `NF-${x.numero_nf || x.id}.pdf`)}><FileText size={14}/>PDF</button>}{!x.xml_url && !x.pdf_url && "—"}</div></td><td className="px-4 py-3">{x.status_envio === "ENVIADO" ? <div><span className="text-xs font-semibold text-emerald-700">ENVIADO</span><div className="text-[10px] text-slate-500">{x.email_destino}</div></div> : <button className="btn-ghost h-8 px-2 text-xs" disabled={!emailConfigurado || (!x.xml_url && !x.pdf_url)} onClick={() => abrirEmail(x)}><Mail size={14}/>Enviar</button>}</td><td className="px-4 py-3 text-right"><button className="btn-ghost h-8 w-8 p-0 text-red-600" onClick={() => excluir(x)}><Trash2 size={15}/></button></td></tr>)}
    </tbody></table></div>

    {modal && <Modal titulo={form.origem === "XML" ? "Importar nota do XML" : "Nova nota fiscal"} onClose={() => { setModal(false); limparArquivos(); }}><form onSubmit={salvar} className="grid gap-4 md:grid-cols-2">
      <label><span className="label">Empresa</span><select className="input" required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id:e.target.value })}><option value="">Selecione</option>{op.empresas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label><span className="label">Tipo</span>{form.origem === "XML" ? <input className="input bg-slate-50" readOnly value="Automático pelo CNPJ da empresa"/> : <select className="input" value={form.tipo} onChange={e => setForm({ ...form, tipo:e.target.value })}><option>SAIDA</option><option>ENTRADA</option></select>}</label>
      <label><span className="label">Número NF</span><input className="input" value={form.numero_nf} onChange={e => setForm({ ...form, numero_nf:e.target.value })}/></label>
      <label><span className="label">Data emissão</span><input className="input" type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao:e.target.value })}/></label>
      <label><span className="label">Vencimento {form.origem === "XML" && "*"}</span><input className="input" type="date" required={form.origem === "XML"} value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento:e.target.value })}/></label>
      <label><span className="label">Valor total</span><input className="input" type="number" step="0.01" value={form.valor_total} onChange={e => setForm({ ...form, valor_total:e.target.value })}/></label>
      <label><span className="label">Emitente</span><input className="input" value={form.nome_emitente} onChange={e => setForm({ ...form, nome_emitente:e.target.value })}/></label>
      <label><span className="label">CNPJ emitente</span><input className="input" value={form.cnpj_emitente} onChange={e => setForm({ ...form, cnpj_emitente:e.target.value })}/></label>
      <label><span className="label">Destinatário</span><input className="input" value={form.nome_destinatario} onChange={e => setForm({ ...form, nome_destinatario:e.target.value })}/></label>
      <label><span className="label">CNPJ destinatário</span><input className="input" value={form.cnpj_destinatario} onChange={e => setForm({ ...form, cnpj_destinatario:e.target.value })}/></label>
      <label><span className="label">E-mail destino</span><input className="input" type="email" value={form.email_destino} onChange={e => setForm({ ...form, email_destino:e.target.value })}/></label>
      <label><span className="label">PDF da nota</span><button type="button" className="btn-outline w-full justify-center" onClick={() => pdfRef.current?.click()}><FileText size={15}/>{pdfFile ? pdfFile.name : "Selecionar PDF"}</button><input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={escolherPdf}/></label>
      <label className="md:col-span-2"><span className="label">Chave de acesso</span><input className="input" value={form.chave_acesso} onChange={e => setForm({ ...form, chave_acesso:e.target.value })}/></label>
      <label className="md:col-span-2"><span className="label">Observação</span><textarea className="input min-h-20" value={form.observacao} onChange={e => setForm({ ...form, observacao:e.target.value })}/></label>
      {form.origem === "XML" && <div className="md:col-span-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-800"><b>Ao confirmar:</b> o XML será salvo no bucket privado `ml-arquivos`. Se o CNPJ da empresa for o emitente, será criado/vinculado um <b>Recebimento</b>; se for o destinatário, será criada/vinculada uma <b>Despesa</b>. O vencimento informado aqui será usado no título.</div>}
      <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => { setModal(false); limparArquivos(); }}>Cancelar</button><button className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : form.origem === "XML" ? "Importar e lançar" : "Salvar nota"}</button></div>
    </form></Modal>}

    {emailModal && <Modal titulo={`Enviar NF ${emailModal.numero_nf || ""}`} largura="max-w-xl" onClose={() => setEmailModal(null)}><form onSubmit={enviarEmail} className="space-y-4"><label className="block"><span className="label">E-mail do destinatário</span><input className="input" type="email" required value={emailForm.email} onChange={e => setEmailForm({ ...emailForm, email:e.target.value })}/></label><label className="block"><span className="label">Assunto</span><input className="input" required value={emailForm.assunto} onChange={e => setEmailForm({ ...emailForm, assunto:e.target.value })}/></label><label className="block"><span className="label">Mensagem</span><textarea className="input min-h-36" value={emailForm.mensagem} onChange={e => setEmailForm({ ...emailForm, mensagem:e.target.value })}/></label><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Serão anexados automaticamente os arquivos disponíveis: {emailModal.xml_url ? "XML " : ""}{emailModal.pdf_url ? "PDF" : ""}.</div><div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setEmailModal(null)}>Cancelar</button><button className="btn-primary" disabled={enviando}><Send size={15}/>{enviando ? "Enviando..." : "Enviar e-mail"}</button></div></form></Modal>}
  </div>;
}
