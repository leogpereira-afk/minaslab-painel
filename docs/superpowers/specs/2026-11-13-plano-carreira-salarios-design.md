# Plano de carreira: novos cargos e faixas salariais (design curto)

Aprovado pelo usuário em 13/11/2026.

## Intenção
A MinasLab (7 pessoas, Montes Claros/MG) quer um plano de carreira completo, com
valores, para organizar a equipe e mostrar a cada um o próximo passo. O plano já
existe no painel `gestao` (aba Carreira); falta estagiário no laboratório, cargos
na Qualidade, gerentes de área e salários em reais.

## Objetivos
- Novos cargos: Estagiário de Laboratório, Estagiário da Qualidade, Analista da
  Qualidade, Gerente da Qualidade, Analista Financeiro, Gerente Administrativo,
  Gerente Financeiro.
- Trilhas: Qualidade vira Estagiário → Analista → Supervisor → Gerente;
  Comercial termina em Gerente Administrativo; nova trilha Financeiro
  (Aux. Adm. Financeiro → Analista Financeiro → Gerente Financeiro).
- Faixa salarial padrão (mínimo e máximo em R$) para todos os cargos, com os
  valores aprovados abaixo; a direção edita no detalhe do cargo.
- Faixa visível em cada degrau da trilha e no PCC impresso.
- Aviso quando o mínimo de um cargo fica abaixo do mínimo do cargo anterior
  da mesma trilha.

## Não objetivos
- Não guardar salário individual de cada pessoa (o sistema não tem esse dado);
  por isso não há aviso de "pessoa fora da faixa" nesta versão.
- Gerente (Lidyane, pró-labore) e Diretora continuam fora do plano.

## Valores aprovados (R$/mês)
| Cargo | Mín | Máx |
|---|---|---|
| Estagiário de Laboratório / da Qualidade / de Suporte Operacional | 800 (bolsa) | 1.100 |
| Auxiliar de Laboratório | 1.621 | 1.800 |
| Analista de Laboratório I | 1.800 | 2.000 |
| Analista de Laboratório II | 2.000 | 2.250 |
| Analista de Laboratório III | 2.250 | 2.550 |
| Supervisor de Laboratório | 2.700 | 3.200 |
| Analista da Qualidade | 2.000 | 2.400 |
| Supervisor da Qualidade | 2.500 | 3.000 |
| Gerente da Qualidade | 3.300 | 4.000 |
| Operador de Coletas e Logística | 1.700 | 1.950 |
| Técnico de Amostragem e Coleta | 2.100 | 2.600 |
| Aux. Adm. Comercial I (+ comissão) | 1.621 | 1.850 |
| Aux. Adm. Comercial II (+ comissão) | 1.850 | 2.100 |
| Analista Administrativo Comercial | 2.100 | 2.500 |
| Supervisor Administrativo | 2.800 | 3.300 |
| Aux. Adm. Financeiro | 1.700 | 1.950 |
| Analista Financeiro | 2.100 | 2.500 |
| Gerente Administrativo / Financeiro | 3.600 | 4.500 |

## Abordagem
Uma só sensata: estender o que existe. Os valores padrão ficam no código
(`gestao/src/lib/planoCarreira.js`, campo `salario: {min, max, obs}` por nível);
o ajuste da direção (registro `nivel_<id>` da coleção `carreira`) passa a ter
`salarioMin`/`salarioMax` numéricos que sobrepõem o padrão. O campo de texto
livre `faixa` some (nenhum valor salvo hoje; se existir, aparece como observação).
Alternativas descartadas: tabela nova no Supabase (desnecessária, a coleção já
existe) e só cadastrar valores via tela (perderia o padrão aprovado).

## Constraints
- O painel `gestao` só abre com crachá de direção: salários ficam restritos.
- Manter os testes de `planoCarreira.test.mjs` (ex.: função "Gerente" sem nível).

## Deixado para o construtor
Escopo, requisitos, grupo de risco e treinamentos dos cargos novos, seguindo o
padrão dos existentes; texto de remuneração do PCC; estilo do valor no degrau.
