// Gera o arquivo Word da ata no navegador: abre o modelo FM-LAB-001
// (public/modelos/ata-reuniao.docx), preenche e baixa. Nada sai do computador.
import JSZip from "jszip";
import { preencherAtaXml, nomeArquivoAta } from "./ata.js";

let modelo = null;
async function lerModelo() {
  if (!modelo) {
    const r = await fetch(new URL("modelos/ata-reuniao.docx", document.baseURI));
    if (!r.ok) throw new Error("Não consegui abrir o modelo da ata. Recarregue a página.");
    modelo = await r.arrayBuffer();
  }
  return modelo;
}

export async function arquivoAta(ata) {
  const z = await JSZip.loadAsync(await lerModelo());
  const xml = await z.file("word/document.xml").async("string");
  z.file("word/document.xml", preencherAtaXml(xml, ata));
  return z.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export async function baixarAta(ata) {
  const blob = await arquivoAta(ata);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoAta(ata);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}
