// LABORATÓRIO DE ANÁLISES AMBIENTAIS.
// O módulo cresce por seções (botões no topo). "Início" resume o que pede
// atenção e leva a cada área; "Entradas de amostras" substitui a planilha
// PROTOCOLO DE ENTRADAS DE AMOSTRAS; Qualidade, Microbiologia e Físico-Químico
// estão reservadas (AreaEmBreve) até serem desenvolvidas.
// Seções novas entram em SECOES e ganham o seu componente em
// components/laboratorio/.

import { useSearchParams } from "react-router-dom";
import { PageTitle, Segmented } from "../components/ui.jsx";
import { getSessao } from "../lib/sessao.js";
import { secoesLiberadas } from "../lib/laboratorioAcesso.js";
import EntradasAmostras from "../components/laboratorio/EntradasAmostras.jsx";
import InicioLaboratorio from "../components/laboratorio/InicioLaboratorio.jsx";
import AreaEmBreve from "../components/laboratorio/AreaEmBreve.jsx";

const SECOES = [
  { valor: "inicio", rotulo: "Início", descricao: "O que pede atenção hoje e as áreas do laboratório." },
  { valor: "entradas", rotulo: "Entradas de amostras", descricao: "Protocolo de recebimento, análise, liberação e descarte das amostras." },
  { valor: "qualidade", rotulo: "Qualidade", descricao: "Gestão da qualidade do laboratório (em desenvolvimento)." },
  { valor: "microbiologia", rotulo: "Microbiologia", descricao: "Análises microbiológicas (em desenvolvimento)." },
  { valor: "fisicoquimico", rotulo: "Físico-Químico", descricao: "Análises físico-químicas (em desenvolvimento)." },
];

export default function Laboratorio() {
  const [params, setParams] = useSearchParams();
  const liberadas = secoesLiberadas(getSessao(), SECOES);
  if (!liberadas.length) return <p className="rounded-2xl border bg-white p-8 text-center text-slate-500">Seu acesso ainda não inclui nenhuma área do Laboratório. Peça à direção.</p>;
  const secao = liberadas.find((s) => s.valor === params.get("secao")) || liberadas[0];
  const ir = (valor, aba) => {
    const p = new URLSearchParams(params);
    p.set("secao", valor);
    if (aba) p.set("aba", aba); else p.delete("aba");
    setParams(p);
  };
  return (
    <div className="space-y-4">
      <PageTitle titulo="Laboratório" descricao={secao.descricao} />
      <Segmented opcoes={liberadas} valor={secao.valor} onChange={(v) => ir(v)} className="w-full sm:w-fit" />
      {secao.valor === "inicio" && <InicioLaboratorio irPara={ir} />}
      {secao.valor === "entradas" && <EntradasAmostras key={params.get("aba") || ""} abaInicial={params.get("aba")} />}
      {["qualidade", "microbiologia", "fisicoquimico"].includes(secao.valor) && <AreaEmBreve area={secao.valor} voltar={() => ir("inicio")} />}
    </div>
  );
}
