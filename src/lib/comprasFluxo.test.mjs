import test from "node:test";
import assert from "node:assert/strict";
import {
  aguardandoOrdem, podeEntrarEmOrdem, statusAoCriarOrdem, statusAoComprarOrdem,
} from "../../supabase/functions/_shared/compras-solicitacao.mjs";

test("fila: só aprovado sem ordem aguarda ordem", () => {
  assert.equal(aguardandoOrdem({ status: "aprovada", ordemId: "" }), true);
  assert.equal(aguardandoOrdem({ status: "aprovada", ordemId: "oc1" }), false);
  assert.equal(aguardandoOrdem({ status: "solicitada" }), false);
});

test("ordem: solicitado, recebido e recusado não entram; quem já tem ordem também não", () => {
  assert.equal(podeEntrarEmOrdem({ status: "aprovada" }), true);
  assert.equal(podeEntrarEmOrdem({ status: "cotando" }), true);
  assert.equal(podeEntrarEmOrdem({ status: "comprada" }), true);
  for (const status of ["solicitada", "recebida", "cancelada"]) assert.equal(podeEntrarEmOrdem({ status }), false);
  assert.equal(podeEntrarEmOrdem({ status: "aprovada", ordemId: "oc1" }), false);
});

test("criar ordem põe em cotação; comprar põe comprada; nunca rebaixa recebido/recusado", () => {
  assert.equal(statusAoCriarOrdem({ status: "aprovada" }), "cotando");
  assert.equal(statusAoCriarOrdem({ status: "comprada" }), "comprada");
  assert.equal(statusAoComprarOrdem({ status: "aprovada" }), "comprada");
  assert.equal(statusAoComprarOrdem({ status: "cotando" }), "comprada");
  assert.equal(statusAoComprarOrdem({ status: "recebida" }), "recebida");
  assert.equal(statusAoComprarOrdem({ status: "cancelada" }), "cancelada");
});
