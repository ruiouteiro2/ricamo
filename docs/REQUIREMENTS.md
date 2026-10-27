# Matriz de requisitos e evidência — Ricamo

Reconciliação de 27-10-2026 para a fonte Ricamo 0.4.0. **Validação delimitada do candidato 0.4.0 no host Windows 10; não certifica todos os ambientes ou combinações.** Contrato: RICAMO_CODEX_MASTER_PROMPT.md, SHA-256 `15bea1805873ab3d7b102971f7d58e974b165dfc8c8b955ac04f69a8754b74ef`. Cobertura mecânica: **111 requisitos funcionais e AC-01 a AC-67, sem omissões nem duplicados**.

Esta atualização reconcilia as cinco lacunas funcionais trabalhadas para 0.4: THR-03, GEN-02, EDIT-02, EDIT-06 e CALC-01. As provas distinguem candidatos isolados e a integração final: 438 testes e 28 jornadas Windows passaram no artefacto auditado, com lifecycle, segunda instância e escala separados. Não somar suites sobrepostas nem converter IV/B de ambiente, acessibilidade ou distribuição em aprovação global. O glossário dos guias foi ampliado, sem declarar revisão terminológica integral.

## Estados

| Estado | Interpretação |
| --- | --- |
| V | Implementado e verificado **na superfície indicada**. Não implica Windows, auditoria integral ou ausência universal de bugs. |
| IV | Implementado, mas falta o percurso completo, o candidato exato ou a plataforma exigida. |
| P | Existe uma lacuna funcional/documental obrigatória concreta, identificada na linha. |
| B | O cenário depende de ambiente externo indisponível identificado; não substitui uma aprovação técnica. |
| C | Condicional e não aplicável nas condições descritas; nunca dispensa um requisito obrigatório. |

Um requisito amplo pode continuar P/IV mesmo quando os seus casos de domínio passam. Os testes numéricos AC-34–44/65–66, por exemplo, não provam por si só toda a experiência de inventário.

## Índice de evidência

