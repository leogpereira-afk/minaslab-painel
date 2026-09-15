import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src=fs.readFileSync(new URL("./ServicosGeradosPrintButton.jsx",import.meta.url),"utf8");
test("Serviços Gerados exporta Office Open XML .xlsx e não XML Spreadsheet 2003",()=>{
  assert.match(src,/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(src,/\.xlsx`/);
  assert.match(src,/\[Content_Types\]\.xml/);
  assert.match(src,/0x04034b50/);
  assert.doesNotMatch(src,/urn:schemas-microsoft-com:office:spreadsheet/);
  assert.doesNotMatch(src,/\.xml`/);
});
