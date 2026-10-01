# Roteiro de teste — Gestão de Estoque

Endereço: https://leogpereira-afk.github.io/minaslab-painel/ (use **Ctrl+F5** antes de começar).
O módulo foi zerado em 30/09/2026: todas as listas começam vazias. Os códigos continuam a numeração anterior
(próximo lote **ML-403**, próximo pedido **PC-28**) porque o sistema nunca reaproveita código.

Como usar: faça os blocos **na ordem** (um depende do anterior). Em cada passo marque ✅ ou ❌.
Se algo falhar, anote o **texto exato do aviso** e, se possível, tire um print.

---

## 0. Preparação
| # | Ação | Esperado |
|---|---|---|
| 0.1 | Entrar com seu usuário e abrir **Gestão de Estoque** | Menu com Dashboard, Cadastro de Insumo, Entrada, Retirada, Fornecedores, Pedido de Compra, Etiquetas, Relatórios, Configurações |
| 0.2 | Abrir cada tela | Todas vazias (sem registros), sem erro |

## 1. Configurações
| # | Ação | Esperado |
|---|---|---|
| 1.1 | Grupo: digitar `TESTE GRUPO` → Adicionar | Aparece na lista (em maiúsculas); aviso de sucesso |
| 1.2 | Remover o grupo `TESTE GRUPO` (lixeira) | Some da lista |
| 1.3 | Unidade: adicionar `Kg` duplicada | Não duplica |
| 1.4 | Tipo de documento: nome `CARTAO CNPJ`, **Sem validade** → Adicionar tipo | Linha "Validade: NÃO · ATIVO"; cartão "Tipos ativos" = 1 |
| 1.5 | Tipo: `ESCOPO`, **Possui validade**, alerta `30` | Linha "Validade: SIM · Alerta: 30 dias" |
| 1.6 | Editar `ESCOPO` (mudar descrição) → Salvar | Janela abre preenchida; alteração salva |
| 1.7 | Inativar e Reativar `ESCOPO` | Cartões "Tipos inativos/ativos" acompanham |
| 1.8 | Regra: tipo `LABORATÓRIO`, documento `ESCOPO`, `OBRIGATÓRIO` → Salvar regra | Linha **"LABORATÓRIO → ESCOPO (OBRIGATÓRIO)"** (com o nome do documento) |
| 1.9 | Editar a regra para `OPCIONAL` | Atualiza |
| 1.10 | Criar uma 2ª regra e excluí-la | Some da lista |
| 1.11 | Excluir tipo que tem regra | **Recusado** ("possui documentos ou regras vinculadas") |

## 2. Fornecedores
| # | Ação | Esperado |
|---|---|---|
| 2.1 | Novo fornecedor: nome em minúsculas, e-mail em MAIÚSCULAS, tipo `LABORATÓRIO`, CNPJ | Salva; nome/endereço/tipo em **MAIÚSCULAS**, e-mail em **minúsculas**; ID `F-nn` sequencial |
| 2.2 | Abrir o fornecedor → aba **Classificação**: requer qualificação SIM, semestral, última avaliação = hoje → Salvar | Aviso com "Próxima avaliação" = hoje + 6 meses |
| 2.3 | Aba **Avaliação**: avaliação inicial com notas 0–2 | Nota final e classificação (RUIM/BOM/ÓTIMO) corretas |
| 2.4 | Gerar **FAPE** (exige avaliação inicial) | PDF gerado e arquivado |
| 2.5 | Aba **Documentos**: criar pasta no Drive e enviar `ESCOPO` (PDF) | Pasta criada; documento listado com versão 1; reenviar = versão 2 |
| 2.6 | Criar 2º fornecedor sem CNPJ | Salva (sem bloqueio) |
| 2.7 | Excluir o 2º fornecedor (sem vínculo) | Excluído |

## 3. Produto Base (Cadastro de Insumo)
| # | Ação | Esperado |
|---|---|---|
| 3.1 | Novo produto sem preencher nada → Gravar | **Recusa** listando os campos obrigatórios |
| 3.2 | Preencher produto (minúsculas), fornecedor, grupo, unidade, setor, mínimo `10` | Salva em **MAIÚSCULAS**, ID `ML-nn` |
| 3.3 | Os seletores de grupo/unidade | Mostram os valores de Configurações |
| 3.4 | Criar um 2º produto (ex.: mínimo `500`) | Salva |
| 3.5 | Inativar o 2º produto | Some dos seletores de **Entrada** e **Pedido**; histórico registra |
| 3.6 | Reativar | Volta aos seletores |

## 4. Pedido de compra
| # | Ação | Esperado |
|---|---|---|
| 4.1 | **Novo pedido**: fornecedor, 2 produtos, frete e imposto, anexo PDF | Grava como **PC-28**; aviso "Pasta criada no Drive com o anexo"; PDF baixa sozinho |
| 4.2 | Verificar no Drive | Pasta `PC-28` na pasta-mãe, com o anexo e o `PEDIDO_PC-28.pdf` |
| 4.3 | Abrir o PDF | Logo, itens, Conteúdo, **Total Geral = itens + frete + imposto** |
| 4.4 | Tentar gravar pedido com quantidade `0` | **Recusado** com mensagem |
| 4.5 | Botão **olho** (Visualizar pedido) | Janela com itens, frete, imposto, total, pasta e PDF |
| 4.6 | Botão **pasta** | Abre a pasta do Drive |
| 4.7 | **Editar** o pedido (item PENDENTE) | Abre o PC completo; alterar quantidade e salvar funciona |
| 4.8 | **Autorizar** o item 1 | Status AUTORIZADO (selo azul) |
| 4.9 | **Cancelar** o item 2 | Status CANCELADO |
| 4.10 | Em outro pedido PENDENTE: **Excluir** o item | Excluído; aparece log "excluído" |
| 4.11 | Editar o pedido com item AUTORIZADO | Item AUTORIZADO preservado; só PENDENTE editável |

