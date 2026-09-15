import test from "node:test";
import assert from "node:assert/strict";
const fiscalText=v=>String(v??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").replace(/\s+/g," ").trim();
test("normalização fiscal remove whitespace residual do logradouro",()=>{assert.equal(fiscalText("Fazenda Teixeira "),"Fazenda Teixeira");assert.equal(fiscalText("  Fazenda\tTeixeira\n"),"Fazenda Teixeira");});
