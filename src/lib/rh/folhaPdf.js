// Linhas de texto de um PDF, na ordem visual, com as células separadas por " | ".
// O relatório da contabilidade é em colunas, e a ordem interna dos objetos do PDF
// não acompanha a da folha: as linhas são remontadas pela posição (Y) e cada linha
// ordenada da esquerda para a direita (X). Mesmo jeito do leitor do kit admissional.
export async function linhasDoPdf(file) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    // O pdf.js do navegador exige o endereço do worker, mesmo lendo só texto.
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const documento = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
  const linhas = [];
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n);
    const conteudo = await pagina.getTextContent();
    const itens = (conteudo.items || [])
      .filter((i) => String(i.str || "").trim())
      .map((i) => ({ texto: String(i.str).trim(), x: Number(i.transform?.[4] || 0), y: Number(i.transform?.[5] || 0) }));
    const grupos = [];
    for (const item of itens) {
      let g = grupos.find((l) => Math.abs(l.y - item.y) <= 2);
      if (!g) { g = { y: item.y, itens: [] }; grupos.push(g); }
      g.itens.push(item);
    }
    grupos.sort((a, b) => b.y - a.y).forEach((g) => linhas.push(g.itens.sort((a, b) => a.x - b.x).map((i) => i.texto).join(" | ")));
  }
  return linhas;
}
