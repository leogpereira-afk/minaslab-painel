// Desativada em 01/10/2026 (auditoria): era uma correção pontual do logo no
// DANFSe, chamada por um gatilho do banco que já foi removido em 16/09/2026
// (migração 20260916211500). Não tinha autenticação e regravava o PDF fiscal,
// então passa a só responder 410.
Deno.serve(() =>
  new Response(JSON.stringify({ ok: false, erro: "Função desativada." }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
);
