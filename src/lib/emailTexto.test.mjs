import test from "node:test";
import assert from "node:assert/strict";
import {
  pastaDecodificar, pastaCodificar, decodificarPalavras, lerCabecalhos, lerEnderecos, lerLinhaList, organizarPastas,
  lerLinhaStatus, lerSearch, lerLinhaFetch, resumoDaMensagem, conjuntoUids, limparHtml, assuntoResposta, montarMensagem, dataIso, textoDeHtml,
} from "../../supabase/functions/_shared/email-texto.mjs";

test("nome de pasta em UTF-7 modificado vai e volta", () => {
  assert.equal(pastaDecodificar("Licita&AOcA9Q-es"), "Licitações");
  assert.equal(pastaCodificar("Licitações"), "Licita&AOcA9Q-es");
  assert.equal(pastaDecodificar("P&-D"), "P&D");
  assert.equal(pastaCodificar("P&D"), "P&-D");
  for (const n of ["Itens Excluídos", "Laudos 2026/Março", "Órgãos públicos"]) assert.equal(pastaDecodificar(pastaCodificar(n)), n);
});

test("cabeçalhos codificados (B e Q, juntando palavras vizinhas)", () => {
  assert.equal(decodificarPalavras("=?UTF-8?Q?Edital_042_=E2=80=94_An=C3=A1lises?="), "Edital 042 — Análises");
  assert.equal(decodificarPalavras("=?utf-8?B?T3LDp2FtZW50bw==?= =?utf-8?B?IG7CuiA4ODIx?="), "Orçamento nº 8821");
  assert.equal(decodificarPalavras("=?ISO-8859-1?Q?Jos=E9?= Silva"), "José Silva");
  const c = lerCabecalhos("Subject: =?UTF-8?Q?Ol=C3=A1?=\r\n continuação\r\nFrom: A <a@b.com>\r\n");
  assert.equal(c.subject, "Olá continuação");
  assert.equal(c.from, "A <a@b.com>");
});

test("endereços", () => {
  assert.deepEqual(lerEnderecos('"Silva, Ana" <Ana@X.com>, b@y.com.br, inválido'), [{ nome: "Silva, Ana", email: "ana@x.com" }, { nome: "", email: "b@y.com.br" }]);
});

test("pastas: Hostinger e Gmail ficam na ordem certa e com nomes em português", () => {
  const linhas = [
    '* LIST (\\HasNoChildren) "." "INBOX"',
    '* LIST (\\HasNoChildren \\Sent) "." "INBOX.Sent"',
    '* LIST (\\HasNoChildren) "." "INBOX.Licita&AOcA9Q-es"',
    '* LIST (\\HasNoChildren \\Trash) "." "INBOX.Trash"',
    '* LIST (\\HasChildren \\Noselect) "/" "[Gmail]"',
    '* LIST (\\All \\HasNoChildren) "/" "[Gmail]/Todos os e-mails"',
    '* LIST (\\HasNoChildren \\Junk) "/" "[Gmail]/Spam"',
    '* LIST (\\HasNoChildren) "." "INBOX.Drafts"',
  ];
  const p = organizarPastas(linhas.map((l) => lerLinhaList(l)));
  assert.deepEqual(p.map((x) => [x.rotulo, x.tipo]), [
    ["Caixa de entrada", "entrada"], ["Enviados", "enviados"], ["Rascunhos", "rascunhos"], ["Todos os e-mails", "todos"], ["Spam", "spam"], ["Lixeira", "lixeira"], ["Licitações", null],
  ]);
  assert.equal(p.find((x) => x.rotulo === "Licitações").id, "INBOX.Licita&AOcA9Q-es");
});