| Código | Prova e âmbito | Implementação / testes reproduzíveis |
| --- | --- | --- |
| D | Suite integrada do domínio; resultado final identificado abaixo. Invariantes, identidade, precisão e desconhecidos. | [application](../core/application.mjs), [domain tests](../tests/domain.test.mjs) |
| SQL | SQLite real, reopen, rollback e backup/restauro; IndexedDB em jornadas browser distintas. | [Repository](../desktop/repository.mjs), [persistence tests](../tests/persistence.test.mjs) |
| ATOMIC | Transação metadata+BLOB+owner/lote, sessão e guards; 98 testes focados na revisão independente, incluindo 4 novos. Negativa IPC real dos 4 comandos internos; native integrado attachments-native-qywV1n. | [entity assets](../core/entity-assets.mjs), [atomic tests](../tests/atomic-entity.test.mjs), [native runner](../tests/desktop-attachments.mjs) |
| ENG | Core original/adapter/worker, 500×500/80, paleta de 5000 holdings, cleanup protegido, motivos/texto e identidade. | [adapter](../src/engine/adapter.mjs), [engine tests](../tests/engine.test.mjs), [scale tests](../tests/generator-scale.test.mjs), [audit](ENGINE-AUDIT.md) |
| INV | Jornadas reais de inventário, categorias, entrada rápida/lote, filtros, etiquetas e stock; não equivale ao pacote final. | [inventory workflows](../core/inventory-workflows.mjs), [inventory tests](../tests/inventory-workflows.test.mjs) |
| DESC | Descritores tipados de categorias/lotes e CSV com preservação de metadata; native material-descriptors-YK7F2n com readback. | [descriptors](../core/material-descriptors.mjs), [descriptor tests](../tests/material-descriptors.test.mjs), [native runner](../tests/desktop-material-descriptors.mjs) |
| FAB | Domínio e jornada browser de reserva/região/corte, overlap, custo e reversão condicionada. | [fabric planning](../core/fabric-planning.mjs), [tests](../tests/fabric-planning.test.mjs) |
| TOOLS | Domínio e jornada browser de empréstimos, perda, devolução, manutenção e lembretes. | [tool activity](../core/tool-activity.mjs), [tests](../tests/tool-activity.test.mjs) |
| KIT | Coleções virtuais, declaração/verificação e abertura física; revisão independente de recibos; native kits-cSJDs3. | [kit workflows](../core/kit-workflows.mjs), [kit tests](../tests/kit-workflows.test.mjs), [native runner](../tests/desktop-kits.mjs) |
| THREAD | Receitas/componentes, estimativas configuráveis/calibradas e invalidação/histórico tipado; browser real e regressões de domínio. | [recipes](../core/thread-recipes.mjs), [estimate workflow](../core/thread-estimate-workflow.mjs), [history](../core/thread-estimate-history.mjs) |
| PLAN | Manual/medida, checklists CRUD/apply/delete e PDF de desconhecido; native planning-NfDMyj com reload/restart/SQLite e zero HTTP/erros. | [forecast](../core/project-forecast.mjs), [templates](../core/checklist-templates.mjs), [native runner](../tests/desktop-planning.mjs) |
| WORK | Contexto, marcadores revisionados, cor/tipo, teclado/undo e fecho/reopen; native integrado work-companion-CLWqSp e work-review-SPGE8D. | [work companion](../core/work-companion.mjs), [tests](../tests/work-companion.test.mjs), [native runner](../tests/desktop-work-companion.mjs) |
| REF | PDF multipágina, anotações/posição/bookmarks, original e exportação; journeys Linux e pacote Windows anterior. | [reference reader](../src/components/ReferenceReader.vue), [reference tests](../tests/references.test.mjs), [documents runner](../tests/desktop-documents.mjs) |
| DRAFT | Acknowledgement, coalescência, falha/retry e recuperação; fecho nativo pendente e saída após confirmação. | [autosave](../src/editor-draft.mjs), [draft tests](../tests/editor-draft.test.mjs), [native runner](../tests/desktop-drafts.mjs) |
| OUT | PDFs reais/Unicode, mosaicos, escala/calibração; export-cancel-H0kg7A comprova cancelar/repetir sem sucesso fictício. | [pattern export](../src/pattern-export.mjs), [physical print](../src/physical-print.mjs), [cancel runner](../tests/desktop-export-cancel.mjs) |
| OPEN | data-exports-mpFTwD: 12 ficheiros reais, parsing/readback, CSV/TSV/JSON, IT e cancelamento; inventário inalterado. | [open exports](../core/open-exports.mjs), [native runner](../tests/desktop-data-exports.mjs) |
| PKG | project-transfer-F5GwI9: Electron Linux (prova funcional; ver ressalva de sandbox), SQLite/BLOB, blends, privacidade/IDs/tecido/reexportação. Marcadores opcionais têm novos testes separados. | [package](../core/project-package.mjs), [transfer service](../desktop/project-transfer.mjs), [tests](../tests/project-package.test.mjs) |
| EXAMPLE | example-studio-C4BonS: arranque/material, sessão/IndexedDB separados, fecho/reopen, pending draft e backup pessoal invariantes. | [example](../desktop/example-studio.mjs), [native runner](../tests/desktop-example.mjs) |
| BACK | Snapshots/retention, backup anterior a restore, erro do segundo destino preservando local e restore atómico. | [backup manager](../desktop/backup-manager.mjs), [tests](../tests/backup-manager.test.mjs) |
| SEC | Negativos de path/protocolo, frame errado, capacidades/commands, tipos/limites, versões futuras e restore. Não é fuzzing universal. | [main](../desktop/main.mjs), [protocol](../desktop/protocol.mjs), [security tests](../tests/security.test.mjs), [image tests](../tests/images.test.mjs) |
| I18N | Dicionários IT/EN, valores/códigos/datas e trocas reais em formulários; guias com nomes dos controlos conferidos mecanicamente. | [i18n](../src/i18n.js), [additional strings](../src/i18n-extra.json), [IT guide](USER-GUIDE-IT.md), [EN guide](USER-GUIDE-EN.md) |
| UI | Jornadas reais enumeradas; layout/teclado/foco cobertos parcialmente. Limite de janela respeita área útil, sem alegar todos os DPI. | [App](../src/App.vue), [styles](../src/styles.css), [window bounds](../desktop/window-bounds.mjs) |
| PERF | Medições com hashes/fixture, incluindo falhas históricas e Windows 0.2.0 aprovado; superfícies separadas abaixo. | [runner](../tests/performance.mjs), [fixture](../tests/performance-fixture.mjs) |
| WIN-PERF | performance-1Cyds6: Windows 10 x64, 0.4 auditado; oito grupos aprovados, zero erros/HTTP, medição com sandbox OS ativo. Não prova 8 GB ou PC limpo. | [runner](../tests/performance.mjs), [STATUS](STATUS.md) |
| WIN-OLD | Windows 10 Home x64 build 19045 real: instalador anterior, caminho acentuado/com espaços, geração/PDF/backup/readback. **Prova histórica, separada de WIN04.** | [package](../package.json), [STATUS](STATUS.md), [smoke runner](../tests/desktop-smoke.mjs) |
| DOC | Fonte/lock/licenças e guias/arquitetura/motor/formatos/materiais inspecionados; conteúdo do pacote final separado. | [README](../README.md), [architecture](ARCHITECTURE.md), [formats](DATA-FORMATS.md), [materials](MATERIALS.md), [notices](../THIRD-PARTY-NOTICES.md) |
| LIBMETA | Metadata/coleções/favoritos/histórico, backup/pacote; native isolado library-ks9aZB, código integrado. | [library](../core/pattern-library.mjs), [tests](../tests/pattern-library.test.mjs), [runner](../tests/desktop-library-details.mjs) |
| COUNT | Inventário parcial e conflitos/reservas; stock-count-yjeiWH e revisão independente preview-HNI00e isolados, regressões integradas. | [counts](../core/stock-count.mjs), [tests](../tests/stock-count.test.mjs), [review tests](../tests/stock-count-review.test.mjs) |
| OPDOC | Owners estritos de compra/receção/localização, bytes e histórico; owner-documents-E9aGZ6 isolado e testes integrados. | [owners](../core/owner-documents.mjs), [tests](../tests/owner-documents.test.mjs), [runner](../tests/desktop-owner-documents.mjs) |
| PDFOPT | Orientação/margens reais e categorias de motivos; oito PDFs parseados e native isolado pdf-motifs-8SspnZ. | [tests](../tests/pdf-motif-options.test.mjs), [runner](../tests/desktop-pdf-motifs.mjs) |
| BOUNDS | Bounds/medidas físicos; design-size-duFLjb isolado com PDF/reopen/imutabilidade e sandbox explícito/flags/Seccomp 2/NoNewPrivs 1 em ambas as aberturas. | [helper](../core/design-size.mjs), [tests](../tests/design-size.test.mjs), [runner](../tests/desktop-design-size.mjs) |
| SUPPORT | Modelos CSV vazios e diagnóstico sanitizado com preview; fonte/testes integrados, prova nativa final por fixar. | [templates](../core/csv-template.mjs), [diagnostics](../core/diagnostics.mjs), [tests](../tests/support-data.test.mjs), [runner](../tests/desktop-support.mjs) |
| SPACE | Preflight de espaço para backup/restauro, falha fechada e testes determinísticos; não equivale a disco Windows realmente cheio. | [space guard](../desktop/disk-space.mjs), [tests](../tests/disk-space.test.mjs) |
| WIN-UPGRADE | installed-upgrade-proof-040: upgrade 0.2→0.4, edição/reopen, reinstalação 0.4 e uninstall; estado/originais preservados e identidade exata. Históricos 0.1→0.2 e 0.2→0.3 retidos. | [PowerShell](../tests/windows-upgrade.ps1), [runner](../tests/desktop-upgrade.mjs) |
| GENOPT | Fundo alpha/composição, cores fixadas/excluídas e comparação real; generator-options-jXbcXO isolado com sandbox explícito, worker, save/reopen e originais. | [tests](../tests/generator-options.test.mjs), [runner](../tests/desktop-generator-options.mjs) |
| BATCH | Importação PDF/imagens 20/100 MiB, resultado por item/duplicates/retry/close; reference-batch-CPuwDQ isolado, bytes SQLite; sandbox solicitado, sem flag de desativação, métrica Linux indisponível. | [batch](../src/reference-import.mjs), [tests](../tests/reference-batch.test.mjs), [runner](../tests/desktop-reference-batch.mjs) |
| REFLINK | Bibliografia local/pages/inversos/backup e exclusão de pacotes; catalogue-references-MBC6s6 isolado, código e regressões integrados. | [references](../core/catalogue-references.mjs), [tests](../tests/catalogue-references.test.mjs), [runner](../tests/desktop-catalogue-references.mjs) |
| LABEL | Etiquetas dimensionadas/projecto/content-fit; label-options-Z7rhR2 isolado com sandbox explícito, PDFs parseados e SQLite invariável. | [labels](../src/inventory-labels.mjs), [tests](../tests/label-options.test.mjs), [runner](../tests/desktop-label-options.mjs) |
| BGCTR | Root background-center-TWnuJJ: remoção opaca, branco encerrado, refresh 40→1→40, centro/paridade/coordenadas, original, reopen/SQLite; sandbox solicitado sem --no-sandbox. | [mask](../src/engine/background.mjs), [tests](../tests/background-removal.test.mjs), [runner](../tests/desktop-background-center.mjs) |
| GEOM | Candidato isolado fabric-geometry-XBXVUV: polígonos, área/união, colisões, PDF, corte fracionário/undo, SQLite e backup real; 43 testes focados e 411 na sua suite. | [geometry](../core/fabric-geometry.mjs), [tests](../tests/fabric-geometry.test.mjs), [runner](../tests/desktop-fabric-geometry.mjs) |
| REVIMP | Candidato isolado revision-impact-soCRnL: preview/cancel/stale/carry, necessidades, contexto antigo, reload/reopen; 13 regressões e revisão independente de identidade/filamentos/replay/stock. | [review](../core/revision-impact.mjs), [matching](../core/revision-progress.mjs), [tests](../tests/revision-impact.test.mjs), [runner](../tests/desktop-revision-impact.mjs) |
| TCAT | Candidato isolado thread-catalogues-3RkNaN: versões/import/export, worker, substituição, projeção portátil conservadora e SQLite; 7 regressões e 404 na sua suite. | [catalogues](../core/thread-catalogues.mjs), [tests](../tests/thread-catalogues.test.mjs), [runner](../tests/desktop-thread-catalogues.mjs) |
| WIN03 | Candidato Windows 0.3 passou 24 jornadas nativas; instalador reprovado na auditoria de conteúdos por extras/cache e isolado. Allowlist corrigida; não é aprovação do pacote 0.4. | [release audit](../build/release-audit.mjs), [STATUS](STATUS.md) |
| WIN04 | 28 jornadas nativas no Windows 10 x64 0.4; resultados e retry explícitos em windows-040-final-results.json. | [STATUS](STATUS.md) |
| PKG04 | Instalador auditado; core/desktop/dist exatos, 51 pacotes e 74 avisos, manifesto e SHA256 locais. | [audit](../build/release-audit.mjs), [STATUS](STATUS.md) |
| WIN-LOCK | instance-lock-RRKr3q e desktop-smoke-JfVb9p: segunda instância/SQLite e escala 150% reais no candidato 0.4. | [instance runner](../tests/desktop-instance-lock.mjs), [smoke](../tests/desktop-smoke.mjs) |
| LEDGER | Comparação mecânica dos IDs extraídos do master e das duas tabelas deste documento. Não aprova as capacidades automaticamente. | [matriz](REQUIREMENTS.md) |

