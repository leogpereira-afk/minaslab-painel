// Meus Certificados: registros emitidos pelo servidor (imutáveis).
import { useCallback, useEffect, useState } from "react";
import { Download, Award } from "lucide-react";
import { PageTitle, Card, Empty, CarregandoModulo, ErroModulo, Aviso } from "../../components/ui.jsx";
import { certificadosListar, certificadoObter } from "../../services/academy.js";
import { baixarCertificadoPdf } from "../../lib/academy/certificadoPdf.js";
import { dataBR } from "../../lib/academy/regras.js";
import { SemVinculo } from "./MinhaAcademy.jsx";

export default function Certificados() {
  const [lista, setLista] = useState(null), [erro, setErro] = useState(""), [aviso, setAviso] = useState(null), [ocupado, setOcupado] = useState("");
  const carregar = useCallback(() => certificadosListar().then(setLista).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return /vinculada/.test(erro) ? <div className="space-y-4"><PageTitle titulo="Meus Certificados" /><SemVinculo /></div> : <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(); }} />;
  if (!lista) return <CarregandoModulo />;
  const baixar = async (id) => {
    setOcupado(id);
    try { await baixarCertificadoPdf(await certificadoObter(id)); } catch (e) { setAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(""); }
  };
  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle titulo="Meus Certificados" descricao="Registros de conclusão dos seus treinamentos." />
      {lista.length === 0 ? <Empty>Você ainda não tem certificados. Eles são emitidos quando você cumpre todos os critérios de um treinamento.</Empty> : (
        <Card className="divide-y p-0">{lista.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ok-50 text-ok-700"><Award size={18} /></span>
            <span className="min-w-0 flex-1 basis-56"><span className="block font-display text-sm font-semibold text-slate-900">{c.treinamento_titulo}</span>
              <span className="block text-xs text-slate-500">Versão {c.versao_numero} · emitido em {dataBR(String(c.emitido_em).slice(0, 10))} · {c.codigo}</span></span>
            <button type="button" className="btn-outline" onClick={() => baixar(c.id)} disabled={ocupado === c.id}><Download size={15} />{ocupado === c.id ? "Gerando..." : "Baixar PDF"}</button>
          </div>))}</Card>)}
    </div>
  );
}
