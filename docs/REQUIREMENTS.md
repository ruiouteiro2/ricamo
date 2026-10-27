# Matriz de requisitos e evidência — Ricamo

Estado intermédio de 27-10-2026. A missão continua; esta matriz não é uma declaração de conclusão global. Contrato: RICAMO_CODEX_MASTER_PROMPT.md, SHA-256 `15bea1805873ab3d7b102971f7d58e974b165dfc8c8b955ac04f69a8754b74ef`. Cobertura conferida: **111 identificadores funcionais + AC-01 a AC-67, sem omissões nem duplicados**.

O snapshot isolado deriva do intake `aa8cdad39d9f9d578f08de7cf439e5e134321cb7`; os hashes por árvore abaixo identificam efectivamente o código medido, porque a integração principal continuava em paralelo. Novos commits, pacote Windows final e handoffs posteriores exigem actualizar os estados relevantes.

## Estados e interpretação

| Estado | Significado |
| --- | --- |
| V | Implementado e verificado **na superfície especificada**; um teste de domínio não certifica a instalação Windows nem a experiência completa. |
| IV | Implementação existente, mas o percurso completo, plataforma exigida ou cobertura final continua sem prova. |
| P | Implementação ou documentação obrigatória parcial/pendente; a lacuna está descrita. |
| B | Verificação bloqueada por ambiente externo indisponível, identificado concretamente. Não significa que o código esteja aprovado. |
| C | Condicional e não aplicável nas condições descritas; nunca usado para dispensar requisito obrigatório. |

Os códigos de evidência nas linhas ligam à tabela seguinte. Testes listados como executados passaram no comando `npm test` do snapshot isolado: **148/148**, incluindo duas regressões do resumo de progresso. Scripts E2E presentes mas não executados nesta medição são assinalados, sem os contar como prova.

## Índice de implementação e evidência

| Código | Superfície e prova | Ficheiros |
| --- | --- | --- |
| D | Domínio executado, 148 testes totais | [core/inventory.mjs](../core/inventory.mjs), [core/projects.mjs](../core/projects.mjs), [core/fabric.mjs](../core/fabric.mjs), [core/purchasing.mjs](../core/purchasing.mjs), [tests/domain.test.mjs](../tests/domain.test.mjs) |
| SQL | SQLite real, atomicidade/readback e falhas injectadas | [desktop/repository.mjs](../desktop/repository.mjs), [core/csv.mjs](../core/csv.mjs), [core/backup.mjs](../core/backup.mjs), [tests/persistence.test.mjs](../tests/persistence.test.mjs) |
| ENG | Motor original/adapter/worker reais; testes geométricos e formatos | [src/engine/adapter.mjs](../src/engine/adapter.mjs), [src/engine/worker.js](../src/engine/worker.js), [core/pattern.mjs](../core/pattern.mjs), [src/pattern-export.mjs](../src/pattern-export.mjs), [tests/engine.test.mjs](../tests/engine.test.mjs) |
| INV | Domínio executado e UI de inventário; handoffs anteriores não substituem gate do pacote final | [core/inventory-workflows.mjs](../core/inventory-workflows.mjs), [src/views/MaterialsPage.vue](../src/views/MaterialsPage.vue), [src/views/MaterialDetail.vue](../src/views/MaterialDetail.vue), [src/components/MaterialForm.vue](../src/components/MaterialForm.vue), [tests/inventory-workflows.test.mjs](../tests/inventory-workflows.test.mjs) |
| FAB | 16 testes de planeamento/corte/rollback e encaixe executados | [core/fabric-planning.mjs](../core/fabric-planning.mjs), [core/fabric-state.mjs](../core/fabric-state.mjs), [src/components/FabricWorkspace.vue](../src/components/FabricWorkspace.vue), [tests/fabric-planning.test.mjs](../tests/fabric-planning.test.mjs) |
| TOOLS | 16 testes de empréstimos, perdas, manutenção e compromissos executados; UI integrada | [core/tool-activity.mjs](../core/tool-activity.mjs), [core/tool-state.mjs](../core/tool-state.mjs), [src/components/ToolActivity.vue](../src/components/ToolActivity.vue), [tests/tool-activity.test.mjs](../tests/tool-activity.test.mjs) |
| REF | PDF real de duas páginas no benchmark; anotações/rotação/exportação em testes | [core/references.mjs](../core/references.mjs), [src/components/ReferenceReader.vue](../src/components/ReferenceReader.vue), [tests/references.test.mjs](../tests/references.test.mjs), [tests/reference-export.test.mjs](../tests/reference-export.test.mjs) |
| DRAFT | Autosave/coalescência/falhas/recuperação em testes executados; script Electron final precisa de execução própria | [core/drafts.mjs](../core/drafts.mjs), [src/editor-draft.mjs](../src/editor-draft.mjs), [src/views/PatternEditor.vue](../src/views/PatternEditor.vue), [tests/drafts.test.mjs](../tests/drafts.test.mjs), [tests/editor-draft.test.mjs](../tests/editor-draft.test.mjs), [tests/desktop-drafts.mjs](../tests/desktop-drafts.mjs) |
| BACK | Retenção só após sucesso, snapshots e destino externo indisponível executados | [desktop/backup-manager.mjs](../desktop/backup-manager.mjs), [src/components/BackupControls.vue](../src/components/BackupControls.vue), [tests/backup-manager.test.mjs](../tests/backup-manager.test.mjs) |
| SEC | Negativos de comandos/restauro/versões/protocolo executados; probe Electron anterior isolado | [desktop/main.mjs](../desktop/main.mjs), [desktop/preload.cjs](../desktop/preload.cjs), [desktop/protocol.mjs](../desktop/protocol.mjs), [core/files.mjs](../core/files.mjs), [core/validation.mjs](../core/validation.mjs), [tests/security.test.mjs](../tests/security.test.mjs), [tests/images.test.mjs](../tests/images.test.mjs) |
| I18N | Fonte IT/EN e parsing/round-trip executado; tradução integral não certificada | [src/i18n.js](../src/i18n.js), [src/i18n-extra.json](../src/i18n-extra.json), [src/components/FormField.vue](../src/components/FormField.vue), [tests/domain.test.mjs](../tests/domain.test.mjs), [tests/persistence.test.mjs](../tests/persistence.test.mjs) |
| UI | Fonte e navegação Electron do benchmark; presença de código não conta como jornada executada | [src/App.vue](../src/App.vue), [src/styles.css](../src/styles.css), [src/views/HelpPage.vue](../src/views/HelpPage.vue), [src/views/ShoppingPage.vue](../src/views/ShoppingPage.vue), [src/views/LocationsPage.vue](../src/views/LocationsPage.vue), [src/views/ProjectDetail.vue](../src/views/ProjectDetail.vue) |
| PERF | Electron 45 Linux/WSL, build de produção próprio; performance-3JHhTo e diagnósticos abaixo | [tests/performance.mjs](../tests/performance.mjs), [tests/performance-fixture.mjs](../tests/performance-fixture.mjs), [src/pattern-thumbnail.mjs](../src/pattern-thumbnail.mjs), [tests/progress-summary.test.mjs](../tests/progress-summary.test.mjs) |
| WIN | Configuração e artefacto Windows preliminar comunicado pelo root; não foi executado neste benchmark | [package.json](../package.json), [tests/desktop-smoke.mjs](../tests/desktop-smoke.mjs) |
| DOC | Revisão documental estática; incompletude explicitada na matriz | [README.md](../README.md), [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md), [package-lock.json](../package-lock.json), [docs/STATUS.md](../docs/STATUS.md) |
| PKG | Handoff DATA-04: 11 testes, Chromium real/IndexedDB e Electron SQLite/BLOB isolados; aguarda gate root após ajustes | [core/project-package.mjs](../core/project-package.mjs), [desktop/project-transfer.mjs](../desktop/project-transfer.mjs), [src/components/ProjectTransfer.vue](../src/components/ProjectTransfer.vue), [tests/project-package.test.mjs](../tests/project-package.test.mjs) |
| THREAD-PENDING | Frente independente em integração; sem evidência executada neste snapshot |  |
| FINISH-PENDING | Frente independente em integração; sem evidência executada neste snapshot |  |
| LEDGER | Comparação mecânica dos 111 IDs funcionais e 67 AC; não equivale a aprovação global | [docs/REQUIREMENTS.md](../docs/REQUIREMENTS.md) |

