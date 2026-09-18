import { useCallback, useEffect, useState } from "react";
import { Download, FileText, LoaderCircle, Upload } from "lucide-react";
import { rhDocumentoUrl, rhDocumentoUpload, rhDocumentosListar } from "../../services/dados.js";
import { Card, Empty } from "../ui.jsx";

const TIPOS = [
  "Ficha de Registro", "Kit Admissional", "Contrato de Trabalho", "ASO",
  "NR / Certificado de Treinamento", "Ordem de Serviço SST", "Documentos Pessoais", "Outros",
];

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
      await rhDocumentoUpload({
        pessoaId: pessoa.id,
        empresa: pessoa.empresa || "",
        tipo,
        nomeOriginal: file.name,
        mimeType: file.type || "application/octet-stream",
        arquivoBase64: base64,
        leituraStatus: "REQUER_CONFERENCIA",
        dadosExtraidos: {},
        observacoes: "Documento enviado para conferência humana.",
      });
      setMensagem("Documento armazenado. A leitura requer conferência humana.");
      await carregar();
    } catch (err) { setMensagem(err.message); }
    finally { setCarregando(false); }
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
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">Documentos</h2>
          <p className="text-xs text-slate-500">Original preservado no Storage privado.</p>
        </div>
        {editavel && (
          <div className="flex flex-wrap items-center gap-2">
            <select className="select py-1 text-xs" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label className="btn-primary cursor-pointer py-1 text-xs">
              {carregando ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
              Enviar documento
              <input type="file" className="sr-only" accept=".pdf,image/*,.doc,.docx" onChange={enviar} disabled={carregando} />
            </label>
          </div>
        )}
      </div>
      {mensagem && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{mensagem}</p>}
      {documentos.length === 0 ? <Empty>Nenhum documento enviado.</Empty> : (
        <ul className="divide-y" style={{ borderColor: "var(--fio-lista)" }}>
          {documentos.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <FileText size={16} className="text-brand-600" />
              <span className="min-w-0 flex-1 truncate">{doc.nome_original}</span>
              <span className="chip">{doc.tipo}</span>
              <span className="text-xs text-slate-500">{doc.leitura_status === "REQUER_CONFERENCIA" ? "Conferência manual" : doc.leitura_status}</span>
              <button type="button" className="btn-ghost py-1 text-xs" onClick={() => abrir(doc)}><Download size={14} /> Abrir</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