Os identificadores de execução acima referem ficheiros brutos em `.runtime/<identificador>/result.json`, ou no draft isolado quando explicitado. Esses artefactos não entram no instalador. Há controlo de origem/hashes nos runners relevantes; ausência de erro num cenário não se generaliza aos restantes.

## Resultado integrado final

Fonte integrada: **438/438 testes**. Windows 0.4: **28/28 jornadas distintas**, registadas em `.runtime/windows-040-final-results.json`; 27 passaram na primeira passagem e o teste Ricama passou após adaptar a confirmação ao novo fluxo de revisão, sem alterar o produto. ASAR SHA-256 `fcd8ea523086b8d78dd34c395d8b8c26b9b27b6fe241e1dcdc2ce7a4266a1479`; instalador `a73afa857fde4d03bf28bfc9aaef50d4b15d2d7f49ec82f63bb89f9ad7529c34`. Segunda instância, escala 150%, upgrade/reinstalação/desinstalação e benchmark passaram separadamente; detalhes em STATUS. As contagens sobrepostas não são somadas.

O candidato Windows 0.3 passou **24 jornadas nativas**, mas o instalador foi **reprovado e isolado** porque incluía ficheiros extra/cache. A allowlist de empacotamento foi corrigida; os passes funcionais anteriores não anulam essa reprovação nem aprovam um novo artefacto. O pacote 0.4 recebeu auditoria e provas próprias, identificadas em WIN04/PKG04.

O upgrade sintético instalado 0.1→0.2 preservou estado e bytes, registro/atalhos/ASAR e passou edição UI/reopen. Essa evidência histórica mantém-se válida no seu âmbito, sem certificar update/reinstall/uninstall do candidato 0.4. Os benchmarks 0.2 abaixo também permanecem históricos e delimitados.

**Correção das provas Linux:** o Playwright instalado injeta --no-sandbox em Electron Linux quando chromiumSandbox não é explicitamente true. Os ensaios antigos continuam a provar funcionalidade, persistência e as preferências BrowserWindow, mas não o sandbox do sistema operativo. As novas provas que o verificam dizem-no expressamente, como BOUNDS. A injeção é específica de Linux; não invalida a prova funcional instalada Windows. Não generalizar um resultado de segurança a todos os runners.

## Requisitos funcionais e de entrega