test("STATUS, SEARCH e FETCH", () => {
  assert.deepEqual(lerLinhaStatus('* STATUS "INBOX.Sent" (MESSAGES 12 UNSEEN 3)'), { nome: "INBOX.Sent", total: 12, naoLidas: 3 });
  assert.deepEqual(lerSearch(["* SEARCH 2 10 7", "* SEARCH"]), [10, 7, 2]);
  const lit = [new TextEncoder().encode("From: =?UTF-8?Q?Jo=C3=A3o?= <j@x.com>\r\nSubject: Oi\r\nContent-Type: multipart/mixed; boundary=a\r\nDate: Mon, 16 Nov 2026 14:32:00 -0300\r\n\r\n")];
  const f = lerLinhaFetch('* 3 FETCH (UID 10 FLAGS (\\Seen \\Flagged) INTERNALDATE "16-Nov-2026 14:32:00 -0300" RFC822.SIZE 99 BODY[HEADER.FIELDS (FROM SUBJECT CONTENT-TYPE DATE)] {#0})', lit);
  const r = resumoDaMensagem(f);
  assert.equal(r.uid, 10);
  assert.equal(r.lida, true);
  assert.equal(r.estrela, true);
  assert.equal(r.temAnexo, true);
  assert.deepEqual(r.de, { nome: "João", email: "j@x.com" });
  assert.equal(r.data, "2026-11-16T17:32:00.000Z");
  assert.equal(dataIso("16-Nov-2026 14:32:00 -0300"), "2026-11-16T17:32:00.000Z");
});

test("conjunto de UIDs", () => {
  assert.equal(conjuntoUids([9, 5, 6, 7, 7, 12]), "5:7,9,12");
  assert.equal(conjuntoUids(["x", -1]), "");
});

test("HTML recebido perde script e eventos", () => {
  const h = limparHtml('<p onclick="roubar()">oi</p><script>x()</script><a href="javascript:alert(1)">l</a><iframe src="x"></iframe><img src="cid:a">');
  assert.ok(!/script|onclick|javascript:|iframe/i.test(h), h);
  assert.ok(h.includes('<img src="cid:a">'));
  assert.equal(textoDeHtml("<p>Olá</p><p>Mundo &amp; cia</p>"), "Olá\nMundo & cia");
});

test("assunto de resposta não acumula Re:", () => {
  assert.equal(assuntoResposta("RE: Re: Proposta", "responder"), "Re: Proposta");
  assert.equal(assuntoResposta("Fwd: Proposta", "encaminhar"), "Enc: Proposta");
});

test("mensagem montada: acentos no cabeçalho, imagens da assinatura e anexo", () => {
  const bytes = montarMensagem({
    de: { nome: "Léo Pereira", email: "leo@minaslab.online" }, para: [{ nome: "", email: "a@b.com" }], cc: [{ nome: "Ana", email: "ana@c.com" }],
    assunto: "Proposta — análises", html: '<p>Oi</p><img src="cid:ml-logo@minaslab">', texto: "Oi", messageId: "<1@minaslab.online>",
    inReplyTo: "<x@y>", referencias: ["<x@y>"],
    inline: [{ cid: "ml-logo@minaslab", tipo: "image/png", nome: "logo.png", bytes: new Uint8Array([1, 2, 3]) }],
    anexos: [{ nome: "laudo.pdf", tipo: "application/pdf", bytes: new Uint8Array([4, 5]) }],
  });
  const t = new TextDecoder().decode(bytes);
  assert.match(t, /^From: =\?UTF-8\?B\?[^?]+\?= <leo@minaslab\.online>\r\n/);
  assert.match(t, /\r\nCc: Ana <ana@c\.com>\r\n/);
  assert.match(t, /\r\nIn-Reply-To: <x@y>\r\n/);
  assert.match(t, /multipart\/mixed[\s\S]*multipart\/related[\s\S]*multipart\/alternative/);
  assert.match(t, /Content-ID: <ml-logo@minaslab>/);
  assert.match(t, /Content-Disposition: attachment; filename="laudo\.pdf"/);
  assert.ok([...t].every((c) => c.charCodeAt(0) < 128), "mensagem toda em ASCII");
});

test("conversa: mesmo assunto sem Re:/RES:/Enc:/Fwd:", async () => {
  const { assuntoBase, mesmaConversa } = await import("../../supabase/functions/_shared/email-texto.mjs");
  assert.equal(assuntoBase("RES: Enc: RE:  Reunião de alinhamentos"), "Reunião de alinhamentos");
  assert.equal(assuntoBase("Fwd[2]: Proposta"), "Proposta");
  assert.ok(mesmaConversa("Reunião de alinhamentos", "Re: reunião de  alinhamentos"));
  assert.ok(!mesmaConversa("Reunião de alinhamentos", "Reunião de alinhamentos 2"));
  assert.ok(!mesmaConversa("", "Re:"));
});
