import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import {
  rhDocumentoConfirmarPreenchimento, rhDocumentoExcluir, rhDocumentoUrl,
  rhDocumentoUpload, rhDocumentosListar,
} from "../../services/dados.js";
import { extrairDadosKit, extrairTextoPdf } from "../../lib/rh/leituraKit.js";
import { Card, Empty } from "../ui.jsx";

const TIPOS = [
  "Ficha de Registro", "Kit Admissional", "Contrato de Trabalho", "ASO",
  "NR / Certificado de Treinamento", "Ordem de Serviço SST", "Documentos Pessoais", "Outros",
];
const ROTULOS = {
  nome:"Nome", cpf:"CPF", rg:"RG", dataNascimento:"Nascimento", admissao:"Admissão",
  cargo:"Cargo/Função", salario:"Salário", telefone:"Telefone", endereco:"Endereço",
  cidade:"Cidade", email:"E-mail", setor:"Setor", jornada:"Jornada",
};

function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function DocumentosFuncionario({ pessoa, editavel }) {
  const [documentos, setDocumentos] = useState([]);
  const [tipo, setTipo] = useState("Outros");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState(null);

  const carregar = useCallback(async () => {
    if (!pessoa?.id) return;
    try { setDocumentos(await rhDocumentosListar({ pessoaId: pessoa.id })); }
    catch (e) { setMensagem(e.message); }
  }, [pessoa?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCarregando(true); setMensagem("");
    try {
      const base64 = await lerArquivo(file);
      let leitura = { dados: {}, conflitos: [], leituraStatus: "REQUER_CONFERENCIA", camposEncontrados: [], textoExtraido: "" };
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        try {
          const texto = await extrairTextoPdf(file);
          leitura = extrairDadosKit(texto, pessoa);
        } catch {
          leitura.leituraStatus = "REQUER_CONFERENCIA";
        }
      }
      const doc = await rhDocumentoUpload({
        pessoaId: pessoa.id, empresa: pessoa.empresa || "", tipo,
        nomeOriginal: file.name, mimeType: file.type || "application/octet-stream",
        arquivoBase64: base64, leituraStatus: leitura.leituraStatus,
        dadosExtraidos: leitura.dados, observacoes: leitura.leituraStatus === "CONCLUIDA"
          ? "Campos encontrados aguardando confirmação humana."
          : "Documento armazenado; requer conferência manual.",
      });
      setPendente({ doc, dados: leitura.dados, conflitos: leitura.conflitos, camposEncontrados: leitura.camposEncontrados });
      setMensagem(leitura.camposEncontrados.length ? "Confira os campos encontrados antes de confirmar." : "Arquivo armazenado, mas não foi possível extrair texto automaticamente.");
      await carregar();
    } catch (err) { setMensagem(err.message); }
    finally { setCarregando(false); }
  }

  async function confirmar() {
    if (!pendente) return;
    try {
      const r = await rhDocumentoConfirmarPreenchimento(pendente.doc.id, pessoa.id, pendente.dados);
      setMensagem(`Cadastro preenchido: ${(r.camposAlterados || []).join(", ") || "nenhum campo novo"}.`);
      setPendente(null); await carregar();
    } catch (e) { setMensagem(e.message); }
  }

  async function excluir(doc) {
    if (!window.confirm(`Retirar o documento "${doc.nome_original}" da ficha?`)) return;
    try {
      await rhDocumentoExcluir(doc.id);
      if (pendente?.doc?.id === doc.id) setPendente(null);
      setMensagem("Documento retirado da ficha. O original foi preservado no histórico.");
      await carregar();
    } catch (e) { setMensagem(e.message); }
  }

  async function abrir(doc) {
    try {
      const url = await rhDocumentoUrl(doc.id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { setMensagem(e.message); }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-display text-base font-semibold text-slate-900">Documentos</h2><p className="text-xs text-slate-500">Original preservado no Storage privado.</p></div>
        {editavel && <div className="flex flex-wrap items-center gap-2"><select className="select py-1 text-xs" value={tipo} onChange={e => setTipo(e.target.value)}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select><label className="btn-primary cursor-pointer py-1 text-xs">{carregando ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />} Enviar documento<input type="file" className="sr-only" accept=".pdf,image/*,.doc,.docx" onChange={enviar} disabled={carregando} /></label></div>}
      </div>
      {mensagem && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{mensagem}</p>}
      {pendente && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold"><CheckCircle2 size={16}/> Informações encontradas — confira antes de preencher</div>
          {pendente.conflitos?.length > 0 && <p className="mb-2 text-xs text-warn-800">Existem divergências com o cadastro atual. A confirmação usará somente os valores exibidos abaixo.</p>}
          {pendente.camposEncontrados?.length ? <div className="grid gap-2 md:grid-cols-2">{pendente.camposEncontrados.map(campo => <label key={campo} className="text-xs text-slate-600">{ROTULOS[campo] || campo}<input className="input mt-1" value={pendente.dados[campo] || ""} onChange={e => setPendente(p => ({...p, dados:{...p.dados, [campo]:e.target.value}}))} /></label>)}</div> : <p className="text-xs text-slate-600">Nenhum campo foi extraído automaticamente. Abra o original e faça a conferência manual.</p>}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-primary" onClick={confirmar} disabled={!pendente.camposEncontrados?.length}>Confirmar e preencher cadastro</button><button type="button" className="btn-outline" onClick={() => setPendente(null)}>Cancelar confirmação</button></div>
        </div>
      )}
      {documentos.length === 0 ? <Empty>Nenhum documento enviado.</Empty> : <ul className="divide-y" style={{ borderColor:"var(--fio-lista)" }}>{documentos.map(doc => <li key={doc.id} className="flex flex-wrap items-center gap-3 py-2 text-sm"><FileText size={16} className="text-brand-600"/><span className="min-w-0 flex-1 truncate">{doc.nome_original}</span><span className="chip">{doc.tipo}</span><span className="text-xs text-slate-500">{doc.status === "CONFIRMADO" ? "Confirmado" : doc.leitura_status === "REQUER_CONFERENCIA" ? "Conferência manual" : doc.leitura_status}</span><button type="button" className="btn-ghost py-1 text-xs" onClick={() => abrir(doc)}><Download size={14}/> Abrir</button>{editavel && <button type="button" className="btn-ghost py-1 text-xs text-bad-700" onClick={() => excluir(doc)}><Trash2 size={14}/> Retirar</button>}</li>)}</ul>}
    </Card>
  );
}