| ID | Requisito | Estado | Prova | Cobertura e limite atual |
|---|---|---|---|---|
| BASE-01 | Aplicação completa com uma interface nova, destinada a utilização diária por uma pessoa não técnica. | IV | UI, DOC, WIN04 | Interface e funções avançadas concluídas; 28 jornadas Windows verificadas. Avaliação humana integral de facilidade de uso e ambientes externos continuam delimitados. |
| BASE-02 | Italiano e inglês em toda a experiência, incluindo ajuda, erros, exportações e documentação de utilização. | IV | I18N, DOC, OUT | Guias IT/EN, ajuda, formulários e exportações bilingues existem; revisão linguística integral e pacote final ainda não certificados. |
| BASE-03 | Inventário abrangente de materiais, ferramentas, kits, tecidos, referências e acabamentos. | IV | INV, DESC, KIT, FAB, TOOLS | Categorias, descritores, lotes, tecidos, ferramentas e kits integrados; publicação→projeto e documentação de compras continuam parciais. |
| BASE-04 | Gestão de projectos desde a ideia até ao acabamento e arquivo. | V | PLAN, WORK, D | Preparação, execução, previsão, acabamento, fecho, arquivo e repetição verificados no domínio e em jornadas locais. |
| BASE-05 | Geração real de esquemas através do motor existente, com integração independente da interface antiga. | V | ENG, WIN04, WIN-PERF | Motor original real reutilizado em worker; geração e persistência, incluindo 500×500, verificadas no Windows 0.4. |
| BASE-06 | Editor de esquemas, acompanhamento do bordado e impressão/exportação utilizáveis. | IV | ENG, WORK, OUT | Editor/progresso/exportadores utilizáveis; opções obrigatórias de edição/paginação e ensaio final Windows ainda incompletos. |
| BASE-07 | Dados locais persistentes, cópias de segurança, restauro e transferência para outro computador. | IV | SQL, BACK, PKG | SQLite, BLOB, backup/restauro e pacotes verificados localmente; segundo PC/perfil Windows continua sem prova. |
| BASE-08 | Instalador Windows .exe que inclua as dependências necessárias e funcione sem Internet. | IV | WIN04, PKG04 | Instalador 0.4 auditado e instalado no Windows 10, com runtime incluído; execução sem pedidos HTTP observados. Instalação limpa com rede OS bloqueada não executada. |
| BASE-09 | Verificação de funcionamento no pacote instalado, incluindo uma instalação num ambiente Windows limpo. | B | WIN-OLD | Não existe ambiente Windows 11 limpo/offline disponível; testes no host de desenvolvimento não substituem esse aceite. |
| BASE-10 | Código completo, instruções de build, licenças, testes e relatório factual de entrega. | V | DOC, D, PKG04 | Código, lockfile, licenças, guias, build, matriz, manifesto e hashes entregues; âmbito e limitações documentados. |
| ENG-01 | Auditoria inicial | V | ENG, DOC | Auditoria publicada com hash original reconfirmado, dependências resolvidas, algoritmos, limites, alterações e licenças. |
| ENG-02 | Reutilização efectiva | V | ENG | Adapter chama convert herdado; comparação de resultados, transparência e identidade do snapshot têm regressões. |
| ENG-03 | Contrato da integração | V | ENG, DOC | Contrato de RGBA/settings/paleta/revisão, erros, versões, unidades e proveniência documentado e validado. |
| ENG-04 | Execução controlada | V | ENG, WIN-PERF | Worker/job ID/cancelamento/reinício e UI responsiva passaram no candidato Windows 0.2.0; 500×500 gerado pelo motor real. Não garante tempos universais. |
| UX-01 | Organização pelas tarefas da pessoa | IV | UI, EXAMPLE | Áreas orientadas às tarefas e exemplo guiado exercitados; compreensão por utilizador não técnico não foi avaliada independentemente. |
| UX-02 | Divulgação progressiva | IV | INV, DESC, UI | Campos opcionais/avançados, desconhecidos e entrada rápida existem; cobertura de todas as variantes de formulário permanece parcial. |
| UX-03 | Operações previsíveis | IV | ATOMIC, WORK, OUT | Pré-visualizações, cancelamento, confirmação, retry e undo cobertos em fluxos concretos; não há auditoria exaustiva de todas as ações. |
| UX-04 | Primeiro arranque | V | EXAMPLE | Primeiro arranque e material real; exemplo em janela/armazenamento separado, fecho/reabertura e backup pessoal sem dados de exemplo verificados. |
| UX-05 | Ajuda contextual | IV | UI, DOC, EXAMPLE | Ajuda pesquisável offline, exemplos práticos e guias IT/EN presentes; não foi certificada cobertura de toda a ajuda contextual. |
| I18N-01 | Cobertura | IV | I18N, DOC, OUT | UI/ajuda/guias e documentos IT/EN existem; revisão integral do instalador/desinstalador e todos os textos finais pendente. |
| I18N-02 | Comportamento | IV | I18N, PLAN, WORK, OPEN | Mudança em formulários preserva valores; datas, vírgula decimal, códigos e TSV verificados. Pluralização/terminologia total ainda sem auditoria. |
| I18N-03 | Glossário de base | IV | I18N, DOC | Glossário breve bilingue acrescentado aos dois guias; códigos e unidades preservados. Revisão terminológica integral e todas as variantes continuam por executar. |
| INV-01 | Separar produto, existência e movimento | V | D, SQL, ATOMIC | Catálogo, lotes e movimentos distintos; fusão preserva referências; owner/lote/anexos agora gravam atomicamente. |
| INV-02 | Categorias extensíveis | V | INV, DESC | Categorias/campos pessoais, identidade estável e validação de propriedades executados; descritores não substituem relações essenciais. |
| INV-03 | Campos comuns | V | INV, DESC, ATOMIC | Campos comuns, variantes/estado, descritores tipados e anexos ligados ao owner verificados; desconhecido não vira zero. |
| INV-04 | Operações de utilização diária | V | INV, DESC, OPEN, OPDOC | Entrada rápida/lote/filtros/fusão/contagem/exportação e fotos/documentos próprios da localização integrados; jornada nativa e bytes/reopen no candidato isolado. |
| THR-01 | Tipos de linha | IV | DESC, INV | Composição, filamentos, embalagem, tamanho, efeitos, descontinuação/substituição e condição do lote existem; variantes completas não foram todas exercitadas na UI. |
| THR-02 | Quantidades e conversões | V | D, THREAD | Unidades de fio/filamento, embalagens explícitas, confiança e conversões desconhecidas preservadas sem duplicar stock. |
| THR-03 | Catálogos e cores | V | ENG, TCAT | Versões locais imutáveis com origem/licença/digest, seleção no gerador/editor e comparação CIE76+inventário/unidades. Candidato isolado verificado; sem equivalência oficial nem novo catálogo de fabricante inferido. |
| THR-04 | Misturas | V | THREAD, PKG | Receitas de filamentos inteiros, símbolos e necessidades por componentes verificadas; não criam stock fictício nem mistura física automática. |
| FAB-01 | Tipos e identificação | IV | DESC, FAB | Composição/textura/tratamento/lavagem/identificação disponíveis; amostra de categorias validada, sem prova de toda a diversidade têxtil. |
| FAB-02 | Dimensões e contagem | IV | DESC, FAB, GEOM | Contagens por eixo, margens e área após formas medidas implementadas; geometria automática tem prova isolada. Toda a diversidade têxtil/formulários não foi exercitada integralmente. |
| FAB-03 | Verificação de adequação | V | FAB, GEOM | Encaixe por dimensão/rotação/densidade e posição candidata sem colisões conhecidas. Busca limitada devolve desconhecido quando não prova posição; não afirma empacotamento geral nem mede fotografias. |
| FAB-04 | Plano e confirmação de corte | V | FAB, GEOM | Reserva e corte retangular recusam defeitos/contorno/margens conhecidos; sobras conservam frame/offset, área útil e custos, com undo condicionado. Corte físico de peças irregulares permanece manual. |
| TOOL-01 | Ferramentas reutilizáveis | V | TOOLS | Reservas, empréstimos, devoluções, perda, manutenção e alertas verificados; ferramentas não são consumidas como linha. |
| MAT-01 | Preparação | IV | DESC, INV | Preparação/estabilização têm composição, remoção, prazo e notas; dados específicos integrados, sem jornada nativa de cada material. |
| MAT-02 | Adornos | IV | DESC, INV | Tamanho, forma, acabamento, lotes/unidades e substituição disponíveis; comparação completa de todos os adornos não certificada. |
| MAT-03 | Acabamento e entrega | V | PLAN, D | Materiais de acabamento entram no plano/orçamento/consumo; cuidados, entrega e passos finais persistem sem consumo fictício. |
| KIT-01 | Kits comprados e kits montados pela pessoa | V | KIT, ATOMIC | Coleções virtuais, conteúdo declarado/verificado, reservas e abertura física com verificação tardia exercitados; custo comum separado. |
| REF-01 | Livros, revistas e referências | V | REFLINK, DESC | Publicações sem posse ligadas a esquemas/projetos com páginas e inversos navegáveis; backup conserva, pacote exclui e rejeita links locais forjados. Domínio e jornada nativa isolada. |
| LOC-01 | Localização física | IV | INV, D | Hierarquia, pesquisa/conteúdo, transferências e etiquetas dimensionáveis existem; cobertura de todos os percursos de teclado/projeto/retalho pendente. |
| STOCK-01 | Movimentos | V | D, SQL | Entradas, consumo, perda, descarte, transferência, contagem e reversão conservam histórico e persistência. |
| STOCK-02 | Regras invariantes | V | D, SQL, ATOMIC | Não-negatividade, reservas de terceiros, consumo e retry atómico cobertos; rejeições deixam o estado anterior intacto. |
| STOCK-03 | Necessidades e compras sem dupla contagem | V | D, THREAD | Procura agregada partilha stock uma vez, separa recebido de encomendado e mantém falta desconhecida quando necessário. |
| STOCK-04 | Contagem física | V | COUNT, INV | Contagem parcial por material/categoria/local descendente, diferenças e conflitos por projeto; manter/redistribuir explícito, replay/rollback e revisão independente. |
| BUY-01 | Lista de compras | IV | D, OPEN | Compras manuais/derivadas, embalagens, parcial/retry e exportação existem; alternativas aprovadas e todos os estados ainda sem jornada integral. |
| BUY-02 | Fornecedores e documentos | V | UI, OPDOC | Fornecedor/contacto/URL/histórico e faturas/recibos/documentos de receção com owner estrito e bytes atómicos; regressões integradas e jornada nativa isolada. |
| COST-01 | Custos claros | IV | PLAN, KIT, D | Custos consumidos/previstos/comprometidos separados por moeda, orçamento e relatório; custo comum dos kits continua sem imputação automática. |
| LIB-01 | Organização | V | LIBMETA, REF | Metadata/coleções/favoritos/filtros e utilização atual/histórica integrados; conservação em backup/pacote e jornada nativa com SQLite no candidato isolado. |
| LIB-02 | Tipos de conteúdo | V | REF, ENG, ATOMIC | Original, referência, geometria editável, exportação e foto mantêm semânticas distintas; PDF não é inferido como grelha. |
| LIB-03 | Importação segura e duradoura | V | BATCH, SEC, REF, ATOMIC | PDF/imagens múltiplos com validação/limites, decisão de duplicado, resultado por item, stop/retry/reload; cada original+referência atómico. Formatos estruturados adicionais mantêm importação individual. |
| LIB-04 | PDF de referência | V | REF, WIN-OLD | PDF local multipágina, zoom/posição, notas/realces/bookmarks e exportação preservam camada separada e original. |
| GEN-01 | Percurso principal | V | ENG, PERF, WIN-OLD | Imagem→preparação→dimensões em pontos→motor→preview→guardar→editar executado; entrada física alternativa não existe. |
| GEN-02 | Preparação da imagem | V | ENG, GENOPT, BGCTR | Preparação/original e máscara opcional com quatro vizinhos de fundo ligado aos bordos, tolerância 0–80 CIE76, branco encerrado e preview conforme grelha verificados; não é recorte semântico. |
| GEN-03 | Configuração do esquema | V | ENG, GENOPT | Grelha/dimensões físicas derivadas, limites/paleta/restrições reais e comparação anterior×atual; só resultado atual guardável. Entrada cm não oferecida; regra de arredondamento é condicional a essa conversão. |
| GEN-04 | Relação com o inventário | IV | ENG, THREAD, D | Catálogo, inventário exclusivo e preferência real testados; suficiência é analisada depois no projeto, não no mesmo preview. |
| GEN-05 | Qualidade e revisão | IV | ENG | Pontos isolados, cores residuais, limpeza/proteção e contagens verificados; deteção específica de detalhes perdidos por resolução baixa continua limitada. |
| GEN-06 | Trabalhos e reprodução | V | ENG, PERF | Worker cancelável, resposta por job ID, parâmetros efetivos, versões/proveniência e preservação de resultado válido verificados. |
| EDIT-01 | Modelo estruturado | V | ENG, D | Modelo estruturado versionado independente da UI e da execução; geometria/paleta/primitivas têm validação e testes. |
| EDIT-02 | Operações obrigatórias | V | ENG, DRAFT, WORK, BGCTR | Operações anteriores mais salto por coordenadas também no desenho, centro geométrico/guia opcional e foco/viewport em grelha par×ímpar; navegação não altera revisão ou stock. |
| EDIT-03 | Tipos de ponto | V | ENG | Cruz/meio/backstitch distintos; outros pontos rejeitados sem achatamento silencioso. Geração e editor têm capacidades declaradas separadas. |
| EDIT-04 | Paleta e símbolos | IV | ENG, THREAD, OUT | Símbolos, receitas e fontes locais verificados; revisão visual completa de cada símbolo/todas as saídas monocromáticas não efetuada. |
| EDIT-05 | Motivos e texto | V | ENG, PDFOPT | Motivos pessoais nomeados/categorizados/filtrados/inseríveis e alfabeto local real; validação/backup legado e jornada nativa no candidato isolado. |
| EDIT-06 | Revisões | V | DRAFT, WORK, THREAD, REVIMP | Preview antes/depois de dimensões/materiais/estimativas/necessidades/reservas/consumo; reset por defeito, carry opcional só de correspondência única provada, stale/replay/histórico. PDFs antigos não mudam; páginas futuras dependem das opções ainda não escolhidas. |
| PROJ-01 | Ficha e estados | V | D, PLAN, ATOMIC | Ficha/estados, revisão, notas, materiais e fotografias locais persistem; pode usar referência ou nenhum esquema. |
| PROJ-02 | Planeamento | IV | FAB, THREAD, TOOLS, D | Tecido, receitas por tipo, necessidades, desconhecidos, reservas, ferramentas e compras integrados; todas as substituições posteriores não exercitadas em conjunto. |
| PROJ-03 | Preparação | V | PLAN | Modelos incluídos IT/EN e CRUD pessoal, reordenação, pré-visualização/aplicação e preservação de tarefas concluídas verificados. |
| PROJ-04 | Execução | IV | WORK, PLAN, ATOMIC | Progresso, sessões corrigíveis com fotos, cronómetro e consumo separado verificados; suspensão real do PC e todas as substituições ainda sem jornada final. |
| PROJ-05 | Conclusão e acabamento | V | PLAN, D | Revisão de fecho, cuidados, entrega, custos/tempos e passos finais persistem; liberta reservas/ferramentas sem consumo automático. |
| PROJ-06 | Repetir e arquivar | V | D, PLAN, PKG | Duplicação limpa execução/reservas e contagens manuais anteriores; arquivo/reabertura conservam história e não recriam reservas antigas. |
| WORK-01 | Utilização durante o trabalho | V | WORK, REF | Contexto/cursor, cor/símbolo/região, teclado, restantes por tipo, marcadores e fecho/reopen testados no nativo integrado; alternativa manual existe sem esquema. Não afirma todos os DPI Windows. |
| WORK-02 | Regras de progresso | V | WORK, D, REF | Denominador real, tipos separados, deduplicação e revisão próprios; navegar/anotar não altera stock nem confirma pontos. |
| CALC-01 | Dimensão física | V | FAB, BOUNDS, GEOM | Área útil automática de retângulos/polígonos simples medidos: união descontada uma vez, contorno/margens/regiões e janelas das sobras. Legado incompleto fica desconhecido; zero útil é explícito. Corte irregular físico continua manual. |
| CALC-02 | Estimativa de linha | V | THREAD, D | Geometria por tipo, avesso/início/fim/desperdício, filamentos/receitas, conversões e calibração com histórico imutável verificados. |
| CALC-03 | Quantidades desconhecidas | V | D, THREAD, PLAN | Desconhecido distingue-se de zero; falta de unidade/conversão/tempo mantém resultado desconhecido e não cria compra automática. |
| CALC-04 | Tempo e previsões | V | PLAN | Escolha manual/medida, taxas por tipo, restantes manuais sem grelha e horas/finituras persistem; percentagem não fabrica velocidade. |
| OUT-01 | Documentos de trabalho | IV | OUT, THREAD, PLAN | Relatórios de projeto, esquema/PNG, legendas de misturas, notas/progresso e listas existem; todas as combinações documentais não auditadas. |
| OUT-02 | Paginação | V | OUT, PDFOPT | Mosaicos A4/Letter, mapa/sobreposição/fronteiras; orientação real e margens 5–40 mm integradas, oito PDFs parseados e jornada nativa isolada. |
| OUT-03 | Escala física | V | OUT, PLAN | PDF real com geometria/densidades efetivas, calibração 100 mm e correção implementados; precisão da impressora não é prometida. |
| OUT-04 | Impressão e etiquetas | V | LABEL, INV, OUT | Etiquetas de material/lote/retalho/local e projeto sem esquema; dimensões fixas/A4/Letter, IDs/texto completos e preflight de overflow antes do destino. PDF real nativo; impressão física não certificada. |
| DATA-01 | Pesquisa local | IV | UI, INV, PERF | Pesquisa transversal e por área funciona offline, incluindo notas/códigos; cobertura semântica de todas as entidades ainda não auditada. |
| DATA-02 | Importação de inventário | IV | SQL, DESC, SUPPORT | CSV/TSV/mapeamento/correção/transação e modelos vazios IT/EN implementados; falta fixar prova integrada final do novo percurso de download. |
| DATA-03 | Exportação aberta | V | OPEN | 12 exportações reais inventário/movimentos/compras/projetos × CSV/TSV/JSON, cancelamento e decimais IT verificados sem mutação. |
| DATA-04 | Pacote de projecto | IV | PKG, WORK | Pacote/privacidade/remapeamento/restauro/reexportação passaram; marcadores opcionais/históricos têm testes de domínio novos, sem jornada Windows final. |
| DATA-05 | Dados antigos do programa fornecido | IV | ENG | Importação legada validada, original preservado e vínculos externos destacados; relatório completo de perdas sobre acervo antigo real ainda não demonstrado. |
| MODEL-01 | Entidades e relações | IV | D, SQL, THREAD, PLAN, ATOMIC | Entidades centrais/receitas/acabamentos/sessões/anexos representados; conceitos ainda parciais identificados nas linhas REF/THR. |
| MODEL-02 | Invariantes técnicas | V | D, SQL, SEC, WIN-LOCK, WIN-UPGRADE | IDs, precisão, versões, retry, transações e semântica temporal verificados; segunda instância e atualização/reinstalação reais passaram no Windows 0.4. |
| STORE-01 | Dados locais | V | SQL, DRAFT, ATOMIC | SQLite/BLOB, acknowledgement, rollback e reabertura reais; futuro/corrupção não substituem silenciosamente dados por biblioteca vazia. |
| BACK-01 | Backup completo | V | BACK, SQL, WIN-OLD | Snapshot transacional completo, validação, retenção após sucesso e segundo destino indisponível exercitados. |
| BACK-02 | Restauro seguro | IV | BACK, SQL, SPACE | Preview/integridade/backup anterior/rollback e preflight explícito de espaço integrado com falha fechada; disco cheio/ACL Windows reais não ensaiados. |
| BACK-03 | Transferência para outro computador | B | WIN-OLD, SQL | Backup portátil/restauro local provados; segundo PC/perfil Windows para o fluxo completo não está disponível. |
| PRIV-01 | Privacidade | IV | SEC, PKG, SUPPORT | Sem telemetria, partilha explícita e diagnóstico com preview/whitelist sem registos/ficheiros/caminhos implementados; percurso integrado final ainda por fixar. |
| ARCH-01 | Escolha da stack | V | DOC, ENG, SQL | Escolha Electron/Vue/SQLite e separação UI/domínio/motor/persistência/exportação documentadas com contratos, tradeoffs e rollback. |
| ARCH-02 | Funcionamento desktop | V | WIN04, WIN-UPGRADE, SEC | Aplicação instalada 0.4 abre sem servidor de desenvolvimento; recursos locais, atualização real e SQLite/BLOB/reopen comprovados no Windows 10. |
| SEC-01 | Ficheiros e conteúdo | IV | SEC, ATOMIC, PKG | Negativos reais de protocolo/IPC/tamanho/digests/pacotes passam; avaliação adversarial limitada aos caminhos e formatos exercitados; não é fuzzing universal. |
| SEC-02 | Fronteira da interface | V | SEC, ATOMIC, WIN04, WIN-LOCK | Sandbox OS observado nos processos Windows 0.4, contextIsolation/CSP/IPC verificados; Linux recente também confirmou Seccomp/NoNewPrivs. Provas Linux antigas só funcionais. |
| SEC-03 | Dependências e manutenção | IV | DOC, SEC | Dependências fixadas e licenças preservadas; conteúdo final 0.4 auditado. Monitorização contínua de novos avisos de segurança não foi estabelecida. |
| OFF-01 | O que deve funcionar sem rede | IV | UI, SEC, WIN-OLD | Jornadas locais sem HTTP e host Windows anterior funcionaram; todos os fluxos com bloqueio OS/instalação limpa ainda não demonstrados. |
| OFF-02 | Recursos incluídos | V | ENG, REF, PKG04 | Motor, paleta, PDF, codecs, fontes e runtime locais presentes no ASAR auditado; jornadas do candidato 0.4 passaram sem pedidos HTTP. |
| WIN-01 | Destino e compatibilidade | B | WIN-OLD | Host Windows 10 Home x64 build 19045 conhecido; referência Windows 11 limpa e mínimos finais sem ambiente de validação. |
| WIN-02 | Instalador .exe | V | WIN04, PKG04 | Instalador NSIS x64 0.4 passou auditoria e instalação/atualização/reinstalação no host Windows 10; não generaliza a Windows 11 limpo. |
| WIN-03 | Runtimes | IV | WIN-OLD, DOC | Electron inclui runtime; não exige WebView2/Python. Máquina controlada sem runtimes de desenvolvimento continua indisponível. |
| WIN-04 | Actualização e desinstalação | V | WIN-UPGRADE, SEC | Atualização real 0.2→0.4, edição UI/reopen, reinstalação 0.4 e desinstalação passaram. Estado/originais sintéticos preservados; app/registro/atalhos removidos. |
| WIN-05 | Integridade e assinatura | IV | PKG04, DOC | Manifesto/hashes e conteúdos exatos 0.4 verificados, 51 dependências/74 avisos. Sem certificado de assinatura; não existe identidade de editor verificado. |
| A11Y-01 | Utilização confortável | IV | UI, WORK, PLAN | Teclado, diálogos e alguns checks de acessibilidade reais; janela ajusta área útil, mas DPI Windows 100–200% e auditoria integral não concluídos. |
| PERF-01 | Hardware e dimensão dos dados | V | PERF, WIN-PERF | Fixture 5000 materiais/lotes, 20000 movimentos, 50 projetos/51 anexos e grelha 500×500 verificada no Windows 0.4; também 20.000 cores versionadas ensaiadas separadamente em Node/Linux. |
| PERF-02 | Metas e medição | V | PERF, WIN-PERF | Oito grupos Windows 0.4 passaram: arranque 2,12/1,84/1,81 s, pesquisa p95 32 ms/filtro 66 ms. Memória amostrada 1731 MiB; não certifica hardware mínimo. |
| DEL-01 | Produto utilizável | IV | WIN04, PKG04, DOC | Produto 0.4 verificado no host e instalador entregue; ficam explícitos os aceites externos indisponíveis, sem declaração universal de completude. |
| DEL-02 | Código e manutenção | V | DOC, ENG, PKG04 | Fonte/lock, arquitetura, motor, formatos, guias, licenças, inventário auditado do pacote e procedimento de build/rollback documentados. |
| DEL-03 | Matriz de rastreabilidade | V | LEDGER | 111 requisitos funcionais e 67 AC reconciliados mecanicamente; estados distinguem implementação, prova local, pacote e ambiente indisponível. |
| DEL-04 | Resposta final do Codex | IV | DOC | Relatório de entrega e instruções em STATUS/README; a resposta final acompanha o candidato e não substitui os limites deste registo. |