## Requisitos funcionais

| ID | Requisito | Estado | Evidência | Resultado e trabalho restante |
| --- | --- | --- | --- | --- |
| BASE-01 | Aplicação completa com uma interface nova, destinada a utilização diária por uma pessoa não técnica. | P | UI, PERF | A interface nova e os percursos centrais existem; lacunas obrigatórias abaixo impedem declarar a aplicação integralmente completa. |
| BASE-02 | Italiano e inglês em toda a experiência, incluindo ajuda, erros, exportações e documentação de utilização. | P | I18N | Interface bilingue; faltam guias finais IT/EN e auditoria integral de todos os textos/exportações. |
| BASE-03 | Inventário abrangente de materiais, ferramentas, kits, tecidos, referências e acabamentos. | P | INV, D, FAB | Inventário e regras centrais verificados; campos especializados, referências e kits virtuais têm cobertura parcial. |
| BASE-04 | Gestão de projectos desde a ideia até ao acabamento e arquivo. | P | D, PERF | Planeamento/execução/arquivo existem; fecho detalhado e previsões estavam em integração noutra frente. |
| BASE-05 | Geração real de esquemas através do motor existente, com integração independente da interface antiga. | V | ENG, PERF | Motor real integrado e geração CPU executada em Electron Linux; não usa a interface antiga. |
| BASE-06 | Editor de esquemas, acompanhamento do bordado e impressão/exportação utilizáveis. | IV | ENG, REF, PERF | Editor, progresso e PDF executados; biblioteca de motivos e cobertura completa de edição/impressão ainda faltam. |
| BASE-07 | Dados locais persistentes, cópias de segurança, restauro e transferência para outro computador. | IV | SQL, BACK, PKG, PERF | Persistência e snapshots verificados localmente; transferência real para segundo PC não executada. |
| BASE-08 | Instalador Windows .exe que inclua as dependências necessárias e funcione sem Internet. | IV | WIN | Pacote NSIS configurado e artefacto Windows existente; este benchmark não testa instalação Windows limpa. |
| BASE-09 | Verificação de funcionamento no pacote instalado, incluindo uma instalação num ambiente Windows limpo. | B | WIN | Não há VM Windows 11 limpa/offline disponível nesta execução. |
| BASE-10 | Código completo, instruções de build, licenças, testes e relatório factual de entrega. | P | DOC | Código/lock/licenças/testes existem; documentação final, inventário de dependências e relatório de release devem ser concluídos. |
| ENG-01 | Auditoria inicial | P | ENG, DOC | Snapshot/hash e limites documentados; falta consolidar tabela completa de capacidades/adaptações e auditoria no repositório. |
| ENG-02 | Reutilização efectiva | V | ENG | Teste compara resultado do adaptador com convert original; fonte copiada e origem SHA-256 preservadas. |
| ENG-03 | Contrato da integração | IV | ENG, PERF | Contrato/versionamento/erros/proveniência implementados; documentação formal de todas as unidades e operações ainda parcial. |
| ENG-04 | Execução controlada | IV | ENG, PERF | Worker real, cancelamento/reinício e preservação de preview verificados; falha/bloqueio prolongado e todos os limites precisam de jornada nativa final. |
| UX-01 | Organização pelas tarefas da pessoa | IV | PERF | Todas as áreas de navegação exercitadas com dados; compreensão por pessoa não técnica não foi avaliada com utilizador. |
| UX-02 | Divulgação progressiva | IV | INV, PERF | Entrada rápida, dados desconhecidos e campos avançados existem; verificar todas as variantes de formulário. |
| UX-03 | Operações previsíveis | IV | INV, SQL, D | Idempotência, contexto de inventário e confirmação cobertos parcialmente; não há auditoria completa de eliminar/desfazer em todas as áreas. |
| UX-04 | Primeiro arranque | P | WIN, UI | Arranque vazio/default IT implementado; área separada de exemplo opcional não foi encontrada. |
| UX-05 | Ajuda contextual | P | UI | Ajuda local pesquisável existe; falta conferir exemplos e cobertura integral dos tópicos exigidos. |
| I18N-01 | Cobertura | P | I18N | Textos IT/EN no produto; documentação de utilização e revisão integral do instalador/desinstalador/exportações incompletas. |
| I18N-02 | Comportamento | IV | I18N, SQL | Idioma não altera dados; decimais/códigos verificados. Revisão linguística/plurais e todas as mudanças durante edição pendentes. |
| I18N-03 | Glossário de base | IV | I18N, SQL | Terminologia e casos 1,5/001 testados; glossário publicado e revisão terminológica integral pendentes. |
| INV-01 | Separar produto, existência e movimento | V | D, SQL | Catálogo/lotes/movimentos separados; fusão conserva história e lotes; readback SQLite exercitado. |
| INV-02 | Categorias extensíveis | V | INV | Categorias/campos personalizados e renomeação com identidade estável testados, incluindo fronteira de persistência. |
| INV-03 | Campos comuns | IV | INV, SQL | Campos comuns e anexos implementados; verificar variantes, estado não aplicável e todos os tipos especializados na UI. |
| INV-04 | Operações de utilização diária | IV | INV, UI, PERF | Entrada rápida/lote/filtros/etiquetas executados; fotografia de localização e reconciliação agrupada merecem verificação específica. |
| THR-01 | Tipos de linha | P | INV | Propriedades de composição/tipo/tamanho disponíveis; quantidades fechada/parcial, descontinuação e fontes de substituição não têm fluxo completo próprio. |
| THR-02 | Quantidades e conversões | V | D, SQL | Conversões explícitas, desconhecido e precisão testados; conversão não cria stock adicional. |
| THR-03 | Catálogos e cores | P | ENG, INV | DMC aproximado/licenciado e catálogo pessoal existem; actualizações versionadas de catálogo e comparação de substituições não estão completas. |
| THR-04 | Misturas | P | THREAD-PENDING | Receitas/misturas e calibração pertencem a handoff independente ainda não incluído no snapshot medido. |
| FAB-01 | Tipos e identificação | IV | FAB, INV | Campos técnicos e estado de lavagem disponíveis; cobertura de todos os tipos/têxteis por introdução real pendente. |
| FAB-02 | Dimensões e contagem | IV | FAB | Unidades/contagens/margens e peça física testadas; algumas propriedades descritivas dependem de campos pessoais. |
| FAB-03 | Verificação de adequação | V | FAB, D | Encaixe dimensional, rotação, contagens anisotrópicas e peças irregulares/manuais cobertos por testes específicos. |
| FAB-04 | Plano e confirmação de corte | V | FAB | Reserva geométrica, sobreposição, corte/área/custo/desfazer e dependências posteriores testados; jornada visual existe no handoff de tecidos. |
| TOOL-01 | Ferramentas reutilizáveis | IV | TOOLS, D | Atribuição/empréstimo/manutenção/devolução integrados; 16 testes específicos passam. Jornada visual do pacote final deve ser repetida. |
| MAT-01 | Preparação | P | INV | Categoria/propriedades pessoais armazenam preparação; campos de remoção/prazo e ajuda por material não têm verificação completa. |
| MAT-02 | Adornos | IV | INV, D | Unidades/embalagens/lotes/necessidades gerais servem adornos; não há jornada dedicada para todos os atributos e substituições. |
| MAT-03 | Acabamento e entrega | IV | D, FINISH-PENDING | Materiais fora da paleta podem ser planeados/reservados; orçamento/fecho completos dependem da frente de acabamento. |
| KIT-01 | Kits comprados e kits montados pela pessoa | P | D | Abertura física e custos conservados testados; colecção virtual, conteúdo declarado/verificado e sobras finais têm cobertura incompleta. |
| REF-01 | Livros, revistas e referências | P | INV, REF | Referências e anexos locais existem; relação explícita publicação→esquema/projecto, autor e páginas como modelo completo não encontrada. |
| LOC-01 | Localização física | IV | D, INV, UI | Hierarquia/transferência/etiquetas locais funcionam; identificação de projectos/retalhos e leitura por teclado precisam de cobertura completa. |
| STOCK-01 | Movimentos | V | D, SQL | Entradas/consumos/perdas/descarte/transferências/contagens/correcções conservam histórico e persistem. |
| STOCK-02 | Regras invariantes | V | D, SQL | Invariantes numéricos AC34–40/65/66 e idempotência transaccional exercitados. |
| STOCK-03 | Necessidades e compras sem dupla contagem | V | D | Procura agregada, consumo confirmado, reservas próprias/terceiros e encomendas recebidas separadas testados. |
| STOCK-04 | Contagem física | IV | D, UI | Contagem expõe conflitos e preserva reservas; reconciliação completa por conjunto/caixa e resolução UI devem ser reexecutadas. |
| BUY-01 | Lista de compras | IV | D, UI | Recepção parcial/idempotente, compras derivadas e exportação existentes; arredondamento/alternativas em todos os percursos ainda parcial. |
| BUY-02 | Fornecedores e documentos | P | UI | Ficha local e histórico existem; anexos de recibos/facturas e fluxo completo documental não foram demonstrados. |
| COST-01 | Custos claros | IV | D, FINISH-PENDING | Moedas e custos históricos testados; orçamento final e distinção completa de todas as parcelas em relatório pendentes. |
| LIB-01 | Organização | P | ENG, REF | Biblioteca/pesquisa/revisões/duplicação existem; colecções, autor/direitos/dificuldade e histórico de utilização não estão completos. |
| LIB-02 | Tipos de conteúdo | V | REF, ENG | Referência PDF permanece referência; esquema estruturado tem geometria/paleta própria; originais geridos separadamente. |
| LIB-03 | Importação segura e duradoura | IV | SEC, REF, SQL | Tipos/limites/anexos/deduplicação verificados; importação múltipla por item e formatos documentados requerem fecho. |
| LIB-04 | PDF de referência | V | REF, PERF | PDF local de duas páginas, posição/anotações/bookmarks e exportação de notas testados; não promete extracção de grelha. |
| GEN-01 | Percurso principal | IV | ENG, PERF | Imagem→motor→preview→guardar executado; entrada por dimensão física desejada ainda não demonstrada. |
| GEN-02 | Preparação da imagem | P | ENG, PERF | Recorte/rotação/espelho/contraste/transparência existem; escolha explícita completa de fundo removido/mantido/convertido não encontrada. |
| GEN-03 | Configuração do esquema | P | ENG | Dimensões/limites/modos/paleta existem; cores fixadas/excluídas, comparação de versões e entrada física/arredondamento não completos. |
| GEN-04 | Relação com o inventário | P | ENG | Paleta restrita real testada; preferência por cores existentes permitindo novas e suficiência integrada na geração não completas. |
| GEN-05 | Qualidade e revisão | P | ENG | Contagens e simplificação regional existem; avisos de pontos isolados/cores residuais e protecção explícita de detalhes não completos. |
| GEN-06 | Trabalhos e reprodução | V | ENG, PERF | Preview vinculado aos parâmetros, CPU worker, cancelamento/reinício e proveniência verificados; tempos são do host registado. |
| EDIT-01 | Modelo estruturado | V | ENG, D | Formato estruturado versionado e primitivas independentes de UI/progresso testados. |
| EDIT-02 | Operações obrigatórias | P | ENG, DRAFT, PERF | Operações de base e recuperação existem; rotação/espelho de selecção e impacto integral devem ser reconciliados com toda a lista obrigatória. |
| EDIT-03 | Tipos de ponto | V | ENG | Cruz/meio/backstitch distintos; primitivas não suportadas rejeitadas e geometria preservada nos testes. |
| EDIT-04 | Paleta e símbolos | IV | ENG, THREAD-PENDING | Símbolos/códigos/revisões existem; misturas e legibilidade monocromática completa dependem de integração e inspecção. |
| EDIT-05 | Motivos e texto | P | ENG | Copiar/colar existe, mas biblioteca persistente pessoal de motivos com nome/categoria não encontrada. Texto em pontos é condicionado. |
| EDIT-06 | Revisões | IV | D, SQL, DRAFT | Pin de revisão e execução anterior preservados; análise de impacto completa em materiais/reservas/impressão ainda parcial. |
| PROJ-01 | Ficha e estados | IV | D, PERF | Ficha/estados/projeto sem esquema implementados; campos personalizados de processo/objectivo precisam de revisão final. |
| PROJ-02 | Planeamento | P | FAB, D, THREAD-PENDING, TOOLS | Necessidades/reservas/tecido/compras existem; misturas e substituições aguardam integração final; atribuição dedicada já integrada. |
| PROJ-03 | Preparação | P | D, FINISH-PENDING | Passos editáveis existem; biblioteca reutilizável de checklists pertence à frente de acabamento ainda não medida aqui. |
| PROJ-04 | Execução | IV | D, PERF, FINISH-PENDING | Progresso/sessões/fotos/consumo separados existem; suspensão do PC, substituições posteriores e estimativa restante requerem cobertura final. |
| PROJ-05 | Conclusão e acabamento | P | FINISH-PENDING, D | Fecho simples não inventa consumo; revisão completa de acabamento/entrega/ferramentas/cuidados ainda em integração. |
| PROJ-06 | Repetir e arquivar | IV | D | Duplicação/arquivo/reabertura preservam história e não copiam execução; disponibilidade actual na reabertura precisa de jornada final. |
| WORK-01 | Utilização durante o trabalho | IV | D, PERF | Teclado/cores/coordenadas/marcação/posição implementados; fios estacionados/restante por tipo e todos os contextos precisam de verificação. |
| WORK-02 | Regras de progresso | V | D, SQL, REF, PERF | Progresso idempotente por revisão, contagens distintas e ausência de consumo automático verificados. |
| CALC-01 | Dimensão física | V | D, FAB | Todos os exemplos numéricos obrigatórios, margens e incompatibilidade por lado curto testados. |
| CALC-02 | Estimativa de linha | P | SQL, THREAD-PENDING | Estimativa geométrica/filamentos/backstitch e incerteza existem; misturas/calibração e configuração por tipo aguardam integração. |
| CALC-03 | Quantidades desconhecidas | V | D, SQL | Dados/unidades desconhecidos não inventam conversões, disponibilidade nem compras automáticas. |
| CALC-04 | Tempo e previsões | P | FINISH-PENDING | Sessões/cronómetro existem; previsão fundamentada, pausa/suspensão e estimativa manual pertencem à frente independente. |
| OUT-01 | Documentos de trabalho | P | ENG, REF, FINISH-PENDING | PDF de esquema/referência e listas existem; resumo completo de projecto/misturas/custos ainda em integração. |
| OUT-02 | Paginação | IV | ENG | A4/Letter e mosaico testados no domínio/exportador; símbolos/fronteiras/segmentos e opções completas precisam de revisão visual final. |
| OUT-03 | Escala física | IV | ENG | Exportação actual explica ampliação de leitura; escala real/calibração só pode ser anunciada após geometria específica implementada e testada. |
| OUT-04 | Impressão e etiquetas | IV | INV, PERF | PDF sem impressora e etiquetas dimensionáveis testados; impressão física e todas as categorias de etiqueta não verificadas. |
| DATA-01 | Pesquisa local | IV | PERF, UI | Pesquisa local por área/global/ajuda existe; códigos exactos e todas as entidades exigem auditoria completa. |
| DATA-02 | Importação de inventário | IV | SQL, UI | CSV/TSV, mapeamento/preview/rollback/repetição testados; modelos IT/EN e recuperação de erro por linha não completos. |
| DATA-03 | Exportação aberta | P | SQL, UI | Inventário/compras CSV e backup JSON existem; exportação aberta de movimentos e resumo de projectos ainda incompleta. |
| DATA-04 | Pacote de projecto | IV | PKG | Handoff completo verificado em Chromium e Electron/SQLite isolados; root integra e amplia proveniência/misturas, exigindo novo gate. |
| DATA-05 | Dados antigos do programa fornecido | IV | ENG | Importador legado com preview e preservação da fonte existe; relatório explícito de perdas e exemplos antigos completos pendentes. |
| MODEL-01 | Entidades e relações | P | D, SQL, THREAD-PENDING, FINISH-PENDING | Modelo central coberto; receitas e acabamento avançados em integração; nem todos os conceitos estão fechados. |
| MODEL-02 | Invariantes técnicas | IV | D, SQL, SEC | Transacções/IDs/precisão/versões verificadas; segunda instância, migrações e documentação completa precisam de gate final. |
| STORE-01 | Dados locais | IV | SQL, DRAFT, PERF | SQLite+BLOB, atomicidade e readback confirmados; falha de disco real e base corrompida no pacote final ainda não exercitadas. |
| BACK-01 | Backup completo | V | BACK, SQL, PERF | Snapshot completo validado, retenção pós-sucesso e falha de destino externo testados; cópias geridas verificadas. |
| BACK-02 | Restauro seguro | IV | BACK, SQL, SEC | Preflight/rejeição/backup anterior/rollback testados; falta simular espaço insuficiente e activar noutro perfil. |
| BACK-03 | Transferência para outro computador | B | WIN, SQL | Formato portátil e restauro local testados; segundo PC/perfil Windows limpo não disponível nesta execução. |
| PRIV-01 | Privacidade | IV | SEC, PERF, PKG | Sem pedidos remotos observados nas jornadas, capacidades locais e privacidade de pacote testadas; diagnóstico exportável/sanitização integral pendentes. |
| ARCH-01 | Escolha da stack | IV | ENG, SQL, DOC | Separação de domínio/armazenamento/UI/motor/exportação existe; ADR/tabela de decisão completa ainda não publicada. |
| ARCH-02 | Funcionamento desktop | IV | SEC, PERF, WIN | Electron real arranca pelo protocolo local sem servidor; atalho/permissões e encerramento no Windows final aguardam gate. |
| SEC-01 | Ficheiros e conteúdo | IV | SEC, REF | Traversal/links/limites/tipos/ficheiros activos têm negativos específicos; não constitui prova universal de todos os descodificadores. |
| SEC-02 | Fronteira da interface | IV | SEC | Sandbox/contextIsolation/CSP/protocolo restrito e chamadas erradas de IPC exercitados em Electron isolado anterior; repetir contra pacote final exacto. |
| SEC-03 | Dependências e manutenção | IV | DOC, SEC | Lockfile/atribuição presentes; análise de avisos relevante e revisão do pacote final precisam de evidência datada própria. |
| OFF-01 | O que deve funcionar sem rede | IV | PERF, SEC | Jornadas Linux sem pedidos externos observados; instalação/actualização Windows offline limpa não executadas. |
| OFF-02 | Recursos incluídos | IV | ENG, REF, WIN | Assets/fontes/paleta/PDF/engine locais no build; pacote Windows final e dependências completas por validar. |
| WIN-01 | Destino e compatibilidade | B | WIN | Host Windows 10 conhecido; Windows 11 suportado limpo e limites mínimos finais não disponíveis neste runner Linux. |
| WIN-02 | Instalador .exe | IV | WIN | Instalador NSIS real existente segundo handoff root; cópia/atalhos/Unicode/utilizador comum precisam de evidência do pacote final. |
| WIN-03 | Runtimes | IV | WIN | Electron inclui Chromium/Node; não depende de WebView 2/Python. Dependências efectivas ainda requerem instalação limpa offline. |
| WIN-04 | Actualização e desinstalação | P | WIN, SEC | Preservação de dados configurada e versão futura recusada; upgrade/reinstall/uninstall e migração entre versões reais não demonstrados. |
| WIN-05 | Integridade e assinatura | IV | WIN, DOC | Pacote é explicitamente não assinado; hashes/manifesto devem acompanhar o artefacto final exacto. Certificado não autorizado/disponível. |
| A11Y-01 | Utilização confortável | IV | PERF, UI | Controlos nomeados e teclado exercitados parcialmente; auditoria WCAG/contraste/foco/reduced motion/DPI completa pendente. |
| PERF-01 | Hardware e dimensão dos dados | V | PERF | Cenário 5000/20000/50, anexos e 500×500/80 exercitado em Electron Linux/WSL com ~8GB; não equivale a Windows limpo. |
| PERF-02 | Metas e medição | IV | PERF | Pesquisa/filtros cumprem 300 ms; repetição final teve 3 arranques abaixo de 5 s. Falhas anteriores ficam registadas e pacote Windows final continua por medir. |
| DEL-01 | Produto utilizável | P | WIN, DOC | Artefacto preliminar existe; guias IT/EN, release notes, manifesto e pacote final precisam de entrega consolidada. |
| DEL-02 | Código e manutenção | P | DOC, ENG | Código/lock/tests/atribuição existem; esquema/formatos/migrações/ADR/capacidades e inventário completo de licenças por finalizar. |
| DEL-03 | Matriz de rastreabilidade | IV | LEDGER | Esta matriz cobre 111 IDs funcionais e 67 AC; root deve reconciliar novos commits/evidência antes da entrega. |
| DEL-04 | Resposta final do Codex | P | DOC | Resposta final deve indicar apenas artefactos/ambientes/funcionalidades efectivamente verificados; missão ainda em curso. |

