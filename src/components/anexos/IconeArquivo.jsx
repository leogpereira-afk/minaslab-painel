// Ícone do tipo de arquivo (PDF, planilha, imagem...), na mesma linha dos demais ícones do painel.
import { File, FileArchive, FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { familiaDoArquivo } from "../../lib/anexos.js";

const ICONES = { imagem: FileImage, pdf: FileText, planilha: FileSpreadsheet, documento: FileText, apresentacao: Presentation, compactado: FileArchive, arquivo: File };
const CORES = { imagem: "text-violet-600 bg-violet-50", pdf: "text-red-600 bg-red-50", planilha: "text-emerald-700 bg-emerald-50", documento: "text-sky-700 bg-sky-50", apresentacao: "text-orange-600 bg-orange-50", compactado: "text-amber-700 bg-amber-50", arquivo: "text-slate-600 bg-slate-100" };

export default function IconeArquivo({ nome, tamanho = 36 }) {
  const familia = familiaDoArquivo(nome);
  const Icone = ICONES[familia];
  return <span className={`grid shrink-0 place-items-center rounded-lg ${CORES[familia]}`} style={{ width: tamanho, height: tamanho }} aria-hidden="true"><Icone size={Math.round(tamanho * 0.5)} /></span>;
}
