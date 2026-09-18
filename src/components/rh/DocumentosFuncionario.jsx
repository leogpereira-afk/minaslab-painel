import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import {
  rhDocumentoConfirmarPreenchimento, rhDocumentoExcluir, rhDocumentoUrl,
  rhDocumentoAtualizar, rhDocumentoUpload, rhDocumentosListar, salvar,
} from "../../services/dados.js";
import { extrairDadosKit, extrairTextoPdf } from "../../lib/rh/leituraKit.js";
import { Card, Empty } from "../ui.jsx";

const TIPOS = [
  "Ficha de Registro", "Kit Admissional", "Contrato de Trabalho", "ASO",
  "NR / Certificado de Treinamento", "Ordem de Serviço SST", "Documentos Pessoais", "Outros",
];
const ROTULOS = {
  nome:"Nome", cpf:"CPF", rg:"RG", dataNascimento:"Nascimento", admissao:"Admissão",
  cargo:"Cargo/Função", cbo:"CBO", salario:"Salário", telefone:"Telefone", endereco:"Endereço",
  cidade:"Cidade", cep:"CEP", email:"E-mail", setor:"Setor/Local", jornada:"Jornada",
  horasSemanais:"Horas semanais", estadoCivil:"Estado civil", escolaridade:"Escolaridade",
  empresa:"Empresa", matriculaEsocial:"Matrícula eSocial", pis:"PIS/PASEP", ctps:"CTPS",
  vinculo:"Vínculo", nacionalidade:"Nacionalidade", naturalidade:"Naturalidade", sexo:"Sexo",
  orgaoEmissorRg:"Órgão emissor do RG", ufRg:"UF do RG", nomeMae:"Nome da mãe", nomePai:"Nome do pai",
  serieCtps:"Série CTPS", ufCtps:"UF CTPS", tipoSalario:"Tipo de salário", centroCusto:"Centro de custo",
};
const TIPOS_CADASTRO = new Set(["Ficha de Registro", "Kit Admissional", "Contrato de Trabalho", "Documentos Pessoais"]);
const TIPOS_EVENTO = new Set(["ASO", "NR / Certificado de Treinamento", "Ordem de Serviço SST"]);
const hoje = () => new Date().toISOString().slice(0, 10);

function somarMeses(iso, meses) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const [a, m, d] = iso.split("-").map(Number);
  const base = new Date(a, m - 1, 1);
  base.setMonth(base.getMonth() + meses);
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