## Critérios de aceitação

| ID | Requisito | Estado | Prova | Cobertura e limite atual |
|---|---|---|---|---|
| AC-01 | Primeiro arranque offline em italiano | IV | EXAMPLE, WIN-OLD | Arranque vazio/default IT e criação real testados; instalação 0.4 num PC limpo com bloqueio de rede OS não ensaiada. |
| AC-02 | Mudar para inglês durante edição | V | I18N, PLAN, WORK | Formulários reais trocaram IT/EN durante edição sem perder valores, seleções ou texto próprio. |
| AC-03 | Registar material incompleto | V | D, SQL, EXAMPLE | Material incompleto/null persiste e não produz suficiência fictícia; exemplo distingue desconhecido/estimado/zero. |
| AC-04 | Códigos 001 e B5200 | V | D, DESC, OPEN | 001/B5200 preservados em criação, pesquisa, CSV/TSV/JSON e reimportação; códigos tratados como texto. |
| AC-05 | Mesma cor em dois lotes | V | SQL, INV | Referência comercial partilhada com lotes/locais distintos; CSV repetido não funde quantidades físicas indevidamente. |
| AC-06 | Sobras aproximadas | V | D, THREAD | Confiança estimada preservada em transferência/conversão; informação ausente continua desconhecida. |
| AC-07 | Kit aberto e decomposto | V | KIT | Abertura verificada remove um kit, cria só componentes encontrados e conserva custos separados; retry não duplica. |
| AC-08 | Ferramenta atribuída | V | TOOLS, D | Ferramenta atribuída/emprestada fica indisponível sem consumo; devolução e conflitos têm regressões. |
| AC-09 | Transferir linha de caixa para saco de projecto | V | D | Transferência parcial conserva físico e referências; não transfere implicitamente reservas de outro projeto. |
| AC-10 | Corte rectangular com sobras | V | FAB | Corte/retalhos/desperdício/origem/custos e reversão condicionada exercitados no domínio e UI local. |
| AC-11 | Peça com área suficiente mas lado curto | V | FAB, D | Encaixe verifica os dois lados: área suficiente não compensa largura curta. |
| AC-12 | Importar CSV italiano | V | SQL, DESC | CSV italiano com vírgula decimal/delimitador, codificação e descritores é revisto antes de aplicar. |
| AC-13 | Cancelar importação | V | SQL, ATOMIC | Cancelar preview não escreve; erro na gravação de lotes/anexos reverte metadata/BLOB/owner sem efeitos parciais. |
| AC-14 | Reimportar ficheiro | V | SQL, INV | Digest repetido exige escolha; idempotência distingue retry da decisão explícita de importar novamente. |
| AC-15 | Criar esquema a partir de imagem | V | ENG, PERF, WIN-OLD | Motor real em worker e pacote Windows anterior gerou grelha com parâmetros/proveniência e persistência reais. |
| AC-16 | Imagem com transparência | V | ENG, WIN-OLD | Na política alpha predefinida, alpha abaixo de 128 vira vazio e branco opaco continua ponto; remoção/composição são escolhas explícitas. Jornada Windows anterior preservou células transparentes. |
| AC-17 | Cancelar geração e iniciar outra | V | ENG, PERF | Cancelamento/reinício real e IDs de trabalho impedem resposta obsoleta de substituir o preview válido. |
| AC-18 | Usar apenas cores existentes | V | ENG | Inventário exclusivo usa materialId e holdings elegíveis; 5000 cores possuídas e preferência têm regressões reais. |
| AC-19 | Editar e desfazer | V | ENG, WORK | Geometria, paleta e contagens com undo/redo testadas; canvas real confirmou marcação por tipo/cor e undo/redo. |
| AC-20 | Importar PDF sem estrutura reconhecida | V | REF, WIN-OLD | PDF real multipágina permanece documento com anotações, sem grelha ou contagem automática inventada. |
| AC-21 | Criar projecto do esquema | IV | THREAD, FAB, D | Projeto/pin/necessidades/tecido associam-se corretamente no domínio e fluxos separados; jornada conjunta final ainda parcial. |
| AC-22 | Gerar lista de compras | V | D, THREAD | Faltas agregadas, reservas de terceiros e arredondamento de embalagem conhecidos testados; desconhecido não gera compra automática. |
| AC-23 | Recepção parcial e repetição de clique | V | D, SQL | Só a receção parcial entra no físico; retry não duplica e falha de transação mantém o estado anterior. |
| AC-24 | Marcar a mesma região duas vezes | V | WORK, D | Marcar a mesma primitiva/região deduplica; total real exclui vazios e stock/movimentos permanecem iguais. |
| AC-25 | Fechar e retomar | V | WORK, DRAFT, REF | Fecho nativo/reabertura recuperaram cursor/contexto, progresso, referências e rascunhos; prova Linux, não novo instalador Windows. |
| AC-26 | Mudar desenho de projecto em curso | V | REVIMP, WIN04 | Jornada Windows final verifica comparação, cancelamento, stale/refresh, transporte opt-in por correspondência, histórico e stock preservado. |
| AC-27 | Concluir projecto | V | PLAN, D, TOOLS | Fecho revê passos/necessidades, liberta reservas/ferramentas e conserva consumo real sem inventar entradas. |
| AC-28 | Duplicar projecto concluído | V | D, PLAN, PKG | Duplicação limpa progresso, reservas, movimentos e restantes manuais; mantém configuração/tarefas reutilizáveis. |
| AC-29 | Exportar esquema multipágina | V | OUT, ENG | Mosaicos e fronteiras de primitivas têm testes; sobreposição é identificada e não altera contagem fonte. |
| AC-30 | Exportar em ambos os idiomas | IV | OUT, I18N | Relatórios e legendas IT/EN exercitados em percursos concretos; não há revisão linguística de todas as combinações exportáveis. |
| AC-31 | Não existir impressora | V | OUT, WIN-OLD | PDF real guardado por destino nativo sem impressora; não depende de uma impressora para exportar. |
| AC-32 | Pesquisa e ajuda sem Internet | V | UI, PERF, EXAMPLE | Pesquisa/ajuda local percorridas com recursos incluídos e zero HTTP observado. |
| AC-33 | Retirar exemplos | V | EXAMPLE | Fechar/retomar exemplo separado deixa SQLite e backup pessoais intactos; exemplos nunca são misturados no inventário real. |
| AC-34 | Stock elegível de 24 m, reservas A=10 m e B=8 m | V | D | 24 m elegíveis, A=10 e B=8: físico 24, disponível 6. |
| AC-35 | Consumir 4 m da reserva A | V | D | Consumir 4 de A: físico 20, A=6, B=8, disponível 6; nenhuma subtração duplicada. |
| AC-36 | Libertar 3 m da reserva A restante | V | D | Libertar 3 de A mantém físico 20 e aumenta disponível para 9. |
| AC-37 | Q físico elegível=10 m, sem reservas de terceiros; necessidades restantes A=8 m e B=7 m | V | D | Procura A=8+B=7 partilha 10 m uma vez: falta 5. |
| AC-38 | No cenário anterior, as únicas reservas são A=4 m e B=3 m | V | D | Reservas próprias A=4+B=3 deixam livre 3, mantendo falta agregada 5. |
| AC-39 | Repetir confirmação de consumo por retry | V | D, SQL, ATOMIC | Retry idêntico aplica uma vez; assinatura diferente rejeita. Replay posterior preserva trabalho mais recente. |
| AC-40 | Contagem física inferior às reservas | V | COUNT, D | Contagem parcial e conflito por projeto, preservação/redistribuição explícita, necessidades mínimas e transação/replay; provas autor e revisão independente. |
| AC-41 | Exemplos de CALC-01 | V | FAB, D | Exemplos obrigatórios 140×140, over-two/over-one, eixos distintos, margens e lado curto passam. |
| AC-42 | Mistura de dois componentes | V | THREAD, PKG | Misturas expandem para materiais componentes com filamentos inteiros; não criam stock de mistura fictício. |
| AC-43 | Embalagem com conversão desconhecida | V | D, THREAD | Sem conversão de embalagem válida, necessidades/compra mantêm desconhecido em vez de zero fabricado. |
| AC-44 | Moedas distintas | V | D, PLAN, KIT | Totais e custos históricos separados por moeda; nenhum câmbio automático ou duplo custo de kit. |
| AC-45 | Encerramento inesperado | IV | DRAFT, SQL | Draft acknowledged sobreviveu saída imediata; fecho pendente foi descarregado. Falha abrupta abrangente do novo pacote Windows não executada. |
| AC-46 | Disco cheio ou pasta sem escrita | IV | SQL, ATOMIC, BACK | Falhas reais injetadas em SQLite/IndexedDB e destino externo mantêm rollback/erro; disco cheio/ACL Windows reais não testados. |
| AC-47 | Motor falha ou bloqueia | IV | ENG, PERF | Erros, worker cancelável e timeout existem; bloqueio prolongado/crash no pacote final ainda não ensaiado. |
| AC-48 | Backup durante utilização | V | BACK, SQL | Backup lê estado+BLOB numa transação consistente e é validado; restauração real conserva relações. |
| AC-49 | Backup corrompido/incompatível | V | BACK, SEC, SQL | Corrompido/futuro/shape inválida recusados antes de substituir; SQLite destino permanece intacto. |
| AC-50 | Pacote com caminhos perigosos | V | SEC, PKG | Traversal, nomes perigosos e capacidade de importação forjada recusados; nenhum caminho externo é interpretado como destino. |
| AC-51 | Segunda instância | V | WIN-LOCK, SEC | Segunda execução real com o mesmo perfil saiu 0; janela original restaurada, um evento de segunda instância e SQLite/originais inalterados. |
| AC-52 | Instalação em Windows limpo sem rede | B | WIN-OLD | Sem Windows 11 limpo/controlado e offline disponível; host de desenvolvimento não satisfaz o cenário. |
| AC-53 | Remover acesso ao programa original | IV | ENG, WIN-OLD | Motor/copias locais empacotados e execução real funcionam; acesso OS ao diretório original não foi removido no ensaio final. |
| AC-54 | Copiar pacote por USB para outro perfil/PC | B | WIN-OLD | Transferência por USB para outro perfil/PC não executada; não inferida de um instalador que abriu no mesmo host. |
| AC-55 | Restaurar backup noutro perfil/PC | B | SQL, WIN-OLD | Restauro local real passa; segundo perfil/PC Windows independente ainda indisponível. |
| AC-56 | Actualizar instalação com dados | V | WIN-UPGRADE, SEC | Atualização instalada 0.2→0.4 preservou estado/BLOB, registro/atalhos/ASAR e passou edição UI/reopen. |
| AC-57 | Reinstalar e desinstalar | V | WIN-UPGRADE | Reinstalação 0.4 do mesmo artefacto preservou estado/originais/atalhos; desinstalação retirou app/registro/atalhos, conservando o perfil sintético. |
| AC-58 | Utilizador Windows com acentos e espaços | B | WIN-OLD | Caminho de instalação com acento/espaço foi testado; não equivale a conta Windows distinta com perfil acentuado. |
| AC-59 | Teclado e escalas de ecrã | IV | UI, WORK | Teclado/diálogos e janela adaptada à área útil; percursos Windows 100/125/150/200% ainda não certificados. |
| AC-60 | Rede bloqueada durante todos os percursos | IV | SEC, UI, WIN-OLD | Sem HTTP nas jornadas e bloqueio de pedidos no produto; rede bloqueada ao nível OS em todos os percursos Windows pendente. |
| AC-61 | Dados representativos de PERF-01 | V | PERF, WIN-PERF | Oito grupos aprovados em Windows 0.4 com workload completo, readback e memória amostrada; falhas históricas permanecem documentadas. |
| AC-62 | Segurança dos ficheiros importados | IV | SEC, ATOMIC | Tipos/dimensões/tamanho/protocolo/IPC/pacotes têm negativos; conteúdo ativo e descodificadores não têm auditoria universal. |
| AC-63 | Formato nativo de versão futura | V | SEC, ENG | Schema/formato futuro rejeitado sem gravar sobre a informação; validações de revisão/draft/pacote conservam versão. |
| AC-64 | Revisão final do pacote | V | PKG04, DOC | Auditoria 0.4 aprovada: allowlist explícita, fontes/bundle exatos, versões/licenças e hashes.0.3 reprovado permanece isolado; não é certificação de segurança absoluta. |
| AC-65 | 24 m físicos, 2 m bloqueados e 18 m reservados sobre material elegível | V | D | 24 físicos−2 bloqueados=22 elegíveis; 18 reservados deixam 4 disponíveis. |
| AC-66 | Cenário de AC-38, acrescentando reserva de 2 m para C, fora da lista A+B | V | D | Reserva externa C=2 aumenta a falta de A+B para 7 e mantém C intacta. |
| AC-67 | Runtime necessário ausente ou abaixo da versão mínima, numa VM controlada | B | WIN-OLD | Electron inclui runtime, mas não há VM controlada sem runtimes externos para executar o cenário exigido. |

