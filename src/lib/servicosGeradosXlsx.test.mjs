import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here=path.dirname(fileURLToPath(import.meta.url));
const src=fs.readFileSync(path.resolve(here,"../components/financeiro/ServicosGeradosPrintButton.jsx"),"utf8");
test("exportação de Serviços Gerados usa XLSX Office Open XML",()=>{assert.match(src,/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);assert.match(src,/\.xlsx`/);assert.match(src,/\[Content_Types\]\.xml/);assert.match(src,/0x04034b50/);assert.doesNotMatch(src,/urn:schemas-microsoft-com:office:spreadsheet/);});
