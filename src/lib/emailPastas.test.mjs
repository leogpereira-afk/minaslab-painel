import { test } from "node:test";
import assert from "node:assert/strict";
import { arvoreDePastas, pastasVisiveis, ancestrais } from "./emailPastas.js";
import { lerLinhaList, organizarPastas } from "../../supabase/functions/_shared/email-texto.mjs";

const hostinger = organizarPastas([
  '* LIST (\\HasChildren) "." "INBOX"',
  '* LIST (\\HasNoChildren \\Sent) "." "INBOX.Sent"',
  '* LIST (\\HasNoChildren \\Trash) "." "INBOX.Trash"',
  '* LIST (\\HasNoChildren) "." "INBOX.Acelen"',
  '* LIST (\\HasNoChildren) "." "INBOX.ACI"',
  '* LIST (\\HasChildren) "." "INBOX.Boletos e NF 2025"',
  '* LIST (\\HasNoChildren) "." "INBOX.Boletos e NF 2025.Dezembro"',
  '* LIST (\\HasNoChildren) "." "INBOX.Boletos e NF 2025.Abril"',
  '* LIST (\\HasNoChildren) "." "INBOX.Boletos e NF 2025.Arquivo"',
  '* LIST (\\HasNoChildren) "." "INBOX.Agendor"',
].map((l) => lerLinhaList(l)));
hostinger.find((p) => p.id === "INBOX.Boletos e NF 2025.Abril").naoLidas = 2;
hostinger.find((p) => p.id === "INBOX.Boletos e NF 2025.Arquivo").naoLidas = 1;

test("pastas viram árvore, em ordem alfabética, com o nome curto", () => {
  const { sistema, arvore } = arvoreDePastas(hostinger);
  assert.deepEqual(sistema.map((p) => p.rotulo), ["Caixa de entrada", "Enviados", "Lixeira"]);
  assert.deepEqual(arvore.map((p) => [p.nome, p.nivel, p.temFilhos]), [
    ["Acelen", 0, false], ["ACI", 0, false], ["Agendor", 0, false], ["Boletos e NF 2025", 0, true],
    ["Abril", 1, false], ["Arquivo", 1, false], ["Dezembro", 1, false],
  ]);
  const boletos = arvore.find((p) => p.nome === "Boletos e NF 2025");
  assert.equal(boletos.naoLidasTotal, 3); // soma as filhas (aparece quando está fechada)
  assert.equal(arvore.find((p) => p.nome === "Abril").id, "INBOX.Boletos e NF 2025.Abril");
});

test("subpasta chamada \"Arquivo\" não vira a pasta Arquivo do sistema", () => {
  assert.equal(hostinger.find((p) => p.id === "INBOX.Boletos e NF 2025.Arquivo").tipo, null);
});

test("fechada esconde as filhas; abrir o caminho até a pasta atual", () => {
  const { arvore } = arvoreDePastas(hostinger);
  assert.equal(pastasVisiveis(arvore, new Set()).length, 4);
  assert.equal(pastasVisiveis(arvore, new Set(["Boletos e NF 2025"])).length, 7);
  assert.deepEqual(ancestrais(arvore, "INBOX.Boletos e NF 2025.Abril"), ["Boletos e NF 2025"]);
});

test("mãe \\Noselect (Gmail) vira agrupador sem clique", () => {
  const gmail = organizarPastas([
    '* LIST (\\HasNoChildren) "/" "INBOX"',
    '* LIST (\\HasNoChildren) "/" "Clientes/Vale"',
    '* LIST (\\HasNoChildren) "/" "Clientes/Usiminas"',
  ].map((l) => lerLinhaList(l)));
  const { arvore } = arvoreDePastas(gmail);
  assert.deepEqual(arvore.map((p) => [p.nome, p.virtual, p.id]), [
    ["Clientes", true, null], ["Usiminas", false, "Clientes/Usiminas"], ["Vale", false, "Clientes/Vale"],
  ]);
});