## Cinco lacunas funcionais tratadas e gates restantes

THR-03, GEN-02, EDIT-02, EDIT-06 e CALC-01 foram integrados e passaram também no candidato Windows final. Mantêm-se as provas independentes e as regressões que corrigiram identidades anónimas, contornos côncavos, bypass de corte, margens e backups alterados. O V continua limitado às superfícies registadas.

1. **Distribuição 0.4:** conteúdo/hashes e lifecycle passaram no host. Sem assinatura digital e sem ambiente Windows 11 limpo. O pacote 0.3 reprovado continua isolado.
2. **Verificação integral:** os IV de A11Y, I18N, entidades/formulários, documentos, pesquisa e restantes percursos conservam os limites de cada linha. O glossário curto não equivale à auditoria linguística integral.
3. **Limites de produto explícitos:** máscara cromática não é recorte semântico; corte físico irregular permanece manual; busca de posições é limitada; substituição aproximada não prova equivalência de marca; regenerar uma revisão partilhada com `provenance.palette.catalogue` requer catálogo e configurações originais. A projeção reduzida inclui o DMC incorporado selecionado na UI; proveniência antiga sem `catalogue` e o fallback DMC/inventário mantêm o contrato anterior.

GEN-03 entrada por centímetros continua condicional: dimensões físicas são derivadas da grelha e densidade, sem fingir um controlo de entrada em cm. OCR/PES/DST/leitura de códigos/IA/sincronização continuam ausentes e não são anunciados.

