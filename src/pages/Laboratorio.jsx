// LABORATÓRIO DE ANÁLISES AMBIENTAIS.
// O módulo cresce por seções (botões no topo). A primeira é "Entradas de
// amostras", que substitui a planilha PROTOCOLO DE ENTRADAS DE AMOSTRAS.
// Seções novas entram em SECOES e ganham o seu componente em
// components/laboratorio/.

import { useSearchParams } from "react-router-dom";
import { PageTitle, Segmented } from "../components/ui.jsx";
import EntradasAmostras from "../components/laboratorio/EntradasAmostras.jsx";

const SECOES = [
  { valor: "entradas", rotulo: "Entradas de amostras", descricao: "Protocolo de recebimento, análise, liberação e descarte das amostras." },
];

export default function Laboratorio() {
  const [params, setParams] = useSearchParams();
  const secao = SECOES.find((s) => s.valor === params.get("secao")) || SECOES[0];
  const ir = (valor) => { const p = new URLSearchParams(params); p.set("secao", valor); setParams(p, { replace: true }); };
  return (
    <div className="space-y-4">
      <PageTitle titulo="Laboratório" descricao={secao.descricao} />
      <Segmented opcoes={SECOES} valor={secao.valor} onChange={ir} className="w-full sm:w-fit" />
      {secao.valor === "entradas" && <EntradasAmostras />}
    </div>
  );
}
