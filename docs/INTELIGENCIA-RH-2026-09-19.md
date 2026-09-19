# Inteligência do RH Impresilk adaptada à MinasLab

## Entrega

A entrada do RH passa a ser **Visão geral**, com quadro atual, salário cadastrado com cobertura explícita, lacunas essenciais, pendências por pessoa, distribuição por setor/vínculo, agenda de férias e datas da equipe. A aba **Relatórios** acrescenta movimentações mensais e exportações em Excel.

A lista e a exportação de pendências usam o mesmo filtro de assunto, prioridade e busca. A exportação inclui o recorte inteiro, mesmo quando a lista está paginada. Movimentações usam datas efetivamente registradas até hoje; quadro e salário continuam identificados como atuais.

## Regras e integração

- Reutiliza completude, cadência de feedback, experiência, aniversários e presença de férias já portados da Impresilk.
- Reutiliza o mesmo radar de exame vigente da aba Exames; um exame antigo substituído não volta a virar pendência no painel.
- Experiência respeita vínculos explicitamente não CLT em todas as telas que consomem a regra compartilhada. Legados sem contrato mantêm a referência existente para conferência.
- Combinados vencidos, exames sem validade, documentos vencidos/a vencer, férias com datas inválidas/sobrepostas e ausência de histórico ficam visíveis.
- CPF repetido não provoca união ou exclusão automática. Gestor inexistente, registros órfãos e ativo com desligamento são apontados para conferência.
- Ausência de férias no histórico não é dívida. Salário cadastrado não é folha paga. Sem salário informado, o valor é “Sem registro”.
- Pessoas desligadas não entram em custos atuais nem em renovações de exames/documentos. Permanecem no relatório de movimentações e na conferência de vínculos históricos.
- Atalhos abrem a pessoa na busca de Pessoas, expandem Férias/Feedback, filtram Exames e Vencimentos.
- Coleções recusadas pelo servidor não são tratadas como coleções vazias; a carga apresenta erro e mantém explícita a condição da última carga disponível.

## Origem e adaptação

| Inteligência Impresilk | Resultado na MinasLab |
| --- | --- |
| Painel: quadro e composição | Visão geral por setor e vínculo registrado |
| Pendências por pessoa e completude | Fila integrada, filtros e exportação |
| Férias, experiência e feedback | Motores existentes reaproveitados e conectados às ações |
| Saúde e segurança | Radar vigente e documentos/NR com prazo |
| Relatórios e movimentações | Admissões e desligamentos mensais, com cobertura e lacunas |
| Aniversários e tempo de casa | Datas no mês; admissão não conferida identificada |
| Auditoria de vínculos | Órfãos, gestores inexistentes e possíveis duplicidades |

## Limites explícitos

Esta adaptação usa as seis coleções já existentes da MinasLab. **Não é uma cópia integral de todos os módulos da Impresilk**: importação da folha/Mubisys, societárias, faixas salariais, desempenho por ciclos, 9-Box e recrutamento exigem modelos, fontes e fluxos próprios na MinasLab e não foram transplantados como telas sem dados. Não há inferência de perfil comportamental, engajamento, risco de saída ou promoção. Não foi criado turnover sobre histórico incompleto ou salário histórico a partir do valor atual.

Nenhum dado de colaborador da Impresilk foi copiado. Finanças, funções de produção e esquema do banco não foram alterados. A demonstração usa pessoas fictícias e serviços de gravação bloqueados; seus arquivos não fazem parte da entrega.

## Validação

- 17 testes novos de gestão e integração de regras: datas inválidas, vínculos, salário ausente, quadro, férias sobrepostas/canceladas, radar vigente, órfãos, duplicidade, períodos, filtros e ausência de mutação.
- Teste de regressão confirmou primeiro a aplicação indevida da experiência a prestadores; passou após a correção na regra compartilhada.
- Suíte completa: 393 testes aprovados, zero falhas. Os 17 novos testes também passaram em America/Sao_Paulo. ESLint sem apontamentos e build BASE_PATH=/minaslab-painel/ concluído na cópia isolada.
- Navegador: filtro combinado por assunto/pessoa, abertura de Exames com pessoa selecionada, Feedback expandido, meses com/sem movimentos e geração da planilha.
- Layout desktop e celular conferidos com dados fictícios; sem rolagem lateral a 1366 e 390 pixels.
- Produção consultada somente para comparar a apresentação atual dos dois sistemas. Novos fluxos não foram publicados nem executados sobre registros reais.

## Arquivos próprios

`src/lib/rh/gestao.js`, `src/lib/rh/gestao.test.mjs`, `src/components/rh/AbaGestao.jsx`, `src/components/rh/gestao.css`, integração em `src/pages/RH.jsx`, parâmetros de navegação em `AbaExames.jsx`/`AbaFeedback.jsx` e regra de vínculo em `src/lib/rh/clt.js`.

As alterações locais anteriores foram preservadas. A aplicação ao projeto original exige hashes iguais aos capturados antes do trabalho, para não sobrescrever alterações concorrentes.

## Preparação para publicação autorizada

Em 19/09/2026, a entrega foi reaplicada sobre a versão remota 44efdd0, preservando as atualizações posteriores do site e excluindo outras edições locais. Foram aprovados 437 testes e o build de produção. O lint terminou sem erros, com 37 avisos em arquivos fora desta alteração. A publicação usa o workflow existente do GitHub Pages, sem implantação de backend ou mudança em dados.