## Critérios de aceitação

| ID | Cenário | Estado | Evidência | Resultado e limites |
| --- | --- | --- | --- | --- |
| AC-01 | Primeiro arranque offline em italiano | IV | UI, WIN | Arranque vazio/default IT implementado; instalação Windows offline não exercitada por este runner. |
| AC-02 | Mudar para inglês durante edição | IV | I18N, UI | Dados desacoplados das traduções; repetir mudança de idioma com formulário aberto no pacote final. |
| AC-03 | Registar material incompleto | V | D, SQL | Teste unknown stock remains distinct from zero; persistência retém null/confidence=unknown. |
| AC-04 | Códigos 001 e B5200 | V | D, SQL | Testes AC04/locale e CSV round-trip preservam 001/B5200; filtros reais usam códigos como strings. |
| AC-05 | Mesma cor em dois lotes | V | SQL | CSV repeated lots share catalogue identity e stock por lote; nunca junta localizações em quantidade fictícia. |
| AC-06 | Sobras aproximadas | V | D | Teste estimated confidence survives transfer; conversões desconhecidas continuam desconhecidas. |
| AC-07 | Kit aberto e decomposto | V | D | Teste AC07 opening a kit transfere uma vez e mantém custos sem duplicar origem. |
| AC-08 | Ferramenta atribuída | V | D, TOOLS | Teste AC08/27 e 16 casos de empréstimos/manutenção: atribuição/indisponibilidade não consomem. |
| AC-09 | Transferir linha de caixa para saco de projecto | V | D | Teste AC09 partial transfer conserva total e recusa transferência implícita de reservas. |
| AC-10 | Corte rectangular com sobras | V | D, FAB | Partição/área/custo/origem/desfazer e reutilização posterior têm testes independentes. |
| AC-11 | Peça com área suficiente mas lado curto | V | D, FAB | Exemplos CALC01 e encaixe por eixos detectam lado curto apesar de área suficiente. |
| AC-12 | Importar CSV italiano | V | SQL | CSV quotes/newlines/decimal comma testado e pré-visualização sem mutação. |
| AC-13 | Cancelar importação | V | SQL | Preview puro; commit atómico rejeita linhas inválidas sem efeitos parciais. |
| AC-14 | Reimportar ficheiro | V | SQL | Digest repetido exige decisão explícita; retry do mesmo comando não cria stock. |
| AC-15 | Criar esquema a partir de imagem | V | ENG, PERF | PNG real 500×500/80 passa worker/UI/SQLite e reabertura; proveniência lida da revisão persistida. |
| AC-16 | Imagem com transparência | V | ENG | Teste original engine is reused exactly for quantization and transparency; brancos válidos distintos de vazio. |
| AC-17 | Cancelar geração e iniciar outra | V | ENG, PERF | Worker real cancelado, preview anterior retido, segunda geração 500×500 guardada; IDs dejob testados. |
| AC-18 | Usar apenas cores existentes | V | ENG | Paleta de holdings usa materialId/unidade elegível e exclui bloqueados/tecido; motor respeita paleta efectiva. |
| AC-19 | Editar e desfazer | IV | ENG, DRAFT | Operações geométricas/recuperação testadas; repetir sequência visual completa com desfazer/refazer no pacote final. |
| AC-20 | Importar PDF sem estrutura reconhecida | V | REF, PERF | PDF real 2 páginas aberto como referência e navegado sem alegar grelha estruturada. |
| AC-21 | Criar projecto do esquema | IV | D, FAB | Associação de projecto/revisão/necessidades implementada; jornada de criação completa precisa de gate final. |
| AC-22 | Gerar lista de compras | IV | D, UI | Falta agregada e compras derivadas testadas; embalagem/arredondamento de todas as unidades ainda parcial. |
| AC-23 | Recepção parcial e repetição de clique | V | D, SQL | Recepção parcial idempotente e rollback SQLite testados; encomenda não recebida não entra no stock. |
| AC-24 | Marcar a mesma região duas vezes | V | D, SQL, PERF | Marca c:3 lida após reabrirSQLite; lotes/movimentos idênticos e repetição deduplicada no domínio. |
| AC-25 | Fechar e retomar | IV | DRAFT, REF, PERF | Progresso/SQLite/PDF recuperam; captura/restauro completo das preferências/posição em todos os editores requer gate final. |
| AC-26 | Mudar desenho de projecto em curso | IV | D, DRAFT | Revisões fixadas não remapeiam progresso; apresentação integral do impacto ainda parcial. |
| AC-27 | Concluir projecto | IV | D, TOOLS, FINISH-PENDING | Fecho simples liberta reservas/ferramentas sem inventar movimento; reconciliação final avançada em integração. |
| AC-28 | Duplicar projecto concluído | V | D | Teste AC28 copia plano/tarefas e exclui execução/reservas/movimentos. |
| AC-29 | Exportar esquema multipágina | IV | ENG | Exportador multipágina e geometria de fronteira testados; inspecção visual completa dos mosaicos pendente. |
| AC-30 | Exportar em ambos os idiomas | IV | I18N, ENG | Labels por idioma existem; exportação real de todos os relatórios nos dois idiomas ainda não executada. |
| AC-31 | Não existir impressora | V | PERF | PDF guardado com diálogo nativo apontado à área sintética; ficheiro real validado sem impressora. |
| AC-32 | Pesquisa e ajuda sem Internet | V | PERF | Pesquisa 20 amostras e páginaHelp executadas com bundle local e sem pedidos HTTP externos observados. |
| AC-33 | Retirar exemplos | C | UI | Não são carregados dados de demonstração; remoção não aplicável ao estado actual. UX04 continua parcial pela falta da área opcional. |
| AC-34 | Stock elegível de 24 m, reservas A=10 m e B=8 m | V | D | AC34–36: físico 24 m, reservas 10+8 m, disponível 6 m exactamente. |
| AC-35 | Consumir 4 m da reserva A | V | D | AC34–36: consumo 4 m liberta sóA; físico 20 m, A6 m, B8 m, livre 6 m. |
| AC-36 | Libertar 3 m da reserva A restante | V | D | AC34–36: libertar 3 m mantém físico 20 m e aumenta livre para 9 m. |
| AC-37 | Q físico elegível=10 m, sem reservas de terceiros; necessidades restantes A=8 m e B=7 m | V | D | AC37/38/66: necessidades 8+7 m partilham 10 m uma vez, falta 5 m. |
| AC-38 | No cenário anterior, as únicas reservas são A=4 m e B=3 m | V | D | AC37/38/66: reservas 4+3 m, livre 3 m, falta agregada mantém 5 m. |
| AC-39 | Repetir confirmação de consumo por retry | V | D, SQL, SEC | Retry idêntico produz um movimento; payload alterado ou revisão obsoleta falha sem escrita. |
| AC-40 | Contagem física inferior às reservas | V | D, TOOLS | Contagem expõe conflito sem roubar reserva; empréstimos/manutenção também permanecem coerentes. |
| AC-41 | Exemplos de CALC-01 | V | D, FAB | Exemplos numéricos de contagem/margens/tecido testados com tolerância explícita. |
| AC-42 | Mistura de dois componentes | P | THREAD-PENDING | Receitas/misturas estão no handoff independente ainda não incluído neste snapshot. |
| AC-43 | Embalagem com conversão desconhecida | V | D, SQL | Conversão inexistente mantém desconhecido; estimativa não inventa quantidade nem zero válido. |
| AC-44 | Moedas distintas | V | D, TOOLS | Custos EUR/USD separados e história imutável; nenhum câmbio automático. |
| AC-45 | Encerramento inesperado | IV | SQL, DRAFT | Atomicidade/autosave/cancelamento do fecho testados em módulos; crash abrupto do pacote final precisa de ensaio próprio. |
| AC-46 | Disco cheio ou pasta sem escrita | IV | SQL, DRAFT | Falhas injectadas mantêm rollback e estado pendente; não foi enchido um disco real nem testada ACL Windows. |
| AC-47 | Motor falha ou bloqueia | IV | ENG, PERF | Erros estáveis e cancelamento real funcionam; bloqueio prolongado/crash de worker no pacote final não exercitado. |
| AC-48 | Backup durante utilização | V | BACK, PERF | Backup nativo do cenário completo validado com base+BLOB e restauro transaccional testado. |
| AC-49 | Backup corrompido/incompatível | V | SQL, SEC, BACK | Backup malformado mesmo com hash correcto/futuro rejeitado; original conserva bytes/estado. |
| AC-50 | Pacote com caminhos perigosos | V | SEC, PKG | Traversal/links/hostestrangeiro e nomes de pacote perigosos rejeitados; pacote não interpreta caminhos como destino. |
| AC-51 | Segunda instância | IV | SEC, WIN | Lock de instância e controlo de revision implementados; segunda instância Windows real não aberta neste runner. |
| AC-52 | Instalação em Windows limpo sem rede | B | WIN | Sem ambiente Windows 11 limpo/offline disponível. |
| AC-53 | Remover acesso ao programa original | IV | ENG, PERF | Motor empacotado é cópia local identificada e funciona sem importar pasta original; acesso OS à pasta original não foi removido nesta medição. |
| AC-54 | Copiar pacote por USB para outro perfil/PC | B | WIN | USB/segundo perfil ou PC limpo não disponíveis; não simular este aceite com simples build. |
| AC-55 | Restaurar backup noutro perfil/PC | B | SQL, WIN | Restauro local real passa, mas ambiente de segundo perfil/PC ainda não disponível. |
| AC-56 | Actualizar instalação com dados | P | WIN, SEC | Versões futuras são recusadas sem escrita; migração real entre duas versões distribuídas e cópia anterior ainda não demonstradas. |
| AC-57 | Reinstalar e desinstalar | IV | WIN | Política de preservar dados configurada; instalação/reinstalação/desinstalação final não executadas aqui. |
| AC-58 | Utilizador Windows com acentos e espaços | B | WIN | Não há perfil Windows sintético com acentos/espaços disponível nesta execução Linux. |
| AC-59 | Teclado e escalas de ecrã | IV | PERF, UI | Teclado no canvas funciona; percursos completos em escalas Windows 100/125/150/200% não testados. |
| AC-60 | Rede bloqueada durante todos os percursos | IV | PERF, SEC | Nenhum pedido HTTP externo observado nas jornadas; bloqueio de rede OS + todas as jornadas Windows ainda pendentes. |
| AC-61 | Dados representativos de PERF-01 | V | PERF | Fixture real 5000/20000/50/51 assets; 20 amostras de pesquisa/filtro, 3 arranques e 5 diagnósticos adicionais registados. Limites falhados explícitos. |
| AC-62 | Segurança dos ficheiros importados | IV | SEC | Casos negativos de tamanho/container/referências/protocolo passam; não equivale a fuzzing universal dos descodificadores. |
| AC-63 | Formato nativo de versão futura | V | ENG, SEC | Formatos de esquema/draft/SQLite/aplicação futuros recusados sem modificar base original. |
| AC-64 | Revisão final do pacote | IV | WIN, DOC | Não foi auditado o pacote Windows final desta revisão; revisão de release precisa de identidade/hash e inventário completo. |
| AC-65 | 24 m físicos, 2 m bloqueados e 18 m reservados sobre material elegível | V | D | AC65: físico 24 m, bloqueado 2 m, elegível 22 m, reserva 18 m, disponível 4 m. |
| AC-66 | Cenário de AC-38, acrescentando reserva de 2 m para C, fora da lista A+B | V | D | AC37/38/66: reserva externa C de 2 m aumenta falta de A+B para 7 m e permanece intacta. |
| AC-67 | Runtime necessário ausente ou abaixo da versão mínima, numa VM controlada | B | WIN | VM controlada com runtimes ausentes não disponível; Electron incorpora runtime mas isso não substitui o ensaio. |