function tipoAso(obs) {
  const s = String(obs || "").toLowerCase();
  if (s.includes("admiss")) return "admissional";
  if (s.includes("demiss")) return "demissional";
  if (s.includes("retorno")) return "retorno";
  if (s.includes("mudança") || s.includes("mudanca")) return "mudanca_funcao";
  return "periodico";
}

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
      const meta = TIPOS_EVENTO.has(tipo) ? { dataRealizacao: "", validade: "", observacoes: "" } : {};
      setPendente({ doc, tipo, dados: leitura.dados, conflitos: leitura.conflitos, camposEncontrados: leitura.camposEncontrados, meta });
      setMensagem(leitura.camposEncontrados.length
        ? "Ficha/Kit lido. Confira todos os campos encontrados antes de confirmar."
        : "Arquivo armazenado, mas não foi possível extrair texto automaticamente.");
      await carregar();
    } catch (err) { setMensagem(err.message); }
    finally { setCarregando(false); }
  }

  async function confirmar() {
    if (!pendente) return;
    try {
      if (TIPOS_EVENTO.has(pendente.tipo)) {
        if (!pendente.meta?.dataRealizacao) {
          setMensagem("Informe a data de realização/preenchimento antes de confirmar.");
          return;
        }
        const realizado = pendente.meta.dataRealizacao;
        const validadeInformada = pendente.meta.validade || "";
        const validade = pendente.tipo === "ASO" && !validadeInformada ? somarMeses(realizado, 12) : validadeInformada;
        await rhDocumentoAtualizar(pendente.doc.id, {
          dataRealizacao: realizado,
          validade: validade || null,
          observacoes: pendente.meta.observacoes || "",
          status: "CONFIRMADO",
          leituraStatus: pendente.doc.leitura_status || "REQUER_CONFERENCIA",
          dadosExtraidos: { ...(pendente.dados || {}), revisadoEm: hoje() },
        });
        if (pendente.tipo === "ASO") {
          await salvar("rh_exames", {
            pessoaId: pessoa.id, pessoaNome: pessoa.nome || "", tipo: tipoAso(pendente.meta.observacoes),
            exame: "ASO", data: realizado, validadeMeses: validade ? 12 : "", vence: validade,
            validade, resultado: /\\bapto\\b/i.test(pendente.meta.observacoes || "") ? "apto" : "aguardando",
            restricao: "", clinica: "", medico: "", obs: pendente.meta.observacoes || "",
            documentoId: pendente.doc.id,
          });
        } else if (pendente.tipo === "NR / Certificado de Treinamento" && validade) {
          await salvar("rh_vencimentos", {
            pessoaId: pessoa.id, pessoaNome: pessoa.nome || "", tipo: "NR",
            descricao: pendente.meta.observacoes || "Certificado de treinamento", vence: validade,
            realizadoEm: realizado, documentoId: pendente.doc.id,
          });
        }
        setMensagem(pendente.tipo === "ASO"
          ? `ASO confirmado. Próximo vencimento: ${validade || "não informado"}.`
          : validade
            ? `Documento confirmado. Próximo vencimento: ${validade}.`
            : "Documento confirmado. Informe a validade quando o certificado tiver prazo para o radar acompanhar.");
      } else {
        const r = await rhDocumentoConfirmarPreenchimento(pendente.doc.id, pessoa.id, pendente.dados);
        setMensagem("Cadastro preenchido após revisão: " + ((r.camposAlterados || []).join(", ") || "nenhum campo alterado") + ".");
      }
      setPendente(null); await carregar();
    } catch (e) { setMensagem(e.message); }
  }

  async function excluir(doc) {
    if (!window.confirm("Retirar o documento \"" + doc.nome_original + "\" da ficha?")) return;
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
        <div><h2 className="font-display text-base font-semibold text-slate-900">Documentos</h2><p className="text-xs text-slate-500">Ficha de Registro e Kit Admissional alimentam o cadastro após confirmação. Original preservado no Storage privado.</p></div>
        {editavel && <div className="flex flex-wrap items-center gap-2"><select className="select py-1 text-xs" value={tipo} onChange={e => setTipo(e.target.value)}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select><label className="btn-primary cursor-pointer py-1 text-xs">{carregando ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />} Enviar documento<input type="file" className="sr-only" accept=".pdf,image/*,.doc,.docx" onChange={enviar} disabled={carregando} /></label></div>}
      </div>
      {mensagem && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{mensagem}</p>}
      {pendente && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <div className="mb-1 flex items-center gap-2 font-display text-sm font-semibold"><CheckCircle2 size={16}/> Revisar antes de confirmar — {pendente.tipo}</div>
          <p className="mb-3 text-xs text-slate-600">Nada é gravado na ficha da pessoa sem esta revisão. Corrija qualquer informação antes de confirmar.</p>
          {TIPOS_CADASTRO.has(pendente.tipo) && (
            <>
              {pendente.camposEncontrados?.length ? <div className="space-y-2">{pendente.camposEncontrados.map(campo => {
                const atual = String(pessoa?.[campo] ?? "").trim();
                const documento = String(pendente.dados?.[campo] ?? "").trim();
                const mudou = atual && atual !== documento;
                return <div key={campo} className={"rounded-lg border p-2 " + (mudou ? "border-warn-200 bg-warn-50" : "border-slate-200 bg-white")}>
                  <label className="text-xs font-medium text-slate-700">{ROTULOS[campo] || campo}</label>
                  <div className="mt-1 grid gap-2 md:grid-cols-2">
                    <div><span className="text-[11px] text-slate-500">Cadastro atual</span><div className="min-h-9 rounded-md bg-slate-50 px-2 py-2 text-xs text-slate-700">{atual || "— vazio —"}</div></div>
                    <label><span className="text-[11px] text-slate-500">Valor que será gravado</span><input className="input mt-0.5" value={pendente.dados[campo] || ""} onChange={e => setPendente(p => ({...p, dados:{...p.dados, [campo]:e.target.value}}))} /></label>
                  </div>
                  {mudou && <p className="mt-1 text-[11px] font-medium text-warn-800">Divergência: confirme conscientemente antes de substituir o valor atual.</p>}
                </div>;
              })}</div> : <p className="text-xs text-slate-600">Nenhum campo foi extraído automaticamente. O documento foi salvo e pode ser conferido manualmente.</p>}
            </>
          )}
          {TIPOS_EVENTO.has(pendente.tipo) && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-600">Data de realização / preenchimento *<input type="date" className="input mt-1" value={pendente.meta?.dataRealizacao || ""} onChange={e => setPendente(p => ({...p, meta:{...p.meta, dataRealizacao:e.target.value}}))}/></label>
              <label className="text-xs text-slate-600">Validade / próximo vencimento, quando houver<input type="date" className="input mt-1" value={pendente.meta?.validade || ""} onChange={e => setPendente(p => ({...p, meta:{...p.meta, validade:e.target.value}}))}/></label>
              <label className="text-xs text-slate-600 md:col-span-2">Dados/observações conferidos<input className="input mt-1" placeholder={pendente.tipo === "ASO" ? "ex.: periódico, apto, clínica..." : pendente.tipo.startsWith("NR") ? "ex.: NR-06, instrutor, carga horária..." : "ex.: função, riscos, ciência..."} value={pendente.meta?.observacoes || ""} onChange={e => setPendente(p => ({...p, meta:{...p.meta, observacoes:e.target.value}}))}/></label>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={confirmar} disabled={TIPOS_CADASTRO.has(pendente.tipo) && !pendente.camposEncontrados?.length}>{TIPOS_EVENTO.has(pendente.tipo) ? "Confirmar dados do documento" : "Confirmar e preencher cadastro"}</button>
            <button type="button" className="btn-outline" onClick={() => setPendente(null)}>Salvar somente o documento</button>
          </div>
        </div>
      )}
      {documentos.length === 0 ? <Empty>Nenhum documento enviado.</Empty> : <ul className="divide-y" style={{ borderColor:"var(--fio-lista)" }}>{documentos.map(doc => <li key={doc.id} className="flex flex-wrap items-center gap-3 py-2 text-sm"><FileText size={16} className="text-brand-600"/><span className="min-w-0 flex-1 truncate">{doc.nome_original}</span><span className="chip">{doc.tipo}</span><span className="text-xs text-slate-500">{doc.status === "CONFIRMADO" ? "Confirmado" : doc.leitura_status === "REQUER_CONFERENCIA" ? "Conferência manual" : doc.leitura_status}</span><button type="button" className="btn-ghost py-1 text-xs" onClick={() => abrir(doc)}><Download size={14}/> Abrir</button>{editavel && <button type="button" className="btn-ghost py-1 text-xs text-bad-700" onClick={() => excluir(doc)}><Trash2 size={14}/> Retirar</button>}</li>)}</ul>}
    </Card>
  );
}
