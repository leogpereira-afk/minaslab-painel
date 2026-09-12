import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "espree";
import { transformSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleAlert } from "lucide-react";
import { intervaloNaoRegistrado, ausenciaDoDia, minutosTrabalhados } from "./rh/ponto.js";

// Executa expressões e JSX reais sem carregar a página, serviços ou navegador.
// Espree e esbuild já acompanham as ferramentas ESLint/Vite do projeto.
function lerTela(nome) {
  const fonte = readFileSync(new URL(`../components/ponto/${nome}.jsx`, import.meta.url), "utf8");
  const arvore = parse(fonte, {
    ecmaVersion: "latest", sourceType: "module", range: true,
    ecmaFeatures: { jsx: true },
  });
  const texto = (no) => fonte.slice(...no.range);
  const selecionar = (predicado) => {
    const encontrados = [];
    function visitar(no) {
      if (!no || typeof no !== "object") return;
      if (predicado(no)) { encontrados.push(no); return; }
      for (const valor of Object.values(no)) {
        if (Array.isArray(valor)) valor.forEach(visitar);
        else if (valor?.type) visitar(valor);
      }
    }
    visitar(arvore);
    return encontrados;
  };
  const inicializador = (nome) => texto(selecionar((no) => no.type === "VariableDeclarator" && no.id.name === nome)[0].init);
  return { texto, selecionar, inicializador };
}

const rel = lerTela("Relatorios");
const faltas = lerTela("Faltas");
const executar = (expressao, contexto = {}) => new Function(...Object.keys(contexto), `return (${expressao});`)(...Object.values(contexto));
const txt = executar(rel.inicializador("txt"));
const plural = executar(rel.inicializador("plural"));
const situacaoDoDia = executar(rel.texto(rel.selecionar((no) => no.type === "FunctionDeclaration" && no.id.name === "situacaoDoDia")[0]), { SEM: "sem registro", intervaloNaoRegistrado });
const estadosDoDia = rel.selecionar((no) => no.type === "VariableDeclarator" && no.id.name === "emAberto" && /\bmin\b/.test(rel.texto(no.init)));
assert.equal(estadosDoDia.length, 2, "executar a classificação do detalhe e da visão Dia");

function estadoDoDia(no, d) {
  const min = d ? minutosTrabalhados(d) : null;
  const ausencia = d ? ausenciaDoDia(d) : null;
  const emAberto = executar(rel.texto(no.init), { d, min, ausencia, txt });
  return { min, emAberto, ...situacaoDoDia({ dia: d, ausencia, emAberto, previstoMin: 480 }) };
}

function renderizarAvisos(tela, alvo, contexto) {
  const nos = tela.selecionar((no) => no.type === "JSXExpressionContainer"
    && no.expression.type === "LogicalExpression" && alvo.test(tela.texto(no.expression.left)));
  assert.ok(nos.length, "região real de avisos encontrada");
  const jsx = `function renderizar() { return <>${nos.map(tela.texto).join("\n")}</>; }`;
  const { code } = transformSync(jsx, { loader: "jsx", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" });
  const arvore = new Function("React", ...Object.keys(contexto), `${code}\nreturn renderizar();`)(React, ...Object.values(contexto));
  return renderToStaticMarkup(arvore);
}

const avisosMes = (emAberto, estranhas) => renderizarAvisos(rel, /vmMes\.totais\.(emAberto|estranhas)/, {
  vmMes: { totais: { emAberto, estranhas } }, plural,
});
const avisosAusencia = (mudancas = {}) => renderizarAvisos(faltas, /form\.fraseBatida\s*\|\|/, {
  form: { fraseBatida: "", futuro: false, repetidos: 0, duplicataSuspeita: "", ...mudancas }, CircleAlert,
});

for (const [i, no] of estadosDoDia.entries()) {
  const local = i === 0 ? "detalhe" : "visão Dia";
  test(`${local}: ausência conhecida sem batidas mantém seu rótulo e total nulo`, () => {
    for (const [tipo, rotulo] of [["atestado", "Atestado médico"], ["falta", "Falta (injustificada)"], ["justificada", "Falta justificada"], ["ferias", "Férias"], ["folga", "Folga / compensação"]]) {
      const d = Object.freeze({ data: "2026-09-04", origem: "manual", corrigido: true, ausencia: Object.freeze({ tipo }), entrada: " ", saida: "" });
      const resultado = estadoDoDia(no, d);
      assert.equal(resultado.min, null);
      assert.equal(resultado.emAberto, false, tipo);
      assert.equal(resultado.situacao, rotulo);
    }
  });

  test(`${local}: emAberto explícito tem prioridade mesmo com atestado e total gravado zero`, () => {
    const resultado = estadoDoDia(no, { emAberto: true, trabalhadoMin: 0, ausencia: { tipo: "atestado" } });
    assert.equal(resultado.min, null);
    assert.equal(resultado.emAberto, true);
    assert.match(resultado.situacao, /em aberto/);
  });

  test(`${local}: batida incompleta continua pendente mesmo com ausência`, () => {
    for (const batida of [{ entrada: "08:00" }, { saida: "17:00" }]) {
      const resultado = estadoDoDia(no, { ...batida, ausencia: { tipo: "atestado" } });
      assert.equal(resultado.min, null);
      assert.equal(resultado.emAberto, true);
    }
  });

  test(`${local}: sem registro, tipo desconhecido e zero apurado mantêm os estados anteriores`, () => {
    assert.deepEqual(estadoDoDia(no, null), { min: null, emAberto: false, situacao: "sem registro", chip: "chip-warn" });
    assert.equal(estadoDoDia(no, { ausencia: { tipo: "legado-desconhecido" } }).emAberto, true);
    const zero = estadoDoDia(no, { entrada: "08:00", saida: "08:00", trabalhadoMin: 0 });
    assert.equal(zero.min, 0);
    assert.equal(zero.emAberto, false);
  });
}

test("Faltas: suspeita de duplicidade sozinha exibe o nome antes do lançamento", () => {
  assert.match(avisosAusencia({ duplicataSuspeita: "Pessoa fictícia duplicada" }), /Pessoa fictícia duplicada/);
});

test("Faltas: alertas de batida, data futura e repetidos continuam visíveis; vazio não exibe bloco", () => {
  assert.match(avisosAusencia({ fraseBatida: "entrada às 08:00" }), /entrada às 08:00/);
  assert.match(avisosAusencia({ futuro: true }), /ainda não chegou/);
  assert.match(avisosAusencia({ repetidos: 2 }), /Há 2 registros/);
  assert.equal(avisosAusencia(), "");
});

test("Relatórios: ausência desconhecida avisa mesmo sem dia em aberto", () => {
  const html = avisosMes(0, 2);
  assert.match(html, /2 ausências de tipo desconhecido/);
  assert.match(html, /Faltas/);
  assert.doesNotMatch(html, /dia em aberto|dias em aberto/);
});

test("Relatórios: dias em aberto e desconhecidos têm avisos independentes, sem bloco vazio", () => {
  assert.match(avisosMes(1, 0), /1 dia em aberto/);
  assert.doesNotMatch(avisosMes(1, 0), /tipo desconhecido/);
  assert.match(avisosMes(1, 2), /1 dia em aberto/);
  assert.match(avisosMes(1, 2), /2 ausências de tipo desconhecido/);
  assert.equal(avisosMes(0, 0), "");
});
