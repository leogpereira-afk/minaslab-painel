import test from "node:test";
import assert from "node:assert/strict";
import { formatarBanco, resumoBanco, saldoMovimentos, validarMovimento } from "./bancoHoras.js";

const mov = [
  { competencia: "2026-07", credito_minutos: 600, debito_minutos: 0 },
  { competencia: "2026-08", credito_minutos: 300, debito_minutos: 480 },
];
test("banco acumula saldo entre competências", () => {
  assert.equal(resumoBanco(mov, "2026-08").saldoAnterior, 600);
  assert.equal(resumoBanco(mov, "2026-08").saldoFinal, 420);
  assert.equal(resumoBanco(mov, "2026-09").saldoAnterior, 420);
});
test("saldo e formatação preservam sinal", () => {
  assert.equal(saldoMovimentos(mov), 420);
  assert.equal(formatarBanco(420), "+07:00");
  assert.equal(formatarBanco(-150), "-02:30");
});
test("movimento manual exige motivo e somente um sentido", () => {
  assert.ok(validarMovimento({ tipo:"Horas pagas", competencia:"2026-08", dataMovimento:"2026-08-31", motivo:"" }).includes("O motivo é obrigatório."));
  assert.ok(validarMovimento({ tipo:"Ajuste", competencia:"2026-08", dataMovimento:"2026-08-31", motivo:"x", creditoMinutos:60, debitoMinutos:60 }).length > 0);
  assert.equal(validarMovimento({ tipo:"Horas pagas", competencia:"2026-08", dataMovimento:"2026-08-31", motivo:"Pagamento", debitoMinutos:480 }).length, 0);
});

import { ajusteCompensacaoPonto, marcaCompensacaoPonto } from './bancoHoras.js';
test('compensação do Ponto debita uma vez, não repete ao regravar e estorna quando a ausência sai', () => {
  const marca = marcaCompensacaoPonto('2026-10-20');
  assert.deepEqual(ajusteCompensacaoPonto([], '2026-10-20', 480), { tipo: 'debito', minutos: 480 });
  const debitado = [{ motivo: `Compensação lançada no Ponto ${marca}`, debito_minutos: 480, credito_minutos: 0 }];
  assert.equal(ajusteCompensacaoPonto(debitado, '2026-10-20', 480), null);
  assert.deepEqual(ajusteCompensacaoPonto(debitado, '2026-10-20', 0), { tipo: 'credito', minutos: 480 });
  assert.deepEqual(ajusteCompensacaoPonto(debitado, '2026-10-20', 420), { tipo: 'credito', minutos: 60 });
  const estornado = [...debitado, { motivo: `Estorno ${marca}`, debito_minutos: 0, credito_minutos: 480 }];
  assert.equal(ajusteCompensacaoPonto(estornado, '2026-10-20', 0), null);
  assert.deepEqual(ajusteCompensacaoPonto(debitado, '2026-10-21', 0), null);
});
