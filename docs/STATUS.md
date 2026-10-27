# Ricamo implementation record

## Mission and authority

2026-10-27, 08:53–14:53 UTC: build and verify an offline Windows embroidery application from the supplied master prompt. Italian and English, integrated Stitch Studio engine, inventory, project planning and execution, backups, PDF, Windows installer. User authorizes implementation and GitHub pushes, one changed file per commit and immediate push. No unrelated project changes, cloud service deployment or production data access.

Initial revision: a6daa26, main, clean. Runtime: WSL Linux with Node 24.22.1 and Windows Node 24.22.1. Host is Windows 10 Home x64 build19045; Windows Sandbox is unavailable. Windows11 clean-machine acceptance remains unavailable, separate from local installed-product testing.

## Decisions

- Electron 45 (bundled Chromium/Node) avoids an external WebView runtime download. Vue 3 for a new interface. SQLite via bundled Node for transactional local persistence. CPU-only generation in a worker from the original TypeScript engine.
- Original engine: MIT, Rui 2026; DMC RGB compilation: MakeBead CC BY 4.0, approximate colours. Existing consumption assumptions are not inventory conversions. Original limit is 400×400 / 72 colours; any extension must have its own tests.
- New task-oriented visual system: warm paper surfaces, deep ink text, restrained aubergine actions, readable tables, progressive forms. No old CSS or interface components copied.
- Use vt-deliver and vt-design, followed by vt-verify/app testing. The installed engineering-loop entrypoint lacks its required reference resources; no claim of its full orchestration protocol. Independent bounded planning/review may use agents, authorized by the master prompt. Root serializes repository writes and all commits/pushes.
- Data starts empty. Example content, if provided, stays explicitly separate.

## Ordered work and evidence

As of approximately09:37 UTC, first integrated implementation is running; the six-hour mission continues.

1. Real Electron45 startup verified on Linux with SQLite and sandboxed renderer; production assets served through restricted `ricamo://app` protocol. Windows installer configured; build/runtime verification next.
2. Catalogue, lots, explicit stock movements, reservations, location hierarchy, suppliers, partial purchase receipt, geometric fabric cutting and kit opening implemented. Browser journeys verified quantities, conservation, persistent leading-zero codes, unknown quantities, material merges, filters and real PDF storage labels.
3. Projects, checklists, manual and structured progress, sessions/timer, project requirements, editable geometric thread estimates, immutable scheme revisions, drawing/full/half/backstitch tools, real worker generation and PDF/PNG/native scheme export implemented. Browser verified blank-to-project-to-progress-to-PDF and image generation; progress does not consume inventory.
4. IT/EN switching, local help, CSV preview/mapping/duplicates, managed attachments, complete backups and previewed restore implemented. Browser verified imported code001,1.5m and monetary amounts, backup cancel/restore and corrupt rejection. Modal language access, live status labels and original project currency labels repaired after independent review; rerender check pending on latest build.
5. Seventy Node tests pass: domain, engine and worker, SQLite transactions/reopen/idempotency, backup, CSV, estimates and eight security regression cases. Latest500×500/80-colour generation approximately1.03s; RSS154→209MiB is endpoint memory, not peak or Windows evidence. Synthetic domain5000materials/20000movements/50projects validation and commands measured separately; final complete-app benchmark pending.
6. Independent review reproduced and repairs cover arbitrary local-file renderer access, restore-preview token race, future database writes, malformed restore shapes, dangling attachments, scalar buffer allocation and inherited command dispatch. Actual Electron sentinel fetch/XHR/iframe now blocked; wrong-frame IPC rejected. No claim beyond tested boundaries.

Current next slices: actual Windows build/install/restart/offline paths; bundled PDF reference reader/annotations; editor draft recovery; advanced inventory tools/customfields/batch workflows; remaining master-prompt traceability and acceptance coverage. Further requirements remain open and must not be represented as complete.

## Evidence limits

No installed Windows package or clean Windows11 environment has yet been verified. Preliminary UI journeys passed in Chromium and actual Electron Linux; final integrated regression and distribution gates remain open. No digital signature or universal absence-of-bugs claim. PDF reference annotations and draft recovery are still being implemented.

## Continuation

Inspect current Git state and this record. Read the user's full master prompt at its supplied Downloads path and source at its supplied Stitch Studio path when needed. Scratch execution briefs are in /tmp/ricamo-mission. Publish each source change through an individually reviewed one-file commit, followed immediately by push.