## Desempenho medido e identidade

Superfície: Electron 45 real, protocolo `ricamo://app`, build de produção próprio, Linux/WSL 2 x64. Host AMD Ryzen 5 5600H, 12 processadores lógicos, 8.326.352.896 bytes de RAM (~7,75 GiB), Node 24.22.1. Vários agentes podiam executar builds/testes no mesmo host; essa concorrência é interferência possível, não causa demonstrada de um atraso. Nenhuma instalação Windows limpa é inferida daqui.

Fixture determinístico: 5000 materiais e 5000 lotes em 11 categorias, 26 localizações, 20000 movimentos coerentes, 50 projectos com fotos, 51 anexos geridos (50 PNG+1 PDF real de 2 páginas),500 necessidades, 200 tarefas, 150 sessões e 50 encomendas. Há 295 quantidades desconhecidas e 672 estimadas. Três padrões são reutilizados pelos projectos: 20×20/4 cores, 500×500/**80 cores efectivas**, referência PDF. Os recibos de operações são sintéticos e o estado validado é instalado por restore de teste, nunca como dados de demonstração do produto.

As acções subsequentes são reais na UI; o diálogo de destino de exportação é dirigido à área sintética, mantendo os exportadores/handlers/persistência reais. Tempos vão do gesto Playwright até resultado DOM+2 frames e incluem overhead de automação. A primeira execução não significa cache do sistema operativo vazio. Memória é amostrada cada 250 ms; somar working sets pode contar páginas partilhadas duas vezes e não mede pico real.

| Medição | Resultado | Amostras / limite |
| --- | --- | --- |
| Projectos antes da correcção | mediana 2212 ms; 2059–2460 ms | 5 navegações quentes; runner performance-R8POk4 |
| Projectos após correcção | primeiro 526 ms; mediana 145 ms; 110–161 ms | 5 navegações quentes; performance-3JHhTo |
| Pesquisa de materiais | p50=49 ms; p95=50 ms | 20 após 2 aquecimentos; limite 300 ms |
| Filtro por categoria | p50=66 ms; p95=103 ms | 20 após 2 aquecimentos; limite 300 ms |
| Arranque do cenário optimizado | 4094 ms, 7721 ms, 6193 ms | 3 processos; **2 excederam 5000 ms** |
| Diagnóstico posterior de arranque | 3712–4802 ms; mediana 4037 ms | 5 processos; não apaga as falhas anteriores |
| Abertura SQLite validada no diagnóstico | 1206–1632 ms | 5 medições após janela pronta; leitura simples 62–164 ms |
| Worker 500×500 até preview | 1097 ms | limite 80; paleta DMC produziu 53 cores; input UI respondeu em 212 ms |
| Responsividade durante worker | 37 frames; maior intervalo 234 ms | observação deste ensaio, sem promessa de 60 fps |
| Guardar geração | 3998 ms | persistência real; duas transacções completas no snapshot |
| Marcar progresso e persistir | 2242 ms | readback c:3 e stock/movimentos inalterados |
| Backup nativo | 2850 ms | snapshot validado com todos os BLOB e relações |
| Memória observada | 1615 MiB somados | 131 amostras; não é pico verdadeiro |

Todos os 8 grupos funcionais do runner optimizado passaram, sem erros de página ou pedidos HTTP externos observados. O processo termina com erro quando um orçamento falha; performance-3JHhTo terminou com código 1 pelas duas falhas de arranque. O baseline R8POk4 teve uma expectativa errada do harness (aguardava confirmação para um único ponto, que guarda automaticamente); a versão corrigida prova esse percurso. As falhas iniciais de selector/label também permanecem nos registos brutos, não são atribuídas ao produto.

A melhoria proposta evita construir um Set de 250000 strings em cada resumo de progresso e reutiliza até 32 miniaturas de revisões imutáveis por identidade. Não altera a validação de mutações. O ganho de cache depende da reutilização de revisões; 50 grelhas grandes distintas não foram medidas.

Perfil do Guardar (instrumentação de tempos no Repository, handlers intactos):4035 ms de ponta a ponta, importAsset 1102 ms (inclui attachment.add 1016 ms), pattern.save 1117 ms. Os tempos aninhados não devem ser somados novamente. CPU: structuredClone 338 ms, validação de chaves de progresso 233 ms, validateApplicationState 117 ms, assertSafeJson 84 ms, validateState 79 ms; execute agrega 446 ms de trabalho incluindo serialização/SQL. Os ~1816 ms restantes incluem bridge/IPC, adopção/render da UI e automação; não foi isolado um custo puro de IPC. A operação atómica única de imagem+esquema é uma melhoria a investigar e reduz também o risco de anexo órfão.

| Identidade do ensaio optimizado | SHA-256 |
| --- | --- |
| core | `eb41c108f55bbb8837bdc4a3a191fd7b2b65aa85d4c6bbefd0a67bb58e630940` |
| desktop | `3f0d5210662be054444905d4f6103599acabdec5452d598fca6aa31eefe28ba8` |
| src | `b9b2a55b36d43f488f0c3e2a2082da2d74296cd76ec31c74969f3682ff9b3c18` |
| dist | `acca9a257c4580b0a19f6880c72aa47d08598eb157375ad149e6bb9162167e15` |
| Executável Electron Linux | `b36c3ce9b423098a7854f4912f730b0654b41ae183818f887b8f1cd0a90725eb` |
| Fixture | `e94a30c7e5e5b6743c42ce51786883a4e3a155ff78cdff1f66d5252130e46b4a` |

Registos externos ao Git: performance-R8POk4/result.json, performance-3JHhTo/result.json, performance-3JHhTo/startup-phases.json, save-profile-r8HHXU/result.json e os perfis CPU completos. Incluem hashes individuais, ambiente, medições, capturas e readback. Dados sintéticos e artefactos não entram na distribuição.

## Repetição final do runner

A versão final acrescentou espera explícita pelo título da área de destino e tempos separados de lançamento/janela/render. O ensaio **performance-BzAoz6**, de 10:51:20 a 10:52:35 UTC, terminou com **código 0**, oito grupos funcionais verificados, nenhum erro de página ou pedido HTTP externo observado. Os três arranques foram **4683 ms, 3916 ms e 3625 ms**. Isso confirma esta repetição; não elimina as duas falhas de orçamento anteriores nem prova um ambiente Windows limpo.

| Medição final | Resultado | Amostras |
| --- | --- | --- |
| Projectos | primeiro 428 ms; p50 quente 113 ms | 1 primeiro + 5 quentes |
| Pesquisa | p50 49 ms; p95 65 ms | 20 após aquecimento |
| Filtro | p50 82 ms; p95 116 ms | 20 após aquecimento |
| Worker até preview | 1032 ms; 53 cores com limite 80 | 1 geração após cancelar/reiniciar |
| Frames durante worker | 38; maior intervalo 200 ms | observação amostrada |
| Guardar geração / progresso | 4565 ms / 2437 ms | persistência e readback reais |
| Backup | 3311 ms | validado com base e anexos |
| Memória observada | 1626 MiB somados | 151 amostras; não é pico real |

Os hashes do código da aplicação/build coincidem com o ensaio optimizado acima. A cópia exacta do runner executado e harness-identity.json estão junto deste último resultado; a única alteração posterior acrescenta os hashes do próprio runner/helper ao JSON das futuras execuções. O controlo de identidade do pacote lê app.asar e rejeita divergências antes de iniciar o executável. A leitura do pacote Windows preliminar foi verificada, mas esse pacote não foi executado aqui.

## Repetição e gates seguintes

No workspace integrado: `npm test`, `npm run build`, depois `node tests/performance.mjs`. O runner cria uma pasta única em `.runtime`, não abre dados do utilizador, e guarda result.json mesmo após falhas de grupos. Para pacote Windows usar PowerShell: `$env:RICAMO_EXECUTABLE="C:\caminho\win-unpacked\Ricamo.exe"; node tests/performance.mjs`. Executar com Node 24 de desenvolvimento serve apenas ao ensaio; o utilizador final não precisa desse runtime. O runner recusa diferenças entre core/desktop/dist do workspace e do app.asar para evitar atribuir resultados a código diferente.

Antes de fechar a missão: integrar e verificar os handoffs, repetir arranque numa janela sem builds concorrentes, executar o runner contra o pacote Windows exacto, completar documentação/guias/formatos, e obter os ambientes necessários para AC52/54/55/58/67. Falta de ambiente não deve ocultar funcionalidades obrigatórias ainda pendentes.

## Capacidades condicionadas

OCR de grelhas, códigos de barras/câmara, PES/DST/formatos de máquina, IA local, sincronização/rede, alfabeto de texto em pontos e escala física 1:1 só podem ser anunciados quando implementados e verificados; não são substitutos das funções manuais obrigatórias. A referência visual/PDF local e a introdução manual são as alternativas actuais. A assinatura depende de certificado autorizado; a distribuição deve declarar sem assinatura e publicar hashes verificáveis.
