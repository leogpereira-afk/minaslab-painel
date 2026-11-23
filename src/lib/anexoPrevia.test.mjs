import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { tipoPrevia, mimeDaPrevia, lerXlsx, lerDocx, textoDe } from "./anexoPrevia.js";

test("tipo de visualização pelo nome e pelo tipo", () => {
  assert.equal(tipoPrevia("NF 123.PDF", "application/octet-stream"), "pdf");
  assert.equal(tipoPrevia("foto.jpg"), "imagem");
  assert.equal(tipoPrevia("nota.xml", "application/octet-stream"), "texto");
  assert.equal(tipoPrevia("Relatório.xlsx"), "planilha");
  assert.equal(tipoPrevia("Proposta.docx"), "documento");
  assert.equal(tipoPrevia("antigo.xls"), null);
  assert.equal(tipoPrevia("pacote.zip", "application/zip"), null);
  assert.equal(mimeDaPrevia("NF.pdf", "application/octet-stream"), "application/pdf");
});

test("lê planilha .xlsx (texto compartilhado, número, célula pulada)", () => {
  const z = zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Resultados &amp; Cia" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8("<sst><si><t>Parâmetro</t></si><si><r><t>pH</t></r><r><t xml:space=\"preserve\"> a 25 °C</t></r></si></sst>"),
    "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>7.1000000000000005</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="inlineStr"><is><t>ok</t></is></c></row></sheetData></worksheet>'),
  });
  assert.deepEqual(lerXlsx(z), [{ nome: "Resultados & Cia", linhas: [["Parâmetro", "", "7.1"], ["pH a 25 °C", "ok"]], cortada: false }]);
});

test("lê documento .docx em parágrafos", () => {
  const z = zipSync({ "word/document.xml": strToU8('<w:document><w:body><w:p><w:r><w:t>Prezados,</w:t></w:r></w:p><w:p/><w:p><w:r><w:t xml:space="preserve">Valor: </w:t><w:tab/><w:t>R$ 10 &amp; 20</w:t></w:r></w:p></w:body></w:document>') });
  assert.deepEqual(lerDocx(z), ["Prezados,", "", "Valor: \tR$ 10 & 20"]);
});

test("texto em Latin-1 (CSV de banco) não vira lixo", () => {
  assert.equal(textoDe(new Uint8Array([0x43, 0x6f, 0x6e, 0x63, 0x65, 0x69, 0xe7, 0xe3, 0x6f])), "Conceição".slice(0, 6) + "ção");
});