## Provas externas ainda indisponíveis

BASE-09, WIN-01, BACK-03 e AC-52/54/55/58/67 dependem de Windows 11 limpo/offline, segundo perfil/PC ou perfil Windows com acentos. Um caminho de instalação com acento não prova um perfil acentuado. Electron incluir Chromium/Node não substitui AC-67. AC-60 exige o cenário de rede bloqueada ao nível OS; zero HTTP nas jornadas e uma denylist no produto são provas mais estreitas.

Não desinstalar runtimes partilhados do computador principal para simular máquina limpa. O estado B identifica o ambiente ausente; não transfere para ele as lacunas funcionais listadas acima.

## Desempenho do candidato Windows 0.2.0

`performance-4yuSmx/result.json`, 27-10-2026 12:32–12:34 UTC: Windows 10.0.19045 x64, Ryzen 5 5600H, 12 CPUs lógicas, aproximadamente 16 GB RAM. Executável `release/win-unpacked/Ricamo.exe`, versão empacotada 0.2.0; os hashes de core/desktop/dist no ASAR correspondem ao snapshot do workspace. ASAR SHA-256 `ac023028a20a73437f35e1dd8025a761252e6c45c39381a6a1503f94fc356eda`.

Fixture: 5000 materiais/lotes, 20000 movimentos, 50 projetos, 51 anexos, quantidades desconhecidas/estimadas e desenhos até 500×500/80 cores. Os oito grupos passaram, com SQLite/BLOB/reopen, PDF e worker reais; zero consoleErrors, remoteRequests e failedRequests.

