// JANELA "INFORMAR SALDO DO EXTRATO" das Aplicações (28/09/2026).
//
// A integração com a Omie não traz a posição da aplicação (a conta da
// aplicação fica fora do fluxo de caixa), então o saldo vem de quem tem o
// extrato do banco na mão. O painel parte dele e soma os aportes e desconta os
// resgates reconhecidos DEPOIS da data. Montada só quando aberta: cada abertura
// começa com o formulário limpo.
import { useState } from "react";
import { Modal } from "../ui.jsx";
import { dataLonga, moedaCheia, paraNumero } from "../../lib/format.js";
import { dataValida } from "../../lib/relatorioFinanceiro.js";

function conferir({ data, valor }, hoje) {
  const erros = {};
  if (!data) erros.data = "Informe a data do extrato.";
  else if (!dataValida(data) || data < "2000-01-01") erros.data = "Confira a data do extrato.";
  else if (data > hoje) erros.data = "A data do extrato não pode ser depois de hoje.";
  const texto = String(valor ?? "").trim();
  let numero = null;
  if (!texto) erros.valor = "Informe o saldo do extrato.";
  else if (!/\d/.test(texto) || /[^\d\s.,R$-]/i.test(texto)) erros.valor = "Digite só o valor, como 150.000,00.";
  else {
    numero = Math.round(paraNumero(texto) * 100) / 100;
    if (numero < 0 || texto.includes("-")) erros.valor = "O saldo aplicado não pode ser negativo.";
  }
  return { erros, numero };
}

/* Ontem, não hoje: o extrato de hoje ainda pode receber movimento, e o cálculo trata o
   movimento do mesmo dia como já incluído no saldo. Quem tem o extrato de hoje troca a data. */
function ontem(hoje) {
  const [a, m, d] = String(hoje).split("-").map(Number);
  const dia = new Date(a, m - 1, d - 1);
  return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
}

export default function SaldoAplicacaoJanela({ aoFechar, aoSalvar, hoje, escopoRotulo }) {
  const [data, setData] = useState(() => ontem(hoje));
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [tentou, setTentou] = useState(false);
  const [falha, setFalha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { erros, numero } = conferir({ data, valor }, hoje);
  const mostrar = (campo) => (tentou || (campo === "valor" ? valor : data !== ontem(hoje))) && erros[campo];

  async function enviar(e) {
    e.preventDefault();
    setTentou(true);
    setFalha("");
    if (Object.keys(erros).length || salvando) return;
    setSalvando(true);
    try {
      await aoSalvar({ data, valor: numero, observacao: observacao.trim() });
      aoFechar();
    } catch (erro) {
      // A causa aparece: "não salvou" sem motivo faz a pessoa tentar de novo às cegas.
      setFalha(erro?.message || "Não foi possível salvar o saldo.");
      setSalvando(false);
    }
  }

  return (
    // Enquanto salva, fechar (X, Esc, clique fora) esconderia a recusa do servidor: espera terminar.
    <Modal titulo="Informar saldo do extrato" aberto aoFechar={salvando ? () => {} : aoFechar}>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <p className="text-sm leading-relaxed text-slate-600">
          O painel usa este saldo como ponto de partida: soma os aportes e desconta os resgates reconhecidos depois da data do extrato.
        </p>
        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
          <span className="label mb-0.5 block">Vale para</span>
          <span className="font-medium text-slate-800">{escopoRotulo}</span>
          <p className="mt-1 text-xs text-slate-500">Para uma conta específica, feche esta janela e escolha a conta no recorte antes de informar.</p>
        </div>

        <label className="block">
          <span className="label">Data do extrato</span>
          <input
            className="input"
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => setData(e.target.value)}
            aria-invalid={!!mostrar("data")}
            aria-describedby={mostrar("data") ? "saldo-erro-data" : undefined}
            required
          />
          {mostrar("data") && <span id="saldo-erro-data" className="mt-1 block text-xs text-bad-700">{erros.data}</span>}
          {!erros.data && data === hoje && (
            <span className="mt-1 block text-xs text-warn-700">
              Extrato de hoje: os aportes e resgates feitos hoje contam como já incluídos nele. Se o extrato foi lido antes deles, use a data de ontem.
            </span>
          )}
        </label>

        <label className="block">
          <span className="label">Saldo aplicado no fim do dia</span>
          <input
            className="input tnum"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex.: 150.000,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={!!mostrar("valor")}
            aria-describedby="saldo-previa"
            autoFocus
            required
          />
          <span id="saldo-previa" className={mostrar("valor") ? "mt-1 block text-xs text-bad-700" : "mt-1 block text-xs text-slate-500"}>
            {mostrar("valor") ? erros.valor : numero !== null ? `Valor entendido: ${moedaCheia(numero)}${data && !erros.data ? ` em ${dataLonga(data)}` : ""}` : "Digite o valor que aparece no extrato do banco."}
          </span>
        </label>

        <label className="block">
          <span className="label">Observação (opcional)</span>
          <input
            className="input"
            maxLength={140}
            placeholder="Ex.: RDC Sicoob, extrato do dia 31"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </label>

        {falha && <p role="alert" className="rounded-xl bg-bad-50 px-3.5 py-2.5 text-sm text-bad-800">{falha}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar saldo"}</button>
        </div>
      </form>
    </Modal>
  );
}