## 5. Inspeção / Laudo
| # | Ação | Esperado |
|---|---|---|
| 5.1 | Item 1 (AUTORIZADO): **Concluir recebimento** | Janela "Inspeção de Recebimento de Insumo" (cabeçalho escuro, critérios "3 - Excelente…") |
| 5.2 | Deixar fabricante/lote/validade vazios e emitir | Campos obrigatórios impedem |
| 5.3 | Preencher e **Emitir Laudo & Concluir** | Aviso com **IRnn** (ex.: IR130), nota e parecer; item vira **CONCLUÍDO** |
| 5.4 | Verificar PDF | Layout do legado (cabeçalho com logo, 3 seções, assinaturas); salvo na pasta `PC-28` |
| 5.5 | Botão **Visualizar inspeção** | Título "INSPEÇÃO DE RECEBIMENTO", dados do pedido/itens, IR, status da qualidade, operador = seu usuário, **"Abrir PDF existente"** |
| 5.6 | Tentar nova inspeção do mesmo item | Não permitido (botão some / servidor recusa) |

## 6. Gerar Entrada (a partir do pedido)
| # | Ação | Esperado |
|---|---|---|
| 6.1 | Item CONCLUÍDO | Mostra botão **Gerar Entrada** (não "Lote em Estoque") |
| 6.2 | Clicar | Abre Entrada já preenchida (fornecedor, produto, kit, qtd, lote/validade do laudo, "REF PEDIDO: PC-28") |
| 6.3 | Informar valor da NF e responsável; anexar um PDF ou Excel → **Finalizar lote** | Aviso: entrada salva, **item INTEGRADO**, **anexo enviado ao Drive**; **etiqueta abre sozinha** |
| 6.4 | Voltar ao pedido | Item mostra **"Lote em Estoque"**; sem botão Gerar Entrada |
| 6.5 | Lista de entradas | Lote `ML-nn` com botão de **pasta/anexo** que abre o arquivo |
| 6.6 | Tentar gerar outra entrada do mesmo item | **Impossível/recusado** |

## 7. Entrada avulsa e edição de lote
| # | Ação | Esperado |
|---|---|---|
| 7.1 | **Registrar Entrada** sem pedido, validade **no passado** | Salva; status do lote **Vencido** (calculado no servidor) |
| 7.2 | Outra entrada com validade em ~15 dias | "Vencimento em 30 dias" |
| 7.3 | Outra com validade distante | "Dentro do prazo" |
| 7.4 | Produto inativo na busca | **Não aparece** |
| 7.5 | **Editar** um lote | Aparece **Data de abertura**; total menor que o já retirado é recusado |
| 7.6 | **Excluir** entrada sem retirada | Exclui com auditoria |

## 8. Saída (Retirada)
| # | Ação | Esperado |
|---|---|---|
| 8.1 | Retirar parte de um lote, responsável escolhido | Saldo diminui; histórico mostra o **responsável escolhido** |
| 8.2 | Quantidade maior que o saldo | Recusada |
| 8.3 | Lote vencido | Recusado ("Lote vencido não pode ser utilizado") |
| 8.4 | Lote com observação | Mostra **"⚠ ATENÇÃO OPERACIONAL"** com o texto |
| 8.5 | Excluir entrada que já teve retirada | **Bloqueado** |

## 9. Etiquetas
| # | Ação | Esperado |
|---|---|---|
| 9.1 | Escolher um lote → gerar | Etiqueta 50×30 mm: logo, `ML-nn`, produto, lote, validade dd/mm/aa, QR, "ABERTO EM" |

## 10. Relatórios
| # | Ação | Esperado |
|---|---|---|
| 10.1 | **Inventário Geral** | Todos os lotes, cabeçalhos legíveis |
| 10.2 | **Estoque Crítico** | Consolidado **por produto** (produto com mínimo `500` aparece; mostra "Falta comprar"; avisa saldo vencido ignorado) |
| 10.3 | **Produtos Vencidos** | Lista o lote vencido do passo 7.1 |
| 10.4 | **Planilha Completa** | Histórico de movimentações |
| 10.5 | Exportar **PDF**, **CSV** e **Excel completo** | PDF com logo; Excel abre com as 6 abas (Estoque, Histórico, Produto, Fornecedores, Pedidos, Inspeções) |

## 11. Fornecedor com vínculos (fecha o bloco 2)
| # | Ação | Esperado |
|---|---|---|
| 11.1 | Excluir o fornecedor usado no PC-28 | **Recusado** ("vinculado a pedidos de compra…"); inativar funciona |

## 12. Dashboard e permissões
| # | Ação | Esperado |
|---|---|---|
| 12.1 | Dashboard | Cartões batem com o que você lançou (lotes, vencidos, a vencer, críticos) |
| 12.2 | Entrar com usuário **somente consulta** | Botões de gravar/excluir **desabilitados**; todas as telas abrem |
| 12.3 | Abrir outros módulos (Financeiro, RH, Compras…) | Funcionam normalmente |

---

### Limites conhecidos (não são defeitos desta etapa)
- O QR da etiqueta é gerado pelo serviço `quickchart.io` (leva só o código do lote).
- A numeração não recomeça do zero (ML-403, PC-28) a menos que você peça a limpeza definitiva.
- Pastas e arquivos de teste antigos no Drive não foram apagados.
- PC-25, PC-26 e a inspeção IR133 existem só no sistema antigo.

### Ao terminar
Me envie a lista dos passos com ❌ (número do passo + texto do aviso). Corrijo e refazemos só esses passos.