| Operação | Tempo observado |
| --- | --- |
| Arranque, três processos | 4,251 / 3,405 / 3,051 s |
| Pesquisa / filtro, p95 | 32,0 / 80,9 ms |
| Gravar progresso | 2,884 s |
| Worker 500×500 / gravar desenho gerado | 1,571 / 4,266 s |
| Backup real | 6,925 s |

A soma máxima dos working sets amostrados foi 1433 MiB: não é o pico real nem prova para 8 GB. A primeira abertura não implica cache fria do sistema operativo. Os resultados não certificam Windows 11, instalação limpa, rede bloqueada pelo OS ou futuros snapshots. A tentativa anterior não iniciou a aplicação por um erro do verificador ASAR que usava separadores `/` no Windows; corrigir o runner para `path.join` resolveu a verificação, e as fontes já estavam presentes.

## Desempenho histórico preservado

As medições abaixo pertencem a snapshots/ficheiros diferentes. Não são resultados do novo instalador nem podem ser somadas ou comparadas sem ter em conta filesystem, concorrência e identidade de código.

| Ensaio | Superfície / resultado | Limites |
| --- | --- | --- |
| performance-R8POk4 → performance-3JHhTo | Electron Linux em cópia isolada: projetos, mediana quente 2212 → 145 ms; pesquisa p95 50 ms; filtro p95 103 ms. | Snapshot antigo de 148 testes; duas de três amostras de arranque excederam 5 s. |
| performance-BzAoz6 | Repetição isolada: arranques 4683/3916/3625 ms; projetos p50 113 ms; pesquisa/filtro p95 65/116 ms; oito grupos funcionais passaram. | Não apaga falhas anteriores; geração guardou em 4565 ms e progresso em 2437 ms antes da transação única. |
| performance-2fg8Kk | Root sobre montagem Windows/WSL: arranques 6,92/7,43/7,70 s; pesquisa p95 62,9 ms; filtro p95 123,5 ms; guardar geração 11,14 s. | **Falhou gates de arranque/progresso**; progresso excedeu 15 s mas persistiu corretamente. Não é ensaio Windows nativo. |
| Probe do Repository | Mesmo fixture: progresso ~0,86 s em filesystem Linux versus ~10,07 s na montagem Windows/WSL; load ~79 versus ~1155 ms. | Diagnóstico de armazenamento, não uma comparação do pacote instalado nem prova causal completa. |

Fixture: 5000 materiais/lotes, 20000 movimentos, 50 projetos com anexos, 51 BLOBs, quantidades exatas/estimadas/desconhecidas, esquema pequeno e 500×500/80 cores, PDF real. Host observado AMD Ryzen 5 5600H, 12 processadores lógicos, aproximadamente 7,75 GiB de RAM, Node 24.22.1, Electron 45 Linux/WSL. A geração usa CPU; não requer GPU dedicada. Memória somada amostrada (~1,6 GiB nos ensaios antigos) não é pico verdadeiro nem consumo exclusivo, pois páginas podem ser partilhadas.

Os resultados brutos guardam fixture, hashes de árvores/executável e detalhes de medição. O runner atual regista identidade e recusa atribuir um pacote divergente ao código medido. Uma nova medição Windows deve usar o candidato exato e dados sintéticos separados, sem dados pessoais. A nova medição Windows 0.4, descrita em STATUS, inclui as transações atómicas e integrações finais; não atribui uma melhoria causal comparando estes ensaios históricos.

## Repetição e publicação

Executar a suite integrada, build e os runners relevantes após as integrações finais. Repetir o pacote Windows exato, incluindo geração, documentos, guardado/reabertura, cancelamento, backup/restauro e update/reinstall/uninstall quando disponíveis. Manter o instalador anterior e backup compatível para rollback; uma versão antiga deve recusar dados futuros sem os modificar.

A contagem de testes é contexto, não uma percentagem de conclusão. Nenhuma destas linhas declara “sem bugs”, conformidade WCAG automática, compatibilidade com qualquer Windows, catálogo oficial completo, impressão fisicamente calibrada ou criptografia de backup.
